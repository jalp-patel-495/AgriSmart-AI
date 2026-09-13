"""
AgriSmart AI – Comprehensive Role-Based Access Control (RBAC) Test Suite
Covers all 20 specified verification scenarios:
1. Farmer login
2. Expert login
3. Admin login
4. Default Farmer role
5. Farmer access to AI modules
6. Farmer blocked from User Management (403)
7. Farmer blocked from System Monitoring (403)
8. Expert access to Expert Review (200)
9. Expert blocked from User Management (403)
10. Expert blocked from System Monitoring (403)
11. Admin access to User Management (200)
12. Admin access to System Monitoring (200)
13. Admin can change roles
14. Farmer cannot change roles (403)
15. Expert cannot change roles (403)
16. Invalid role handling (400/422 rejection)
17. Missing authentication returns 401
18. Insufficient role returns 403
19. Existing authentication tests (signup, login, profile, password change)
20. Existing AI integration tests (multi-module compatibility)
"""
import unittest
import time
import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"


class TestRoleBasedAccessControl(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # 1. Obtain demo login tokens for all three roles
        farmer_res = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "farmer"}).json()
        cls.farmer_token = farmer_res["token"]
        cls.farmer_id = farmer_res["id"]
        cls.farmer_role = farmer_res["role"]

        expert_res = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "expert"}).json()
        cls.expert_token = expert_res["token"]
        cls.expert_id = expert_res["id"]
        cls.expert_role = expert_res["role"]

        admin_res = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "admin"}).json()
        cls.admin_token = admin_res["token"]
        cls.admin_id = admin_res["id"]
        cls.admin_role = admin_res["role"]

    def test_01_farmer_login(self):
        """1. Farmer login -> returns token, user details, role = FARMER."""
        resp = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "farmer"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("token", data)
        self.assertEqual(data["role"], "FARMER")
        self.assertTrue(data["token"].startswith("agri_"))

    def test_02_expert_login(self):
        """2. Expert login -> returns token, user details, role = AGRICULTURAL_EXPERT."""
        resp = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "expert"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("token", data)
        self.assertEqual(data["role"], "AGRICULTURAL_EXPERT")
        self.assertTrue(data["token"].startswith("agri_"))

    def test_03_admin_login(self):
        """3. Admin login -> returns token, user details, role = ADMIN."""
        resp = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "admin"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("token", data)
        self.assertEqual(data["role"], "ADMIN")
        self.assertTrue(data["token"].startswith("agri_"))

    def test_04_default_farmer_role(self):
        """4. Default Farmer role -> New signup with missing/blank role defaults to FARMER."""
        unique_email = f"test_farmer_default_{int(time.time())}@agrismart.ai"
        signup_payload = {
            "full_name": "Kishan Default",
            "email": unique_email,
            "password": "SecurePassword123!",
            "farm_name": "Kishan Farm",
            "farm_location": "Haryana, India",
            "preferred_crop": "Wheat",
            "role": None,  # omitted / None
        }
        resp = requests.post(f"{BASE_URL}/auth/signup", json=signup_payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["role"], "FARMER")

    def test_05_farmer_access_to_ai_modules(self):
        """5. Farmer access to AI modules -> Smart farming & weather APIs remain accessible."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        # Check soil presets
        presets_resp = requests.get(f"{BASE_URL}/smart-farming/soil-presets", headers=headers)
        self.assertEqual(presets_resp.status_code, 200)

        # Check crops catalog
        catalog_resp = requests.get(f"{BASE_URL}/smart-farming/crops-catalog", headers=headers)
        self.assertEqual(catalog_resp.status_code, 200)

        # Check history
        history_resp = requests.get(f"{BASE_URL}/smart-farming/history", headers=headers)
        self.assertEqual(history_resp.status_code, 200)

    def test_06_farmer_blocked_from_user_management(self):
        """6. Farmer blocked from User Management -> returns 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = requests.get(f"{BASE_URL}/admin/users", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_07_farmer_blocked_from_system_monitoring(self):
        """7. Farmer blocked from System Monitoring -> returns 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = requests.get(f"{BASE_URL}/admin/system-monitoring", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_08_expert_access_to_expert_review(self):
        """8. Expert access to Expert Review -> returns 200 and real available telemetry."""
        headers = {"Authorization": f"Bearer {self.expert_token}"}
        resp = requests.get(f"{BASE_URL}/expert/review-data", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("results", data)
        self.assertIn("crop", data["results"])
        self.assertIn("disease", data["results"])
        self.assertIn("smart_irrigation", data["results"])
        self.assertIn("weather_risk", data["results"])
        self.assertIn("sustainability_score", data["results"])
        self.assertIn("agentic_advisor_priority", data["results"])

    def test_09_expert_blocked_from_user_management(self):
        """9. Expert blocked from User Management -> returns 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.expert_token}"}
        resp = requests.get(f"{BASE_URL}/admin/users", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_10_expert_blocked_from_system_monitoring(self):
        """10. Expert blocked from System Monitoring -> returns 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.expert_token}"}
        resp = requests.get(f"{BASE_URL}/admin/system-monitoring", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_11_admin_access_to_user_management(self):
        """11. Admin access to User Management -> returns 200 and user list."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        resp = requests.get(f"{BASE_URL}/admin/users", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("users", data)
        self.assertGreater(data["total"], 0)

    def test_12_admin_access_to_system_monitoring(self):
        """12. Admin access to System Monitoring -> returns 200, real statuses, and 95-crop EXPERIMENTAL badge."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        resp = requests.get(f"{BASE_URL}/admin/system-monitoring", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("modules", data)
        module_names = [m["module_name"] for m in data["modules"]]
        self.assertIn("Disease Detection", module_names)
        self.assertIn("22-Crop Production Recommendation", module_names)
        self.assertIn("95-Crop Recommendation", module_names)
        self.assertIn("Smart Irrigation", module_names)
        self.assertIn("Weather Intelligence", module_names)
        self.assertIn("Yield Prediction", module_names)
        self.assertIn("Sustainability Score", module_names)
        self.assertIn("Farmer Advisor", module_names)
        self.assertIn("Agentic Advisor", module_names)

        # Verify 95-Crop recommendation displays ⚠️ EXPERIMENTAL
        crop_95_item = next(m for m in data["modules"] if "95-Crop" in m["module_name"])
        self.assertEqual(crop_95_item["badge"], "⚠️ EXPERIMENTAL")

    def test_13_admin_can_change_roles(self):
        """13. Admin can change roles -> updates user role to AGRICULTURAL_EXPERT and then back to FARMER."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        # Change farmer to AGRICULTURAL_EXPERT
        resp1 = requests.patch(
            f"{BASE_URL}/admin/users/{self.farmer_id}/role",
            json={"role": "AGRICULTURAL_EXPERT"},
            headers=headers
        )
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp1.json()["updated_role"], "AGRICULTURAL_EXPERT")

        # Revert back to FARMER
        resp2 = requests.patch(
            f"{BASE_URL}/admin/users/{self.farmer_id}/role",
            json={"role": "FARMER"},
            headers=headers
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json()["updated_role"], "FARMER")

    def test_14_farmer_cannot_change_roles(self):
        """14. Farmer cannot change roles -> returns 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = requests.patch(
            f"{BASE_URL}/admin/users/{self.farmer_id}/role",
            json={"role": "ADMIN"},
            headers=headers
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_15_expert_cannot_change_roles(self):
        """15. Expert cannot change roles -> returns 403 Forbidden."""
        headers = {"Authorization": f"Bearer {self.expert_token}"}
        resp = requests.patch(
            f"{BASE_URL}/admin/users/{self.farmer_id}/role",
            json={"role": "ADMIN"},
            headers=headers
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_16_invalid_role_handling(self):
        """16. Invalid role handling -> rejects role outside allowed list with 422 Unprocessable Entity."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        resp = requests.patch(
            f"{BASE_URL}/admin/users/{self.farmer_id}/role",
            json={"role": "SUPER_USER_HACK"},
            headers=headers
        )
        self.assertEqual(resp.status_code, 422)

    def test_17_missing_authentication_returns_401(self):
        """17. Missing authentication returns 401 Unauthorized across protected endpoints."""
        endpoints = [
            "/expert/review-data",
            "/admin/users",
            "/admin/system-monitoring",
        ]
        for ep in endpoints:
            resp = requests.get(f"{BASE_URL}{ep}")
            self.assertEqual(resp.status_code, 401, f"Expected 401 for {ep} without token")

    def test_18_insufficient_role_returns_403(self):
        """18. Insufficient role returns 403 Forbidden."""
        # Farmer visiting expert review
        farmer_headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp_exp = requests.get(f"{BASE_URL}/expert/review-data", headers=farmer_headers)
        self.assertEqual(resp_exp.status_code, 403)

        # Expert visiting admin users
        expert_headers = {"Authorization": f"Bearer {self.expert_token}"}
        resp_adm = requests.get(f"{BASE_URL}/admin/users", headers=expert_headers)
        self.assertEqual(resp_adm.status_code, 403)

    def test_19_existing_authentication_tests(self):
        """19. Existing authentication tests -> signup, login, profile update, password change."""
        unique_email = f"test_lifecycle_{int(time.time())}@agrismart.ai"
        signup_payload = {
            "full_name": "Test Lifecycle User",
            "email": unique_email,
            "password": "Password123!",
            "farm_name": "Lifecycle Acres",
            "farm_location": "Punjab, India",
            "preferred_crop": "Tomato",
            "role": "farmer",
        }
        # 1. Signup
        signup_resp = requests.post(f"{BASE_URL}/auth/signup", json=signup_payload)
        self.assertEqual(signup_resp.status_code, 201)
        token = signup_resp.json()["token"]

        # 2. Login
        login_resp = requests.post(f"{BASE_URL}/auth/login", json={"email": unique_email, "password": "Password123!"})
        self.assertEqual(login_resp.status_code, 200)

        # 3. Profile update
        prof_resp = requests.put(
            f"{BASE_URL}/auth/profile",
            json={"email": unique_email, "full_name": "Updated Lifecycle User", "farm_name": "Updated Acres"}
        )
        self.assertEqual(prof_resp.status_code, 200)
        self.assertEqual(prof_resp.json()["full_name"], "Updated Lifecycle User")

        # 4. Change password
        pwd_resp = requests.post(
            f"{BASE_URL}/auth/change-password",
            json={"email": unique_email, "current_password": "Password123!", "new_password": "NewPassword456!"}
        )
        self.assertEqual(pwd_resp.status_code, 200)

        # 5. Verify login with new password
        new_login_resp = requests.post(f"{BASE_URL}/auth/login", json={"email": unique_email, "password": "NewPassword456!"})
        self.assertEqual(new_login_resp.status_code, 200)

    def test_20_existing_ai_integration_tests(self):
        """20. Existing AI integration tests -> AI health and prediction endpoints function without regression."""
        # Check health endpoint
        health_resp = requests.get(f"{BASE_URL}/health")
        self.assertEqual(health_resp.status_code, 200)
        self.assertEqual(health_resp.json()["status"], "healthy")

        # Check Smart Farming soil presets
        presets_resp = requests.get(f"{BASE_URL}/smart-farming/soil-presets")
        self.assertEqual(presets_resp.status_code, 200)
        self.assertGreater(len(presets_resp.json()), 0)


if __name__ == "__main__":
    unittest.main()
