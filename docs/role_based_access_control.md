# Role-Based Access Control (RBAC) Specification & Architecture

AgriSmart AI enforces a cryptographically verified, three-tier Role-Based Access Control (RBAC) architecture. This system guarantees strict separation of concerns across agricultural operators, agronomist reviewers, and system administrators without altering underlying machine learning inference engines or creating redundant pages.

---

## 1. Role Definitions

| Role Identifier | UI Display Name | Target Persona | Default State |
| :--- | :--- | :--- | :--- |
| **`FARMER`** | 👨‍🌾 Farmer | Farm owners, agricultural laborers, smallholders | **Default** for all new signups and unassigned legacy records |
| **`AGRICULTURAL_EXPERT`** | 👨‍🔬 Agricultural Expert | ICAR extension specialists, university researchers, agronomists | Assigned by Admin or demo login |
| **`ADMIN`** | 🛠️ Admin | Platform engineers, DevOps, project maintainers | Assigned by Admin or demo login |

---

## 2. Comprehensive Permission Matrix

| Feature / Endpoint | FARMER | AGRICULTURAL_EXPERT | ADMIN | Backend Enforcement |
| :--- | :---: | :---: | :---: | :--- |
| **Farmer Dashboard** | ✅ | ✅ | ✅ | Public / Authenticated |
| **Disease Detection Studio** | ✅ | ✅ | ✅ | Public / Authenticated |
| **Crop Recommendation (22 & 95 Crop)** | ✅ | ✅ | ✅ | Public / Authenticated |
| **Smart Irrigation Hub** | ✅ | ✅ | ✅ | Public / Authenticated |
| **Weather Intelligence Engine** | ✅ | ✅ | ✅ | Public / Authenticated |
| **Yield Prediction** | ✅ | ✅ | ✅ | Public / Authenticated |
| **Sustainability Score** | ✅ | ✅ | ✅ | Public / Authenticated |
| **Farmer Advisor / Kisan AI Co-Pilot** | ✅ | ✅ | ✅ | Public / Authenticated |
| **Agentic Advisor (Multi-Module Synthesizer)** | ✅ | ✅ | ✅ | Public / Authenticated |
| **👨‍🔬 Expert Review Page** | ❌ (403) | ✅ | ✅ | `require_role('AGRICULTURAL_EXPERT', 'ADMIN')` |
| **`GET /api/v1/expert/review-data`** | ❌ (403) | ✅ | ✅ | HTTP 403 Forbidden |
| **🛠️ User Management Page** | ❌ (403) | ❌ (403) | ✅ | `require_role('ADMIN')` |
| **`GET /api/v1/admin/users`** | ❌ (403) | ❌ (403) | ✅ | HTTP 403 Forbidden |
| **`PATCH /api/v1/admin/users/{id}/role`** | ❌ (403) | ❌ (403) | ✅ | HTTP 403 Forbidden |
| **`PATCH /api/v1/admin/users/{id}/status`** | ❌ (403) | ❌ (403) | ✅ | HTTP 403 Forbidden |
| **🛠️ System Monitoring Page** | ❌ (403) | ❌ (403) | ✅ | `require_role('ADMIN')` |
| **`GET /api/v1/admin/system-monitoring`** | ❌ (403) | ❌ (403) | ✅ | HTTP 403 Forbidden |

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
from backend.app.schemas.auth import ROLE_ADMIN, ROLE_AGRICULTURAL_EXPERT

@router.get("/expert/review-data")
def get_expert_review_data(
    current_user: User = Depends(require_role(ROLE_AGRICULTURAL_EXPERT, ROLE_ADMIN)),
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

### 5.2 🛠️ User Management
- **Target Persona**: Administrators only.
- **Functionality**:
  - Search and filter registered accounts by user name, email, or role.
  - View full name, email, farm location, preferred crop, and created date.
  - Change user roles between `FARMER`, `AGRICULTURAL_EXPERT`, and `ADMIN`.
  - Toggle account activation status (`is_active = True/False`).
  - Self-protection: Admins cannot deactivate their own active account.

### 5.3 🛠️ System Monitoring
- **Target Persona**: Administrators only.
- **Functionality**:
  - Live verification of actual model weights and service availability:
    1. Disease Detection (`ai_model/models/crop_disease_model.pth` or active ResNet-34 checkpoint).
    2. 22-Crop Production model (`ai/models/crop_recommendation/best_model.pkl`).
    3. 95-Crop Experimental model (`ai/models/crop_recommendation/best_model_95class.pkl`) displaying `⚠️ EXPERIMENTAL` badge.
    4. Smart Irrigation FAO-56 dual crop coefficient engine and classifier.
    5. Weather Intelligence Open-Meteo API v1 integration.
    6. Yield Prediction agronomic estimation model.
    7. Sustainability Score deterministic 3-pillar formula.
    8. Farmer Advisor ICAR/FAO certified extension rule engine.
    9. Agentic Advisor 8-subsystem agrometeorological orchestrator.
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
- **ADMIN Navigation**:
  - All 9 Farmer tabs + `👨‍🔬 Expert Review` + `🛠️ User Management` + `🛠️ System Monitoring`
- **Role Badges**:
  - Displayed prominently in the user profile avatar pill and account dropdown:
    - `👨‍🌾 Farmer`
    - `👨‍🔬 Agricultural Expert`
    - `🛠️ Admin`
- **Frontend Route Protection**:
  - `RoleProtectedRoute` wraps restricted components (`expert-review`, `user-management`, `system-monitoring`). If an unauthorized user accesses a protected route directly, a prominent 403 Forbidden Access Barrier is rendered.

---

## 7. Security Rules & Guarantees

1. **Backend as Source of Truth**: Frontend role manipulation or URL tampering cannot bypass access restrictions; backend dependencies independently reject unauthorized requests with HTTP 403.
2. **Safe Defaults**: Any signup or database record lacking a specified role safely defaults to `FARMER`.
3. **Invalid Role Rejection**: Any attempt to assign an invalid role string (e.g., `SUPER_USER_HACK`) is rejected with `HTTP 422 Unprocessable Entity`.
4. **Deactivation Enforcement**: Deactivated accounts cannot sign in or invoke any authenticated endpoints.
