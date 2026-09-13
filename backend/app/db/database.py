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
                # Normalize any legacy role strings in database to uppercase canonical
                conn.execute(text("UPDATE users SET role = 'FARMER' WHERE role IS NULL OR role = '' OR LOWER(role) = 'farmer'"))
                conn.execute(text("UPDATE users SET role = 'AGRICULTURAL_EXPERT' WHERE LOWER(role) IN ('agronomist', 'expert', 'agricultural_expert')"))
                conn.execute(text("UPDATE users SET role = 'ADMIN' WHERE LOWER(role) = 'admin'"))
                conn.commit()
    except Exception as e:
        print(f"[!] DB migration notice: {e}")

    print(f"[*] Database initialized ({DATABASE_URL.split('://')[0].upper()}).")

