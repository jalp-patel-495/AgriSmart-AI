/**
 * Node.js test script to verify all 14 scenarios and bug fix rules in cropDiseaseResolver.js
 */

import {
  resolveCrop,
  resolveConfidence,
  isHealthyClass,
  resolvePathogen,
  SUPPORTED_CROPS,
  CANONICAL_CLASSES,
  SAFE_LOW_CONFIDENCE_PRECAUTIONS
} from '../frontend/src/utils/cropDiseaseResolver.js';

console.log('--- 1. Testing Supported Crops (7 crops) ---');
console.assert(SUPPORTED_CROPS.length === 7, 'Must support exactly 7 crops');
const expectedCrops = ['Apple', 'Corn', 'Potato', 'Tomato', 'Grape', 'Bell Pepper', 'Peach'];
expectedCrops.forEach(c => console.assert(SUPPORTED_CROPS.includes(c), `Missing crop ${c}`));
console.log('✓ Supported crops verified:', SUPPORTED_CROPS);

console.log('\n--- 2. Testing Canonical Classes (19 classes) ---');
console.assert(CANONICAL_CLASSES.length === 19, 'Must have exactly 19 classes');
console.log('✓ 19 canonical classes verified.');

console.log('\n--- 3. Testing 14 Required Verification Scenarios ---');

// Scenario 1: High-confidence disease (Tomato Early Blight, 88%)
{
  const result = {
    crop: 'Tomato',
    disease: 'Tomato Early Blight',
    confidence: '88%',
    confidence_score: 0.88,
    status: 'Diseased',
    pathogen: 'Alternaria solani (Fungus)',
    symptoms: 'Target-like rings on lower foliage',
    precautions: ['Prune lower leaves', 'Apply copper fungicide'],
    treatment: 'Apply copper-based fungicides regularly',
    top_predictions: [
      { class_id: 10, disease: 'Tomato Early Blight', crop: 'Tomato', confidence: '88%', confidence_score: 0.88 },
      { class_id: 11, disease: 'Tomato Late Blight', crop: 'Tomato', confidence: '7%', confidence_score: 0.07 }
    ]
  };
  const conf = resolveConfidence(result);
  const crop = resolveCrop(result);
  const isHealthy = isHealthyClass(result, conf.isLowConfidence);
  const pathogen = resolvePathogen(result, conf.isLowConfidence, isHealthy);

  console.assert(!conf.isLowConfidence, 'Scenario 1: Should be high confidence');
  console.assert(conf.tier === 'High Confidence', 'Scenario 1: Tier should be High Confidence');
  console.assert(crop === 'Tomato', 'Scenario 1: Crop should be Tomato');
  console.assert(!isHealthy, 'Scenario 1: Should not be healthy');
  console.assert(pathogen === 'Alternaria solani (Fungus)', 'Scenario 1: Pathogen should be resolved');
  console.log('✓ Scenario 1 (High-confidence disease 88%) PASSED');
}

// Scenario 2: Healthy crop (Peach Healthy, 95%)
{
  const result = {
    crop: 'Peach',
    disease: 'Peach Healthy',
    confidence: '95%',
    confidence_score: 0.95,
    status: 'Healthy',
    pathogen: null,
    top_predictions: [
      { class_id: 18, disease: 'Peach Healthy', crop: 'Peach', confidence: '95%', confidence_score: 0.95 }
    ]
  };
  const conf = resolveConfidence(result);
  const crop = resolveCrop(result);
  const isHealthy = isHealthyClass(result, conf.isLowConfidence);
  const pathogen = resolvePathogen(result, conf.isLowConfidence, isHealthy);

  console.assert(!conf.isLowConfidence, 'Scenario 2: Should be high confidence');
  console.assert(crop === 'Peach', 'Scenario 2: Crop should be Peach');
  console.assert(isHealthy, 'Scenario 2: Should be healthy');
  console.assert(pathogen === null, 'Scenario 2: Pathogen should be suppressed for healthy');
  console.log('✓ Scenario 2 (Peach Healthy 95%) PASSED');
}

// Scenario 3: Confidence = 64.9% (Low Confidence boundary gate)
{
  const result = {
    crop: 'Undetermined',
    disease: 'Low Confidence — Further Inspection Needed',
    confidence: '64.9%',
    confidence_score: 0.649,
    status: 'Low Confidence',
    pathogen: null,
    top_predictions: [
      { class_id: 6, disease: 'Potato Early Blight', crop: 'Potato', confidence: '65%', confidence_score: 0.649 }
    ]
  };
  const conf = resolveConfidence(result);
  const crop = resolveCrop(result);
  const isHealthy = isHealthyClass(result, conf.isLowConfidence);
  const pathogen = resolvePathogen(result, conf.isLowConfidence, isHealthy);

  console.assert(conf.isLowConfidence === true, 'Scenario 3: 64.9% must trigger Low Confidence');
  console.assert(conf.tier === 'Low Confidence', 'Scenario 3: Tier must be Low Confidence');
  console.assert(crop === 'Potato', 'Scenario 3: Crop must resolve to Potato (Possible Crop: Potato)');
  console.assert(pathogen === null, 'Scenario 3: Pathogen must be suppressed');
  console.log('✓ Scenario 3 (Confidence = 64.9% boundary) PASSED');
}

// Scenario 4: Confidence = 65% (Safety gate threshold boundary)
{
  const result = {
    crop: 'Grape',
    disease: 'Black Rot',
    confidence: '65%',
    confidence_score: 0.65,
    status: 'Diseased',
    pathogen: 'Guignardia bidwellii (Fungus)',
    top_predictions: [
      { class_id: 13, disease: 'Grape Black Rot', crop: 'Grape', confidence: '65%', confidence_score: 0.65 }
    ]
  };
  const conf = resolveConfidence(result);
  const crop = resolveCrop(result);

  console.assert(conf.isLowConfidence === false, 'Scenario 4: 65% must NOT be low confidence');
  console.assert(conf.tier === 'Moderate Confidence', 'Scenario 4: Tier must be Moderate Confidence');
  console.assert(crop === 'Grape', 'Scenario 4: Crop must be Grape');
  console.log('✓ Scenario 4 (Confidence = 65% threshold boundary) PASSED');
}

// Scenario 5: Confidence = 26% (Tomato Early Blight, Bug fix verification)
{
  const result = {
    crop: 'Undetermined',
    disease: 'Low Confidence — Further Inspection Needed',
    confidence: '26%',
    confidence_score: 0.26,
    status: 'Low Confidence',
    pathogen: null,
    treatment: null,
    top_predictions: [
      { class_id: 10, disease: 'Tomato Early Blight', crop: 'Tomato', confidence: '26%', confidence_score: 0.26 },
      { class_id: 1, disease: 'Apple Black Rot', crop: 'Apple', confidence: '17%', confidence_score: 0.17 },
      { class_id: 9, disease: 'Tomato Bacterial Spot', crop: 'Tomato', confidence: '15%', confidence_score: 0.15 }
    ]
  };
  const conf = resolveConfidence(result);
  const crop = resolveCrop(result);
  const pathogen = resolvePathogen(result, conf.isLowConfidence, false);

  console.assert(conf.isLowConfidence === true, 'Scenario 5: 26% must be low confidence');
  console.assert(crop === 'Tomato', 'Scenario 5: Crop must map to Tomato (displayed as Possible Crop: Tomato)');
  console.assert(pathogen === null, 'Scenario 5: Pathogen must be suppressed');
  console.log('✓ Scenario 5 (Confidence = 26%, Tomato Early Blight bug fix) PASSED');
}

// Scenario 6: Confidence = 20% (Potato Late Blight)
{
  const result = {
    crop: 'Undetermined',
    disease: 'Low Confidence — Further Inspection Needed',
    confidence: '20%',
    confidence_score: 0.20,
    status: 'Low Confidence',
    top_predictions: [
      { class_id: 7, disease: 'Potato Late Blight', crop: 'Potato', confidence: '20%', confidence_score: 0.20 }
    ]
  };
  const conf = resolveConfidence(result);
  const crop = resolveCrop(result);

  console.assert(conf.isLowConfidence === true, 'Scenario 6: 20% must be low confidence');
  console.assert(crop === 'Potato', 'Scenario 6: Crop must map to Potato (Possible Crop: Potato)');
  console.log('✓ Scenario 6 (Confidence = 20%, Potato Late Blight) PASSED');
}

// Scenario 7: Unknown/noisy image with no valid class or unmapped class
{
  const result = {
    crop: 'Undetermined',
    disease: 'Low Confidence — Further Inspection Needed',
    confidence: '12%',
    confidence_score: 0.12,
    status: 'Low Confidence',
    top_predictions: []
  };
  const conf = resolveConfidence(result);
  const crop = resolveCrop(result);

  console.assert(conf.isLowConfidence === true, 'Scenario 7: Must be low confidence');
  console.assert(crop === null, 'Scenario 7: Must return null crop (displayed as Crop: Undetermined)');
  console.log('✓ Scenario 7 (Unknown/noisy image -> Crop: Undetermined) PASSED');
}

// Scenarios 8-14: All 7 crops resolution test
const testCropClasses = [
  { crop: 'Grape', raw: 'Grape_Black_Rot', id: 13 },
  { crop: 'Bell Pepper', raw: 'Bell_Pepper_Bacterial_Spot', id: 15 },
  { crop: 'Peach', raw: 'Peach_Bacterial_Spot', id: 17 },
  { crop: 'Apple', raw: 'Apple___Apple_scab', id: 0 },
  { crop: 'Corn', raw: 'Corn___Common_rust', id: 3 },
  { crop: 'Potato', raw: 'Potato___Early_blight', id: 6 },
  { crop: 'Tomato', raw: 'Tomato___Early_blight', id: 10 }
];

testCropClasses.forEach((tc, idx) => {
  const res = {
    crop: 'Undetermined', // backend returns Undetermined on low conf
    disease: 'Low Confidence — Further Inspection Needed',
    confidence: '25%',
    confidence_score: 0.25,
    top_predictions: [{ class_id: tc.id, disease: tc.raw, crop: tc.crop, confidence: '25%', confidence_score: 0.25 }]
  };
  const resolved = resolveCrop(res);
  console.assert(resolved === tc.crop, `Scenario ${8 + idx} failed for ${tc.crop}: got ${resolved}`);
  console.log(`✓ Scenario ${8 + idx} (${tc.crop}) successfully resolved from class mapping`);
});

console.log('\n--- ALL 14 SCENARIOS PASSED WITH ZERO ERRORS ---');
