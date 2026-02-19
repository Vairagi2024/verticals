#!/usr/bin/env python3
"""
Backend API Testing for Admin Password Change Functionality
Tests the newly implemented admin password change endpoints
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend .env
BACKEND_URL = "https://study-platform-33.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDENTIALS = {
    "email": "Chemistryby.sandeep@gmail.com",
    "password": "Vairagi@2024"
}

TEACHER_CREDENTIALS = {
    "email": "teacher@test.com",
    "password": "teacher"
}

STUDENT_CREDENTIALS = {
    "email": "student@test.com",
    "password": "student123",
    "batch_code": "VS2026-001"
}

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.teacher_user_id = None
        self.student_user_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    headers: Dict = None, auth_token: str = None) -> Dict[str, Any]:
        """Make HTTP request with proper error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        
        # Set up headers
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        if auth_token:
            req_headers["Authorization"] = f"Bearer {auth_token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=req_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=req_headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=req_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "success": 200 <= response.status_code < 300
            }
        except requests.exceptions.RequestException as e:
            self.log(f"Request failed: {e}", "ERROR")
            return {"status_code": 0, "data": {"error": str(e)}, "success": False}
        except json.JSONDecodeError as e:
            self.log(f"JSON decode error: {e}", "ERROR")
            return {"status_code": response.status_code, "data": {"error": "Invalid JSON"}, "success": False}
    
    def test_admin_login(self) -> bool:
        """Test Case 1: Admin Login"""
        self.log("Testing Admin Login...")
        
        response = self.make_request("POST", "/auth/login/admin", ADMIN_CREDENTIALS)
        
        if not response["success"]:
            self.log(f"❌ Admin login failed: {response['data']}", "ERROR")
            return False
            
        if "session_token" not in response["data"]:
            self.log("❌ Admin login missing session token", "ERROR")
            return False
            
        self.admin_token = response["data"]["session_token"]
        user_data = response["data"].get("user", {})
        
        if user_data.get("role") != "admin":
            self.log(f"❌ Admin login returned wrong role: {user_data.get('role')}", "ERROR")
            return False
            
        self.log("✅ Admin login successful")
        return True
    
    def test_get_all_users(self) -> bool:
        """Test Case 2: Get All Users"""
        self.log("Testing Get All Users...")
        
        if not self.admin_token:
            self.log("❌ No admin token available", "ERROR")
            return False
            
        response = self.make_request("GET", "/admin/users", auth_token=self.admin_token)
        
        if not response["success"]:
            self.log(f"❌ Get users failed: {response['data']}", "ERROR")
            return False
            
        users = response["data"]
        if not isinstance(users, list):
            self.log(f"❌ Expected list of users, got: {type(users)}", "ERROR")
            return False
            
        # Find teacher and student for password change tests
        for user in users:
            if user.get("email") == TEACHER_CREDENTIALS["email"]:
                self.teacher_user_id = user.get("user_id")
            elif user.get("email") == STUDENT_CREDENTIALS["email"]:
                self.student_user_id = user.get("user_id")
                
        self.log(f"✅ Retrieved {len(users)} users")
        self.log(f"   Teacher ID: {self.teacher_user_id}")
        self.log(f"   Student ID: {self.student_user_id}")
        return True
    
    def test_change_teacher_password(self) -> bool:
        """Test Case 3: Change Password for Teacher"""
        self.log("Testing Change Teacher Password...")
        
        if not self.admin_token:
            self.log("❌ No admin token available", "ERROR")
            return False
            
        if not self.teacher_user_id:
            self.log("❌ Teacher user ID not found", "ERROR")
            return False
            
        new_password = "newpass123"
        password_data = {"new_password": new_password}
        
        response = self.make_request(
            "PUT", 
            f"/admin/users/{self.teacher_user_id}/password",
            password_data,
            auth_token=self.admin_token
        )
        
        if not response["success"]:
            self.log(f"❌ Change teacher password failed: {response['data']}", "ERROR")
            return False
            
        self.log("✅ Teacher password changed successfully")
        return True
    
    def test_verify_new_teacher_password(self) -> bool:
        """Test Case 4: Verify the new password works"""
        self.log("Testing Teacher Login with New Password...")
        
        new_credentials = {
            "email": TEACHER_CREDENTIALS["email"],
            "password": "newpass123"
        }
        
        response = self.make_request("POST", "/auth/login/teacher", new_credentials)
        
        if not response["success"]:
            self.log(f"❌ Teacher login with new password failed: {response['data']}", "ERROR")
            return False
            
        if "session_token" not in response["data"]:
            self.log("❌ Teacher login missing session token", "ERROR")
            return False
            
        user_data = response["data"].get("user", {})
        if user_data.get("role") != "teacher":
            self.log(f"❌ Teacher login returned wrong role: {user_data.get('role')}", "ERROR")
            return False
            
        self.log("✅ Teacher login with new password successful")
        return True
    
    def test_reset_teacher_password(self) -> bool:
        """Test Case 5: Reset password back to original"""
        self.log("Testing Reset Teacher Password...")
        
        if not self.admin_token:
            self.log("❌ No admin token available", "ERROR")
            return False
            
        if not self.teacher_user_id:
            self.log("❌ Teacher user ID not found", "ERROR")
            return False
            
        original_password = TEACHER_CREDENTIALS["password"]
        password_data = {"new_password": original_password}
        
        response = self.make_request(
            "PUT", 
            f"/admin/users/{self.teacher_user_id}/password",
            password_data,
            auth_token=self.admin_token
        )
        
        if not response["success"]:
            self.log(f"❌ Reset teacher password failed: {response['data']}", "ERROR")
            return False
            
        # Verify original password works again
        response = self.make_request("POST", "/auth/login/teacher", TEACHER_CREDENTIALS)
        
        if not response["success"]:
            self.log(f"❌ Teacher login with original password failed: {response['data']}", "ERROR")
            return False
            
        self.log("✅ Teacher password reset to original successfully")
        return True
    
    def test_non_admin_access(self) -> bool:
        """Test Case 6: Verify non-admins cannot access admin endpoints"""
        self.log("Testing Non-Admin Access Restrictions...")
        
        # First login as teacher
        teacher_response = self.make_request("POST", "/auth/login/teacher", TEACHER_CREDENTIALS)
        
        if not teacher_response["success"]:
            self.log("❌ Could not login as teacher for access test", "ERROR")
            return False
            
        teacher_token = teacher_response["data"]["session_token"]
        
        # Try to access admin endpoints with teacher token
        users_response = self.make_request("GET", "/admin/users", auth_token=teacher_token)
        
        if users_response["success"]:
            self.log("❌ Teacher was able to access admin users endpoint", "ERROR")
            return False
            
        if users_response["status_code"] != 403:
            self.log(f"❌ Expected 403 Forbidden, got {users_response['status_code']}", "ERROR")
            return False
            
        # Try to change password with teacher token
        if self.student_user_id:
            password_response = self.make_request(
                "PUT",
                f"/admin/users/{self.student_user_id}/password",
                {"new_password": "hacktest"},
                auth_token=teacher_token
            )
            
            if password_response["success"]:
                self.log("❌ Teacher was able to change user password", "ERROR")
                return False
                
            if password_response["status_code"] != 403:
                self.log(f"❌ Expected 403 Forbidden for password change, got {password_response['status_code']}", "ERROR")
                return False
        
        self.log("✅ Non-admin access properly restricted")
        return True
    
    def test_edge_cases(self) -> bool:
        """Test edge cases and error handling"""
        self.log("Testing Edge Cases...")
        
        if not self.admin_token:
            self.log("❌ No admin token available", "ERROR")
            return False
        
        # Test invalid user ID
        invalid_response = self.make_request(
            "PUT",
            "/admin/users/invalid_user_id/password",
            {"new_password": "test123"},
            auth_token=self.admin_token
        )
        
        if invalid_response["success"]:
            self.log("❌ Password change succeeded for invalid user ID", "ERROR")
            return False
            
        if invalid_response["status_code"] != 404:
            self.log(f"❌ Expected 404 for invalid user, got {invalid_response['status_code']}", "ERROR")
            return False
        
        # Test short password
        if self.teacher_user_id:
            short_password_response = self.make_request(
                "PUT",
                f"/admin/users/{self.teacher_user_id}/password",
                {"new_password": "123"},  # Too short
                auth_token=self.admin_token
            )
            
            if short_password_response["success"]:
                self.log("❌ Password change succeeded with short password", "ERROR")
                return False
                
            if short_password_response["status_code"] != 400:
                self.log(f"❌ Expected 400 for short password, got {short_password_response['status_code']}", "ERROR")
                return False
        
        self.log("✅ Edge cases handled correctly")
        return True
    
    def run_all_tests(self) -> bool:
        """Run all test cases"""
        self.log("=" * 60)
        self.log("STARTING ADMIN PASSWORD CHANGE FUNCTIONALITY TESTS")
        self.log("=" * 60)
        
        test_results = []
        
        # Test cases in order
        test_cases = [
            ("Admin Login", self.test_admin_login),
            ("Get All Users", self.test_get_all_users),
            ("Change Teacher Password", self.test_change_teacher_password),
            ("Verify New Password Works", self.test_verify_new_teacher_password),
            ("Reset Password Back", self.test_reset_teacher_password),
            ("Non-Admin Access Restrictions", self.test_non_admin_access),
            ("Edge Cases", self.test_edge_cases)
        ]
        
        for test_name, test_func in test_cases:
            self.log(f"\n--- {test_name} ---")
            try:
                result = test_func()
                test_results.append((test_name, result))
                if not result:
                    self.log(f"❌ {test_name} FAILED", "ERROR")
                else:
                    self.log(f"✅ {test_name} PASSED")
            except Exception as e:
                self.log(f"❌ {test_name} FAILED with exception: {e}", "ERROR")
                test_results.append((test_name, False))
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        
        passed = sum(1 for _, result in test_results if result)
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status} - {test_name}")
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!", "SUCCESS")
            return True
        else:
            self.log(f"❌ {total - passed} tests failed", "ERROR")
            return False

def main():
    """Main test runner"""
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()