import React, { useState, useRef, useEffect } from 'react';

/**
 * ImageUpload Component for Crop Leaf Specimen Inspection
 * 
 * Features:
 * - Visually active upload card with drag-and-drop & file validation
 * - In-app field camera capture
 * - ONE primary large preview inside Crop Leaf Inspector (no duplicate thumbnails)
 * - File metadata extraction (filename, dimensions, file size)
 * - Prominent, animated Analyze button with disabled, active, and analyzing states
 */
export default function ImageUpload({ onDiagnose, isAnalyzing, onClear }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // Rear camera default for field crops
  const [cameraError, setCameraError] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previewUrl]);

  // Format bytes into readable string
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
  };

  // Process and validate selected image file
  const processFile = (file) => {
    setValidationError(null);

    if (!file) return;

    // Validate mime type
    if (!file.type.startsWith('image/')) {
      setValidationError('Please upload a valid image file (JPEG, PNG, WebP).');
      return;
    }

    // Validate size (max 20MB)
    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      setValidationError('Image size exceeds 20MB limit. Please choose a smaller photo.');
      return;
    }

    // Release previous preview URL if exists
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);

    // Extract natural dimensions
    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  };

  // Clear current image and notify parent
  const handleClearImage = (e) => {
    if (e) e.stopPropagation();
    if (isAnalyzing) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setDimensions(null);
    setValidationError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (onClear) {
      onClear();
    }
  };

  // Drag & drop handlers
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

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

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
        const file = new File([blob], `leaf_snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
        processFile(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  const handleAnalyzeClick = () => {
    if (!selectedFile || isAnalyzing) return;
    onDiagnose(selectedFile);
  };

  return (
    <div className="crop-leaf-inspector">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Validation Error Banner */}
      {validationError && (
        <div style={{
          padding: '0.6rem 0.85rem',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '8px',
          color: '#fca5a5',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>⚠️</span>
          <span>{validationError}</span>
        </div>
      )}

      {/* Primary Specimen Area: ONE Large Preview OR Dropzone */}
      {previewUrl ? (
        <div>
          {/* Card Sub-Header inside Inspector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.6rem',
            padding: '0 0.2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.05rem' }}>📷</span>
              <strong style={{ color: '#fff', fontSize: '0.92rem' }}>Crop Leaf Inspector</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="ready-badge" style={{ position: 'static' }}>
                <span className="ready-dot" />
                Ready to Scan
              </span>
            </div>
          </div>

          {/* Large Leaf Preview Box (320-380px desktop, 240-300px mobile, contain, dark neutral) */}
          <div className="leaf-preview-container">
            <img
              src={previewUrl}
              alt="Leaf Specimen"
              className="leaf-preview-img"
            />

            {/* Scanning laser beam animation during AI inference */}
            {isAnalyzing && <div className="scanner-laser" />}

            {/* Top-right Image Control: Remove */}
            {!isAnalyzing && (
              <button
                type="button"
                className="btn-remove-leaf"
                onClick={handleClearImage}
                title="Remove image"
                aria-label="Remove image"
              >
                ✕
              </button>
            )}
          </div>

          {/* Active Image Selection State Metadata Bar */}
          <div className="leaf-meta-bar" style={{ marginTop: '0.75rem' }}>
            <div className="leaf-meta-left">
              <span style={{ fontSize: '0.95rem' }}>🌿</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.8rem' }}>
                  Leaf specimen ready for analysis
                </span>
                <span className="leaf-filename" title={selectedFile?.name}>
                  {selectedFile?.name || 'leaf_specimen.jpg'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {dimensions && (
                <span className="leaf-file-details">
                  📐 {dimensions.width} × {dimensions.height}
                </span>
              )}
              {selectedFile && (
                <span className="leaf-file-details">
                  💾 {formatFileSize(selectedFile.size)}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty Upload State: Active Dropzone */
        <div
          className={`dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        >
          <div className="dropzone-icon">🌿</div>
          <div className="dropzone-title">Click to browse or drop leaf photo here</div>
          <p className="dropzone-hint">
            Use a clear, well-lit leaf image (JPEG, PNG, WebP up to 20MB)
          </p>
        </div>
      )}

      {/* Action Buttons: Camera & File Selection */}
      <div className="upload-buttons-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => startCamera()}
          disabled={isAnalyzing}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          <span>📷</span>
          <span>Open Field Camera</span>
        </button>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAnalyzing}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          <span>📁</span>
          <span>Select File</span>
        </button>
      </div>

      {/* Prominent Analyze Leaf Condition Button */}
      <button
        type="button"
        className={`btn-analyze-leaf ${isAnalyzing ? 'analyzing' : selectedFile ? 'active' : 'disabled'}`}
        disabled={!selectedFile || isAnalyzing}
        onClick={handleAnalyzeClick}
        aria-label="Analyze Leaf Condition"
      >
        {isAnalyzing ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
              <span style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite' }}>🔄</span>
              Analyzing Leaf...
            </span>
            <span className="analyze-subtext">AI model is processing the specimen</span>
          </>
        ) : (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
              <span>🔍</span>
              Analyze Leaf Condition
            </span>
            {selectedFile && (
              <span className="analyze-subtext">Deep AI multi-crop disease classification</span>
            )}
          </>
        )}
      </button>

      {/* Camera Viewfinder Modal */}
      {isCameraOpen && (
        <div className="camera-modal-backdrop" onClick={stopCamera}>
          <div className="camera-modal" onClick={(e) => e.stopPropagation()}>
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
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto' }}
                onClick={stopCamera}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ width: 'auto', padding: '0.6rem 1.6rem', borderRadius: '999px' }}
                onClick={capturePhoto}
              >
                📸 Capture Leaf
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto' }}
                onClick={flipCamera}
              >
                🔄 Flip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
