import json
import time
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.app.schemas.prediction import PredictionResponse, DiseaseInfo
from backend.app.core.config import settings

router = APIRouter()


def load_classes():
    classes_path = Path(settings.CLASSES_PATH)
    if not classes_path.exists():
        # Fallback search
        classes_path = Path(__file__).resolve().parents[4] / "dataset" / "classes.json"
    if classes_path.exists():
        with open(classes_path, "r", encoding="utf-8") as f:
            return json.load(f)["classes"]
    return []


@router.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict_crop_disease(file: UploadFile = File(...)):
    """
    Analyzes uploaded crop leaf image.
    In Phase 1, returns a structured stub schema verified against classes.json.
    Phase 2/4 directly links the trained PyTorch neural network.
    """
    start_time = time.time()
    
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image format (JPEG, PNG, etc.)")
    
    # Read image contents to verify bytes
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty")

    classes = load_classes()
    sample_cls = classes[10] if len(classes) > 10 else (classes[0] if classes else None)

    if not sample_cls:
        raise HTTPException(status_code=500, detail="Disease class configuration could not be loaded")

    duration_ms = round((time.time() - start_time) * 1000, 2)

    return PredictionResponse(
        success=True,
        message="Image processed successfully (Phase 1 Baseline Scaffold). Model inference connects in Phase 2.",
        prediction=DiseaseInfo(
            class_id=sample_cls["id"],
            class_name=sample_cls["name"],
            crop=sample_cls["crop"],
            disease=sample_cls["disease"],
            status=sample_cls["status"],
            confidence=0.945,
            pathogen=sample_cls.get("pathogen"),
            symptoms=sample_cls.get("symptoms"),
            treatment=sample_cls.get("treatment")
        ),
        top_predictions=[
            {"class_name": sample_cls["name"], "confidence": 0.945},
            {"class_name": "Tomato___healthy", "confidence": 0.038},
            {"class_name": "Tomato___Late_blight", "confidence": 0.017}
        ],
        processing_time_ms=duration_ms
    )
