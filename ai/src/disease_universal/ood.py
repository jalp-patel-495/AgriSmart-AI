"""
AgriSmart AI – Out-Of-Distribution (OOD) & Species Rejection Engine
Implements Free Energy score, Normalized Shannon Entropy,
and Calibrated Confidence Floors to reject non-leaf objects and unsupported plant species.
"""

import math
import torch
import torch.nn.functional as F
from typing import Dict, Any, Tuple, Optional


class UniversalOODDetector:
    """
    Multi-faceted OOD Detector combining:
    1. Free Energy Score: E(x; T) = -T * log(sum(exp(z_i / T)))
    2. Normalized Shannon Entropy: H(p) / log(K)
    3. Maximum Softmax Probability (MSP)
    4. Top-1 vs Top-2 Margin
    """
    def __init__(
        self,
        energy_threshold: float = -2.5,   # Energy > threshold implies OOD
        entropy_threshold: float = 0.82,  # Normalized entropy > threshold implies severe ambiguity
        confidence_floor: float = 0.22,   # Minimum crop confidence required for supported species
        temperature: float = 1.0
    ):
        self.energy_threshold = energy_threshold
        self.entropy_threshold = entropy_threshold
        self.confidence_floor = confidence_floor
        self.temperature = temperature

    def compute_energy(self, logits: torch.Tensor) -> float:
        """Computes Helmholtz free energy score."""
        with torch.no_grad():
            t_logits = logits / self.temperature
            energy = -self.temperature * torch.logsumexp(t_logits, dim=-1).item()
        return float(energy)

    def compute_entropy(self, probs: torch.Tensor) -> Tuple[float, float]:
        """Computes raw Shannon entropy and normalized entropy [0, 1]."""
        with torch.no_grad():
            p = torch.clamp(probs, min=1e-8)
            raw_entropy = -torch.sum(p * torch.log(p), dim=-1).item()
            num_classes = p.shape[-1]
            max_entropy = math.log(max(num_classes, 2))
            norm_entropy = float(raw_entropy / max_entropy)
        return float(raw_entropy), norm_entropy

    def evaluate_crop_prediction(
        self,
        crop_logits: torch.Tensor,
        crop_probs: torch.Tensor,
        crop_names: list
    ) -> Dict[str, Any]:
        """
        Evaluates Stage A crop logits and probabilities for OOD status.
        """
        energy = self.compute_energy(crop_logits)
        raw_ent, norm_ent = self.compute_entropy(crop_probs)
        
        # Sort top-k
        sorted_probs, sorted_indices = torch.sort(crop_probs, descending=True)
        top1_idx = int(sorted_indices[0].item())
        top1_prob = float(sorted_probs[0].item())
        top1_crop = crop_names[top1_idx]
        
        top2_prob = float(sorted_probs[1].item()) if len(sorted_probs) > 1 else 0.0
        top2_idx = int(sorted_indices[1].item()) if len(sorted_indices) > 1 else -1
        top2_crop = crop_names[top2_idx] if top2_idx >= 0 else None
        
        margin = top1_prob - top2_prob

        # Decision rules
        is_ood = False
        rejection_reasons = []

        # Rule 1: Energy score exceeds in-distribution envelope
        if energy > self.energy_threshold:
            is_ood = True
            rejection_reasons.append(f"Free energy ({energy:.2f}) exceeds threshold ({self.energy_threshold:.2f})")

        # Rule 2: Normalized entropy indicates flat probability distribution
        if norm_ent > self.entropy_threshold:
            is_ood = True
            rejection_reasons.append(f"Normalized entropy ({norm_ent:.2f}) exceeds threshold ({self.entropy_threshold:.2f})")

        # Rule 3: Top confidence below statistical floor
        if top1_prob < self.confidence_floor:
            is_ood = True
            rejection_reasons.append(f"Top crop confidence ({top1_prob*100:.1f}%) below confidence floor ({self.confidence_floor*100:.1f}%)")

        ood_score = round(max(0.0, min(1.0, (norm_ent * 0.5) + (max(0.0, energy + 10.0) / 10.0) * 0.5)), 4)
        ood_status = "out_of_distribution" if is_ood else "in_distribution"

        return {
            "is_ood": is_ood,
            "is_supported": not is_ood,
            "ood_status": ood_status,
            "ood_score": ood_score,
            "rejection_reason": "; ".join(rejection_reasons) if rejection_reasons else None,
            "energy": round(energy, 4),
            "normalized_entropy": round(norm_ent, 4),
            "top_crop": top1_crop,
            "top_crop_confidence": round(top1_prob, 4),
            "second_crop": top2_crop,
            "second_crop_confidence": round(top2_prob, 4),
            "confidence_margin": round(margin, 4)
        }
