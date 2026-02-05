"""
Browser-Based Synthetic Monitoring Checks

Uses Playwright to run real browser tests against production.
These catch issues that API-only tests miss (CSP, JavaScript errors, etc.)
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any
from playwright.async_api import async_playwright, Page, Browser, BrowserContext

logger = logging.getLogger(__name__)


class BrowserCheck:
    """Base class for browser-based checks."""

    def __init__(self, url: str = "https://thunderbird.bot"):
        self.url = url
        self.browser: Browser | None = None
        self.context: BrowserContext | None = None

    async def setup(self):
        """Initialize browser."""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context()

    async def teardown(self):
        """Cleanup browser."""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()

    async def run(self) -> Dict[str, Any]:
        """Run the check. Override in subclasses."""
        raise NotImplementedError


class BetaSignupCheck(BrowserCheck):
    """
    CRITICAL: Tests that beta signup form works end-to-end.

    This is the check that would have caught today's localhost bug.
    """

    async def run(self) -> Dict[str, Any]:
        """Test beta signup flow."""
        start_time = datetime.now()
        result = {
            "check": "beta_signup_flow",
            "success": False,
            "duration_ms": 0,
            "error": None,
            "details": {}
        }

        try:
            await self.setup()
            page = await self.context.new_page()

            # Track errors
            errors = []
            csp_violations = []

            page.on("console", lambda msg: errors.append(msg.text()) if msg.type() == "error" else None)
            page.on("console", lambda msg: csp_violations.append(msg.text()) if "Content Security Policy" in msg.text() else None)

            # Load homepage
            await page.goto(self.url, timeout=30000)
            result["details"]["homepage_loaded"] = True

            # Click beta button
            await page.click('text=Apply for Beta', timeout=5000)
            result["details"]["modal_opened"] = True

            # Fill form
            test_email = f"monitor-{int(datetime.now().timestamp())}@example.com"
            await page.fill('input[type="text"]', 'Monitor Test')
            await page.fill('input[type="email"]', test_email)
            await page.select_option('select', 'Australia')
            result["details"]["form_filled"] = True

            # Submit
            await page.click('button[type="submit"]', timeout=5000)

            # Wait for response (max 10s)
            await page.wait_for_timeout(3000)

            # Check for errors
            page_content = await page.content()

            # CRITICAL: Should NOT see "Network error"
            if "Network error" in page_content:
                raise Exception("Beta signup shows 'Network error' - API unreachable from frontend")

            # Should see success message
            if "Application Received" not in page_content:
                raise Exception("Beta signup did not show success message")

            result["details"]["form_submitted"] = True

            # Check for CSP violations
            localhost_violations = [v for v in csp_violations if "localhost" in v]
            if localhost_violations:
                raise Exception(f"CSP violation with localhost: {localhost_violations[0]}")

            result["details"]["no_csp_violations"] = True

            # Check for JavaScript errors
            critical_errors = [e for e in errors if "localhost" in e or "failed to fetch" in e.lower()]
            if critical_errors:
                raise Exception(f"JavaScript error: {critical_errors[0]}")

            result["details"]["no_js_errors"] = True

            result["success"] = True

        except Exception as e:
            logger.error(f"Beta signup check failed: {e}")
            result["error"] = str(e)

        finally:
            await self.teardown()

        result["duration_ms"] = (datetime.now() - start_time).total_seconds() * 1000
        return result


class HomepageLoadCheck(BrowserCheck):
    """Tests that homepage loads without errors."""

    async def run(self) -> Dict[str, Any]:
        """Test homepage load."""
        start_time = datetime.now()
        result = {
            "check": "homepage_load",
            "success": False,
            "duration_ms": 0,
            "error": None,
            "details": {}
        }

        try:
            await self.setup()
            page = await self.context.new_page()

            # Track resources
            failed_resources = []
            page.on("response", lambda r: failed_resources.append(f"{r.url} - {r.status}") if not r.ok and r.status != 404 else None)

            # Load page
            response = await page.goto(self.url, timeout=30000, wait_until="networkidle")

            result["details"]["status_code"] = response.status
            result["details"]["load_time_ms"] = (datetime.now() - start_time).total_seconds() * 1000

            # Check key elements exist
            title = await page.title()
            result["details"]["title"] = title

            if "Thunderbird" not in title:
                raise Exception(f"Title missing 'Thunderbird': {title}")

            # Check beta button exists
            beta_button = await page.locator('text=Apply for Beta').count()
            if beta_button == 0:
                raise Exception("Beta button not found on homepage")

            result["details"]["beta_button_exists"] = True

            # Check for failed resources
            critical_failures = [r for r in failed_resources if "/api/" in r or "/static/" in r]
            if critical_failures:
                raise Exception(f"Critical resource failed: {critical_failures[0]}")

            result["details"]["all_resources_loaded"] = True
            result["success"] = True

        except Exception as e:
            logger.error(f"Homepage load check failed: {e}")
            result["error"] = str(e)

        finally:
            await self.teardown()

        result["duration_ms"] = (datetime.now() - start_time).total_seconds() * 1000
        return result


async def run_all_browser_checks(url: str = "https://thunderbird.bot") -> Dict[str, Any]:
    """
    Run all browser-based checks.

    Returns:
        {
            "timestamp": "2026-02-05T06:30:00Z",
            "checks": [
                {"check": "beta_signup_flow", "success": True, ...},
                {"check": "homepage_load", "success": True, ...}
            ],
            "all_passed": True
        }
    """
    checks = [
        BetaSignupCheck(url),
        HomepageLoadCheck(url)
    ]

    results = []
    for check in checks:
        try:
            result = await check.run()
            results.append(result)
        except Exception as e:
            logger.error(f"Check failed with exception: {e}")
            results.append({
                "check": check.__class__.__name__,
                "success": False,
                "error": str(e)
            })

    return {
        "timestamp": datetime.now().isoformat(),
        "checks": results,
        "all_passed": all(r["success"] for r in results)
    }


async def main():
    """Run browser checks manually."""
    import sys

    url = sys.argv[1] if len(sys.argv) > 1 else "https://thunderbird.bot"

    print(f"Running browser checks against {url}...")
    results = await run_all_browser_checks(url)

    print(f"\nResults:")
    for check in results["checks"]:
        status = "✅ PASS" if check["success"] else "❌ FAIL"
        print(f"{status} - {check['check']} ({check.get('duration_ms', 0):.0f}ms)")
        if check.get("error"):
            print(f"  Error: {check['error']}")

    print(f"\nOverall: {'✅ ALL PASSED' if results['all_passed'] else '❌ SOME FAILED'}")

    sys.exit(0 if results["all_passed"] else 1)


if __name__ == "__main__":
    asyncio.run(main())
