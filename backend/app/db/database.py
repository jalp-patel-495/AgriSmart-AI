"""
SQLAlchemy Database Engine for AgriSmart AI
Configured for PostgreSQL with automatic SQLite fallback for turnkey local execution.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agrismart.db")

# SQLite needs connect_args check_same_thread=False
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
except Exception as e:
    print(f"[!] Primary database connection failed: {e}. Falling back to SQLite.")
    DATABASE_URL = "sqlite:///./agrismart.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initializes schema and tables."""
    import backend.app.db.models  # ensure models are registered
    Base.metadata.create_all(bind=engine)
    
    # Safe SQLite column migration for is_active if table was created previously
    try:
        from sqlalchemy import inspect, text
        insp = inspect(engine)
        if "users" in insp.get_table_names():
            columns = [c["name"] for c in insp.get_columns("users")]
            with engine.connect() as conn:
                if "is_active" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                if "organization_name" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN organization_name VARCHAR(150)"))
                if "organization_type" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN organization_type VARCHAR(100)"))
                if "operating_regions" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN operating_regions VARCHAR(255)"))
                if "primary_crops" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN primary_crops VARCHAR(255)"))
                if "stakeholder_type" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN stakeholder_type VARCHAR(100)"))
                if "phone_number" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(50)"))
                if "profile_image" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN profile_image VARCHAR(255)"))
                # Normalize any legacy role strings in database to uppercase canonical
                conn.execute(text("UPDATE users SET role = 'FARMER' WHERE role IS NULL OR role = '' OR LOWER(role) = 'farmer'"))
                conn.execute(text("UPDATE users SET role = 'AGRICULTURAL_EXPERT' WHERE LOWER(role) IN ('agronomist', 'expert', 'agricultural_expert')"))
                conn.execute(text("UPDATE users SET role = 'AGRICULTURAL_STAKEHOLDER' WHERE LOWER(role) IN ('stakeholder', 'agricultural_stakeholder', 'agribusiness', 'agri_stakeholder')"))
                conn.execute(text("UPDATE users SET role = 'ADMIN' WHERE LOWER(role) = 'admin'"))
                conn.commit()

        if "disease_diagnoses" in insp.get_table_names():
            diag_cols = [c["name"] for c in insp.get_columns("disease_diagnoses")]
            with engine.connect() as conn:
                if "expert_reviewed" not in diag_cols:
                    conn.execute(text("ALTER TABLE disease_diagnoses ADD COLUMN expert_reviewed BOOLEAN DEFAULT 0"))
                if "expert_id" not in diag_cols:
                    conn.execute(text("ALTER TABLE disease_diagnoses ADD COLUMN expert_id INTEGER REFERENCES users(id)"))
                if "expert_status" not in diag_cols:
                    conn.execute(text("ALTER TABLE disease_diagnoses ADD COLUMN expert_status VARCHAR(50) DEFAULT 'PENDING'"))
                if "expert_notes" not in diag_cols:
                    conn.execute(text("ALTER TABLE disease_diagnoses ADD COLUMN expert_notes TEXT"))
                if "expert_treatment" not in diag_cols:
                    conn.execute(text("ALTER TABLE disease_diagnoses ADD COLUMN expert_treatment TEXT"))
                if "reviewed_at" not in diag_cols:
                    conn.execute(text("ALTER TABLE disease_diagnoses ADD COLUMN reviewed_at DATETIME"))
                conn.commit()

        if "diseases" in insp.get_table_names():
            dis_cols = [c["name"] for c in insp.get_columns("diseases")]
            with engine.connect() as conn:
                if "expert_reviewed" not in dis_cols:
                    conn.execute(text("ALTER TABLE diseases ADD COLUMN expert_reviewed BOOLEAN DEFAULT 0"))
                    conn.commit()

        if "irrigation_logs" in insp.get_table_names():
            irr_columns = [c["name"] for c in insp.get_columns("irrigation_logs")]
            with engine.connect() as conn:
                if "farmer_id" not in irr_columns:
                    conn.execute(text("ALTER TABLE irrigation_logs ADD COLUMN farmer_id INTEGER REFERENCES users(id)"))
                    conn.commit()

        if "crop_recommendations" in insp.get_table_names():
            rec_columns = [c["name"] for c in insp.get_columns("crop_recommendations")]
            with engine.connect() as conn:
                if "farmer_id" not in rec_columns:
                    conn.execute(text("ALTER TABLE crop_recommendations ADD COLUMN farmer_id INTEGER REFERENCES users(id)"))
                    conn.commit()

        # Seed initial catalog for crops if empty
        with engine.connect() as conn:
            crop_count = conn.execute(text("SELECT COUNT(*) FROM crops")).scalar()
            if crop_count == 0:
                default_crops = [
                    ("Apple", "Malus domestica", "Fruit Crop", "Rabi / Temperate", "High-value deciduous fruit cultivated in temperate northern hills.", "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600"),
                    ("Corn (Maize)", "Zea mays", "Cereal Crop", "Kharif", "Versatile warm-season cereal grain used as staple food and livestock fodder.", "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600"),
                    ("Potato", "Solanum tuberosum", "Tuber Crop", "Rabi", "Nutrient-rich carbohydrate food staple sensitive to late blight foliage fungi.", "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600"),
                    ("Tomato", "Solanum lycopersicum", "Vegetable Crop", "Year-round", "Extensively grown culinary staple prone to early blight and bacterial spots.", "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600"),
                    ("Grape", "Vitis vinifera", "Horticultural Fruit", "Summer / Monsoonal", "Commercial berry crop prone to black rot and powdery mildews in humidity.", "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=600"),
                    ("Bell Pepper", "Capsicum annuum", "Vegetable Crop", "Kharif / Rabi", "Valuable solanaceous vegetable requiring moderate temperatures and disease vigilance.", "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600"),
                    ("Wheat", "Triticum aestivum", "Cereal Grain", "Rabi", "Major Indian food security staple cultivated in northern and central plains.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600"),
                    ("Rice", "Oryza sativa", "Cereal Grain", "Kharif", "Primary dietary staple cultivated with high water uptake across tropical deltas.", "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600")
                ]
                for name, sci_name, cat, szn, desc, img in default_crops:
                    conn.execute(
                        text("INSERT INTO crops (name, scientific_name, category, season, description, image_url, created_at) VALUES (:name, :sci, :cat, :szn, :desc, :img, CURRENT_TIMESTAMP)"),
                        {"name": name, "sci": sci_name, "cat": cat, "szn": szn, "desc": desc, "img": img}
                    )
                conn.commit()

            dis_count = conn.execute(text("SELECT COUNT(*) FROM diseases")).scalar()
            if dis_count == 0:
                default_diseases = [
                    ("Apple", "Apple Scab", "Venturia inaequalis (Fungus)", "Olive-green or dull black velvety spots on leaf surface causing premature foliage loss.", "Apply protective copper fungicide or captan at green-tip stage.", "Prune canopy trees for sunlight aeration; rake and destroy fallen leaf debris in autumn."),
                    ("Apple", "Black Rot", "Botryosphaeria obtusa (Fungus)", "Concentric frog-eye leaf lesions with purple halos and limb cankers.", "Apply thiophanate-methyl or captan fungicide according to regional spray calendars.", "Prune out dead branches and mummified fruit during winter dormancy."),
                    ("Corn (Maize)", "Common Rust", "Puccinia sorghi (Fungus)", "Golden-brown to cinnamon-brown powdery pustules scattered over both leaf surfaces.", "Apply azoxystrobin or propiconazole foliar spray if threshold is breached before silking.", "Sow certified rust-resistant corn hybrid cultivars."),
                    ("Corn (Maize)", "Northern Leaf Blight", "Exserohilum turcicum (Fungus)", "Long, elliptical grayish-green or tan cigar-shaped lesions measuring 2.5 to 15 cm.", "Foliar pyraclostrobin or mancozeb application if lesions develop on ear leaf early.", "Practice 2-year non-host crop rotation and deep tillage of crop debris."),
                    ("Potato", "Early Blight", "Alternaria solani (Fungus)", "Dark brown to black angular target-spot lesions with concentric rings.", "Apply chlorothalonil, mancozeb, or difenoconazole sprays at weekly intervals.", "Maintain adequate crop nitrogen and avoid overhead sprinkler watering in late afternoons."),
                    ("Potato", "Late Blight", "Phytophthora infestans (Oomycete)", "Water-soaked dark lesions on leaf tips with white mildew fuzz on leaf undersides in humid conditions.", "Immediate therapeutic spray with metalaxyl-M + mancozeb or cymoxanil.", "Plant certified disease-free seed tubers and monitor regional blight warnings."),
                    ("Tomato", "Bacterial Spot", "Xanthomonas perforans (Bacterium)", "Small water-soaked circular dark lesions surrounded by yellowish chlorotic halos.", "Copper hydroxide combined with mancozeb bactericide spray.", "Avoid overhead irrigation; use drip watering and sanitize field pruning stakes."),
                    ("Tomato", "Early Blight", "Alternaria linariae (Fungus)", "Target-like concentric ring spots on lower older foliage progressing upwards.", "Apply azoxystrobin or chlorothalonil preventive fungicide.", "Mulch base of tomato plants to prevent soil splash onto lower foliage.")
                ]
                for crop, dname, path, symp, treat, prev in default_diseases:
                    conn.execute(
                        text("INSERT INTO diseases (crop_name, name, pathogen, symptoms, treatment, prevention, created_at) VALUES (:crop, :name, :path, :symp, :treat, :prev, CURRENT_TIMESTAMP)"),
                        {"crop": crop, "name": dname, "path": path, "symp": symp, "treat": treat, "prev": prev}
                    )
                conn.commit()
    except Exception as e:
        print(f"[!] DB migration notice: {e}")

    print(f"[*] Database initialized ({DATABASE_URL.split('://')[0].upper()}).")


