# AgriSmart AI – Universal 14-Plant Disease Detection Pipeline Documentation

## 1. Overview & Architecture

AgriSmart AI's Disease Detection Studio has been updated to a hierarchical, multi-stage 14-plant foliar diagnostic pipeline. The architecture decouples crop species identification from pathological condition diagnosis, preventing cross-crop confusion (such as Bell Pepper foliage misdiagnosed as Grape, or Peach foliage misdiagnosed as Corn) through mathematical crop gating.

```
                  ┌───────────────────────────────┐
                  │          Input Image          │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │    Stage 0: Quality Gate      │
                  │  (Blur, Exposure, Green Area) │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │ Stage 1: Leaf Localization   │
                  │ (Foliar Mask & Dynamic Crop)  │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │ Stage A: 14-Crop Classifier   │
                  │   (Dedicated EfficientNet-B0) │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │ Stage C: OOD / Anomaly Guard  │
                  │ (MSP, Helmholtz Free Energy)  │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │ Stage B: Crop-Gated Diagnosis │
                  │  (Intra-Crop Classes Only)    │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │ Stage D: 65% Safety Gate      │
                  │ (Curative Dosage Suppression) │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │         Final Output          │
                  └───────────────────────────────┘
```

---

## 2. 14 Supported Crops & Actual Pathological Coverage

Coverage reflects actual biological specimens verified in the legitimate datasets without data fabrication. Where a crop exhibits only healthy baseline foliage in the datasets (e.g., Blueberry, Raspberry, Soybean), only Healthy is reported and classified.

| # | Crop Species | Botanical Name | Condition Classes Present in Dataset | Dataset Sources | Image Count |
|---|--------------|----------------|--------------------------------------|-----------------|-------------|
| 1 | **Apple** | *Malus domestica* | Apple Scab, Black Rot, Cedar Apple Rust, Healthy | PlantVillage, PlantDoc, FGVC8 | 3,466 |
| 2 | **Blueberry** | *Vaccinium corymbosum* | Healthy | PlantVillage, PlantDoc | 1,616 |
| 3 | **Cherry (incl. sour)** | *Prunus cerasus* | Powdery Mildew, Healthy | PlantVillage, PlantDoc | 1,963 |
| 4 | **Corn (Maize)** | *Zea mays* | Cercospora Leaf Spot, Common Rust, Northern Leaf Blight | PlantVillage, PlantDoc | 415 |
| 5 | **Grape** | *Vitis vinifera* | Black Rot, Healthy | PlantDoc | 133 |
| 6 | **Orange** | *Citrus sinensis* | Citrus Greening (Huanglongbing) | PlantVillage | 60 |
| 7 | **Peach** | *Prunus persica* | Bacterial Spot, Healthy | PlantVillage, PlantDoc | 2,768 |
| 8 | **Pepper, bell** | *Capsicum annuum* | Bacterial Spot, Healthy | PlantDoc | 132 |
| 9 | **Potato** | *Solanum tuberosum* | Early Blight, Late Blight, Healthy | PlantDoc | 245 |
| 10 | **Raspberry** | *Rubus idaeus* | Healthy | PlantDoc | 119 |
| 11 | **Soybean** | *Glycine max* | Healthy | PlantDoc | 65 |
| 12 | **Squash** | *Cucurbita pepo* | Powdery Mildew | PlantDoc | 130 |
| 13 | **Strawberry** | *Fragaria × ananassa* | Healthy | PlantDoc | 96 |
| 14 | **Tomato** | *Solanum lycopersicum* | Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Mosaic Virus, Septoria Leaf Spot, Spider Mites, Yellow Leaf Curl Virus, Healthy | PlantDoc | 735 |

---

## 3. Dataset Registry, Sources & Licensing

1. **PlantVillage Dataset**
   - **Repository**: `https://github.com/spMohanty/PlantVillage-Dataset`
   - **Role**: Primary multi-crop baseline for lab/controlled conditions.
   - **License**: Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA 4.0).
   - **Specimens Used**: Apple (4 classes), Blueberry (1 class), Cherry (2 classes), Orange (1 class), Peach (2 classes).

2. **PlantDoc Dataset**
   - **Repository**: `https://github.com/ai-agriculture-circuits-and-systems/plant_doc_detection`
   - **Role**: Field / in-the-wild robustness against natural lighting, complex backgrounds, shadows, and angle variations.
   - **License**: Creative Commons Attribution 4.0 International (CC-BY 4.0).
   - **Specimens Used**: 2,563 real field images across 28 classes covering 13 crop species.

3. **FieldPV / PPDRD Dataset**
   - **Repository**: `https://github.com/xml94/PPDRD`
   - **Role**: Field-style PlantVillage references and field benchmark standards.
   - **License**: Research Non-Commercial License.

4. **Plant Pathology 2021 FGVC8 Dataset**
   - **Source**: `https://www.kaggle.com/competitions/plant-pathology-2021-fgvc8`
   - **Role**: Apple-specific field multi-label pathology (scab, rust, frog-eye spot, powdery mildew, complex).
   - **License**: Kaggle Competition Research / Open Access.

---

## 4. Train, Validation, Test & Field Benchmark Splits

Dataset stratification strictly isolates an **Independent Field Benchmark** set before training, guaranteeing that field robustness metrics reflect unseen real-world conditions.

- **Total Unified Images**: 11,983
- **Train Set (70% training pool)**: 7,483 images
- **Validation Set (15% training pool)**: 1,590 images
- **Test Set (15% training pool)**: 1,636 images
- **Independent Field Benchmark**: 1,274 images (100% real field images from PlantDoc, held out completely from training)
- **Deterministic Random Seed**: `SEED = 42` across NumPy, PyTorch, and Python random modules.

---

## 5. Model Architecture & Preprocessing

- **Backbone**: EfficientNet-B0 with ImageNet pretrained feature weights.
- **Stage A (14-Class Crop Classifier)**:
  - Input: $224 \times 224 \times 3$ normalized tensor.
  - Dropout: 0.3 for regularization against leaf background noise.
  - Output: 14 crop logits.
  - Outputs separate `crop` and `crop_confidence`.
- **Stage B (Crop-Gated Disease Classifier)**:
  - Input: $224 \times 224 \times 3$ normalized tensor + detected crop mask.
  - Crop Gating: Logits of all disease classes not belonging to the detected crop are masked with $-\infty$, preventing cross-crop competition.
  - Calibration: Softmax over intra-crop candidates produces calibrated `disease_confidence`.
- **Conservative Data Augmentation**:
  - Horizontal flip ($p=0.5$), vertical flip ($p=0.2$).
  - Gentle rotation ($\pm 15^\circ$).
  - Subtle color jitter (brightness 0.15, contrast 0.15, saturation 0.15) to simulate sunny/overcast daylight without distorting chlorotic halo or necrotic spot colors.

---

## 6. Out-of-Distribution (OOD) & Quality Gate Strategy

1. **Quality Gate (`LeafQualityGate`)**:
   - Laplacian variance check ($> 80.0$) rejects blurred and out-of-focus camera captures.
   - Mean intensity check ($35 \le \mu \le 230$) rejects severely underexposed or overexposed images.
   - Foliar green/brown mask ratio check ($> 12\%$) rejects non-plant objects.
2. **OOD Detection (`OODDetector`)**:
   - Maximum Softmax Probability (MSP threshold $< 0.50$).
   - Helmholtz Free Energy score ($E(x) = -T \cdot \log \sum e^{z_i / T}$).
   - Normalized Shannon Entropy ($H(p) / \log K > 0.85$).
   - If an image is non-leaf, random object, animal, vehicle, or unsupported plant species:
     ```json
     {
       "crop": "Unsupported / Unknown",
       "disease": "Not confidently identified",
       "status": "Low Confidence",
       "is_supported": false,
       "is_ood": true,
       "ood_status": "out_of_distribution"
     }
     ```

---

## 7. 65% Disease Safety Gate

- If `disease_confidence >= 65%`:
  - Show confirmed disease or healthy diagnosis.
  - Provide causal pathogen, symptoms, precautions, and curative treatment.
- If `disease_confidence < 65%`:
  - `crop`: detected crop (e.g., "Peach" or "Bell Pepper")
  - `disease`: "Not confidently identified"
  - `status`: "Low Confidence"
  - Curative chemical dosages and treatments are **strictly suppressed**.
  - Safe inspection precautions are provided to guide the farmer to take clearer photographs.

---

## 8. Fallback Architecture

The system maintains the legacy EfficientNet-B0 model (`models/disease/` and `ai_model/models/production_model.pth`) as an automatic operational fallback. If an unexpected runtime error occurs in the universal pipeline, the system transparently executes the legacy inference path, ensuring zero downtime for live farmers.

---

## 9. Known Limitations

1. **Class Asymmetry**: Certain crops (Blueberry, Raspberry, Soybean) currently contain only verified healthy baseline images in the public repositories; the pipeline accurately classifies them as Healthy and does not speculate on unrepresented diseases.
2. **Sparse Field Classes**: Tomato Two-Spotted Spider Mites has very limited field images (2 specimens) in public field datasets.
3. **Severe Multi-Stress**: When foliage suffers simultaneously from extreme drought necrosis and fungal sporulation, the primary visual lesion dominates the intra-crop classification.
