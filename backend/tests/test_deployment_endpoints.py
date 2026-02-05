"""
Deployment Endpoint Tests

Tests to verify all critical endpoints are accessible and return correct status codes.
These tests would catch deployment issues like missing routers or incorrect nginx configuration.

This test suite was created after discovering auth endpoints returned 404 in production
despite being properly defined in the code.

Run with: pytest tests/test_deployment_endpoints.py -v
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create test client for API."""
    from app.main import app
    return TestClient(app)


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_root_health_endpoint(self, client):
        """GET /health should return 200."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "services" in data
        assert "version" in data

    def test_api_health_endpoint(self, client):
        """GET /api/health should return 200."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "services" in data
        assert "version" in data

    def test_health_services_structure(self, client):
        """Health endpoint should NOT expose service details (security hardening)."""
        response = client.get("/health")
        data = response.json()

        # Services should be empty dict (no internal details exposed)
        assert data["services"] == {}, "Health endpoint should not expose service details"

    def test_health_version_format(self, client):
        """Health endpoint should NOT expose real version (security hardening)."""
        response = client.get("/health")
        data = response.json()

        version = data["version"]
        assert isinstance(version, str)
        # Version should be opaque, not a real version number
        assert "." not in version, "Health endpoint should not expose real version number"


class TestAuthEndpointsExist:
    """Tests to verify auth endpoints exist and are accessible.

    These tests would catch the bug where auth endpoints returned 404 in production.
    """

    def test_auth_token_endpoint_exists(self, client):
        """POST /auth/token endpoint should exist (not 404)."""
        # Don't send auth data, just check endpoint exists
        response = client.get("/auth/token")
        # Should return 405 Method Not Allowed (GET not allowed), NOT 404
        assert response.status_code != 404, \
            "Auth token endpoint returned 404 - router may not be included"
        assert response.status_code == 405, \
            f"Expected 405 Method Not Allowed for GET /auth/token, got {response.status_code}"

    def test_auth_register_endpoint_exists(self, client):
        """POST /auth/register endpoint should exist (not 404)."""
        response = client.get("/auth/register")
        assert response.status_code != 404, \
            "Auth register endpoint returned 404 - router may not be included"
        assert response.status_code == 405, \
            f"Expected 405 Method Not Allowed for GET /auth/register, got {response.status_code}"

    def test_auth_me_endpoint_exists(self, client):
        """GET /auth/me endpoint should exist (not 404)."""
        response = client.get("/auth/me")
        # Should return 401 Unauthorized (no token), NOT 404
        assert response.status_code != 404, \
            "Auth me endpoint returned 404 - router may not be included"
        assert response.status_code == 401, \
            f"Expected 401 Unauthorized for GET /auth/me, got {response.status_code}"

    def test_auth_forgot_password_endpoint_exists(self, client):
        """POST /auth/forgot-password endpoint should exist (not 404)."""
        response = client.get("/auth/forgot-password")
        assert response.status_code != 404, \
            "Forgot password endpoint returned 404 - router may not be included"
        # Should return 405 (wrong method) or 422 (validation error), NOT 404
        assert response.status_code in [405, 422], \
            f"Expected 405 or 422 for GET /auth/forgot-password, got {response.status_code}"

    def test_auth_reset_password_endpoint_exists(self, client):
        """POST /auth/reset-password endpoint should exist (not 404)."""
        response = client.get("/auth/reset-password")
        assert response.status_code != 404, \
            "Reset password endpoint returned 404 - router may not be included"
        assert response.status_code in [405, 422], \
            f"Expected 405 or 422 for GET /auth/reset-password, got {response.status_code}"


class TestAuthEndpointsFunctional:
    """Functional tests for auth endpoints."""

    def test_auth_register_with_valid_data(self, client):
        """POST /auth/register with valid data should create account."""
        import time
        email = f"test-{int(time.time())}@example.com"

        response = client.post(
            "/auth/register",
            json={
                "email": email,
                "password": "testpass123"
            }
        )
        assert response.status_code == 201, f"Registration failed: {response.json()}"
        data = response.json()
        assert data["email"] == email
        assert "id" in data
        assert "password" not in data  # Password should not be returned

    def test_auth_register_duplicate_email(self, client):
        """POST /auth/register with duplicate email should return 400."""
        import time
        email = f"test-dup-{int(time.time())}@example.com"

        # Register first time
        response1 = client.post(
            "/auth/register",
            json={"email": email, "password": "testpass123"}
        )
        assert response1.status_code == 201

        # Try to register again with same email
        response2 = client.post(
            "/auth/register",
            json={"email": email, "password": "testpass456"}
        )
        assert response2.status_code == 400
        assert "already registered" in response2.json()["detail"].lower()

    def test_auth_login_with_valid_credentials(self, client):
        """POST /auth/token with valid credentials should return token."""
        import time
        email = f"test-login-{int(time.time())}@example.com"

        # Register user
        client.post(
            "/auth/register",
            json={"email": email, "password": "testpass123"}
        )

        # Login
        response = client.post(
            "/auth/token",
            data={"username": email, "password": "testpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0

    def test_auth_login_with_invalid_credentials(self, client):
        """POST /auth/token with invalid credentials should return 401."""
        response = client.post(
            "/auth/token",
            data={"username": "nonexistent@example.com", "password": "wrongpass"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 401

    def test_auth_me_with_valid_token(self, client):
        """GET /auth/me with valid token should return account info."""
        import time
        email = f"test-me-{int(time.time())}@example.com"

        # Register and login
        client.post("/auth/register", json={"email": email, "password": "testpass123"})
        login_response = client.post(
            "/auth/token",
            data={"username": email, "password": "testpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        token = login_response.json()["access_token"]

        # Get account info
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email
        assert "password" not in data

    def test_auth_me_without_token(self, client):
        """GET /auth/me without token should return 401."""
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_auth_me_with_invalid_token(self, client):
        """GET /auth/me with invalid token should return 401."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid-token-12345"}
        )
        assert response.status_code == 401


class TestAPIEndpointsExist:
    """Tests to verify API endpoints exist."""

    def test_library_endpoint_exists(self, client):
        """GET /api/library endpoint should exist."""
        response = client.get("/api/library")
        assert response.status_code != 404
        assert response.status_code in [200, 401], \
            f"Library endpoint should return 200 or 401, got {response.status_code}"

    def test_beta_apply_endpoint_exists(self, client):
        """POST /api/beta/apply endpoint should exist."""
        response = client.get("/api/beta/apply")
        assert response.status_code != 404
        # Should return 405 (wrong method) or 422 (validation error), NOT 404
        assert response.status_code in [405, 422], \
            f"Beta apply endpoint should return 405 or 422, got {response.status_code}"


class TestDeploymentVerification:
    """High-level deployment verification tests."""

    def test_all_critical_endpoints_accessible(self, client):
        """Verify all critical endpoints are accessible (not 404)."""
        critical_endpoints = [
            ("GET", "/health"),
            ("GET", "/api/health"),
            ("GET", "/api/library"),
            ("GET", "/auth/token"),  # Will return 405, not 404
            ("GET", "/auth/register"),  # Will return 405, not 404
            ("GET", "/auth/me"),  # Will return 401, not 404
        ]

        failures = []
        for method, path in critical_endpoints:
            response = client.get(path)
            if response.status_code == 404:
                failures.append(f"{method} {path} returned 404")

        assert len(failures) == 0, \
            f"Critical endpoints returned 404:\n" + "\n".join(failures)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
