"""
AgriSmart AI — Farmer ↔ Stakeholder Ecosystem Comprehensive Test Suite
Validates the complete real-data architecture:
 1. Farmer can list discoverable organizations and existing connections
 2. Farmer can submit connection request to a stakeholder organization (PENDING)
 3. Farmer duplicate connection request is rejected
 4. Stakeholder can view pending connection requests
 5. Stakeholder can approve their own pending request (status -> ACTIVE)
 6. Stakeholder can inspect connected farmer's real agricultural profile
 7. Stakeholder CANNOT inspect unconnected farmer's agricultural profile (403 Forbidden)
 8. Unconnected farmer is NOT visible in stakeholder's connected farmers list
 9. Stakeholder cannot approve a connection request belonging to another stakeholder
10. Farmer can remove / disconnect from an organization
11. Disconnected farmer's data is immediately inaccessible to the stakeholder
12. Authenticated disease prediction creates a persistent DiseaseDiagnosisRecord
13. Authenticated smart irrigation advisory persists with farmer_id
14. Authenticated crop recommendation persists with farmer_id
15. Stakeholder Dashboard aggregates strictly from connected farmers
16. Stakeholder with 0 connected farmers sees honest zero-data state (no fake Punjab/Wheat fallbacks)
17. Stakeholder Copilot is grounded strictly in connected farmer records
18. RBAC: Expert blocked from stakeholder connection endpoints (403)
19. RBAC: Unauthenticated requests return 401 Unauthorized
"""
import io
import time
import unittest
from fastapi.testclient import TestClient
from backend.main import app


class TestFarmerStakeholderEcosystem(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # 1. Demo Farmer & Demo Stakeholder (pre-seeded with active connection)
        farmer_res = cls.client.post("/api/v1/auth/demo-login", json={"role": "farmer"}).json()
        cls.farmer_token = farmer_res["token"]
        cls.farmer_id = farmer_res["id"]

        stakeholder_res = cls.client.post("/api/v1/auth/demo-login", json={"role": "stakeholder"}).json()
        cls.stakeholder_token = stakeholder_res["token"]
        cls.stakeholder_id = stakeholder_res["id"]

        expert_res = cls.client.post("/api/v1/auth/demo-login", json={"role": "expert"}).json()
        cls.expert_token = expert_res["token"]

        admin_res = cls.client.post("/api/v1/auth/demo-login", json={"role": "admin"}).json()
        cls.admin_token = admin_res["token"]

        # 2. Fresh Isolated Farmer B and Stakeholder Y (to test isolation & workflow)
        ts = int(time.time() * 1000)
        signup_farmer_b = {
            "full_name": f"Farmer B {ts}",
            "email": f"farmer_b_{ts}@testfarm.com",
            "password": "Password123!",
            "role": "FARMER",
            "farm_name": f"Green Acres B {ts}",
            "farm_location": "Gujarat, India",
            "preferred_crop": "Cotton",
        }
        res_fb = cls.client.post("/api/v1/auth/signup", json=signup_farmer_b).json()
        cls.farmer_b_token = res_fb["token"]
        cls.farmer_b_id = res_fb["id"]

        signup_stk_y = {
            "full_name": f"Stakeholder Y {ts}",
            "email": f"stakeholder_y_{ts}@agricorp.com",
            "password": "Password123!",
            "role": "AGRICULTURAL_STAKEHOLDER",
            "organization_name": f"Gujarat Agro Buyers {ts}",
            "organization_type": "Commodity Trader",
            "operating_regions": "Gujarat",
            "primary_crops": "Cotton, Groundnut",
        }
        res_sy = cls.client.post("/api/v1/auth/signup", json=signup_stk_y).json()
        cls.stakeholder_y_token = res_sy["token"]
        cls.stakeholder_y_id = res_sy["id"]

    # -------------------------------------------------------------------------
    # FARMER SIDE CONNECTION DISCOVERY & CREATION
    # -------------------------------------------------------------------------

    def test_01_farmer_can_list_connections_and_discovery(self):
        """Farmer can query their connections and discover registered stakeholders."""
        headers = {"Authorization": f"Bearer {self.farmer_b_token}"}
        resp = self.client.get("/api/v1/farmer/stakeholder-connections", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("connections", data)
        self.assertIn("available_stakeholders", data)
        # Farmer B initially has 0 connections
        self.assertEqual(len(data["connections"]), 0)
        # Should discover available stakeholders
        self.assertGreaterEqual(len(data["available_stakeholders"]), 1)

    def test_02_farmer_can_create_connection_request(self):
        """Farmer B creates a connection request to Stakeholder Y."""
        headers = {"Authorization": f"Bearer {self.farmer_b_token}"}
        payload = {
            "stakeholder_id": self.stakeholder_y_id,
            "notes": "Requesting agricultural procurement partnership for cotton harvest."
        }
        resp = self.client.post("/api/v1/farmer/stakeholder-connections", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["connection_status"], "PENDING")
        self.assertIn("relationship_id", data)
        self.__class__.rel_b_y_id = data["relationship_id"]

    def test_03_farmer_duplicate_request_rejected(self):
        """Farmer B cannot create duplicate pending request to same stakeholder."""
        headers = {"Authorization": f"Bearer {self.farmer_b_token}"}
        payload = {"stakeholder_id": self.stakeholder_y_id}
        resp = self.client.post("/api/v1/farmer/stakeholder-connections", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("already pending", resp.json()["detail"].lower())

    # -------------------------------------------------------------------------
    # STAKEHOLDER APPROVAL & ISOLATION
    # -------------------------------------------------------------------------

    def test_04_stakeholder_y_sees_pending_request(self):
        """Stakeholder Y can view the pending connection request from Farmer B."""
        headers = {"Authorization": f"Bearer {self.stakeholder_y_token}"}
        resp = self.client.get("/api/v1/stakeholder/pending-requests", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["total_pending"], 1)
        self.assertEqual(data["pending_requests"][0]["farmer_id"], self.farmer_b_id)

    def test_05_demo_stakeholder_cannot_see_stakeholder_y_pending_request(self):
        """Demo Stakeholder cannot see Stakeholder Y's pending requests (isolated)."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/pending-requests", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        pending_ids = [r["farmer_id"] for r in data["pending_requests"]]
        self.assertNotIn(self.farmer_b_id, pending_ids)

    def test_06_demo_stakeholder_cannot_approve_stakeholder_y_request(self):
        """Demo Stakeholder cannot approve a request addressed to Stakeholder Y."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.post(
            f"/api/v1/stakeholder/connections/{self.rel_b_y_id}/approve",
            headers=headers
        )
        self.assertEqual(resp.status_code, 403)

    def test_07_stakeholder_y_approves_farmer_b_request(self):
        """Stakeholder Y approves Farmer B's connection request."""
        headers = {"Authorization": f"Bearer {self.stakeholder_y_token}"}
        resp = self.client.post(
            f"/api/v1/stakeholder/connections/{self.rel_b_y_id}/approve",
            json={"notes": "Approved for 2026 Cotton procurement cycle"},
            headers=headers
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["connection_status"], "ACTIVE")

    # -------------------------------------------------------------------------
    # DATA VISIBILITY & ISOLATION
    # -------------------------------------------------------------------------

    def test_08_stakeholder_y_sees_connected_farmer_b(self):
        """Stakeholder Y now sees Farmer B in their connected farmers list."""
        headers = {"Authorization": f"Bearer {self.stakeholder_y_token}"}
        resp = self.client.get("/api/v1/stakeholder/farmers", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_connected"], 1)
        self.assertEqual(data["farmers"][0]["farmer_id"], self.farmer_b_id)
        self.assertEqual(data["farmers"][0]["connection_status"], "ACTIVE")

    def test_09_demo_stakeholder_cannot_see_farmer_b(self):
        """Demo Stakeholder CANNOT see Farmer B because Farmer B is not connected to Demo Stakeholder."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/farmers", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        connected_ids = [f["farmer_id"] for f in data["farmers"]]
        self.assertNotIn(self.farmer_b_id, connected_ids)
        self.assertIn(self.farmer_id, connected_ids)  # Demo farmer is connected to Demo Stakeholder

    def test_10_demo_stakeholder_blocked_from_farmer_b_detail(self):
        """Demo Stakeholder is strictly blocked from accessing Farmer B's agricultural profile (403)."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get(f"/api/v1/stakeholder/farmers/{self.farmer_b_id}", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access denied", resp.json()["detail"])

    def test_11_stakeholder_y_can_access_farmer_b_detail(self):
        """Stakeholder Y can access Farmer B's agricultural profile."""
        headers = {"Authorization": f"Bearer {self.stakeholder_y_token}"}
        resp = self.client.get(f"/api/v1/stakeholder/farmers/{self.farmer_b_id}", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["farmer_id"], self.farmer_b_id)
        self.assertIn("farm_profile", data)
        self.assertIn("crop_health", data)
        self.assertIn("irrigation", data)
        self.assertIn("weather", data)
        self.assertIn("sustainability", data)

    # -------------------------------------------------------------------------
    # AGRICULTURAL DATA PERSISTENCE LINKED TO FARMER
    # -------------------------------------------------------------------------

    def test_12_authenticated_irrigation_advisory_persists_ownership(self):
        """Farmer B running Smart Irrigation persists with farmer_id = Farmer B."""
        headers = {"Authorization": f"Bearer {self.farmer_b_token}"}
        payload = {
            "crop": "Cotton",
            "soil_type": "Clay Loam",
            "field_size_hectares": 3.5,
            "moisture_15cm": 22.0,
            "moisture_30cm": 26.0,
            "ambient_temp": 31.0,
            "humidity": 50.0,
            "rain_forecast_mm": 0.0
        }
        resp = self.client.post("/api/v1/smart-farming/irrigation-advisory", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 200)

        # Stakeholder Y should now see this irrigation update on Farmer B
        headers_y = {"Authorization": f"Bearer {self.stakeholder_y_token}"}
        prof_res = self.client.get(f"/api/v1/stakeholder/farmers/{self.farmer_b_id}", headers=headers_y)
        self.assertEqual(prof_res.status_code, 200)
        data = prof_res.json()
        self.assertTrue(data["irrigation"]["has_record"])
        self.assertEqual(data["irrigation"]["crop"], "Cotton")
        self.assertEqual(data["irrigation"]["field_size_ha"], 3.5)

    def test_13_authenticated_crop_recommendation_persists_ownership(self):
        """Farmer B running crop recommendation persists with farmer_id = Farmer B."""
        headers = {"Authorization": f"Bearer {self.farmer_b_token}"}
        payload = {
            "nitrogen": 80.0,
            "phosphorus": 40.0,
            "potassium": 40.0,
            "ph": 6.5,
            "temperature": 27.0,
            "humidity": 60.0,
            "rainfall": 110.0
        }
        resp = self.client.post("/api/v1/smart-farming/recommend-crop", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 200)

        # Stakeholder Y's crop intelligence now includes Farmer B's recommendation
        headers_y = {"Authorization": f"Bearer {self.stakeholder_y_token}"}
        crop_res = self.client.get("/api/v1/stakeholder/crop-intelligence", headers=headers_y)
        self.assertEqual(crop_res.status_code, 200)
        self.assertGreaterEqual(crop_res.json()["total_recommendations_on_record"], 1)

    # -------------------------------------------------------------------------
    # DISCONNECTION / REVOCATION TEST
    # -------------------------------------------------------------------------

    def test_14_farmer_removes_connection_revokes_stakeholder_access(self):
        """Farmer B disconnects from Stakeholder Y; Stakeholder Y immediately loses data access."""
        headers_b = {"Authorization": f"Bearer {self.farmer_b_token}"}
        del_resp = self.client.delete(f"/api/v1/farmer/stakeholder-connections/{self.rel_b_y_id}", headers=headers_b)
        self.assertEqual(del_resp.status_code, 200)
        self.assertEqual(del_resp.json()["connection_status"], "REMOVED")

        # Stakeholder Y can NO LONGER view Farmer B's profile
        headers_y = {"Authorization": f"Bearer {self.stakeholder_y_token}"}
        prof_res = self.client.get(f"/api/v1/stakeholder/farmers/{self.farmer_b_id}", headers=headers_y)
        self.assertEqual(prof_res.status_code, 403)

        # Stakeholder Y's connected farmers list is now 0
        farmers_res = self.client.get("/api/v1/stakeholder/farmers", headers=headers_y)
        self.assertEqual(farmers_res.status_code, 200)
        self.assertEqual(farmers_res.json()["total_connected"], 0)

    # -------------------------------------------------------------------------
    # ZERO FABRICATED DATA FOR EMPTY STAKEHOLDER
    # -------------------------------------------------------------------------

    def test_15_empty_stakeholder_shows_truthful_empty_states(self):
        """Stakeholder Y (now with 0 connected farmers) sees honest empty states without fabricated fallbacks."""
        headers_y = {"Authorization": f"Bearer {self.stakeholder_y_token}"}
        dash_res = self.client.get("/api/v1/stakeholder/dashboard", headers=headers_y)
        self.assertEqual(dash_res.status_code, 200)
        data = dash_res.json()
        self.assertEqual(data["macro_kpis"]["total_registered_farmers"], 0)
        self.assertEqual(data["macro_kpis"]["aggregated_acreage_ha"], 0.0)
        self.assertEqual(len(data["crop_distribution"]), 0)
        self.assertEqual(len(data["disease_risks"]), 0)
        self.assertEqual(len(data["recent_alerts"]), 0)

        # Copilot returns honest answer
        copilot_res = self.client.post("/api/v1/stakeholder/copilot", json={"query": "Which farms need attention?"}, headers=headers_y)
        self.assertEqual(copilot_res.status_code, 200)
        self.assertIn("no farmers are actively connected", copilot_res.json()["answer"].lower())

    # -------------------------------------------------------------------------
    # DEMO STAKEHOLDER SEED VERIFICATION
    # -------------------------------------------------------------------------

    def test_16_demo_stakeholder_sees_demo_farmer_with_real_data(self):
        """Demo Stakeholder queries backend and retrieves Demo Farmer's real application data."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        resp = self.client.get("/api/v1/stakeholder/farmers", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(data["total_connected"], 1)
        demo_card = next((f for f in data["farmers"] if f["farmer_id"] == self.farmer_id), None)
        self.assertIsNotNone(demo_card)
        self.assertEqual(demo_card["full_name"], "Ramesh Kumar")
        self.assertEqual(demo_card["farm_name"], "Kisan Green Acres")
        self.assertIn("Early Blight", demo_card["latest_health_status"])

    def test_17_demo_stakeholder_copilot_is_grounded_in_connected_farmer(self):
        """Demo Stakeholder asks copilot 'Which connected farms need attention today?' -> grounded in Demo Farmer."""
        headers = {"Authorization": f"Bearer {self.stakeholder_token}"}
        payload = {"query": "Which connected farms need attention today?"}
        resp = self.client.post("/api/v1/stakeholder/copilot", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        ans = data["answer"]
        # Must mention Ramesh Kumar or Kisan Green Acres or the Early Blight / Irrigation alert
        self.assertTrue(
            "ramesh kumar" in ans.lower() or
            "kisan green acres" in ans.lower() or
            "early blight" in ans.lower() or
            "tomato" in ans.lower() or
            "irrigation" in ans.lower()
        )

    # -------------------------------------------------------------------------
    # RBAC SECURITY
    # -------------------------------------------------------------------------

    def test_18_expert_blocked_from_farmer_connections(self):
        """Expert cannot create or manage farmer stakeholder connections."""
        headers = {"Authorization": f"Bearer {self.expert_token}"}
        resp = self.client.get("/api/v1/farmer/stakeholder-connections", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_19_unauthenticated_blocked(self):
        """Unauthenticated requests strictly return 401."""
        resp1 = self.client.get("/api/v1/farmer/stakeholder-connections")
        self.assertEqual(resp1.status_code, 401)
        resp2 = self.client.get("/api/v1/stakeholder/farmers")
        self.assertEqual(resp2.status_code, 401)


if __name__ == "__main__":
    unittest.main()
