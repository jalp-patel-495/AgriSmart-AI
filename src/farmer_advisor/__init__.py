"""
AgriSmart AI – Farmer Advisory Package
"""
from src.farmer_advisor.advisor import generate_farmer_advice
from src.farmer_advisor.rules import (
    evaluate_disease_advisory,
    evaluate_irrigation_advisory,
    evaluate_yield_advisory,
    evaluate_crop_recommendation_advisory,
    compute_overall_priority
)

__all__ = [
    "generate_farmer_advice",
    "evaluate_disease_advisory",
    "evaluate_irrigation_advisory",
    "evaluate_yield_advisory",
    "evaluate_crop_recommendation_advisory",
    "compute_overall_priority"
]
