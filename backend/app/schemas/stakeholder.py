"""
AgriSmart AI – Agricultural Stakeholder Schemas
Pydantic data transfer schemas for stakeholder intelligence endpoints.
Strictly adheres to Zero Fabricated Data policy.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class StakeholderOverviewKPIs(BaseModel):
    monitored_farms_count: int
    monitored_crops_count: int
    monitored_crops_list: List[str]
    irrigation_records_count: int
    crop_recommendation_records_count: int
    iot_sensors_count: int
    latest_soil_moisture: Optional[str] = None
    latest_crop: Optional[str] = None
    weather_risk_level: str
    indicative_sustainability_score: Optional[str] = None
    agentic_priority_level: str
    active_alerts_count: int


class StakeholderDashboardResponse(BaseModel):
    status: str
    timestamp: str
    stakeholder_profile: Dict[str, Any]
    kpis: StakeholderOverviewKPIs
    macro_kpis: Optional[Dict[str, Any]] = None
    crop_distribution: Optional[List[Dict[str, Any]]] = None
    disease_risks: Optional[List[Dict[str, Any]]] = None
    water_stress_index: Optional[Dict[str, Any]] = None
    climate_risk: Optional[Dict[str, Any]] = None
    sustainability_esg: Optional[Dict[str, Any]] = None
    recent_alerts: Optional[List[Dict[str, Any]]] = None
    regional_summary: Optional[Dict[str, Any]] = None
    field_telemetry_summary: Dict[str, Any]
    weather_summary: Dict[str, Any]
    sustainability_summary: Dict[str, Any]
    data_availability_notice: str


class CropIntelligenceItem(BaseModel):
    crop_name: str
    record_count: int
    avg_confidence: Optional[float] = None
    top_soil_conditions: Optional[str] = None


class CropIntelligenceResponse(BaseModel):
    status: str
    total_recommendations_on_record: int
    top_recommended_crops: List[CropIntelligenceItem]
    crop_distribution: Optional[List[Dict[str, Any]]] = None
    agro_climatic_presets: List[Dict[str, Any]]
    supported_production_crops: List[str]
    empty_state_message: Optional[str] = None


class DiseaseIntelligenceResponse(BaseModel):
    status: str
    total_disease_records: int
    supported_crops_count: int
    supported_crops_list: List[str]
    observations: List[Dict[str, Any]]
    disease_risks: Optional[List[Dict[str, Any]]] = None
    weather_driven_pathogen_risk: Dict[str, Any]
    empty_state_message: Optional[str] = None


class RiskAlertItem(BaseModel):
    id: str
    level: str  # CRITICAL, HIGH, MODERATE, LOW
    category: str  # Disease, Weather, Irrigation, Sustainability, Crop Stress
    what: str
    why: str
    action: str
    source_module: str
    timestamp: str


class StakeholderRisksResponse(BaseModel):
    status: str
    overall_risk_level: str
    total_active_alerts: int
    alerts: List[RiskAlertItem]
    climate_risk: Optional[Dict[str, Any]] = None
    risk_matrix_summary: Dict[str, Any]
    empty_state_message: Optional[str] = None


class RegionalLocationItem(BaseModel):
    region_name: str
    farms_count: int
    primary_crops: List[str]
    weather_risk: str
    irrigation_demand: str
    data_status: str


class RegionalIntelligenceResponse(BaseModel):
    status: str
    total_monitored_regions: int
    regions: List[RegionalLocationItem]
    regional_summary: Optional[Dict[str, Any]] = None
    limitation_notice: str
    empty_state_message: Optional[str] = None


class StakeholderCopilotRequest(BaseModel):
    query: str
    region: Optional[str] = None
    crop: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class StakeholderCopilotResponse(BaseModel):
    status: str
    query: str
    answer: str
    response: Optional[str] = None
    recommended_actions: Optional[List[str]] = None
    grounded_sources: List[str]
    suggested_followups: List[str]
    telemetry_grounding: Dict[str, Any]
