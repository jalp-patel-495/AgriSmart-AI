# PlantVillage Disease Model Benchmark Comparison

| Model | Architecture | Macro F1 | Accuracy | Macro Precision | Macro Recall | Weighted F1 | Inference Time (ms) | Model Size (MB) | Train Time (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EFFICIENTNET_B0 | efficientnet_b0 | 0.9036 | 0.9115 | 0.8851 | 0.9347 | 0.9108 | 17.75 | 15.6 | 40.0 |
| CONVNEXT_TINY | convnext_tiny | 0.7935 | 0.8269 | 0.8626 | 0.807 | 0.8034 | 40.74 | 106.2 | 40.0 |
| DENSENET121 | densenet121 | 0.7158 | 0.7769 | 0.7203 | 0.7415 | 0.7665 | 41.17 | 27.2 | 40.0 |
| RESNET50 | resnet50 | 0.6527 | 0.7346 | 0.6827 | 0.6665 | 0.7008 | 45.28 | 90.1 | 40.0 |
| MOBILENET_V3 | mobilenet_v3 | 0.6394 | 0.6962 | 0.7053 | 0.6878 | 0.7015 | 8.73 | 16.3 | 40.0 |
