"""
AgriSmart AI - Quality Gate Module
Performs foliar image quality validation:
1. Sharpness / Blur detection via Laplacian variance
2. Exposure / illumination check (underexposed or overexposed)
3. Foliar chromatic validity (validates presence of plant tissue / chlorophyll pigments)
"""
from typing import Tuple, Dict, Any
import cv2
import numpy as np

class LeafQualityGate:
    """
    Fast, deterministic computer vision quality gate.
    Prevents corrupt, completely blurred, or non-vegetative images from entering inference.
    """
    def __init__(
        self,
        min_blur_variance: float = 25.0,
        min_brightness: float = 20.0,
        max_brightness: float = 245.0,
        min_green_ratio: float = 0.08
    ):
        self.min_blur_variance = min_blur_variance
        self.min_brightness = min_brightness
        self.max_brightness = max_brightness
        self.min_green_ratio = min_green_ratio

    def assess_image(self, img_bgr: np.ndarray) -> Dict[str, Any]:
        """
        Assesses BGR numpy image array.
        Returns:
            quality_ok (bool)
            quality_score (float, 0.0 to 1.0)
            is_leaf (bool)
            reasons (list of str)
            metrics (dict)
        """
        if img_bgr is None or img_bgr.size == 0:
            return {
                "quality_ok": False,
                "quality_score": 0.0,
                "is_leaf": False,
                "reasons": ["Corrupt or empty image buffer"],
                "metrics": {}
            }

        # 1. Blur Detection using Laplacian Variance
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        is_sharp = lap_var >= self.min_blur_variance

        # 2. Exposure Check
        mean_brightness = float(np.mean(gray))
        is_exposed = self.min_brightness <= mean_brightness <= self.max_brightness

        # 3. Foliar / Chlorophyll Presence Check via HSV & ExG (Excess Green)
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        
        # Foliar hues: Yellow-Green to Dark-Green (Hue ~ 25 to 90 in OpenCV 0-180 scale)
        # Also includes brown/yellow necrotic foliar tissue (Hue ~ 10 to 35)
        foliage_mask = cv2.inRange(hsv, np.array([10, 25, 25]), np.array([95, 255, 255]))
        foliage_ratio = float(np.count_nonzero(foliage_mask) / (img_bgr.shape[0] * img_bgr.shape[1]))
        is_foliage = foliage_ratio >= self.min_green_ratio

        reasons = []
        if not is_sharp:
            reasons.append(f"Image is excessively blurred (Laplacian variance {lap_var:.1f} < {self.min_blur_variance})")
        if mean_brightness < self.min_brightness:
            reasons.append(f"Image is severely underexposed (Mean intensity {mean_brightness:.1f} < {self.min_brightness})")
        elif mean_brightness > self.max_brightness:
            reasons.append(f"Image is severely washed out / overexposed (Mean intensity {mean_brightness:.1f} > {self.max_brightness})")
        if not is_foliage:
            reasons.append(f"Low plant tissue presence detected (Vegetation ratio {foliage_ratio:.2f} < {self.min_green_ratio})")

        quality_ok = is_sharp and is_exposed and is_foliage
        quality_score = min(1.0, max(0.0, (
            (min(lap_var, 200.0) / 200.0) * 0.4 +
            (1.0 - abs(mean_brightness - 128.0) / 128.0) * 0.3 +
            min(foliage_ratio / 0.3, 1.0) * 0.3
        )))

        return {
            "quality_ok": quality_ok,
            "quality_score": round(quality_score, 3),
            "is_leaf": is_foliage,
            "reasons": reasons,
            "metrics": {
                "sharpness_var": round(lap_var, 2),
                "brightness": round(mean_brightness, 2),
                "foliage_ratio": round(foliage_ratio, 3)
            }
        }
