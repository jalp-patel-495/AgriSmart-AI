"""
AgriSmart AI – Intelligent Image Quality Gate
Validates uploaded imagery prior to deep neural inference:
- Valid image decoding
- Minimum resolution threshold
- Focus & blur analysis (Laplacian variance)
- Exposure analysis (overexposure / underexposure)
- Foliar presence & leaf coverage ratio (HSV foliar color space)
"""
from typing import Tuple, Dict, Any, Union
import cv2
import numpy as np


def check_image_quality(
    image: Union[bytes, np.ndarray],
    min_resolution: int = 120,
    blur_threshold: float = 25.0,
    min_leaf_area_ratio: float = 0.10,
    min_luminance: float = 22.0,
    max_luminance: float = 242.0
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Evaluates leaf image quality across 5 diagnostic vectors:
    Returns (quality_ok, failure_reason, quality_metrics).
    """
    # 1. Decoding check
    if isinstance(image, (bytes, bytearray)):
        np_buf = np.frombuffer(image, np.uint8)
        img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
    elif isinstance(image, np.ndarray):
        img_bgr = image
    else:
        return False, "Unsupported image data format.", {"error": "invalid_type"}

    if img_bgr is None or img_bgr.size == 0:
        return False, "Could not decode image buffer. The file may be damaged or corrupted.", {"error": "decode_failed"}

    h, w, c = img_bgr.shape

    # 2. Resolution check
    if min(h, w) < min_resolution:
        return False, (
            f"Image resolution ({w}×{h}) is too low for reliable disease detection. "
            f"Please upload an image of at least {min_resolution}×{min_resolution} pixels."
        ), {
            "width": w,
            "height": h,
            "error": "low_resolution"
        }

    # Convert to grayscale and YCrCb/HSV
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    # 3. Blur detection via Laplacian Variance
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if laplacian_var < blur_threshold:
        return False, (
            "The image appears significantly blurred or out of focus. "
            "Please upload a clear, sharp leaf photograph in good focus."
        ), {
            "blur_score": round(laplacian_var, 2),
            "blur_threshold": blur_threshold,
            "error": "excessive_blur"
        }

    # 4. Exposure & Lighting check
    mean_luminance = float(np.mean(gray))
    if mean_luminance < min_luminance:
        return False, (
            "The image is too dark or underexposed to resolve leaf lesions. "
            "Please capture the leaf in bright, natural daylight."
        ), {
            "luminance": round(mean_luminance, 2),
            "error": "underexposed"
        }
    if mean_luminance > max_luminance:
        return False, (
            "The image is overexposed or washed out by harsh glare/flash. "
            "Please avoid direct flash or intense camera glare on the leaf surface."
        ), {
            "luminance": round(mean_luminance, 2),
            "error": "overexposed"
        }

    # 5. Foliar Presence & Leaf Coverage Ratio
    # Green foliar range: H in [25, 95], S in [30, 255], V in [30, 255]
    green_mask = cv2.inRange(hsv, np.array([25, 30, 30]), np.array([95, 255, 255]))
    # Yellow-brown necrotic foliar range (scab, blights, rusts): H in [8, 25], S in [40, 255], V in [30, 240]
    brown_mask = cv2.inRange(hsv, np.array([8, 40, 30]), np.array([25, 255, 240]))
    # Dark necrotic spot range (brown/olive foliar necrotic spots): H in [5, 40], S in [25, 255], V in [15, 85]
    dark_lesion_mask = cv2.inRange(hsv, np.array([5, 25, 15]), np.array([40, 255, 85]))

    foliar_mask = cv2.bitwise_or(green_mask, brown_mask)
    foliar_mask = cv2.bitwise_or(foliar_mask, dark_lesion_mask)

    leaf_pixels = cv2.countNonZero(foliar_mask)
    total_pixels = h * w
    leaf_area_ratio = float(leaf_pixels / total_pixels) if total_pixels > 0 else 0.0

    if leaf_area_ratio < min_leaf_area_ratio:
        return False, (
            "No clear crop foliage or leaf tissue was detected in the photograph. "
            "Please ensure a single leaf occupies the center of the frame against a plain background."
        ), {
            "leaf_area_ratio": round(leaf_area_ratio, 4),
            "min_ratio": min_leaf_area_ratio,
            "error": "no_leaf_detected"
        }

    metrics = {
        "width": w,
        "height": h,
        "blur_score": round(laplacian_var, 2),
        "mean_luminance": round(mean_luminance, 2),
        "leaf_area_ratio": round(leaf_area_ratio, 4),
        "quality_ok": True
    }
    return True, "Image quality verified successfully.", metrics
