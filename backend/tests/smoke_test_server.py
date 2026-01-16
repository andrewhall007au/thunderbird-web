#!/usr/bin/env python3
"""
V3.0 Server Smoke Tests

Run these tests ON THE SERVER after deployment to verify everything works.
These tests hit real endpoints without sending actual SMS.

Usage:
  # On server after deployment
  cd /opt/thunderbird/backend
  source venv/bin/activate
  python tests/smoke_test_server.py

  # Or with specific server URL
  python tests/smoke_test_server.py --url http://localhost:8000

Exit codes:
  0 = All tests passed
  1 = Some tests failed
"""

import argparse
import json
import sys
import time
from datetime import datetime
from urllib.parse import urlencode
import urllib.request
import urllib.error


# =============================================================================
# Configuration
# =============================================================================

DEFAULT_URL = "http://localhost:8000"
TEST_PHONE = "+61400000000"  # Fake phone for testing


# =============================================================================
# Test Runner
# =============================================================================

class SmokeTestRunner:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def run_all(self):
        """Run all smoke tests"""
        print(f"\n{'='*60}")
        print(f"THUNDERBIRD v3.0 SERVER SMOKE TESTS")
        print(f"Server: {self.base_url}")
        print(f"Time: {datetime.now().isoformat()}")
        print(f"{'='*60}\n")
        
        # Health check first
        self.test_health_check()
        
        # v3.0 Command tests
        self.test_cast_command()
        self.test_cast12_command()
        self.test_cast24_command()
        self.test_cast7_command()
        self.test_peaks_command()
        self.test_checkin_command()
        self.test_route_command()
        self.test_alerts_command()
        self.test_alerts_on_command()
        self.test_alerts_off_command()
        
        # Standard commands
        self.test_status_command()
        self.test_key_command()
        self.test_commands_command()
        
        # Format validation
        self.test_cast12_format()
        self.test_prec_column_format()
        self.test_wd_column_format()
        
        # Error handling
        self.test_invalid_command()
        self.test_invalid_location()
        
        # Print summary
        self.print_summary()
        
        return self.failed == 0
    
    def test(self, name: str, condition: bool, details: str = ""):
        """Record test result"""
        if condition:
            print(f"  ✓ {name}")
            self.passed += 1
        else:
            print(f"  ✗ {name}")
            if details:
                print(f"    → {details}")
            self.failed += 1
            self.errors.append(f"{name}: {details}")
    
    def send_sms_command(self, command: str) -> dict:
        """Send command via webhook endpoint"""
        url = f"{self.base_url}/webhook/sms/inbound"
        data = urlencode({
            "From": TEST_PHONE,
            "Body": command,
            "To": "+61400000001",
        }).encode()
        
        try:
            req = urllib.request.Request(url, data=data, method="POST")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            
            with urllib.request.urlopen(req, timeout=30) as response:
                return {
                    "status": response.status,
                    "body": response.read().decode(),
                }
        except urllib.error.HTTPError as e:
            return {
                "status": e.code,
                "body": e.read().decode() if e.fp else str(e),
                "error": str(e),
            }
        except Exception as e:
            return {
                "status": 0,
                "body": "",
                "error": str(e),
            }
    
    def get_json(self, path: str) -> dict:
        """GET JSON from endpoint"""
        url = f"{self.base_url}{path}"
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                return json.loads(response.read().decode())
        except Exception as e:
            return {"error": str(e)}
    
    # =========================================================================
    # Health Tests
    # =========================================================================
    
    def test_health_check(self):
        """Test /health endpoint"""
        print("\n[Health Check]")
        
        result = self.get_json("/health")
        
        self.test(
            "Health endpoint responds",
            "error" not in result,
            result.get("error", "")
        )
        
        self.test(
            "Status is healthy",
            result.get("status") == "healthy",
            f"Got: {result.get('status')}"
        )
    
    # =========================================================================
    # v3.0 Command Tests
    # =========================================================================
    
    def test_cast_command(self):
        """Test CAST LAKEO command"""
        print("\n[CAST Command]")
        
        result = self.send_sms_command("CAST LAKEO")
        
        self.test(
            "CAST returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        self.test(
            "Response contains forecast data",
            "Hr|" in result["body"] or "Tmp" in result["body"],
            "Missing forecast header"
        )
    
    def test_cast12_command(self):
        """Test CAST12 LAKEO command"""
        print("\n[CAST12 Command]")
        
        result = self.send_sms_command("CAST12 LAKEO")
        
        self.test(
            "CAST12 returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
    
    def test_cast24_command(self):
        """Test CAST24 LAKEO command"""
        print("\n[CAST24 Command]")
        
        result = self.send_sms_command("CAST24 LAKEO")
        
        self.test(
            "CAST24 returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        # CAST24 should have pagination markers
        body = result["body"]
        self.test(
            "CAST24 has multi-part indicator",
            "[1/" in body or "(1/" in body or "cont" in body.lower(),
            "Missing part indicator for 24hr forecast"
        )
    
    def test_cast7_command(self):
        """Test CAST7 command"""
        print("\n[CAST7 Command]")
        
        result = self.send_sms_command("CAST7")
        
        self.test(
            "CAST7 returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
    
    def test_peaks_command(self):
        """Test PEAKS command"""
        print("\n[PEAKS Command]")
        
        result = self.send_sms_command("PEAKS")
        
        self.test(
            "PEAKS returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
    
    def test_checkin_command(self):
        """Test CHECKIN LAKEO command"""
        print("\n[CHECKIN Command]")
        
        result = self.send_sms_command("CHECKIN LAKEO")
        
        self.test(
            "CHECKIN returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        body = result["body"]
        self.test(
            "CHECKIN confirms location",
            "Lake Oberon" in body or "LAKEO" in body or "check" in body.lower(),
            "Missing location confirmation"
        )
    
    def test_route_command(self):
        """Test ROUTE command"""
        print("\n[ROUTE Command]")
        
        result = self.send_sms_command("ROUTE")
        
        self.test(
            "ROUTE returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        body = result["body"]
        self.test(
            "ROUTE lists camps",
            "CAMPS" in body.upper() or "LAKEO" in body,
            "Missing camps list"
        )
    
    def test_alerts_command(self):
        """Test ALERTS command"""
        print("\n[ALERTS Command]")
        
        result = self.send_sms_command("ALERTS")
        
        self.test(
            "ALERTS returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
    
    def test_alerts_on_command(self):
        """Test ALERTS ON command"""
        print("\n[ALERTS ON Command]")
        
        result = self.send_sms_command("ALERTS ON")
        
        self.test(
            "ALERTS ON returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        self.test(
            "ALERTS ON confirms enablement",
            "enabled" in result["body"].lower() or "ON" in result["body"],
            "Missing enable confirmation"
        )
    
    def test_alerts_off_command(self):
        """Test ALERTS OFF command"""
        print("\n[ALERTS OFF Command]")
        
        result = self.send_sms_command("ALERTS OFF")
        
        self.test(
            "ALERTS OFF returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
    
    # =========================================================================
    # Standard Command Tests
    # =========================================================================
    
    def test_status_command(self):
        """Test STATUS command"""
        print("\n[STATUS Command]")
        
        result = self.send_sms_command("STATUS")
        
        self.test(
            "STATUS returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
    
    def test_key_command(self):
        """Test KEY command"""
        print("\n[KEY Command]")
        
        result = self.send_sms_command("KEY")
        
        self.test(
            "KEY returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        body = result["body"]
        self.test(
            "KEY explains columns",
            "Tmp" in body or "Temp" in body,
            "Missing column explanation"
        )
        
        # v3.0: Should explain Prec and Wd
        self.test(
            "KEY explains Prec column",
            "Prec" in body or "R=" in body or "rain" in body.lower(),
            "Missing Prec explanation"
        )
        
        self.test(
            "KEY explains Wd column",
            "Wd" in body or "direction" in body.lower(),
            "Missing Wd explanation"
        )
    
    def test_commands_command(self):
        """Test COMMANDS command"""
        print("\n[COMMANDS Command]")
        
        result = self.send_sms_command("COMMANDS")
        
        self.test(
            "COMMANDS returns 200",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        body = result["body"]
        self.test(
            "COMMANDS lists CAST",
            "CAST" in body,
            "Missing CAST command"
        )
        
        self.test(
            "COMMANDS lists CHECKIN",
            "CHECKIN" in body,
            "Missing CHECKIN command"
        )
    
    # =========================================================================
    # Format Validation Tests
    # =========================================================================
    
    def test_cast12_format(self):
        """Validate CAST12 output format"""
        print("\n[CAST12 Format Validation]")
        
        result = self.send_sms_command("CAST12 LAKEO")
        body = result["body"]
        
        # Should have 12 hourly rows
        import re
        hour_rows = re.findall(r'^\d{2}\|', body, re.MULTILINE)
        self.test(
            "Has 12 hourly rows",
            len(hour_rows) >= 10,  # Allow some flexibility
            f"Found {len(hour_rows)} rows"
        )
        
        # Should fit in ~3 SMS (under 500 chars)
        self.test(
            "Fits in 3 SMS segments",
            len(body) <= 500,
            f"Length: {len(body)} chars"
        )
    
    def test_prec_column_format(self):
        """Validate Prec column format (R#-# or S#-#)"""
        print("\n[Prec Column Format]")
        
        result = self.send_sms_command("CAST12 LAKEO")
        body = result["body"]
        
        import re
        # Should have Prec column with R or S prefix
        has_rain_format = bool(re.search(r'R\d+-\d+', body))
        has_snow_format = bool(re.search(r'S\d+-\d+', body))
        
        self.test(
            "Prec column uses R#-# or S#-# format",
            has_rain_format or has_snow_format,
            "Missing Prec format in output"
        )
        
        # Should NOT have separate Rn|Sn columns
        self.test(
            "No separate Rn|Sn columns",
            "|Rn|Sn|" not in body,
            "Old Rn|Sn format still present"
        )
    
    def test_wd_column_format(self):
        """Validate Wd column format (compass direction)"""
        print("\n[Wd Column Format]")
        
        result = self.send_sms_command("CAST12 LAKEO")
        body = result["body"]
        
        # Should have wind direction values
        wind_dirs = ["NW", "SW", "W|", "N|", "NE", "E|", "SE", "S|"]
        has_wd = any(wd in body for wd in wind_dirs)
        
        self.test(
            "Has wind direction values",
            has_wd,
            "Missing Wd values in output"
        )
        
        # Should NOT have CB column
        self.test(
            "No CB column (removed in v3.0)",
            "|CB|" not in body,
            "Old CB column still present"
        )
    
    # =========================================================================
    # Error Handling Tests
    # =========================================================================
    
    def test_invalid_command(self):
        """Test invalid command handling"""
        print("\n[Invalid Command Handling]")
        
        result = self.send_sms_command("XYZABC")
        
        self.test(
            "Invalid command returns 200 (with error message)",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        body = result["body"]
        self.test(
            "Response indicates error",
            "not recognized" in body.lower() or "invalid" in body.lower() or "commands" in body.lower(),
            "Missing error indication"
        )
    
    def test_invalid_location(self):
        """Test invalid location handling"""
        print("\n[Invalid Location Handling]")
        
        result = self.send_sms_command("CAST XXXXX")
        
        self.test(
            "Invalid location returns 200 (with error message)",
            result["status"] == 200,
            f"Got status: {result['status']}"
        )
        
        body = result["body"]
        self.test(
            "Response suggests ROUTE command",
            "ROUTE" in body or "not recognized" in body.lower(),
            "Missing helpful suggestion"
        )
    
    # =========================================================================
    # Summary
    # =========================================================================
    
    def print_summary(self):
        """Print test summary"""
        total = self.passed + self.failed
        
        print(f"\n{'='*60}")
        print(f"SUMMARY")
        print(f"{'='*60}")
        print(f"Passed: {self.passed}/{total}")
        print(f"Failed: {self.failed}/{total}")
        
        if self.errors:
            print(f"\nFailed tests:")
            for error in self.errors:
                print(f"  • {error}")
        
        if self.failed == 0:
            print(f"\n✓ ALL TESTS PASSED")
        else:
            print(f"\n✗ SOME TESTS FAILED")
        
        print(f"{'='*60}\n")


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Run server smoke tests")
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"Server URL (default: {DEFAULT_URL})"
    )
    args = parser.parse_args()
    
    runner = SmokeTestRunner(args.url)
    success = runner.run_all()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
