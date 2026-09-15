"""
AgriSmart AI - Out-of-Distribution (OOD) & Unknown Object Detector
Stage C in the Unified Disease Detection Pipeline.
Rejects non-leaf uploads, random objects, animal/vehicle photos, and unsupported plant species.
"""
from typing import Dict, Any, Tuple
import torch
import torch.nn.functional as F
import numpy as np

class OODDetector:
    """
    Multi-criteria Out-Of-Distribution Detector combining:
    1. Maximum Softmax Probability (MSP)
    2. Helmholtz Free-Energy Score: E(x) = -T * log(sum(exp(l_i / T)))
    3. Shannon Information Entropy: H(p) / log(K)
    4. Foliar Biological Validation from Quality Gate
    """
    def __init__(
        self,
        min_crop_confidence: float = 0.25,
        max_entropy_ratio: float = 0.82,
        energy_threshold: float = -2.5,
        temperature: float = 1.0
    ):
        self.min_crop_confidence = min_crop_confidence
        self.max_entropy_ratio = max_entropy_ratio
        self.energy_threshold = energy_threshold
        self.temperature = temperature

    def evaluate(
        self,
        crop_logits: torch.Tensor,
        quality_assessment: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluates crop logits and quality assessment.
        Returns:
            is_ood (bool)
            ood_score (float, 0.0 to 1.0)
            ood_status (str: "in_distribution" | "out_of_distribution")
            reasons (list of str)
        """
        # Rule 1: Visual quality gate check
        if not quality_assessment.get("is_leaf", True):
            return {
                "is_ood": True,
                "ood_score": 0.95,
                "ood_status": "out_of_distribution",
                "reasons": ["Visual analysis indicates absence of plant foliar tissue (non-leaf upload)."]
            }

        if crop_logits is None:
            return {
                "is_ood": True,
                "ood_score": 1.0,
                "ood_status": "out_of_distribution",
                "reasons": ["Missing neural logits."]
            }

        with torch.no_grad():
            probs = F.softmax(crop_logits / self.temperature, dim=-1).squeeze(0).cpu().numpy()
            logits_np = crop_logits.squeeze(0).cpu().numpy()

        num_classes = len(probs)
        max_prob = float(np.max(probs))

        # Shannon Entropy
        eps = 1e-10
        entropy = -float(np.sum(probs * np.log(probs + eps)))
        max_possible_entropy = np.log(num_classes)
        normalized_entropy = float(entropy / max_possible_entropy) if max_possible_entropy > 0 else 0.0

        # Free Energy Score: -T * log(sum(exp(l_i / T)))
        # In-distribution images have lower (more negative) free energy
        energy = -self.temperature * float(np.log(np.sum(np.exp(logits_np / self.temperature)) + eps))

        reasons = []
        is_ood = False

        if max_prob < self.min_crop_confidence:
            is_ood = True
            reasons.append(f"Crop confidence too low ({max_prob:.2f} < {self.min_crop_confidence:.2f}). Unsupported plant or ambiguous leaf.")

        if normalized_entropy > self.max_entropy_ratio:
            is_ood = True
            reasons.append(f"High prediction uncertainty across crop categories (Entropy {normalized_entropy:.2f} > {self.max_entropy_ratio:.2f}).")

        # Compute normalized OOD score (0.0 = confidently in-distribution, 1.0 = definitely OOD)
        ood_score = max(0.0, min(1.0, (
            (1.0 - max_prob) * 0.5 +
            normalized_entropy * 0.3 +
            (0.2 if not quality_assessment.get("quality_ok", True) else 0.0)
        )))

        ood_status = "out_of_distribution" if is_ood else "in_distribution"

        return {
            "is_ood": is_ood,
            "ood_score": round(ood_score, 4),
            "ood_status": ood_status,
            "max_confidence": round(max_prob, 4),
            "normalized_entropy": round(normalized_entropy, 4),
            "energy_score": round(energy, 4),
            "reasons": reasons
        }
