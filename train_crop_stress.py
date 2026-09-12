"""
AgriSmart AI – Standalone Crop Stress / Health Training Runner
Command: python train_crop_stress.py
"""
import sys
from pathlib import Path

# Add project root and ai/ to sys.path
root_dir = Path(__file__).resolve().parent
ai_dir = root_dir / "ai"
for p in [str(root_dir), str(ai_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.stress.train import train_crop_stress


def main():
    res = train_crop_stress()
    if res["status"] != "OK":
        print("\nCROP STRESS TRAINING NOT POSSIBLE\n")
        print("Reason:")
        print(res.get("reason", "No suitable supervised crop stress target found."))
        sys.exit(1)

    m = res["metrics"]
    print("\n" + "=" * 50)
    print("CROP STRESS MODEL TRAINING COMPLETE")
    print("=" * 50)
    print(f"\nDataset:\n{res['dataset_name']}")
    print(f"\nSamples:\n{res['samples']:,}")
    print(f"\nTarget:\n{res['target']}")
    print(f"\nClasses:\n{res['classes']}")
    print(f"\nBest Model:\n{res['best_model']}")
    print(f"\nAccuracy:\n{m['accuracy']:.4f}")
    print(f"\nPrecision:\n{m['precision']:.4f}")
    print(f"\nRecall:\n{m['recall']:.4f}")
    print(f"\nMacro-F1:\n{m['macro_f1']:.4f}")
    print(f"\nWeighted-F1:\n{m['weighted_f1']:.4f}")
    print(f"\nModel saved:\nmodels/crop_stress/best_model.pkl")
    print(f"\nPreprocessor:\nmodels/crop_stress/preprocessor.pkl")
    print(f"\nPrediction function:\nsrc/crop_stress/predict.py -> predict_crop_stress(features)")
    print(f"\nReport:\nreports/crop_stress_report.md")
    print("\n" + "=" * 50)


if __name__ == "__main__":
    main()
