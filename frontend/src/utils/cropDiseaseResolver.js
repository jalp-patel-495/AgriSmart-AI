/**
 * AgriSmart AI – Crop & Disease Scientific Resolution Utility
 * 
 * Enforces scientific safety thresholds and class mappings across all
 * 19 canonical disease/healthy classes and 7 supported crop staples.
 * 
 * Safety Rules:
 * - Confidence < 65%: LOW CONFIDENCE safety gate.
 *   - Disease is NOT confirmed ("Not confidently identified").
 *   - If crop can be resolved from model prediction: "Possible Crop: [Crop]".
 *   - If unresolvable: "Crop: Undetermined".
 *   - Pathogens, chemical dosages, and treatments are STRICTLY SUPPRESSED.
 *   - Differential diagnosis percentages are HIDDEN.
 * - Confidence >= 65%: Verified prediction displayed.
 * - Healthy: General monitoring advice, pathology sections suppressed.
 */

export const SUPPORTED_CROPS = [
  'Apple',
  'Blueberry',
  'Cherry',
  'Corn',
  'Grape',
  'Orange',
  'Peach',
  'Bell Pepper',
  'Potato',
  'Raspberry',
  'Soybean',
  'Squash',
  'Strawberry',
  'Tomato'
];

export const CANONICAL_CLASSES = [
  { id: 0, name: 'apple_scab', crop: 'Apple', disease: 'Apple Scab', status: 'Diseased', pathogen: 'Venturia inaequalis (Fungus)' },
  { id: 1, name: 'apple_black_rot', crop: 'Apple', disease: 'Black Rot', status: 'Diseased', pathogen: 'Botryosphaeria obtusa (Fungus)' },
  { id: 2, name: 'apple_cedar_apple_rust', crop: 'Apple', disease: 'Cedar Apple Rust', status: 'Diseased', pathogen: 'Gymnosporangium juniperi-virginianae (Fungus)' },
  { id: 3, name: 'apple_healthy', crop: 'Apple', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 4, name: 'blueberry_healthy', crop: 'Blueberry', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 5, name: 'cherry_powdery_mildew', crop: 'Cherry', disease: 'Powdery Mildew', status: 'Diseased', pathogen: 'Podosphaera clandestina (Fungus)' },
  { id: 6, name: 'cherry_healthy', crop: 'Cherry', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 7, name: 'corn_cercospora_leaf_spot', crop: 'Corn', disease: 'Cercospora Leaf Spot', status: 'Diseased', pathogen: 'Cercospora zeae-maydis (Fungus)' },
  { id: 8, name: 'corn_common_rust', crop: 'Corn', disease: 'Common Rust', status: 'Diseased', pathogen: 'Puccinia sorghi (Fungus)' },
  { id: 9, name: 'corn_northern_leaf_blight', crop: 'Corn', disease: 'Northern Leaf Blight', status: 'Diseased', pathogen: 'Exserohilum turcicum (Fungus)' },
  { id: 10, name: 'corn_healthy', crop: 'Corn', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 11, name: 'grape_black_rot', crop: 'Grape', disease: 'Black Rot', status: 'Diseased', pathogen: 'Guignardia bidwellii (Fungus)' },
  { id: 12, name: 'grape_esca_black_measles', crop: 'Grape', disease: 'Esca (Black Measles)', status: 'Diseased', pathogen: 'Phaeoacremonium & Fomitiporia complex (Fungal complex)' },
  { id: 13, name: 'grape_leaf_blight', crop: 'Grape', disease: 'Leaf Blight', status: 'Diseased', pathogen: 'Pseudocercospora vitis / Isariopsis clavispora (Fungus)' },
  { id: 14, name: 'grape_healthy', crop: 'Grape', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 15, name: 'orange_citrus_greening', crop: 'Orange', disease: 'Citrus Greening', status: 'Diseased', pathogen: 'Candidatus Liberibacter asiaticus (Bacteria vectored by Asian citrus psyllid)' },
  { id: 16, name: 'peach_bacterial_spot', crop: 'Peach', disease: 'Bacterial Spot', status: 'Diseased', pathogen: 'Xanthomonas arboricola pv. pruni (Bacteria)' },
  { id: 17, name: 'peach_healthy', crop: 'Peach', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 18, name: 'bell_pepper_bacterial_spot', crop: 'Bell Pepper', disease: 'Bacterial Spot', status: 'Diseased', pathogen: 'Xanthomonas campestris pv. vesicatoria (Bacteria)' },
  { id: 19, name: 'bell_pepper_healthy', crop: 'Bell Pepper', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 20, name: 'potato_early_blight', crop: 'Potato', disease: 'Early Blight', status: 'Diseased', pathogen: 'Alternaria solani (Fungus)' },
  { id: 21, name: 'potato_late_blight', crop: 'Potato', disease: 'Late Blight', status: 'Diseased', pathogen: 'Phytophthora infestans (Oomycete)' },
  { id: 22, name: 'potato_healthy', crop: 'Potato', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 23, name: 'raspberry_healthy', crop: 'Raspberry', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 24, name: 'soybean_healthy', crop: 'Soybean', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 25, name: 'squash_powdery_mildew', crop: 'Squash', disease: 'Powdery Mildew', status: 'Diseased', pathogen: 'Podosphaera xanthii (Fungus)' },
  { id: 26, name: 'strawberry_leaf_scorch', crop: 'Strawberry', disease: 'Leaf Scorch', status: 'Diseased', pathogen: 'Diplocarpon earlianum (Fungus)' },
  { id: 27, name: 'strawberry_healthy', crop: 'Strawberry', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 28, name: 'tomato_bacterial_spot', crop: 'Tomato', disease: 'Bacterial Spot', status: 'Diseased', pathogen: 'Xanthomonas perforans (Bacteria)' },
  { id: 29, name: 'tomato_early_blight', crop: 'Tomato', disease: 'Early Blight', status: 'Diseased', pathogen: 'Alternaria solani (Fungus)' },
  { id: 30, name: 'tomato_late_blight', crop: 'Tomato', disease: 'Late Blight', status: 'Diseased', pathogen: 'Phytophthora infestans (Oomycete)' },
  { id: 31, name: 'tomato_leaf_mold', crop: 'Tomato', disease: 'Leaf Mold', status: 'Diseased', pathogen: 'Passalora fulva (Fungus)' },
  { id: 32, name: 'tomato_septoria_leaf_spot', crop: 'Tomato', disease: 'Septoria Leaf Spot', status: 'Diseased', pathogen: 'Septoria lycopersici (Fungus)' },
  { id: 33, name: 'tomato_spider_mites', crop: 'Tomato', disease: 'Spider Mites', status: 'Diseased', pathogen: 'Tetranychus urticae (Arachnid Pest)' },
  { id: 34, name: 'tomato_target_spot', crop: 'Tomato', disease: 'Target Spot', status: 'Diseased', pathogen: 'Corynespora cassiicola (Fungus)' },
  { id: 35, name: 'tomato_yellow_leaf_curl_virus', crop: 'Tomato', disease: 'Yellow Leaf Curl Virus', status: 'Diseased', pathogen: 'Tomato yellow leaf curl virus (Begomovirus vectored by Bemisia tabaci whitefly)' },
  { id: 36, name: 'tomato_mosaic_virus', crop: 'Tomato', disease: 'Mosaic Virus', status: 'Diseased', pathogen: 'Tomato mosaic virus (Tobamovirus)' },
  { id: 37, name: 'tomato_healthy', crop: 'Tomato', disease: 'Healthy', status: 'Healthy', pathogen: null }
];

export const SAFE_LOW_CONFIDENCE_PRECAUTIONS = [
  'Upload a clearer, high-resolution leaf image',
  'Use natural daylight and avoid artificial color cast',
  'Keep the leaf in sharp focus without blur or camera shake',
  'Avoid blur, glare, and harsh shadows',
  'Capture the complete leaf surface from tip to petiole base',
  'Inspect both upper and lower leaf surfaces for early lesion signs'
];

export const HEALTHY_MONITORING_PRECAUTIONS = [
  'Maintain scheduled drip hydration without waterlogging root zones',
  'Conduct routine weekly field scouting under leaf undersides',
  'Preserve balanced soil nutrition and organic matter content',
  'Disinfect pruning shears and harvesting knives between rows'
];

/**
 * Resolves the crop name from prediction payload, top_predictions, or class mappings.
 * Returns null if the crop cannot be reliably determined.
 */
export function resolveCrop(result) {
  if (!result) return null;

  // 1. Direct match on top_predictions[0].crop
  const topCandidate = result.top_predictions?.[0];
  if (topCandidate?.crop && typeof topCandidate.crop === 'string') {
    const matched = matchCanonicalCrop(topCandidate.crop);
    if (matched) return matched;
  }

  // 2. Class ID lookup in CANONICAL_CLASSES
  if (topCandidate && typeof topCandidate.class_id === 'number') {
    const foundClass = CANONICAL_CLASSES.find((c) => c.id === topCandidate.class_id);
    if (foundClass) return foundClass.crop;
  }

  // 3. Match from top_candidate disease or class name
  if (topCandidate?.disease) {
    const matched = extractCropFromText(topCandidate.disease);
    if (matched) return matched;
  }
  if (topCandidate?.class) {
    const matched = extractCropFromText(topCandidate.class);
    if (matched) return matched;
  }

  // 4. Match from top-level result.crop (if not generic/undetermined)
  if (result.crop && typeof result.crop === 'string') {
    const trimmed = result.crop.trim();
    if (trimmed.toLowerCase() !== 'undetermined' && trimmed.toLowerCase() !== 'crop') {
      const matched = matchCanonicalCrop(trimmed);
      if (matched) return matched;
    }
  }

  // 5. Match from top-level result.disease or result.class
  if (result.disease && typeof result.disease === 'string') {
    const matched = extractCropFromText(result.disease);
    if (matched) return matched;
  }
  if (result.class && typeof result.class === 'string') {
    const matched = extractCropFromText(result.class);
    if (matched) return matched;
  }

  return null;
}

/**
 * Checks if a string matches one of the 7 supported crops.
 */
function matchCanonicalCrop(cropName) {
  if (!cropName) return null;
  const lower = cropName.trim().toLowerCase();
  for (const canonical of SUPPORTED_CROPS) {
    if (canonical.toLowerCase() === lower) {
      return canonical;
    }
  }
  return null;
}

/**
 * Extracts crop name from class name strings (e.g. "Grape_Black_Rot", "Tomato___Early_blight").
 */
function extractCropFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  if (lower.startsWith('bell_pepper') || lower.startsWith('bell pepper') || lower.includes('bell pepper')) {
    return 'Bell Pepper';
  }
  if (lower.startsWith('apple') || lower.includes('apple')) {
    return 'Apple';
  }
  if (lower.startsWith('blueberry') || lower.includes('blueberry')) {
    return 'Blueberry';
  }
  if (lower.startsWith('cherry') || lower.includes('cherry')) {
    return 'Cherry';
  }
  if (lower.startsWith('corn') || lower.includes('corn') || lower.includes('maize')) {
    return 'Corn';
  }
  if (lower.startsWith('grape') || lower.includes('grape')) {
    return 'Grape';
  }
  if (lower.startsWith('orange') || lower.includes('orange') || lower.includes('citrus')) {
    return 'Orange';
  }
  if (lower.startsWith('peach') || lower.includes('peach')) {
    return 'Peach';
  }
  if (lower.startsWith('potato') || lower.includes('potato')) {
    return 'Potato';
  }
  if (lower.startsWith('raspberry') || lower.includes('raspberry')) {
    return 'Raspberry';
  }
  if (lower.startsWith('soybean') || lower.includes('soybean') || lower.includes('soyabean')) {
    return 'Soybean';
  }
  if (lower.startsWith('squash') || lower.includes('squash')) {
    return 'Squash';
  }
  if (lower.startsWith('strawberry') || lower.includes('strawberry')) {
    return 'Strawberry';
  }
  if (lower.startsWith('tomato') || lower.includes('tomato')) {
    return 'Tomato';
  }

  return null;
}

/**
 * Resolves confidence float (0.0 to 1.0), formatted string, and safety tier.
 */
export function resolveConfidence(result) {
  if (!result) {
    return {
      rawScore: 0,
      percentStr: '0%',
      percentNum: 0,
      isLowConfidence: true,
      tier: 'Low Confidence',
      barColor: '#ef4444'
    };
  }

  let rawScore = 0;
  if (typeof result.confidence_score === 'number' && !isNaN(result.confidence_score)) {
    rawScore = result.confidence_score;
  } else if (result.confidence) {
    const parsed = parseFloat(result.confidence);
    if (!isNaN(parsed)) {
      rawScore = parsed > 1.0 ? parsed / 100 : parsed;
    }
  }

  // Bound within [0.0, 1.0]
  rawScore = Math.max(0.0, Math.min(1.0, rawScore));
  const percentNum = Math.round(rawScore * 100);
  const percentStr = `${percentNum}%`;

  // Safety gate: exactly 65% is required for confirmed diagnosis
  const isLowConfidence = rawScore < 0.65;

  let tier = 'Low Confidence';
  let barColor = '#ef4444'; // amber/red warning

  if (rawScore >= 0.85) {
    tier = 'High Confidence';
    barColor = '#10b981'; // emerald green
  } else if (rawScore >= 0.65) {
    tier = 'Moderate Confidence';
    barColor = '#f59e0b'; // golden amber
  } else {
    tier = 'Low Confidence';
    barColor = '#ef4444'; // warning orange/red
  }

  return {
    rawScore,
    percentStr,
    percentNum,
    isLowConfidence,
    tier,
    barColor
  };
}

/**
 * Checks if the predicted condition is Healthy with valid confidence.
 */
export function isHealthyClass(result, isLowConfidence) {
  if (!result || isLowConfidence) return false;

  const status = result.status?.toLowerCase() || '';
  const disease = result.disease?.toLowerCase() || '';
  const topCandidateDisease = result.top_predictions?.[0]?.disease?.toLowerCase() || '';

  return status === 'healthy' || disease.includes('healthy') || topCandidateDisease.includes('healthy');
}

/**
 * Safely resolves causal pathogen, preventing fabrications.
 */
export function resolvePathogen(result, isLowConfidence, isHealthy) {
  if (isLowConfidence || isHealthy) return null;

  if (result.pathogen && result.pathogen !== 'None' && result.pathogen !== 'N/A' && result.pathogen !== 'null') {
    return result.pathogen;
  }

  // Lookup canonical pathogen if available
  const topCandidate = result.top_predictions?.[0];
  if (topCandidate && typeof topCandidate.class_id === 'number') {
    const meta = CANONICAL_CLASSES.find((c) => c.id === topCandidate.class_id);
    if (meta && meta.pathogen) {
      return meta.pathogen;
    }
  }

  return 'Pathogen information unavailable.';
}
