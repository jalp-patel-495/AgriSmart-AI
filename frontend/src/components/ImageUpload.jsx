import React, { useState, useRef, useEffect } from 'react';

export default function ImageUpload({ onDiagnose, isAnalyzing }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // Default to rear camera for field crops
  const [cameraError, setCameraError] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Camera Management
  const startCamera = async (mode = facingMode) => {
    setCameraError(null);
    setIsCameraOpen(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError('Camera access not permitted or unavailable on this device.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `leaf_camera_snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
        processFile(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // File Dropzone handlers
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
    if (!selectedFile) return;
    onDiagnose(selectedFile);
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">📸 Crop Leaf Inspector</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-emerald)', fontWeight: 600 }}>
          {selectedFile ? 'Ready to Scan' : 'Upload or Snap'}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {/* Image Preview or Dropzone */}
      {previewUrl ? (
        <div className="upload-preview-wrapper">
          <img src={previewUrl} alt="Crop Leaf Preview" className="upload-preview-img" />
          {isAnalyzing && <div className="scanner-laser" />}
          {!isAnalyzing && (
            <button className="btn-remove-preview" title="Remove image" onClick={clearImage}>
              ✕
            </button>
          )}
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
          <div className="dropzone-title">Click to browse or drop leaf photo here</div>
          <p className="dropzone-hint">High-resolution field photo (JPEG, PNG, WebP up to 20MB)</p>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="upload-buttons-row">
        <button className="btn-secondary" onClick={() => startCamera()}>
          📷 Open Field Camera
        </button>
        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
          📁 Select File
        </button>
      </div>

      {/* Diagnose CTA */}
      <div style={{ marginTop: '1.25rem' }}>
        <button
          className="btn-primary"
          disabled={!selectedFile || isAnalyzing}
          onClick={triggerDiagnose}
        >
          {isAnalyzing ? '🔬 Running PyTorch Neural Diagnostics...' : '🔍 Analyze Leaf Condition'}
        </button>
      </div>

      {/* Camera Modal Viewfinder */}
      {isCameraOpen && (
        <div className="camera-modal-backdrop">
          <div className="camera-modal">
            <div className="camera-viewfinder">
              <video ref={videoRef} autoPlay playsInline className="camera-video-feed" />
              <div className="viewfinder-crosshair" />
            </div>

            {cameraError && (
              <div style={{ padding: '0.75rem 1rem', background: '#7f1d1d', color: '#fecaca', fontSize: '0.85rem' }}>
                ⚠️ {cameraError}
              </div>
            )}

            <div className="camera-actions">
              <button className="btn-secondary" style={{ width: 'auto' }} onClick={stopCamera}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ width: 'auto', padding: '0.6rem 1.5rem', borderRadius: '999px' }}
                onClick={capturePhoto}
              >
                📸 Capture Leaf
              </button>
              <button className="btn-secondary" style={{ width: 'auto' }} onClick={flipCamera}>
                🔄 Flip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
