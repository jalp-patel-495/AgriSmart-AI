import React, { useState } from 'react';
import ImageUpload from '../ImageUpload';
import ResultView from '../ResultView';
import { predictCropDisease } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_CROPS } from '../../utils/cropDiseaseResolver';

/**
 * Crop Disease Detection Studio
 * 
 * Clean, professional, visually active, responsive AI diagnostic studio.
 * Layout Structure:
 * - Disease Detection Studio Header (with Scan History & Treatment Catalog buttons)
 * - Step 1: Capture or Upload Leaf Specimen (Crop Leaf Inspector with single large preview & Analyze CTA)
 * - Step 2: Diagnostic Outcome & Prescription (Field Diagnostic Report)
 * - Multi-Crop Supported Specimen Classes flowing chip section
 */
export default function FarmerDiseaseDetection() {
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleDiagnose = async (file) => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const data = await predictCropDisease(file);
      setResult(data);
    } catch (err) {
      console.error('Diagnosis error:', err);
      setError(err.message || 'Error occurred while contacting the AI inference engine.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  // Crop emojis dictionary for visual polish
  const cropIcons = {
    'Apple': '🍎',
    'Blueberry': '🫐',
    'Cherry': '🍒',
    'Corn': '🌽',
    'Grape': '🍇',
    'Orange': '🍊',
    'Peach': '🍑',
    'Bell Pepper': '🫑',
    'Potato': '🥔',
    'Raspberry': '🫐',
    'Soybean': '🌱',
    'Squash': '🎃',
    'Strawberry': '🍓',
    'Tomato': '🍅',
  };

  return (
    <div className="role-page-container disease-detection-page">
      {/* Studio Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag">38 supported disease & healthy classes</span>
          <h1 className="page-main-title">🔬 Crop Disease Detection Studio</h1>
          <p className="page-desc">
            Snap or upload a leaf photograph to classify plant health, detect supported plant diseases, and receive AI-powered diagnostic guidance.
          </p>
        </div>

        <div className="header-action-group">
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => navigate('/farmer/disease-history')}
            title="View previous diagnostic scans"
          >
            📋 Scan History
          </button>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => navigate('/farmer/treatments')}
            title="Browse agronomic treatment library"
          >
            💊 Treatment Catalog
          </button>
        </div>
      </div>

      {/* Multi-Crop Supported Specimen Classes (Upper Placement) */}
      <div className="supported-crops-section">
        <div className="supported-crops-header">
          <div className="supported-crops-title">
            <span>🌱</span>
            <span>Multi-Crop Supported Specimen Classes</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600 }}>
            Universal Model Coverage • 38 Classes
          </span>
        </div>

        <div className="supported-crops-grid">
          {SUPPORTED_CROPS.map((cropName) => (
            <div key={cropName} className="crop-specimen-chip">
              <span>{cropIcons[cropName] || '🌿'}</span>
              <span>{cropName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Studio Grid: Step 1 & Step 2 */}
      <div className="detection-studio-grid">
        {/* Left Column: Step 1 — Capture or Upload */}
        <div className="studio-upload-column">
          <div className="studio-card">
            <div className="card-header-bar">
              <div className="card-header-left">
                <span className="step-badge">Step 1</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 700 }}>
                  Capture or Upload Leaf Specimen
                </h3>
              </div>
            </div>
            <p className="card-hint">
              Position the leaf flat with clear natural daylight and sharp focus. Avoid harsh shadows, glare, or cluttered backgrounds.
            </p>

            {/* In-place Inspector with large preview, camera, dropzone, metadata & analyze CTA */}
            <ImageUpload
              onDiagnose={handleDiagnose}
              isAnalyzing={isAnalyzing}
              onClear={handleReset}
            />
          </div>
        </div>

        {/* Right Column: Step 2 — Diagnostic Outcome & Prescription */}
        <div className="studio-result-column">
          <div className="studio-card result-panel-card">
            <div className="card-header-bar">
              <div className="card-header-left">
                <span className="step-badge">Step 2</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 700 }}>
                  Diagnostic Outcome & Prescription
                </h3>
              </div>
            </div>

            <ResultView
              result={result}
              isAnalyzing={isAnalyzing}
              error={error}
              onNavigateToWeather={() => navigate('/farmer/weather')}
              onNavigateToAssistant={() => navigate('/farmer/dashboard')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
