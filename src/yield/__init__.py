"""
AgriSmart AI – Crop Yield Prediction Package
"""
import importlib

_predict_mod = importlib.import_module(".predict", package=__name__)
predict_yield = _predict_mod.predict_yield

__all__ = ["predict_yield"]
