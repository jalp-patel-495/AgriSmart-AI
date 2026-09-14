# Plant Pathology 2021 - FGVC8 (Apple Foliar Disease Dataset)

## Overview
The **Plant Pathology 2021 - FGVC8** challenge dataset is a specialized, in-the-wild agricultural leaf dataset focused on **Apple foliar diseases** (*Malus domestica*). It was curated by Cornell University and the Fine-Grained Visual Categorization (FGVC8) workshop at CVPR 2021.

## Dataset Characteristics
- **Domain**: Foliar pathology of Apple leaves (*Malus domestica*)
- **Total Images**: Approximately 18,634 expert-annotated high-resolution RGB images (14,906 train + 3,728 validation/test)
- **Field Conditions**: Outdoor field photography representing natural variability (non-homogeneous backgrounds, multiple leaves, sunlight glare, shade, leaf maturity stages, and variable camera focal lengths).
- **Labeling Scheme**: **Multi-label foliar classification**. Leaves can exhibit multiple simultaneous infections.

## Canonical Classes
1. **Healthy**: Clear leaf without foliar lesions
2. **Scab** (*Venturia inaequalis*)
3. **Frog Eye Leaf Spot** (*Botryosphaeria obtusa*)
4. **Rust** (*Gymnosporangium juniperi-virginianae*)
5. **Powdery Mildew** (*Podosphaera leucotricha*)
6. **Complex**: Co-infection or secondary opportunistic foliar lesions

## Common Co-infection Combinations
- `scab frog_eye_leaf_spot`
- `scab frog_eye_leaf_spot complex`
- `frog_eye_leaf_spot complex`
- `rust frog_eye_leaf_spot`
- `rust complex`
- `powdery_mildew complex`

## Directory Structure
```
dataset/plant_pathology_2021/
├── train_images/       # High-resolution in-the-wild apple leaf photos
├── train.csv           # Image-to-label multi-label annotations
├── metadata/           # Split definitions, label distributions, multi-label statistics
├── processed/          # Preprocessed tensors and stratified train/val splits
├── class_registry.json # Canonical Apple disease taxonomy
└── README.md           # Dataset documentation
```

## Licensing & Attribution
- **Source**: Kaggle Competition: [Plant Pathology 2021 - FGVC8](https://www.kaggle.com/competitions/plant-pathology-2021-fgvc8)
- **Host**: Cornell University / FGVC8
- **License**: Research and Educational Use (Creative Commons / Competition Rules)
