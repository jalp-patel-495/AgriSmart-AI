"""
AgriSmart AI – Two-Stage Transfer Learning Training Engine
Stage 1: Freeze backbone, train classification head.
Stage 2: Unfreeze upper layers of backbone, fine-tune with reduced learning rate.
Features early stopping, LR scheduler, checkpointing, and macro-F1 tracking.
"""
import copy
import time
from typing import Dict, Any, List, Optional, Tuple
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

from ai.src.disease.models import build_crop_disease_model, CropDiseaseClassifier
from ai.src.disease.losses import build_criterion
from ai.src.disease.evaluate import evaluate_model


def train_single_epoch(
    model: nn.Module,
    train_loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device
) -> float:
    """
    Trains model for one epoch and returns average training loss.
    """
    model.train()
    running_loss = 0.0
    total_samples = 0

    for inputs, targets in train_loader:
        inputs = inputs.to(device)
        targets = targets.to(device)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * inputs.size(0)
        total_samples += inputs.size(0)

    return running_loss / total_samples if total_samples > 0 else 0.0


def train_model_two_stage(
    architecture: str,
    train_loader: DataLoader,
    val_loader: DataLoader,
    class_names: List[str],
    class_weights: Optional[torch.Tensor] = None,
    stage1_epochs: int = 2,
    stage2_epochs: int = 2,
    lr: float = 0.001,
    fine_tune_lr: float = 0.0001,
    weight_decay: float = 0.0001,
    dropout: float = 0.3,
    patience: int = 3,
    loss_function: str = "weighted_cross_entropy",
    device: torch.device = torch.device("cpu"),
    verbose: bool = True
) -> Tuple[CropDiseaseClassifier, Dict[str, Any], Dict[str, Any]]:
    """
    Executes two-stage transfer learning for a given architecture.
    Returns:
    - best_model (with state_dict of best validation Macro-F1)
    - best_metrics: Dict of metrics evaluated at peak Macro-F1
    - history: Dict tracking loss and metrics per epoch
    """
    num_classes = len(class_names)
    model = build_crop_disease_model(
        architecture=architecture,
        num_classes=num_classes,
        pretrained=True,
        dropout=dropout
    )
    model.to(device)

    weights_tensor = class_weights.to(device) if class_weights is not None else None
    criterion = build_criterion(loss_type=loss_function, class_weights=weights_tensor)

    best_macro_f1 = -1.0
    best_weights = None
    best_metrics = {}
    epochs_no_improve = 0

    history = {
        "architecture": architecture,
        "epochs": [],
        "train_loss": [],
        "val_loss": [],
        "val_macro_f1": [],
        "val_accuracy": []
    }

    # ==========================================
    # STAGE 1: Freeze backbone, train head only
    # ==========================================
    if verbose:
        print(f"\n[*] [STAGE 1] {architecture.upper()} - Training Head Only ({stage1_epochs} epochs, lr={lr})")
    model.freeze_backbone()

    trainable_params_s1 = [p for p in model.parameters() if p.requires_grad]
    optimizer_s1 = AdamW(trainable_params_s1, lr=lr, weight_decay=weight_decay)
    scheduler_s1 = CosineAnnealingLR(optimizer_s1, T_max=max(1, stage1_epochs))

    for ep in range(1, stage1_epochs + 1):
        t0 = time.time()
        train_loss = train_single_epoch(model, train_loader, criterion, optimizer_s1, device)
        scheduler_s1.step()
        val_eval = evaluate_model(model, val_loader, device, class_names)
        elapsed = round(time.time() - t0, 1)

        history["epochs"].append(f"S1_E{ep}")
        history["train_loss"].append(round(train_loss, 4))
        history["val_macro_f1"].append(val_eval["macro_f1"])
        history["val_accuracy"].append(val_eval["accuracy"])

        if verbose:
            print(f"    Epoch {ep}/{stage1_epochs} [S1] ({elapsed}s) - Train Loss: {train_loss:.4f} | Val Acc: {val_eval['accuracy']:.4f} | Val Macro-F1: {val_eval['macro_f1']:.4f}")

        if val_eval["macro_f1"] > best_macro_f1:
            best_macro_f1 = val_eval["macro_f1"]
            best_weights = copy.deepcopy(model.state_dict())
            best_metrics = val_eval
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1

    # ====================================================
    # STAGE 2: Unfreeze upper backbone layers, fine-tune
    # ====================================================
    if verbose:
        print(f"[*] [STAGE 2] {architecture.upper()} - Fine-Tuning Upper Layers ({stage2_epochs} epochs, lr={fine_tune_lr})")
    model.unfreeze_upper_layers()

    trainable_params_s2 = [p for p in model.parameters() if p.requires_grad]
    optimizer_s2 = AdamW(trainable_params_s2, lr=fine_tune_lr, weight_decay=weight_decay)
    scheduler_s2 = CosineAnnealingLR(optimizer_s2, T_max=max(1, stage2_epochs))

    for ep in range(1, stage2_epochs + 1):
        if epochs_no_improve >= patience:
            if verbose:
                print(f"    [!] Early stopping triggered at Stage 2 epoch {ep}")
            break

        t0 = time.time()
        train_loss = train_single_epoch(model, train_loader, criterion, optimizer_s2, device)
        scheduler_s2.step()
        val_eval = evaluate_model(model, val_loader, device, class_names)
        elapsed = round(time.time() - t0, 1)

        history["epochs"].append(f"S2_E{ep}")
        history["train_loss"].append(round(train_loss, 4))
        history["val_macro_f1"].append(val_eval["macro_f1"])
        history["val_accuracy"].append(val_eval["accuracy"])

        if verbose:
            print(f"    Epoch {ep}/{stage2_epochs} [S2] ({elapsed}s) - Train Loss: {train_loss:.4f} | Val Acc: {val_eval['accuracy']:.4f} | Val Macro-F1: {val_eval['macro_f1']:.4f}")

        if val_eval["macro_f1"] > best_macro_f1:
            best_macro_f1 = val_eval["macro_f1"]
            best_weights = copy.deepcopy(model.state_dict())
            best_metrics = val_eval
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1

    # Load best observed weights
    if best_weights is not None:
        model.load_state_dict(best_weights)

    return model, best_metrics, history
