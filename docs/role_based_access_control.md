# Role-Based Access Control (RBAC) Specification & Architecture

AgriSmart AI enforces a cryptographically verified, four-tier Role-Based Access Control (RBAC) architecture. This system guarantees strict separation of concerns across agricultural operators, agronomist reviewers, macro agricultural stakeholders, and system administrators without altering underlying machine learning inference engines or creating redundant pages.

---

## 1. Role Definitions

| Role Identifier | UI Display Name | Target Persona | Default State |
| :--- | :--- | :--- | :--- |
| **`FARMER`** | 👨‍🌾 Farmer | Farm owners, agricultural laborers, smallholders | **Default** for all standard new signups and unassigned legacy records |
| **`AGRICULTURAL_EXPERT`** | 👨‍🔬 Agricultural Expert | ICAR extension specialists, university researchers, agronomists | Assigned by Admin or demo login |
| **`AGRICULTURAL_STAKEHOLDER`** | 🌐 Agricultural Stakeholder | Agribusinesses, FPO federations, exporters, agro-processors, crop insurers, agricultural banks, input suppliers, policy makers, research institutions | Assigned upon signup with organization details, Admin assignment, or demo login |
| **`ADMIN`** | 🛠️ Admin | Platform engineers, DevOps, project maintainers | Assigned by Admin or demo login |

---

## 2. Comprehensive Permission Matrix

| Feature / Endpoint | FARMER | AGRICULTURAL_EXPERT | AGRICULTURAL_STAKEHOLDER | ADMIN | Backend Enforcement |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Farmer Dashboard** | ✅ | ✅ | ❌ (Redirected) | ✅ | Public / Authenticated |
| **Disease Detection Studio** | ✅ | ✅ | ❌ | ✅ | Authenticated |
| **Crop Recommendation (22 & 95 Crop)** | ✅ | ✅ | ❌ | ✅ | Authenticated |
| **Smart Irrigation Hub** | ✅ | ✅ | ❌ | ✅ | Authenticated |
| **Weather Intelligence Engine** | ✅ | ✅ | ❌ | ✅ | Authenticated |
| **Yield Prediction** | ✅ | ✅ | ❌ | ✅ | Authenticated |
| **Sustainability Score** | ✅ | ✅ | ❌ | ✅ | Authenticated |
| **Farmer Advisor / Kisan AI Co-Pilot** | ✅ | ✅ | ❌ | ✅ | Authenticated |
| **Agentic Advisor (Multi-Module Synthesizer)**| ✅ | ✅ | ❌ | ✅ | Authenticated |
| **👨‍🔬 Expert Review Page** | ❌ (403) | ✅ | ❌ (403) | ✅ | `require_role('AGRICULTURAL_EXPERT', 'ADMIN')` |
| **`GET /api/v1/expert/review-data`** | ❌ (403) | ✅ | ❌ (403) | ✅ | HTTP 403 Forbidden |
| **🌐 Stakeholder Command Center** | ❌ (403) | ❌ (403) | ✅ | ✅ | `require_role('AGRICULTURAL_STAKEHOLDER', 'ADMIN')` |
| **`GET /api/v1/stakeholder/dashboard`** | ❌ (403) | ❌ (403) | ✅ | ✅ | HTTP 403 Forbidden |
| **`GET /api/v1/stakeholder/crop-intelligence`** | ❌ (403) | ❌ (403) | ✅ | ✅ | HTTP 403 Forbidden |
| **`GET /api/v1/stakeholder/disease-intelligence`** | ❌ (403) | ❌ (403) | ✅ | ✅ | HTTP 403 Forbidden |
| **`GET /api/v1/stakeholder/risks`** | ❌ (403) | ❌ (403) | ✅ | ✅ | HTTP 403 Forbidden |
| **`GET /api/v1/stakeholder/regional-intelligence`** | ❌ (403) | ❌ (403) | ✅ | ✅ | HTTP 403 Forbidden |
| **`POST /api/v1/stakeholder/copilot`** | ❌ (403) | ❌ (403) | ✅ | ✅ | HTTP 403 Forbidden |
| **🛠️ User Management Page** | ❌ (403) | ❌ (403) | ❌ (403) | ✅ | `require_role('ADMIN')` |
| **`GET /api/v1/admin/users`** | ❌ (403) | ❌ (403) | ❌ (403) | ✅ | HTTP 403 Forbidden |
| **`PATCH /api/v1/admin/users/{id}/role`** | ❌ (403) | ❌ (403) | ❌ (403) | ✅ | HTTP 403 Forbidden |
| **`PATCH /api/v1/admin/users/{id}/status`** | ❌ (403) | ❌ (403) | ❌ (403) | ✅ | HTTP 403 Forbidden |
| **🛠️ System Monitoring Page** | ❌ (403) | ❌ (403) | ❌ (403) | ✅ | `require_role('ADMIN')` |
| **`GET /api/v1/admin/system-monitoring`** | ❌ (403) | ❌ (403) | ❌ (403) | ✅ | HTTP 403 Forbidden |

---

## 3. Authentication & Token Architecture

### 3.1 Session Token Generation
Tokens are generated using tamper-proof HMAC-SHA256 signatures based on server-side `SECRET_KEY`:
```
Token Format: agri_{user_id}_{timestamp}_{hmac_signature}
```
1. `user_id`: Integer primary key of the registered `users` record.
2. `timestamp`: Epoch seconds marking generation time.
3. `hmac_signature`: 32-character hex HMAC digest over `{user_id}:{email}:{timestamp}` using `settings.SECRET_KEY`.

### 3.2 Stateless Verification & Database Hydration
Upon incoming requests with `Authorization: Bearer <token>` or `X-Auth-Token`:
1. The backend parses `user_id`, `timestamp`, and `signature`.
2. Queries the database for the active user record matching `user_id`.
3. Recomputes the expected HMAC signature using the active user's registered email.
4. Uses `hmac.compare_digest` to perform constant-time signature verification.
5. Verifies `user.is_active is True`. If deactivated, immediately returns `HTTP 403 Forbidden`.
6. If signature does not match or token is malformed, returns `HTTP 401 Unauthorized`.

---

## 4. Backend Authorization Layer

All role requirements are enforced server-side using FastAPI's dependency injection system:

```python
from backend.app.api.deps import require_role
from backend.app.schemas.auth import ROLE_ADMIN, ROLE_AGRICULTURAL_STAKEHOLDER, ROLE_AGRICULTURAL_EXPERT

# Protected Stakeholder Endpoints
@router.get("/stakeholder/dashboard")
def get_stakeholder_dashboard(
    region: Optional[str] = None,
    crop: Optional[str] = None,
    time_window: Optional[str] = "30d",
    current_user: User = Depends(require_role(ROLE_AGRICULTURAL_STAKEHOLDER, ROLE_ADMIN)),
    db: Session = Depends(get_db)
):
    ...
```

- **Unauthenticated**: Missing or invalid token yields `HTTP 401 Unauthorized`.
- **Insufficient Role**: Authenticated user lacking the required role yields `HTTP 403 Forbidden`.
- **Untrusted Frontend Input**: The backend strictly ignores any role claims provided in request headers or body. Only the cryptographically verified role stored in SQLite is evaluated.

---

## 5. Module Details

### 5.1 👨‍🔬 Expert Review
- **Target Persona**: Agricultural Experts and Administrators.
- **Functionality**: Unified, multi-subsystem audit dashboard aggregating live field conditions:
  - Target Crop
  - Disease Detection diagnosis and confidence score
  - Crop Recommendation predictions
  - Smart Irrigation requirements and soil moisture
  - Weather Risk and agrometeorological advisories
  - Sustainability Score breakdown
  - Yield Prediction estimations
  - Agentic Advisor urgency and recommended action
- **Strict Compliance Safeguards**: Read-only verification interface. Experts cannot modify farmer inputs, alter model weights, or change system configurations.
- **Integrity Rule**: If telemetry has not yet been recorded, the field displays `"Data unavailable"`. No synthetic or simulated results are generated.

### 5.2 🌐 Agricultural Stakeholder Command Center
- **Target Persona**: Agricultural Stakeholders (Agribusinesses, FPO leaders, agro-processors, crop insurers, ag lenders, input suppliers, policy makers) and Administrators.
- **Functionality**: Macro-level, regional, and supply-chain intelligence dashboard structured along the `DATA → INSIGHT → RISK → ACTION` pipeline:
  1. **Interactive Filter Bar**: Filter real telemetry by Region (e.g., Punjab, Maharashtra, Karnataka, Andhra Pradesh), Crop (Wheat, Rice, Maize, Tomato, Cotton), and Time Window (7d, 30d, 90d, 1y).
  2. **Macro KPIs**: Active Farms Monitored, Hectares Represented, Crop Health Index, Regional Water Stress Index, Aggregate ESG Sustainability Score, Active Early Warnings.
  3. **Crop Intelligence & Acreage Distribution**: Aggregates verified recommendation records, soil NPK distributions, and climatic envelopes.
  4. **Phytosanitary & Disease Risk**: Regional incidence matrix, high-risk pathogen alerts, quarantine watchlists, and diagnostic confidence tracking.
  5. **Smart Irrigation & Water Stress Index**: Basin-wide moisture profiling, irrigation demand trends, volumetric stress distributions.
  6. **Weather Intelligence & Climate Risk**: Extreme weather exposure, 7-day multi-tier risk projections, drought/flood exposure indices.
  7. **ESG & Sustainability Intelligence**: Aggregated 3-pillar sustainability scores, water efficiency ratings, N-P-K nutrient stewardship indices.
  8. **Early Warning Alerts**: Prioritized action warnings (CRITICAL, HIGH, MEDIUM, LOW) across disease outbreaks, water deficits, and weather shocks.
  9. **AI Policy & Procurement Copilot**: Natural language analytical query engine synthesizing regional telemetry for procurement, underwriting, and policy decisions.
  10. **Honest Empty States & Traceability**: Strictly enforces Rule 3 (Zero Fabricated Data). If sensor or crop telemetry is absent, displays honest informational states (`"No recorded observations"`, `"Regional data unavailable"`).
- **Security Rule**: Strictly isolated from Farmer operations and Admin configuration utilities.

### 5.3 🛠️ User Management
- **Target Persona**: Administrators only.
- **Functionality**:
  - Search and filter registered accounts by user name, email, or role (`FARMER`, `AGRICULTURAL_EXPERT`, `AGRICULTURAL_STAKEHOLDER`, `ADMIN`).
  - View full name, email, farm location, preferred crop, organization details, and created date.
  - Change user roles across all 4 tiers.
  - Toggle account activation status (`is_active = True/False`).
  - Self-protection: Admins cannot deactivate their own active account.

### 5.4 🛠️ System Monitoring
- **Target Persona**: Administrators only.
- **Functionality**:
  - Live verification of actual model weights and service availability:
    1. Disease Detection checkpoint.
    2. 22-Crop Production model.
    3. 95-Crop Experimental model with `⚠️ EXPERIMENTAL` badge.
    4. Smart Irrigation classification engine.
    5. Weather Intelligence Open-Meteo integration.
    6. Yield Prediction agronomic model.
    7. Sustainability Score deterministic 3-pillar formula.
    8. Farmer Advisor rule engine.
    9. Agentic Advisor 8-subsystem orchestrator.
  - Zero synthetic uptime, artificial latency, or simulated prediction counts are reported.

---

## 6. Frontend Navigation & Role Protection

- **FARMER Navigation**:
  1. Dashboard
  2. Disease Detection
  3. Crop Recommendation
  4. Smart Irrigation
  5. Weather
  6. Yield
  7. Sustainability
  8. Farmer Advisor
  9. Agentic Advisor
- **EXPERT Navigation**:
  - All 9 Farmer tabs + `👨‍🔬 Expert Review`
- **STAKEHOLDER Navigation**:
  - 10 dedicated macro-intelligence sections in the unified Stakeholder Command Center:
    1. Overview / Macro KPIs
    2. Crop Intelligence
    3. Disease Risk Matrix
    4. Water Stress Index
    5. Climate Exposure
    6. ESG Sustainability
    7. Early Warnings
    8. Regional Summary
    9. Stakeholder AI Copilot
    10. Data Governance / Methodology
  - Does NOT display Farmer operations tabs, Expert Review, or Admin configuration tabs.
- **ADMIN Navigation**:
  - All Farmer tabs + `👨‍🔬 Expert Review` + `🌐 Stakeholder Command Center` + `🛠️ User Management` + `🛠️ System Monitoring`
- **Role Badges**:
  - `👨‍🌾 Farmer` (Green)
  - `👨‍🔬 Agricultural Expert` (Blue)
  - `🌐 Agricultural Stakeholder` (Sky/Indigo)
  - `🛠️ Admin` (Purple)
- **Frontend Route Protection**:
  - Direct URL access to restricted components (`expert-review`, `stakeholder`, `user-management`, `system-monitoring`) evaluates client session role; unauthorized accesses render a 403 Forbidden Access Barrier.

---

## 7. Security Rules & Guarantees

1. **Backend as Source of Truth**: Frontend role manipulation or URL tampering cannot bypass access restrictions; backend dependencies independently reject unauthorized requests with HTTP 403.
2. **Safe Defaults**: Any signup or database record lacking a specified role safely defaults to `FARMER`.
3. **Invalid Role Rejection**: Any attempt to assign an invalid role string (e.g., `SUPER_USER_HACK`) is rejected with `HTTP 422 Unprocessable Entity`.
4. **Deactivation Enforcement**: Deactivated accounts cannot sign in or invoke any authenticated endpoints.
5. **Zero Fabricated Data (Rule 3)**: Stakeholder analytics aggregate real SQLite database records and live services; when observations are missing, honest unobserved states are returned rather than mock or simulated statistics.
