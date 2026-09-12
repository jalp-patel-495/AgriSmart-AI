"""
AgriSmart AI – Farmer Advisory Unit Test Suite
Covers all 7 mandatory verification scenarios from Section 12:
1. Healthy crop
2. Diseased crop
3. High irrigation requirement
4. Low irrigation requirement
5. Low disease confidence
6. Missing optional inputs
7. Combined disease + irrigation warning
"""
import sys
import unittest
from pathlib import Path

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parents[1]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from src.farmer_advisor.advisor import generate_farmer_advice


class TestFarmerAdvisor(unittest.TestCase):

    def test_01_healthy_crop(self):
        """Scenario 1: Healthy crop with adequate soil moisture -> LOW priority, optimal status."""
        advice = generate_farmer_advice(
            crop="Tomato",
            disease_result={"crop": "Tomato", "disease": "Tomato___healthy", "confidence": 0.95},
            irrigation_result={"irrigation_required": False, "prediction": "NO", "priority": "NONE", "confidence": 0.98}
        )
        self.assertEqual(advice["status"], "success")
        self.assertEqual(advice["overall_priority"], "LOW")
        self.assertIn("Optimal", advice["farm_status"])
        self.assertTrue(any("healthy" in r.lower() for r in advice["recommendations"]))

    def test_02_diseased_crop(self):
        """Scenario 2: High-confidence diseased crop -> HIGH priority, actionable cultural advice."""
        advice = generate_farmer_advice(
            crop="Apple",
            disease_result={"crop": "Apple", "disease": "Apple Scab", "confidence": 0.91},
            irrigation_result={"irrigation_required": False, "prediction": "NO", "priority": "NONE", "confidence": 0.90}
        )
        self.assertEqual(advice["status"], "success")
        self.assertEqual(advice["overall_priority"], "HIGH")
        self.assertEqual(advice["farm_status"], "Attention Required")
        self.assertTrue(any("apple scab" in r.lower() for r in advice["recommendations"]))
        self.assertTrue(any("consult a local certified agricultural extension officer" in r.lower() for r in advice["recommendations"]))

    def test_03_high_irrigation_requirement(self):
        """Scenario 3: Severe soil moisture deficit -> HIGH priority, urgent irrigation recommendation."""
        advice = generate_farmer_advice(
            crop="Corn",
            disease_result={"crop": "Corn", "disease": "healthy", "confidence": 0.92},
            irrigation_result={"irrigation_required": True, "prediction": "YES", "priority": "HIGH", "confidence": 0.89}
        )
        self.assertEqual(advice["status"], "success")
        self.assertEqual(advice["overall_priority"], "HIGH")
        self.assertTrue(any("the irrigation model predicts that irrigation is required" in r.lower() for r in advice["recommendations"]))
        self.assertTrue(any("high moisture deficit" in w.lower() for w in advice["warnings"]))

    def test_04_low_irrigation_requirement(self):
        """Scenario 4: Moisture adequate -> water conservation advice."""
        advice = generate_farmer_advice(
            crop="Rice",
            irrigation_result={"irrigation_required": False, "prediction": "NO", "priority": "NONE", "confidence": 0.95}
        )
        self.assertEqual(advice["status"], "success")
        self.assertTrue(any("conserve water" in r.lower() or "adequate" in r.lower() for r in advice["recommendations"]))

    def test_05_low_disease_confidence(self):
        """Scenario 5: Disease confidence below 0.65 -> fallback to re-capture request, no chemical treatment."""
        advice = generate_farmer_advice(
            crop="Potato",
            disease_result={"crop": "Potato", "disease": "Late Blight", "confidence": 0.42}
        )
        self.assertEqual(advice["status"], "success")
        # Ensure fallback message exists
        self.assertTrue(any("low confidence prediction. please capture a clearer leaf image" in r.lower() for r in advice["recommendations"]))
        # Ensure warning exists
        self.assertTrue(any("below the safe actionable threshold" in w.lower() for w in advice["warnings"]))

    def test_06_missing_optional_inputs(self):
        """Scenario 6: Completely missing optional inputs -> must not crash, returns 'Data unavailable'."""
        advice = generate_farmer_advice()
        self.assertEqual(advice["status"], "success")
        self.assertEqual(advice["disease"]["name"], "Data unavailable")
        self.assertEqual(advice["irrigation"]["priority"], "Data unavailable")
        self.assertEqual(advice["yield"]["estimated"], "Data unavailable")
        self.assertEqual(advice["overall_priority"], "LOW")

    def test_07_combined_disease_and_irrigation_warning(self):
        """Scenario 7: Simultaneous high infection and critical irrigation need -> CRITICAL priority & compound alert."""
        advice = generate_farmer_advice(
            crop="Tomato",
            disease_result={"crop": "Tomato", "disease": "Early Blight", "confidence": 0.94},
            irrigation_result={"irrigation_required": True, "prediction": "YES", "priority": "HIGH", "confidence": 0.92},
            yield_result={"predicted_yield": 4.15, "unit": "Tonnes/Ha"}
        )
        self.assertEqual(advice["status"], "success")
        self.assertEqual(advice["overall_priority"], "CRITICAL")
        self.assertEqual(advice["farm_status"], "Critical Intervention Required")
        # Ensure Compound Stress Alert is triggered in warnings
        self.assertTrue(any("compound stress alert" in w.lower() for w in advice["warnings"]))
        # Ensure Estimated yield phrasing
        self.assertTrue(any("estimated yield expectation is 4.15 tonnes/ha" in r.lower() for r in advice["recommendations"]))


if __name__ == "__main__":
    unittest.main()
