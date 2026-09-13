"""
SQLAlchemy ORM Models for Phase 8: Smart Irrigation and Crop Recommendation
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean
from backend.app.db.database import Base


class IrrigationLog(Base):
    __tablename__ = "irrigation_logs"

    id = Column(Integer, primary_key=True, index=True)
    crop_name = Column(String(100), nullable=False)
    soil_type = Column(String(100), nullable=False)
    field_size_hectares = Column(Float, default=1.0)
    moisture_15cm = Column(Float, nullable=False)
    moisture_30cm = Column(Float, nullable=False)
    ambient_temp = Column(Float, nullable=False)
    relative_humidity = Column(Float, nullable=False)
    rain_forecast_mm = Column(Float, default=0.0)
    status = Column(String(50), nullable=False)  # 'Immediate', 'Scheduled', 'Adequate', 'Waterlogged'
    water_amount_litres_per_ha = Column(Float, default=0.0)
    drip_duration_mins = Column(Integer, default=0)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CropRecommendationRecord(Base):
    __tablename__ = "crop_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    nitrogen = Column(Float, nullable=False)
    phosphorus = Column(Float, nullable=False)
    potassium = Column(Float, nullable=False)
    ph = Column(Float, nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    rainfall = Column(Float, nullable=False)
    top_crop_1 = Column(String(100), nullable=False)
    confidence_1 = Column(Float, nullable=False)
    top_crop_2 = Column(String(100), nullable=True)
    confidence_2 = Column(Float, nullable=True)
    top_crop_3 = Column(String(100), nullable=True)
    confidence_3 = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class IoTSensorReading(Base):
    __tablename__ = "iot_sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(50), default="AGRI-NODE-01")
    soil_moisture_15cm = Column(Float, nullable=False)
    soil_moisture_30cm = Column(Float, nullable=False)
    soil_temp = Column(Float, nullable=False)
    electrical_conductivity = Column(Float, nullable=False)
    battery_level = Column(Float, default=98.0)
    timestamp = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    farm_name = Column(String(150), nullable=True, default="My Family Farm")
    farm_location = Column(String(150), nullable=True, default="Punjab, India")
    preferred_crop = Column(String(80), nullable=True, default="Wheat")
    role = Column(String(50), default="FARMER", nullable=False)  # 'FARMER', 'AGRICULTURAL_EXPERT', 'ADMIN'
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

