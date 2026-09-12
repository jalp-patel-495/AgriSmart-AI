"""
AgriSmart AI – Standalone Crop Yield Training Runner
Command: python train_yield.py
"""
import sys
from pathlib import Path

# Add project root and ai/ to sys.path
root_dir = Path(__file__).resolve().parent
ai_dir = root_dir / "ai"
for p in [str(root_dir), str(ai_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.yield_prediction.train import train_yield_prediction


def main():
    res = train_yield_prediction()
    if res["status"] != "OK":
        print(f"[ERROR] Training failed: {res.get('reason')}")
        sys.exit(1)

    m = res["metrics"]
    print("\n" + "=" * 50)
    print("YIELD MODEL TRAINING COMPLETE")
    print("=" * 50)
    print(f"\nDataset:\n{res['dataset_name']}")
    print(f"\nSamples:\n{res['samples']:,}")
    print(f"\nTarget:\n{res['target']}")
    print(f"\nBest Model:\n{res['best_model']}")
    print(f"\nMAE:\n{m['mae']:.4f}")
    print(f"\nRMSE:\n{m['rmse']:.4f}")
    print(f"\nR²:\n{m['r2']:.4f}")
    print(f"\nMAPE:\n{m['mape']:.2f}%")
    print(f"\nModel saved:\nmodels/yield/best_model.pkl")
    print(f"\nPreprocessor:\nmodels/yield/preprocessor.pkl")
    print(f"\nPrediction function:\nsrc/yield/predict.py -> predict_yield(features)")
    print(f"\nReport:\nreports/yield_report.md")
    print("\n" + "=" * 50)


if __name__ == "__main__":
    main()
