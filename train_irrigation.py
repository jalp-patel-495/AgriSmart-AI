"""
AgriSmart AI – Standalone Irrigation Training Runner
Command: python train_irrigation.py
"""
import sys
from pathlib import Path

# Add project root and ai/ to sys.path
root_dir = Path(__file__).resolve().parent
ai_dir = root_dir / "ai"
for p in [str(root_dir), str(ai_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.irrigation.train import train_irrigation


def main():
    res = train_irrigation()
    if res["status"] != "OK":
        print(f"[ERROR] Training failed: {res.get('reason')}")
        sys.exit(1)

    m = res["metrics"]
    print("\n" + "=" * 50)
    print("IRRIGATION MODEL TRAINING COMPLETE")
    print("=" * 50)
    print(f"\nDataset:\n{res['dataset_name']}")
    print(f"\nSamples:\n{res['samples']}")
    print(f"\nTarget:\n{res['target']}")
    print(f"\nBest Model:\n{res['best_model']}")
    print(f"\nAccuracy:\n{m['accuracy']:.4f}")
    print(f"\nPrecision:\n{m['precision']:.4f}")
    print(f"\nRecall:\n{m['recall']:.4f}")
    print(f"\nF1:\n{m['f1']:.4f}")
    print(f"\nMacro-F1:\n{m['macro_f1']:.4f}")
    print(f"\nModel saved:\nmodels/irrigation/best_model.pkl")
    print(f"\nPreprocessor:\nmodels/irrigation/preprocessor.pkl")
    print(f"\nReports:\nreports/irrigation_report.md")
    print("\n" + "=" * 50)


if __name__ == "__main__":
    main()
