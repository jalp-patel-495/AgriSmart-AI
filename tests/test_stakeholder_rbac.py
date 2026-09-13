"""
AgriSmart AI — Agricultural Stakeholder Role & RBAC Comprehensive Test Suite
Validates all 26 required scenarios for the AGRICULTURAL_STAKEHOLDER role:
 1. Stakeholder demo login returns token, role, and profile fields
 2. Stakeholder signup with role 'AGRICULTURAL_STAKEHOLDER'
 3. Stakeholder signup with aliases ('stakeholder', 'agribusiness', 'fpo', 'exporter', 'buyer', 'govt_agency')
 4. Invalid role strings are strictly rejected with HTTP 400 or 422
 5. Stakeholder access to GET /api/v1/stakeholder/dashboard (200)
 6. Stakeholder access to GET /api/v1/stakeholder/crop-intelligence (200)
 7. Stakeholder access to GET /api/v1/stakeholder/disease-intelligence (200)
 8. Stakeholder access to GET /api/v1/stakeholder/risks (200)
 9. Stakeholder access to GET /api/v1/stakeholder/regional-intelligence (200)
10. Stakeholder access to POST /api/v1/stakeholder/copilot (200)
11. Farmer blocked from GET /api/v1/stakeholder/dashboard (403 Forbidden)
12. Farmer blocked from GET /api/v1/stakeholder/crop-intelligence (403 Forbidden)
13. Farmer blocked from GET /api/v1/stakeholder/disease-intelligence (403 Forbidden)
14. Farmer blocked from GET /api/v1/stakeholder/risks (403 Forbidden)
15. Farmer blocked from GET /api/v1/stakeholder/regional-intelligence (403 Forbidden)
16. Farmer blocked from POST /api/v1/stakeholder/copilot (403 Forbidden)
17. Expert blocked from GET /api/v1/stakeholder/dashboard (403 Forbidden)
18. Stakeholder blocked from GET /api/v1/admin/users (403 Forbidden)
19. Stakeholder blocked from GET /api/v1/admin/system-monitoring (403 Forbidden)
20. Stakeholder blocked from PUT /api/v1/admin/users/{id}/role (403 Forbidden)
21. Stakeholder blocked from GET /api/v1/expert/review-data (403 Forbidden)
22. Admin has authorized oversight access to GET /api/v1/stakeholder/dashboard (200)
23. Unauthenticated requests to stakeholder endpoints return 401 Unauthorized
24. Deactivated stakeholder account is blocked from accessing protected endpoints
25. Stakeholder profile update persists organizational and regional metadata
26. Zero Fabricated Data test: verifies response fields map to real DB or honest empty states
"""
import time
import unittest
from fastapi.testclient import TestClient
from backend.main import app


class TestAgriculturalStakeholderRBAC(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # Obtain demo login tokens for all 4 roles
        stakeholder_res = cls.client.post("/api/v1/auth/demo-login", json={"role": "stakeholder"}).json()
        cls.stakeholder_token = stakeholder_res["token"]
        cls.stakeholder_id = stakeholder_res["id"]
        cls.stakeholder_role = stakeholder_res["role"]

        farmer_res = cls.client.post("/api/v1/auth/demo-login", json={"role": "farmer"}).json()
        cls.farmer_token = farmer_res["token"]
        cls.farmer_id = farmer_res["id"]
        cls.farmer_role = farmer_res["role"]

        expert_res = cls.client.post("/api/v1/auth/demo-login", json={"role": "expert"}).json()
        cls.expert_token = expert_res["token"]
        cls.expert_id = expert_res["id"]
        cls.expert_role = expert_res["role"]

        admin_res = cls.client.post("/api/v1/auth/demo-login", json={"role": "admin"}).json()
        cls.admin_token = admin_res["token"]
        cls.admin_id = admin_res["id"]
        cls.admin_role = admin_res["role"]

    # -------------------------------------------------------------
    # 1. AUTHENTICATION & ROLE NORMALIZATION
    # -------------------------------------------------------------
    def test_01_stakeholder_demo_login(self):
        """1. Stakeholder demo login -> returns valid token, role AGRICULTURAL_STAKEHOLDER, and profile fields."""
        resp = self.client.post("/api/v1/auth/demo-login", json={"role": "stakeholder"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("token", data)
        self.assertEqual(data["role"], "AGRICULTURAL_STAKEHOLDER")
        self.assertTrue(data["token"].startswith("agri_"))
        self.assertEqual(data["email"], "stakeholder@agrismart.ai")
        self.assertIn("organization_name", data)
        self.assertIn("operating_regions", data)
        self.assertIn("primary_crops", data)

    def test_02_stakeholder_signup_canonical(self):
        """2. Signup with role AGRICULTURAL_STAKEHOLDER creates verified stakeholder account."""
        ts = int(time.time() * 1000)
        payload = {
            "full_name": f"Priya Sharma {ts}",
            "email": f"priya.sharma_{ts}@agrocorp.in",
            "password": "SecurePassword123!",
            "role": "AGRICULTURAL_STAKEHOLDER",
            "organization_name": "Bharat Agri Supply Chain Ltd",
            "organization_type": "Agribusiness",
            "operating_regions": "Maharashtra, Gujarat, Madhya Pradesh",
            "primary_crops": "Cotton, Soybean, Wheat",
            "stakeholder_type": "Commodity Trader"
        }
        resp = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["role"], "AGRICULTURAL_STAKEHOLDER")
        self.assertEqual(data["organization_name"], "Bharat Agri Supply Chain Ltd")
        self.assertEqual(data["operating_regions"], "Maharashtra, Gujarat, Madhya Pradesh")

    def test_03_stakeholder_signup_aliases(self):
        """3. Signup with aliases ('stakeholder', 'agribusiness', 'fpo', 'exporter') normalizes to AGRICULTURAL_STAKEHOLDER."""
        aliases = ["stakeholder", "agribusiness", "fpo", "exporter", "buyer", "govt_agency"]
        for alias in aliases:
            ts = int(time.time() * 1000)
            payload = {
                "full_name": f"Agent {alias} {ts}",
                "email": f"agent_{alias}_{ts}@fpo-union.org",
                "password": "SecurePassword123!",
                "role": alias,
                "organization_name": f"FPO Federation of {alias.title()}",
                "organization_type": "FPO",
            }
            resp = self.client.post("/api/v1/auth/signup", json=payload)
            self.assertEqual(resp.status_code, 201, f"Failed for alias: {alias}")
            data = resp.json()
            self.assertEqual(data["role"], "AGRICULTURAL_STAKEHOLDER", f"Failed normalization for: {alias}")

    def test_04_invalid_role_rejected(self):
        """4. Invalid role strings are strictly rejected with HTTP 400 or 422."""
        invalid_roles = ["SUPERUSER", "HACKER", "ROOT", "GUEST", "UNKNOWN_ROLE"]
        for bad_role in invalid_roles:
            ts = int(time.time() * 1000)
            payload = {
                "full_name": f"Bad User {ts}",
                "email": f"bad_user_{ts}@domain.invalid",
                "password": "SecurePassword123!",
                "role": bad_role
            }
            resp = self.client.post("/api/v1/auth/signup", json=payload)
            self.assertIn(resp.status_code, [400, 422], f"Expected 400/422 for role: {bad_role}")

    # -------------------------------------------------------------
    # 2. STAKEHOLDER AUTHORIZED MODULE ACCESS (200 OK)
    # -------------------------------------------------------------
    def test_05_stakeholder_access_dashboard(self):
        """5. Stakeholder access to GET /api/v1/stakeholder/dashboard -> 200 OK."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/dashboard", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("macro_kpis", data)
        self.assertIn("crop_distribution", data)
        self.assertIn("disease_risks", data)
        self.assertIn("water_stress_index", data)
        self.assertIn("climate_risk", data)
        self.assertIn("sustainability_esg", data)
        self.assertIn("recent_alerts", data)

    def test_06_stakeholder_access_crop_intelligence(self):
        """6. Stakeholder access to GET /api/v1/stakeholder/crop-intelligence -> 200 OK."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/crop-intelligence", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("crop_distribution", data)

    def test_07_stakeholder_access_disease_intelligence(self):
        """7. Stakeholder access to GET /api/v1/stakeholder/disease-intelligence -> 200 OK."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/disease-intelligence", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("disease_risks", data)

    def test_08_stakeholder_access_risks(self):
        """8. Stakeholder access to GET /api/v1/stakeholder/risks -> 200 OK."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/risks", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("climate_risk", data)
        self.assertIn("alerts", data)

    def test_09_stakeholder_access_regional_intelligence(self):
        """9. Stakeholder access to GET /api/v1/stakeholder/regional-intelligence -> 200 OK."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/regional-intelligence", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("regional_summary", data)

    def test_10_stakeholder_access_copilot(self):
        """10. Stakeholder access to POST /api/v1/stakeholder/copilot -> 200 OK."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        payload = {
            "query": "Assess wheat yield and water deficit in Maharashtra for the upcoming harvest.",
            "region": "Maharashtra",
            "crop": "Wheat"
        }
        resp = self.client.post("/api/v1/stakeholder/copilot", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("response", data)
        self.assertIn("recommended_actions", data)

    # -------------------------------------------------------------
    # 3. RBAC ENFORCEMENT: FARMER BLOCKED (403 FORBIDDEN)
    # -------------------------------------------------------------
    def test_11_farmer_blocked_from_stakeholder_dashboard(self):
        """11. Farmer blocked from GET /api/v1/stakeholder/dashboard -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = self.client.get("/api/v1/stakeholder/dashboard", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_12_farmer_blocked_from_stakeholder_crop_intelligence(self):
        """12. Farmer blocked from GET /api/v1/stakeholder/crop-intelligence -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = self.client.get("/api/v1/stakeholder/crop-intelligence", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_13_farmer_blocked_from_stakeholder_disease_intelligence(self):
        """13. Farmer blocked from GET /api/v1/stakeholder/disease-intelligence -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = self.client.get("/api/v1/stakeholder/disease-intelligence", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_14_farmer_blocked_from_stakeholder_risks(self):
        """14. Farmer blocked from GET /api/v1/stakeholder/risks -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = self.client.get("/api/v1/stakeholder/risks", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_15_farmer_blocked_from_stakeholder_regional_intelligence(self):
        """15. Farmer blocked from GET /api/v1/stakeholder/regional-intelligence -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = self.client.get("/api/v1/stakeholder/regional-intelligence", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_16_farmer_blocked_from_stakeholder_copilot(self):
        """16. Farmer blocked from POST /api/v1/stakeholder/copilot -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        payload = {"query": "Assess regional risk."}
        resp = self.client.post("/api/v1/stakeholder/copilot", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 403)

    # -------------------------------------------------------------
    # 4. RBAC ENFORCEMENT: EXPERT BLOCKED (403 FORBIDDEN)
    # -------------------------------------------------------------
    def test_17_expert_blocked_from_stakeholder_dashboard(self):
        """17. Expert blocked from GET /api/v1/stakeholder/dashboard -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.expert_token}"}
        resp = self.client.get("/api/v1/stakeholder/dashboard", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    # -------------------------------------------------------------
    # 5. RBAC ENFORCEMENT: STAKEHOLDER BLOCKED FROM ADMIN/EXPERT (403 FORBIDDEN)
    # -------------------------------------------------------------
    def test_18_stakeholder_blocked_from_admin_users(self):
        """18. Stakeholder blocked from GET /api/v1/admin/users -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/admin/users", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_19_stakeholder_blocked_from_admin_system_monitoring(self):
        """19. Stakeholder blocked from GET /api/v1/admin/system-monitoring -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/admin/system-monitoring", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_20_stakeholder_blocked_from_admin_role_change(self):
        """20. Stakeholder cannot change other users' roles -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        payload = {"role": "ADMIN"}
        resp = self.client.patch(f"/api/v1/admin/users/{self.farmer_id}/role", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_21_stakeholder_blocked_from_expert_review(self):
        """21. Stakeholder blocked from GET /api/v1/expert/review-data -> 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/expert/review-data", headers=headers)
        self.assertEqual(resp.status_code, 403)

    # -------------------------------------------------------------
    # 6. ADMIN OVERSIGHT & SECURITY EDGE CASES
    # -------------------------------------------------------------
    def test_22_admin_access_to_stakeholder_dashboard(self):
        """22. Admin has authorized oversight access to GET /api/v1/stakeholder/dashboard -> 200 OK."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        resp = self.client.get("/api/v1/stakeholder/dashboard", headers=headers)
        self.assertEqual(resp.status_code, 200)

    def test_23_unauthenticated_request_blocked(self):
        """23. Unauthenticated requests to stakeholder endpoints return HTTP 401 Unauthorized."""
        resp = self.client.get("/api/v1/stakeholder/dashboard")
        self.assertEqual(resp.status_code, 401)

    def test_24_deactivated_stakeholder_blocked(self):
        """24. Deactivated stakeholder account is blocked on protected requests."""
        # Create a stakeholder to deactivate
        ts = int(time.time() * 1000)
        email = f"deactivate_test_{ts}@agrismart.ai"
        signup_res = self.client.post("/api/v1/auth/signup", json={
            "full_name": "Temporary Stakeholder",
            "email": email,
            "password": "Password123!",
            "role": "AGRICULTURAL_STAKEHOLDER",
            "organization_name": "Deactivation Test Org"
        }).json()
        temp_id = signup_res["id"]
        temp_token = signup_res["token"]

        # Admin deactivates this user via PATCH
        admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        deact_res = self.client.patch(f"/api/v1/admin/users/{temp_id}/status", json={"is_active": False}, headers=admin_headers)
        self.assertEqual(deact_res.status_code, 200)

        # Deactivated user attempts to access stakeholder dashboard -> blocked
        temp_headers = {"Authorization": f"Bearer {temp_token}"}
        block_res = self.client.get("/api/v1/stakeholder/dashboard", headers=temp_headers)
        self.assertIn(block_res.status_code, [401, 403])

    def test_25_stakeholder_profile_update(self):
        """25. Stakeholder profile update persists organizational and regional metadata."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        update_payload = {
            "email": "stakeholder@agrismart.ai",
            "full_name": "Vikrant Verma",
            "organization_name": "AgriTech Apex Consortium",
            "operating_regions": "Punjab, Haryana, Rajasthan",
            "primary_crops": "Wheat, Mustard, Barley",
            "stakeholder_type": "Apex FPO"
        }
        resp = self.client.put("/api/v1/auth/profile", json=update_payload, headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["organization_name"], "AgriTech Apex Consortium")
        self.assertEqual(data["operating_regions"], "Punjab, Haryana, Rajasthan")
        self.assertEqual(data["primary_crops"], "Wheat, Mustard, Barley")

    def test_26_zero_fabricated_data_integrity(self):
        """26. Zero Fabricated Data test: all responses adhere to Rule 3 (no made-up telemetry numbers)."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/dashboard?region=AntarcticaNonExistent", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # For non-existent region, counts must be 0 or empty list, NEVER fabricated mock numbers
        macro = data["macro_kpis"]
        self.assertEqual(macro["total_registered_farmers"], 0)
        self.assertEqual(macro["aggregated_acreage_ha"], 0.0)
        self.assertEqual(len(data["crop_distribution"]), 0)
        self.assertEqual(len(data["disease_risks"]), 0)


if __name__ == "__main__":
    unittest.main()
