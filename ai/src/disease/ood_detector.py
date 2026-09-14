"""
AgriSmart AI – Model-Based Out-Of-Distribution (OOD) Detector
Uses Free Energy Scoring, Softmax Entropy, and Crop-Level Evidence
to detect inputs outside the 7-crop supported agricultural distribution.

OOD evaluation is strictly independent from disease-class confidence:
- A supported crop with low disease confidence is NOT OOD.
- OOD occurs ONLY when there is genuine evidence the image is outside the 7 supported crops.
"""
from typing import Dict, Any, Tuple
import numpy as np
import torch
import torch.nn.functional as F


def calculate_energy_score(logits: torch.Tensor, temperature: float = 1.0) -> float:
    """
    Computes Free Energy Score E(x; T) = -T * logsumexp(logits / T).
    Lower (negative) values indicate strong in-distribution alignment.
    Higher (positive) values indicate unfamiliar OOD feature spaces.
    """
    if logits.ndim == 1:
        logits = logits.unsqueeze(0)
    energy = -temperature * torch.logsumexp(logits / temperature, dim=1).item()
    return float(energy)


def calculate_softmax_entropy(probs: np.ndarray) -> float:
    """
    Computes Shannon Entropy of class probabilities: H(p) = -sum(p_i * log(p_i)).
    Near 0 indicates sharp deterministic classification.
    High values (> 2.5) indicate diffuse predictions.
    Max entropy for 19 classes is ln(19) = 2.9444.
    """
    p = np.clip(probs, 1e-12, 1.0)
    return float(-np.sum(p * np.log(p)))


def evaluate_ood_status(
    logits: torch.Tensor,
    probabilities: np.ndarray,
    crop_confidence: float,
    min_crop_confidence_floor: float = 0.22,
    max_energy_threshold: float = 0.50
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Model-based OOD evaluation strictly using crop-level distribution:
    - Never flags OOD based on disease-class uncertainty within a supported crop.
    - Preserves supported crops whenever crop_confidence >= min_crop_confidence_floor (0.22).
    - Detects genuine anomalies via Free Energy Scoring and non-plant distribution checks.

    Returns:
    - is_ood (bool): True only if input genuinely falls outside supported crop distribution
    - reason (str): Human-readable decision reason
    - metrics (dict): ood_score, ood_status, entropy, energy_score, max_logit, crop_confidence
    """
    entropy = calculate_softmax_entropy(probabilities)
    energy = calculate_energy_score(logits)
    max_logit = float(logits.max().item())

    is_ood = False
    reasons = []

    max_prob = float(probabilities.max())

    # 1. Insufficient crop-level evidence floor (0.22)
    # Uniform random baseline across 19 classes yields a max crop sum of 21.05% (Tomato 4/19).
    # Any input with crop_confidence < 0.22 lacks evidence of belonging to any of the 7 supported crops.
    if crop_confidence < min_crop_confidence_floor:
        is_ood = True
        reasons.append(f"Insufficient crop species evidence ({crop_confidence:.2%} < {min_crop_confidence_floor:.2%})")

    # 2. Extreme diffuse noise / flat distribution check
    # Max theoretical entropy for 19 classes is ln(19) = 2.9444.
    # Completely random or uninformative visual input produces entropy >= 2.89 with no single class reaching 15%.
    if entropy >= 2.89 and max_prob < 0.15:
        is_ood = True
        reasons.append(f"Diffuse noise distribution (entropy {entropy:.2f} >= 2.89, max class {max_prob:.2%} < 15%)")

    # 3. High positive free energy score (abnormal non-image or corrupted feature space)
    if energy > max_energy_threshold:
        is_ood = True
        reasons.append(f"Positive free-energy anomaly (energy {energy:.2f} > {max_energy_threshold:.2f})")

    # 4. Severe neural activation collapse with no crop leadership
    if max_logit < -1.50 and crop_confidence < min_crop_confidence_floor:
        is_ood = True
        reasons.append(f"Compressed neural activation (max logit {max_logit:.2f})")

    primary_reason = "; ".join(reasons) if reasons else "Input features conform to supported agricultural crop distribution."

    # Continuous OOD score [0.0, 1.0]
    if is_ood:
        ood_score = round(float(np.clip(0.70 + 0.30 * (1.0 - (crop_confidence / max(min_crop_confidence_floor, 0.01))), 0.70, 1.0)), 4)
        ood_status = "out_of_distribution"
    else:
        # In-distribution: bounded in [0.05, 0.49]
        ood_score = round(float(np.clip(0.50 * (1.0 - crop_confidence), 0.05, 0.49)), 4)
        ood_status = "in_distribution"

    metrics = {
        "is_ood": is_ood,
        "ood_score": ood_score,
        "ood_status": ood_status,
        "entropy": round(entropy, 4),
        "energy_score": round(energy, 4),
        "max_logit": round(max_logit, 4),
        "crop_confidence": round(crop_confidence, 4)
    }

    return is_ood, primary_reason, metrics
