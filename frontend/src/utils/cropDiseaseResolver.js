/**
 * AgriSmart AI – Universal Multi-Crop & Disease Scientific Resolution Utility
 * 
 * Enforces scientific safety thresholds, dynamic class mappings, and taxonomy resolution
 * across all 14 supported crop species and 38 disease/healthy classes.
 * 
 * Dynamic catalog loaded directly from class_registry.json.
 * 
 * Safety Rules:
 * - Disease Confidence < 65%: LOW CONFIDENCE safety gate.
 *   - Disease is NOT confirmed ("Not confidently identified").
 *   - Crop species is PRESERVED if identified with valid evidence.
 *   - Pathogens, chemical dosages, and treatments are STRICTLY SUPPRESSED.
 *   - Differential diagnosis percentages are HIDDEN.
 * - Disease Confidence >= 65%: Verified prediction displayed.
 * - Healthy: General monitoring advice, pathology sections suppressed.
 */

import classRegistry from './class_registry.json';

export const TOTAL_SUPPORTED_CROPS = classRegistry?.total_supported_crops || 14;
export const TOTAL_SUPPORTED_CLASSES = classRegistry?.total_supported_classes || 38;

export const SUPPORTED_CROPS = classRegistry?.crops
  ? classRegistry.crops.map((c) => c.name)
  : [
      'Apple', 'Blueberry', 'Cherry', 'Corn', 'Grape',
      'Orange', 'Peach', 'Pepper, bell', 'Potato', 'Raspberry',
      'Soybean', 'Squash', 'Strawberry', 'Tomato'
    ];

export const CANONICAL_CLASSES = classRegistry?.classes
  ? classRegistry.classes.map((c) => ({
      id: c.class_index,
      name: c.raw_class_name,
      crop: c.crop_name,
      disease: c.disease_name,
      status: c.status,
      pathogen: c.pathogen
    }))
  : [];

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
 * Normalizes crop names across naming conventions (e.g. 'Pepper, bell' vs 'Bell Pepper').
 */
export function normalizeCropName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  
  if (lower === 'bell pepper' || lower === 'pepper, bell' || lower === 'pepper bell' || lower === 'pepper') {
    return 'Pepper, bell';
  }
  if (lower.startsWith('cherry')) {
    return 'Cherry';
  }
  if (lower.startsWith('corn')) {
    return 'Corn';
  }
  return matchCanonicalCrop(trimmed) || trimmed;
}

/**
 * Resolves the crop name from prediction payload, top_predictions, or class mappings.
 * Returns null if OOD or image quality insufficient.
 * Preserves detected crop species even when disease confidence is below the 65% gate!
 */
export function resolveCrop(result) {
  if (!result) return null;

  // Quality failure: Crop is Undetermined
  if (result.status === 'image_quality_insufficient' || result.quality_ok === false) {
    return null;
  }

  // Genuine OOD or Unsupported species
  if (result.is_ood === true || result.is_supported === false || result.crop === 'Unsupported / Unknown') {
    return null;
  }

  // 1. Direct match on top-level result.crop (e.g. Tomato, Apple, Corn, Peach, etc.)
  if (result.crop && typeof result.crop === 'string') {
    const trimmed = result.crop.trim();
    if (trimmed.toLowerCase() !== 'undetermined' && trimmed.toLowerCase() !== 'crop' && trimmed.toLowerCase() !== 'unsupported / unknown') {
      const matched = matchCanonicalCrop(trimmed);
      if (matched) return matched;
      return trimmed;
    }
  }

  // 2. Direct match on top_predictions[0].crop
  const topCandidate = result.top_predictions?.[0];
  if (topCandidate?.crop && typeof topCandidate.crop === 'string') {
    const matched = matchCanonicalCrop(topCandidate.crop);
    if (matched) return matched;
    return topCandidate.crop;
  }

  // 3. Class ID lookup in CANONICAL_CLASSES
  if (topCandidate && typeof topCandidate.class_id === 'number') {
    const foundClass = CANONICAL_CLASSES.find((c) => c.id === topCandidate.class_id);
    if (foundClass) return foundClass.crop;
  }

  // 4. Match from top_candidate disease or class name
  if (topCandidate?.disease) {
    const matched = extractCropFromText(topCandidate.disease);
    if (matched) return matched;
  }
  if (topCandidate?.class) {
    const matched = extractCropFromText(topCandidate.class);
    if (matched) return matched;
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
 * Checks if a string matches one of the 14 supported crops.
 */
function matchCanonicalCrop(cropName) {
  if (!cropName) return null;
  const lower = cropName.trim().toLowerCase();
  
  if (lower === 'bell pepper' || lower === 'pepper, bell' || lower === 'pepper bell' || lower === 'pepper') {
    return 'Pepper, bell';
  }

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

  if (lower.includes('bell_pepper') || lower.includes('bell pepper') || lower.includes('pepper,_bell')) {
    return 'Pepper, bell';
  }
  if (lower.includes('apple')) return 'Apple';
  if (lower.includes('blueberry')) return 'Blueberry';
  if (lower.includes('cherry')) return 'Cherry';
  if (lower.includes('corn') || lower.includes('maize')) return 'Corn';
  if (lower.includes('grape')) return 'Grape';
  if (lower.includes('orange') || lower.includes('citrus')) return 'Orange';
  if (lower.includes('peach')) return 'Peach';
  if (lower.includes('potato')) return 'Potato';
  if (lower.includes('raspberry')) return 'Raspberry';
  if (lower.includes('soybean') || lower.includes('soyabean')) return 'Soybean';
  if (lower.includes('squash')) return 'Squash';
  if (lower.includes('strawberry')) return 'Strawberry';
  if (lower.includes('tomato')) return 'Tomato';

  return null;
}

/**
 * Resolves confidence float (0.0 to 1.0), formatted string, safety tier,
 * and distinct crop confidence vs disease confidence.
 */
export function resolveConfidence(result) {
  if (!result) {
    return {
      rawScore: 0,
      percentStr: '0%',
      percentNum: 0,
      isLowConfidence: true,
      tier: 'Low Confidence',
      barColor: '#ef4444',
      cropConfidenceStr: '0%',
      cropConfidenceScore: 0.0
    };
  }

  // 1. Disease Confidence
  let rawScore = 0;
  if (typeof result.disease_confidence === 'number' && !isNaN(result.disease_confidence)) {
    rawScore = result.disease_confidence;
  } else if (typeof result.confidence_score === 'number' && !isNaN(result.confidence_score)) {
    rawScore = result.confidence_score;
  } else if (result.confidence) {
    const str = String(result.confidence).trim();
    const parsed = parseFloat(str);
    if (!isNaN(parsed)) {
      rawScore = str.endsWith('%') ? parsed / 100 : (parsed > 1.0 ? parsed / 100 : parsed);
    }
  }

  // 2. Crop Confidence
  let cropScore = 0;
  if (typeof result.crop_confidence === 'number' && !isNaN(result.crop_confidence)) {
    cropScore = result.crop_confidence;
  } else if (typeof result.top_crop_confidence === 'number' && !isNaN(result.top_crop_confidence)) {
    cropScore = result.top_crop_confidence;
  } else {
    cropScore = rawScore;
  }

  rawScore = Math.max(0.0, Math.min(1.0, rawScore));
  cropScore = Math.max(0.0, Math.min(1.0, cropScore));

  const percentNum = rawScore * 100;
  let percentStr = '';
  if (percentNum <= 0) {
    percentStr = '0%';
  } else if (percentNum < 1.0) {
    percentStr = `${percentNum.toFixed(2)}%`;
  } else {
    percentStr = `${Math.round(percentNum)}%`;
  }

  const cropPercentNum = cropScore * 100;
  let cropPercentStr = '';
  if (cropPercentNum <= 0) {
    cropPercentStr = '0%';
  } else if (cropPercentNum < 1.0) {
    cropPercentStr = `${cropPercentNum.toFixed(2)}%`;
  } else {
    cropPercentStr = `${Math.round(cropPercentNum)}%`;
  }

  // Safety gate: exactly 65% disease confidence is required for confirmed diagnosis
  const isLowConfidence = rawScore < 0.65;

  let tier = 'Low Confidence';
  let barColor = '#ef4444';

  if (rawScore >= 0.85) {
    tier = 'High Confidence';
    barColor = '#10b981';
  } else if (rawScore >= 0.65) {
    tier = 'Moderate Confidence';
    barColor = '#f59e0b';
  } else {
    tier = 'Low Confidence';
    barColor = '#ef4444';
  }

  return {
    rawScore,
    percentStr,
    percentNum,
    isLowConfidence,
    tier,
    barColor,
    cropConfidenceScore: cropScore,
    cropConfidenceStr: cropPercentStr
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
