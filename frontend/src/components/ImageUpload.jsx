import React, { useState, useRef } from 'react';

export default function ImageUpload({ onDiagnose, isAnalyzing }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState('All');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const clearImage = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerDiagnose = () => {
    if (!selectedFile && !previewUrl) return;
    onDiagnose(selectedFile, selectedCrop);
  };

  const loadSample = (crop, disease) => {
    // Canvas generated sample for demo
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#1c2822';
    ctx.fillRect(0, 0, 300, 300);
    
    // Leaf body
    ctx.beginPath();
    ctx.ellipse(150, 150, 70, 110, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2d8647';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1b5e20';
    ctx.stroke();
    
    // Disease spots
    if (disease !== 'Healthy') {
      ctx.fillStyle = '#b45309';
      for (let i = 0; i < 8; i++) {
        const x = 120 + Math.random() * 60;
        const y = 90 + Math.random() * 120;
        ctx.beginPath();
        ctx.arc(x, y, 8 + Math.random() * 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `${crop}_${disease.replace(/\s+/g, '_')}.jpg`, { type: 'image/jpeg' });
      processFile(file);
      setSelectedCrop(crop);
    });
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">📸 Crop Leaf Inspector</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Step 1: Upload Image</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {previewUrl ? (
        <div className="upload-preview-wrapper">
          <img src={previewUrl} alt="Crop Leaf Preview" className="upload-preview-img" />
          <button className="btn-remove-preview" title="Remove image" onClick={clearImage}>
            ✕
          </button>
        </div>
      ) : (
        <div
          className={`dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-icon">🍃</div>
          <div className="dropzone-title">Click to browse or drag & drop leaf photo</div>
          <p className="dropzone-hint">Supports high-res JPEG, PNG, or mobile camera uploads (Max 15MB)</p>
        </div>
      )}

      <div style={{ marginTop: '1.25rem' }}>
        <button
          className="btn-primary"
          disabled={!previewUrl || isAnalyzing}
          onClick={triggerDiagnose}
        >
          {isAnalyzing ? '🔬 Running AI Diagnostics...' : '🔍 Analyze Leaf Health'}
        </button>
      </div>

      {/* Quick Test Samples */}
      <div className="samples-row">
        <div className="samples-label">Quick Test Field Samples:</div>
        <div className="sample-buttons">
          <button className="sample-chip" onClick={() => loadSample('Tomato', 'Early Blight')}>
            🍅 Tomato Early Blight
          </button>
          <button className="sample-chip" onClick={() => loadSample('Potato', 'Late Blight')}>
            🥔 Potato Late Blight
          </button>
          <button className="sample-chip" onClick={() => loadSample('Corn', 'Common Rust')}>
            🌽 Corn Common Rust
          </button>
          <button className="sample-chip" onClick={() => loadSample('Apple', 'Healthy')}>
            🍏 Apple Healthy
          </button>
        </div>
      </div>
    </div>
  );
}
