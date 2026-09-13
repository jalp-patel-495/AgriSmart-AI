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
  'Corn',
  'Potato',
  'Tomato',
  'Grape',
  'Bell Pepper',
  'Peach'
];

export const CANONICAL_CLASSES = [
  { id: 0, name: 'Apple___Apple_scab', crop: 'Apple', disease: 'Apple Scab', status: 'Diseased', pathogen: 'Venturia inaequalis (Fungus)' },
  { id: 1, name: 'Apple___Black_rot', crop: 'Apple', disease: 'Black Rot', status: 'Diseased', pathogen: 'Botryosphaeria obtusa (Fungus)' },
  { id: 2, name: 'Apple___healthy', crop: 'Apple', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 3, name: 'Corn___Common_rust', crop: 'Corn', disease: 'Common Rust', status: 'Diseased', pathogen: 'Puccinia sorghi (Fungus)' },
  { id: 4, name: 'Corn___Northern_Leaf_Blight', crop: 'Corn', disease: 'Northern Leaf Blight', status: 'Diseased', pathogen: 'Exserohilum turcicum (Fungus)' },
  { id: 5, name: 'Corn___healthy', crop: 'Corn', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 6, name: 'Potato___Early_blight', crop: 'Potato', disease: 'Early Blight', status: 'Diseased', pathogen: 'Alternaria solani (Fungus)' },
  { id: 7, name: 'Potato___Late_blight', crop: 'Potato', disease: 'Late Blight', status: 'Diseased', pathogen: 'Phytophthora infestans (Oomycete)' },
  { id: 8, name: 'Potato___healthy', crop: 'Potato', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 9, name: 'Tomato___Bacterial_spot', crop: 'Tomato', disease: 'Bacterial Spot', status: 'Diseased', pathogen: 'Xanthomonas perforans (Bacteria)' },
  { id: 10, name: 'Tomato___Early_blight', crop: 'Tomato', disease: 'Early Blight', status: 'Diseased', pathogen: 'Alternaria solani (Fungus)' },
  { id: 11, name: 'Tomato___Late_blight', crop: 'Tomato', disease: 'Late Blight', status: 'Diseased', pathogen: 'Phytophthora infestans (Oomycete)' },
  { id: 12, name: 'Tomato___healthy', crop: 'Tomato', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 13, name: 'Grape_Black_Rot', crop: 'Grape', disease: 'Black Rot', status: 'Diseased', pathogen: 'Guignardia bidwellii (Fungus)' },
  { id: 14, name: 'Grape_Healthy', crop: 'Grape', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 15, name: 'Bell_Pepper_Bacterial_Spot', crop: 'Bell Pepper', disease: 'Bacterial Spot', status: 'Diseased', pathogen: 'Xanthomonas campestris pv. vesicatoria (Bacteria)' },
  { id: 16, name: 'Bell_Pepper_Healthy', crop: 'Bell Pepper', disease: 'Healthy', status: 'Healthy', pathogen: null },
  { id: 17, name: 'Peach_Bacterial_Spot', crop: 'Peach', disease: 'Bacterial Spot', status: 'Diseased', pathogen: 'Xanthomonas arboricola pv. pruni (Bacteria)' },
  { id: 18, name: 'Peach_Healthy', crop: 'Peach', disease: 'Healthy', status: 'Healthy', pathogen: null }
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
  if (lower.startsWith('corn') || lower.includes('corn')) {
    return 'Corn';
  }
  if (lower.startsWith('potato') || lower.includes('potato')) {
    return 'Potato';
  }
  if (lower.startsWith('tomato') || lower.includes('tomato')) {
    return 'Tomato';
  }
  if (lower.startsWith('grape') || lower.includes('grape')) {
    return 'Grape';
  }
  if (lower.startsWith('peach') || lower.includes('peach')) {
    return 'Peach';
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
