"""
AgriSmart AI – Leaf Localization & Segmentation Engine
Isolates and focuses receptive field on the primary leaf specimen:
- Foliar color segmentation covering green, chlorotic yellow, and necrotic lesion hues
- Principal contour extraction with soil and dark shadow rejection
- Safety-buffered bounding box (20% padding)
- Preserves full image gracefully whenever segmentation is ambiguous
"""
from typing import Tuple, Optional
import cv2
import numpy as np


def localize_leaf_specimen(
    img_bgr: np.ndarray,
    padding_fraction: float = 0.20,
    min_leaf_area_pct: float = 0.12
) -> Tuple[np.ndarray, Tuple[int, int, int, int], float]:
    """
    Localizes the primary leaf specimen within the input image:
    1. Computes multi-hue foliar mask in HSV color space targeting plant foliage.
    2. Identifies the largest contiguous plant contour.
    3. Crops with a generous 20% safety buffer so edge lesions are never clipped.
    4. Falls back gracefully to original image if contour is ambiguous, tiny, or full-frame.

    Returns:
    - cropped_leaf_bgr (np.ndarray)
    - (x, y, w, h) bounding box in original coordinates
    - leaf_coverage_ratio (float)
    """
    if img_bgr is None or img_bgr.size == 0:
        return img_bgr, (0, 0, 0, 0), 0.0

    orig_h, orig_w = img_bgr.shape[:2]
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    # 1. Broad Foliar Mask covering healthy green, chlorotic yellow, and necrotic brown tones
    # Rejects dark soil/shadows by requiring positive plant saturation and hue boundaries
    green_mask = cv2.inRange(hsv, np.array([25, 25, 25]), np.array([95, 255, 255]))
    yellow_chlorotic_mask = cv2.inRange(hsv, np.array([15, 30, 40]), np.array([28, 255, 255]))
    necrotic_brown_mask = cv2.inRange(hsv, np.array([5, 35, 30]), np.array([18, 255, 220]))

    combined_mask = cv2.bitwise_or(green_mask, yellow_chlorotic_mask)
    combined_mask = cv2.bitwise_or(combined_mask, necrotic_brown_mask)

    # Morphological closing to bridge internal lesion holes and venation
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    closed_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # 2. Find contours
    contours, _ = cv2.findContours(closed_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img_bgr, (0, 0, orig_w, orig_h), 1.0

    # Find largest contour by area
    largest_cnt = max(contours, key=cv2.contourArea)
    cnt_area = cv2.contourArea(largest_cnt)
    total_area = orig_h * orig_w
    coverage_ratio = cnt_area / total_area if total_area > 0 else 0.0

    # If the contour is tiny (<12%) or already occupies > 80% of image, preserve full original image
    if coverage_ratio < min_leaf_area_pct or coverage_ratio > 0.80:
        return img_bgr, (0, 0, orig_w, orig_h), coverage_ratio

    # 3. Compute Bounding Box with Padding
    bx, by, bw, bh = cv2.boundingRect(largest_cnt)

    # Rejection of extreme slivers (e.g. edge lines or wire)
    aspect_ratio = float(bw) / float(bh) if bh > 0 else 1.0
    if aspect_ratio > 3.5 or aspect_ratio < 0.28:
        return img_bgr, (0, 0, orig_w, orig_h), coverage_ratio

    pad_w = int(bw * padding_fraction)
    pad_h = int(bh * padding_fraction)

    x1 = max(0, bx - pad_w)
    y1 = max(0, by - pad_h)
    x2 = min(orig_w, bx + bw + pad_w)
    y2 = min(orig_h, by + bh + pad_h)

    # Ensure crop has substantial size (at least 100x100)
    if (x2 - x1) < 100 or (y2 - y1) < 100:
        return img_bgr, (0, 0, orig_w, orig_h), coverage_ratio

    cropped = img_bgr[y1:y2, x1:x2]
    return cropped, (x1, y1, x2 - x1, y2 - y1), coverage_ratio
