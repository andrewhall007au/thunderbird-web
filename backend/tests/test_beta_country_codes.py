"""
Beta Application Country Code Tests

Tests for country code normalization in beta application endpoint.
This test file was created to catch the bug where country codes (AU, US)
were rejected while full names (Australia, United States) were required.

Run with: pytest tests/test_beta_country_codes.py -v
"""
import pytest
from app.models.beta_application import normalize_country, SUPPORTED_COUNTRIES, COUNTRY_CODE_MAP


class TestCountryNormalization:
    """Tests for normalize_country function."""

    def test_normalize_country_code_uppercase(self):
        """Country codes in uppercase should be normalized to full names."""
        assert normalize_country("AU") == "Australia"
        assert normalize_country("US") == "United States"
        assert normalize_country("NZ") == "New Zealand"
        assert normalize_country("UK") == "United Kingdom"
        assert normalize_country("GB") == "United Kingdom"
        assert normalize_country("CA") == "Canada"
        assert normalize_country("DE") == "Germany"
        assert normalize_country("FR") == "France"
        assert normalize_country("JP") == "Japan"
        assert normalize_country("KR") == "South Korea"

    def test_normalize_country_code_lowercase(self):
        """Country codes in lowercase should be normalized to full names."""
        assert normalize_country("au") == "Australia"
        assert normalize_country("us") == "United States"
        assert normalize_country("nz") == "New Zealand"

    def test_normalize_country_code_mixed_case(self):
        """Country codes in mixed case should be normalized."""
        assert normalize_country("Au") == "Australia"
        assert normalize_country("uS") == "United States"

    def test_normalize_full_name_exact_match(self):
        """Full country names with exact case should remain unchanged."""
        assert normalize_country("Australia") == "Australia"
        assert normalize_country("United States") == "United States"
        assert normalize_country("New Zealand") == "New Zealand"

    def test_normalize_full_name_different_case(self):
        """Full country names with different case should be normalized."""
        assert normalize_country("australia") == "Australia"
        assert normalize_country("AUSTRALIA") == "Australia"
        assert normalize_country("united states") == "United States"
        assert normalize_country("UNITED KINGDOM") == "United Kingdom"

    def test_normalize_invalid_country(self):
        """Invalid country codes/names should return original input."""
        assert normalize_country("XX") == "XX"
        assert normalize_country("ZZ") == "ZZ"
        assert normalize_country("InvalidCountry") == "InvalidCountry"
        assert normalize_country("123") == "123"

    def test_normalize_with_whitespace(self):
        """Input with leading/trailing whitespace should be handled."""
        assert normalize_country("  AU  ") == "Australia"
        assert normalize_country(" Australia ") == "Australia"
        assert normalize_country("\tUS\n") == "United States"

    def test_all_supported_countries_covered(self):
        """All supported countries should have a country code mapping."""
        # Verify that common country codes are mapped
        expected_mappings = {
            "AU": "Australia",
            "NZ": "New Zealand",
            "US": "United States",
            "UK": "United Kingdom",
            "GB": "United Kingdom",
            "CA": "Canada",
            "DE": "Germany",
            "FR": "France",
            "JP": "Japan",
            "KR": "South Korea",
        }

        for code, expected_name in expected_mappings.items():
            assert code in COUNTRY_CODE_MAP, f"Country code {code} not in COUNTRY_CODE_MAP"
            assert COUNTRY_CODE_MAP[code] == expected_name, \
                f"Country code {code} maps to {COUNTRY_CODE_MAP[code]}, expected {expected_name}"


class TestBetaApplicationEndpoint:
    """Integration tests for beta application endpoint."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    @pytest.fixture
    def unique_email(self):
        """Generate unique email for each test."""
        import time
        return f"test-{int(time.time())}-{id(self)}@example.com"

    def test_beta_apply_with_country_code_uppercase(self, client, unique_email):
        """Beta application should accept uppercase country codes."""
        response = client.post(
            "/api/beta/apply",
            json={
                "name": "Test User",
                "email": unique_email,
                "country": "AU"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_beta_apply_with_country_code_lowercase(self, client, unique_email):
        """Beta application should accept lowercase country codes."""
        response = client.post(
            "/api/beta/apply",
            json={
                "name": "Test User",
                "email": unique_email,
                "country": "us"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_beta_apply_with_full_country_name(self, client, unique_email):
        """Beta application should accept full country names."""
        response = client.post(
            "/api/beta/apply",
            json={
                "name": "Test User",
                "email": unique_email,
                "country": "Australia"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_beta_apply_with_country_name_lowercase(self, client, unique_email):
        """Beta application should accept lowercase full country names."""
        response = client.post(
            "/api/beta/apply",
            json={
                "name": "Test User",
                "email": unique_email,
                "country": "new zealand"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_beta_apply_with_invalid_country_code(self, client, unique_email):
        """Beta application should reject invalid country codes."""
        response = client.post(
            "/api/beta/apply",
            json={
                "name": "Test User",
                "email": unique_email,
                "country": "XX"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "Country not supported" in data["detail"]

    def test_beta_apply_with_invalid_country_name(self, client, unique_email):
        """Beta application should reject invalid country names."""
        response = client.post(
            "/api/beta/apply",
            json={
                "name": "Test User",
                "email": unique_email,
                "country": "Atlantis"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "Country not supported" in data["detail"]

    def test_beta_apply_all_supported_countries(self, client):
        """Beta application should accept all supported country codes."""
        import time

        for code, full_name in COUNTRY_CODE_MAP.items():
            email = f"test-{code.lower()}-{int(time.time())}-{id(self)}@example.com"

            # Test with country code
            response = client.post(
                "/api/beta/apply",
                json={
                    "name": f"Test {code}",
                    "email": email,
                    "country": code
                }
            )
            assert response.status_code == 200, \
                f"Country code {code} should be accepted but got {response.status_code}"

    def test_beta_apply_alternative_uk_code(self, client, unique_email):
        """Beta application should accept both UK and GB codes for United Kingdom."""
        response_uk = client.post(
            "/api/beta/apply",
            json={
                "name": "Test User UK",
                "email": f"uk-{unique_email}",
                "country": "UK"
            }
        )
        assert response_uk.status_code == 200

        response_gb = client.post(
            "/api/beta/apply",
            json={
                "name": "Test User GB",
                "email": f"gb-{unique_email}",
                "country": "GB"
            }
        )
        assert response_gb.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
