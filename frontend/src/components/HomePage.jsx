import React from 'react';
import droneScannerHq from '../assets/smart_drone_scanner_ultra_hq.png';

export default function HomePage({
  onExploreDashboard,
  onOpenAuth,
  currentUser,
  onNavigateTab
}) {
  const scrollToFeatures = () => {
    const el = document.getElementById('features-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const sampleDiseases = [
    {
      crop: 'Tomato',
      disease: 'Early Blight',
      badge: 'Alternaria solani',
      status: 'Diseased',
      confidence: '98.2%',
      treatment: 'Apply copper-based fungicides; prune lower canopy to restrict soil splash.',
      icon: '🍅',
    },
    {
      crop: 'Potato',
      disease: 'Late Blight',
      badge: 'Phytophthora infestans',
      status: 'Severe Risk',
      confidence: '96.8%',
      treatment: 'Destroy cull piles; apply cymoxanil or metalaxyl formulations immediately.',
      icon: '🥔',
    },
    {
      crop: 'Apple',
      disease: 'Black Rot',
      badge: 'Botryosphaeria obtusa',
      status: 'Diseased',
      confidence: '95.4%',
      treatment: 'Prune mummified fruit and cankered limbs; spray captan at early bloom.',
      icon: '🍏',
    },
    {
      crop: 'Corn',
      disease: 'Common Rust',
      badge: 'Puccinia sorghi',
      status: 'Pustules Active',
      confidence: '97.1%',
      treatment: 'Deploy rust-resistant hybrids; apply triazole foliar spray if threshold met.',
      icon: '🌽',
    },
  ];

  return (
    <div className="home-page">
      {/* Ambient background glows */}
      <div className="home-ambient-glow" />
      <div className="home-ambient-glow-secondary" />

      {/* Hero Section matching Image 1 */}
      <section className="home-hero">
        <div className="hero-split-container">
          {/* Left Column: Typography and CTAs */}
          <div className="hero-left-content">
            <div className="hero-badge">
              <span className="hero-badge-text">NEXT-GEN SMART FARMING</span>
            </div>

            <h1 className="hero-heading">
              AI-Powered Smart<br />Farming for a Healthier<br />Harvest
            </h1>

            <p className="hero-description">
              Detect crop diseases, optimize irrigation, understand weather risks, and get AI-powered farming recommendations — all in one intelligent platform.
            </p>

            <div className="hero-cta-group">
              <button
                className="hero-btn-primary"
                onClick={onExploreDashboard}
                id="hero-explore-btn"
              >
                Explore Dashboard
              </button>

              <button
                className="hero-btn-secondary"
                onClick={scrollToFeatures}
                id="hero-see-works-btn"
              >
                See How It Works
              </button>
            </div>
          </div>

          {/* Right Column: High-Quality Smart Farming AI Drone Scanner Visual */}
          <div className="hero-right-visual">
            <div className="hero-drone-card">
              <img
                src={droneScannerHq}
                alt="AI-Powered Smart Farming Drone Scanning Crops"
                className="hero-drone-image"
              />
              <div className="drone-glow-accent" />
            </div>
          </div>
        </div>
      </section>

      {/* Live Platform Impact Ticker */}
      <section className="home-stats-ticker">
        <div className="stats-ticker-grid">
          <div className="ticker-item">
            <div className="ticker-value">15,014</div>
            <div className="ticker-label">PlantVillage Real Leaf Images</div>
          </div>
          <div className="ticker-item">
            <div className="ticker-value">13</div>
            <div className="ticker-label">Crop Disease Classifiers</div>
          </div>
          <div className="ticker-item">
            <div className="ticker-value">98.4%</div>
            <div className="ticker-label">AI Diagnostic Precision</div>
          </div>
          <div className="ticker-item">
            <div className="ticker-value">FAO-56</div>
            <div className="ticker-label">Dual-Depth Precision Irrigation</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features-section" className="home-features-section">
        <div className="section-header text-center">
          <div className="section-pill">INTELLIGENT AGRICULTURE ECOSYSTEM</div>
          <h2 className="section-title">Engineered for Precision Crop Protection</h2>
          <p className="section-description">
            Combining deep learning computer vision, real-time IoT root-zone telemetry,
            micro-climate intelligence, and generative agronomy AI into a unified portal.
          </p>
        </div>

        <div className="features-grid">
          {/* Card 1: Disease Detector */}
          <div className="feature-card" onClick={() => onNavigateTab('diagnose')}>
            <div className="feature-icon-box green">
              <span>🌿</span>
            </div>
            <div className="feature-tag">PyTorch Vision AI</div>
            <h3 className="feature-heading">Real-Time Leaf Disease Diagnostics</h3>
            <p className="feature-text">
              High-resolution transfer learning models trained on 15,014 verified agricultural
              specimens. Detect early lesions, pathogens, and severity indices in under 400ms.
            </p>
            <div className="feature-action-link">
              <span>Launch Disease Studio →</span>
            </div>
          </div>

          {/* Card 2: Smart Irrigation */}
          <div className="feature-card" onClick={() => onNavigateTab('smart-farming')}>
            <div className="feature-icon-box blue">
              <span>💧</span>
            </div>
            <div className="feature-tag">FAO-56 Dual Zone</div>
            <h3 className="feature-heading">IoT Soil & Irrigation Intelligence</h3>
            <p className="feature-text">
              Physics-based root-zone deficit calculations combining 15cm and 30cm sensor
              telemetry, soil type constants, and rainfall forecasting to prevent crop stress.
            </p>
            <div className="feature-action-link">
              <span>View Irrigation Telemetry →</span>
            </div>
          </div>

          {/* Card 3: Weather */}
          <div className="feature-card" onClick={() => onNavigateTab('weather')}>
            <div className="feature-icon-box amber">
              <span>🌦️</span>
            </div>
            <div className="feature-tag">Micro-Climate</div>
            <h3 className="feature-heading">Agronomic Weather Intelligence</h3>
            <p className="feature-text">
              Live evapotranspiration tracking, leaf wetness hours, and fungal spore outbreak
              warnings calibrated to major agricultural belts across India and global zones.
            </p>
            <div className="feature-action-link">
              <span>Check Weather Radar →</span>
            </div>
          </div>

          {/* Card 4: GenAI Assistant */}
          <div className="feature-card" onClick={() => onNavigateTab('assistant')}>
            <div className="feature-icon-box purple">
              <span>🤖</span>
            </div>
            <div className="feature-tag">Multilingual GenAI</div>
            <h3 className="feature-heading">Kisan AI Agronomist Co-Pilot</h3>
            <p className="feature-text">
              A context-aware AI advisory speaking Hindi, Punjabi, Gujarati, and English.
              Provides tailored chemical dosages, organic remedies, and spray scheduling.
            </p>
            <div className="feature-action-link">
              <span>Ask AI Assistant →</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Disease Diagnostics Showcase */}
      <section className="home-showcase-section">
        <div className="showcase-content">
          <div className="section-pill">FIELD-PROVEN AI DETECTION</div>
          <h2 className="section-title">Trained on Real Agricultural Pathology</h2>
          <p className="section-description">
            Sample diagnosis cards powered by our 15,014-image dataset. Click any disease
            specimen below to test detection or launch the diagnostic camera.
          </p>

          <div className="disease-samples-grid">
            {sampleDiseases.map((item, idx) => (
              <div
                key={idx}
                className="disease-sample-card"
                onClick={() => onNavigateTab('diagnose')}
              >
                <div className="sample-card-top">
                  <span className="sample-crop-icon">{item.icon}</span>
                  <span className="sample-confidence-pill">{item.confidence} Confidence</span>
                </div>
                <h4 className="sample-disease-name">{item.crop} – {item.disease}</h4>
                <div className="sample-pathogen-tag">{item.badge}</div>
                <p className="sample-treatment-text">{item.treatment}</p>
                <div className="sample-cta-btn">
                  <span>Diagnose Leaf Specimen →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Step Highlights */}
      <section className="home-workflow-section">
        <div className="section-header text-center">
          <div className="section-pill">HOW IT WORKS</div>
          <h2 className="section-title">Three Steps to Healthy Crops</h2>
        </div>

        <div className="workflow-steps-row">
          <div className="workflow-step-card">
            <div className="step-number">01</div>
            <div className="step-icon">📸</div>
            <h4>Capture or Upload Leaf</h4>
            <p>Snap a photo of the affected plant leaf directly from the field using your phone or desktop camera.</p>
          </div>

          <div className="workflow-connector">→</div>

          <div className="workflow-step-card">
            <div className="step-number">02</div>
            <div className="step-icon">⚡</div>
            <h4>Instant AI Inference</h4>
            <p>Our neural network extracts cellular lesion patterns and matches against thousands of verified disease instances.</p>
          </div>

          <div className="workflow-connector">→</div>

          <div className="workflow-step-card">
            <div className="step-number">03</div>
            <div className="step-icon">🛡️</div>
            <h4>Precision Treatment</h4>
            <p>Receive actionable chemical & organic spray prescriptions, irrigation guidance, and weather spray windows.</p>
          </div>
        </div>
      </section>

      {/* Final Call to Action Banner */}
      <section className="home-cta-banner">
        <div className="cta-banner-card">
          <div className="cta-leaf-badge">🌱</div>
          <h2 className="cta-title">Ready to Elevate Your Farm’s Productivity?</h2>
          <p className="cta-subtitle">
            Join forward-thinking growers and agronomists using AgriSmart AI for early detection and precision irrigation.
          </p>
          <div className="cta-btn-wrapper">
            <button className="cta-primary-btn" onClick={onExploreDashboard}>
              Open Farmer Dashboard →
            </button>
            {!currentUser && (
              <button className="cta-secondary-btn" onClick={() => onOpenAuth('signup')}>
                Create Free Account
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="footer-logo">
              <span>🌱</span>
              <span className="footer-brand-text">AgriSmart AI</span>
            </div>
            <p className="footer-tagline">
              Intelligent crop health, IoT precision irrigation, and agronomic advisory platform.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h5>Platform</h5>
              <button onClick={() => onNavigateTab('dashboard')}>Farmer Dashboard</button>
              <button onClick={() => onNavigateTab('diagnose')}>Disease Detector</button>
              <button onClick={() => onNavigateTab('smart-farming')}>Smart Irrigation</button>
            </div>
            <div className="footer-col">
              <h5>Intelligence</h5>
              <button onClick={() => onNavigateTab('weather')}>Weather Engine</button>
              <button onClick={() => onNavigateTab('assistant')}>GenAI Advisory</button>
            </div>
            <div className="footer-col">
              <h5>Account</h5>
              {currentUser ? (
                <span>Signed in as <strong>{currentUser.full_name}</strong></span>
              ) : (
                <button onClick={() => onOpenAuth('login')}>Sign In to Portal</button>
              )}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 AgriSmart AI. Open Agriculture Intelligence Initiative.</span>
        </div>
      </footer>
    </div>
  );
}
