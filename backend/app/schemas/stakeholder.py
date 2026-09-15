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
    most_affected_crops: Optional[List[Dict[str, Any]]] = None
    recent_activity: Optional[List[Dict[str, Any]]] = None
    healthy_vs_diseased: Optional[Dict[str, Any]] = None



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


class ConnectedFarmerItem(BaseModel):
    farmer_id: int
    relationship_id: int
    full_name: str
    farm_name: Optional[str] = None
    farm_location: Optional[str] = None
    primary_crop: Optional[str] = None
    connection_status: str
    connected_since: Optional[str] = None
    last_active_date: Optional[str] = None
    latest_health_status: str
    latest_irrigation_status: str
    risk_level: str


class ConnectedFarmersResponse(BaseModel):
    status: str
    total_connected: int
    farmers: List[ConnectedFarmerItem]
    empty_state_message: Optional[str] = None


class PendingConnectionItem(BaseModel):
    relationship_id: int
    farmer_id: int
    farmer_name: str
    farmer_email: str
    farm_name: Optional[str] = None
    farm_location: Optional[str] = None
    preferred_crop: Optional[str] = None
    requested_at: str
    notes: Optional[str] = None


class PendingConnectionsResponse(BaseModel):
    status: str
    total_pending: int
    pending_requests: List[PendingConnectionItem]
    empty_state_message: Optional[str] = None


class FarmerAgriculturalProfileResponse(BaseModel):
    status: str
    farmer_id: int
    farm_profile: Dict[str, Any]
    crop_health: Dict[str, Any]
    irrigation: Dict[str, Any]
    weather: Dict[str, Any]
    sustainability: Dict[str, Any]
    yield_prediction: Dict[str, Any]


class ConnectionActionRequest(BaseModel):
    notes: Optional[str] = None


class CreateConnectionRequest(BaseModel):
    stakeholder_id: int
    notes: Optional[str] = None


class FarmerConnectionItem(BaseModel):
    relationship_id: int
    stakeholder_id: int
    organization_name: str
    stakeholder_name: str
    stakeholder_type: Optional[str] = None
    operating_regions: Optional[str] = None
    primary_crops: Optional[str] = None
    status: str
    created_at: str
    updated_at: Optional[str] = None


class FarmerConnectionsResponse(BaseModel):
    status: str
    connections: List[FarmerConnectionItem]
    available_stakeholders: List[Dict[str, Any]]


class StakeholderCropStatsItem(BaseModel):
    crop: str
    monitored_acreage: Optional[float] = None
    acreage_formatted: Optional[str] = None
    estimated_yield: Optional[str] = None
    health_score: Optional[int] = None
    health_score_formatted: Optional[str] = None
    water_stress: Optional[str] = None
    economic_value: Optional[str] = None
    total_scans: int = 0
    diseased_scans: int = 0
    healthy_scans: int = 0


class StakeholderCropStatsResponse(BaseModel):
    status: str
    total_crops_monitored: int
    crop_stats: List[StakeholderCropStatsItem]
    empty_state_message: Optional[str] = None


class StakeholderActivityItem(BaseModel):
    id: str
    type: str  # DISEASE, IRRIGATION, CROP_REC, FARMER
    icon: str
    title: str
    description: str
    timestamp: str
    timestamp_raw: Optional[str] = None
    farmer_name: Optional[str] = None
    farm_name: Optional[str] = None
    crop: Optional[str] = None
    status: Optional[str] = None


class StakeholderActivityResponse(BaseModel):
    status: str
    total_events: int
    activities: List[StakeholderActivityItem]
    empty_state_message: Optional[str] = None


