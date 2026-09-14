"""
AgriSmart AI - Leaf Localization Module
Isolates the salient leaf region using foliar contour segmentation and saliency bounding,
reducing background noise (soil, wooden benches, sky, camera artifacts) prior to classification.
"""
from typing import Tuple, Optional, Dict, Any
import cv2
import numpy as np

class LeafLocalizer:
    """
    Localizes salient leaf surface using color thresholding and contour analysis.
    """
    def __init__(self, target_size: int = 224, padding_ratio: float = 0.08):
        self.target_size = target_size
        self.padding_ratio = padding_ratio

    def localize_and_crop(self, img_bgr: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Extracts the primary leaf bounding box with margin padding.
        Falls back safely to center crop if no prominent contour is found.
        """
        h, w = img_bgr.shape[:2]
        
        # Color segmentation for foliar regions
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        mask1 = cv2.inRange(hsv, np.array([10, 20, 20]), np.array([100, 255, 255]))
        
        # Morphological opening/closing to consolidate leaf region
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        mask_cleaned = cv2.morphologyEx(mask1, cv2.MORPH_CLOSE, kernel)
        mask_cleaned = cv2.morphologyEx(mask_cleaned, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask_cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            # Fallback: square center crop
            crop_dim = min(h, w)
            y1 = (h - crop_dim) // 2
            x1 = (w - crop_dim) // 2
            cropped = img_bgr[y1:y1+crop_dim, x1:x1+crop_dim]
            resized = cv2.resize(cropped, (self.target_size, self.target_size), interpolation=cv2.INTER_AREA)
            return resized, {"localized": False, "bbox": [0, 0, w, h]}

        # Find largest contour corresponding to leaf
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)

        # If largest contour is too small (< 5% of total image), retain full image
        if area < 0.05 * (h * w):
            crop_dim = min(h, w)
            y1 = (h - crop_dim) // 2
            x1 = (w - crop_dim) // 2
            cropped = img_bgr[y1:y1+crop_dim, x1:x1+crop_dim]
            resized = cv2.resize(cropped, (self.target_size, self.target_size), interpolation=cv2.INTER_AREA)
            return resized, {"localized": False, "bbox": [0, 0, w, h]}

        bx, by, bw, bh = cv2.boundingRect(largest_contour)

        # Add sensible margin padding
        pad_x = int(bw * self.padding_ratio)
        pad_y = int(bh * self.padding_ratio)
        x1 = max(0, bx - pad_x)
        y1 = max(0, by - pad_y)
        x2 = min(w, bx + bw + pad_x)
        y2 = min(h, by + bh + pad_y)

        cropped = img_bgr[y1:y2, x1:x2]
        resized = cv2.resize(cropped, (self.target_size, self.target_size), interpolation=cv2.INTER_AREA)

        return resized, {
            "localized": True,
            "bbox": [x1, y1, x2 - x1, y2 - y1],
            "coverage_ratio": round(area / (h * w), 3)
        }
