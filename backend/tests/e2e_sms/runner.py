#!/usr/bin/env python3
"""
E2E SMS Test Runner

CLI tool to run automated SMS tests against the Thunderbird service.

Usage:
    # Run all tests
    python -m tests.e2e_sms.runner --all

    # Run US tests only
    python -m tests.e2e_sms.runner --country US

    # Run Canada tests only
    python -m tests.e2e_sms.runner --country CA

    # Run specific test
    python -m tests.e2e_sms.runner --test us_yosemite_cast7

    # Dry run (validate config, don't send SMS)
    python -m tests.e2e_sms.runner --dry-run

    # CI mode (exit code reflects test status)
    python -m tests.e2e_sms.runner --all --ci

    # Output JSON report
    python -m tests.e2e_sms.runner --all --json report.json
"""
import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone

from .config import (
    E2ETestConfig,
    ALL_TEST_CASES,
    US_TEST_CASES,
    CA_TEST_CASES,
    EDGE_CASE_TESTS,
)
from .harness import E2ESMSTester, generate_report

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Run E2E SMS tests against Thunderbird",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Test selection
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--all",
        action="store_true",
        help="Run all test cases",
    )
    group.add_argument(
        "--country",
        choices=["US", "CA"],
        help="Run tests for specific country only",
    )
    group.add_argument(
        "--test",
        type=str,
        help="Run specific test by ID",
    )
    group.add_argument(
        "--edge-cases",
        action="store_true",
        help="Run edge case tests only",
    )

    # Execution options
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration without sending SMS",
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI mode: exit with non-zero code if tests fail",
    )

    # Output options
    parser.add_argument(
        "--json",
        type=str,
        metavar="FILE",
        help="Write JSON report to file",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args()


def get_test_cases(args):
    """Get the list of test cases based on arguments."""
    if args.all:
        return ALL_TEST_CASES
    elif args.country == "US":
        return US_TEST_CASES
    elif args.country == "CA":
        return CA_TEST_CASES
    elif args.edge_cases:
        return EDGE_CASE_TESTS
    elif args.test:
        # Find specific test
        for tc in ALL_TEST_CASES:
            if tc.test_id == args.test:
                return [tc]
        logger.error(f"Test not found: {args.test}")
        logger.info(f"Available tests: {[tc.test_id for tc in ALL_TEST_CASES]}")
        sys.exit(1)
    else:
        # Default to US tests
        logger.info("No test selection specified, running US tests")
        return US_TEST_CASES


async def main():
    """Main entry point."""
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load and validate config
    logger.info("Loading configuration from environment...")
    config = E2ETestConfig.from_env()

    errors = config.validate()
    if errors:
        logger.error("Configuration errors:")
        for error in errors:
            logger.error(f"  - {error}")
        sys.exit(1)

    logger.info(f"Thunderbird number: {config.thunderbird_number}")
    logger.info(f"US test number: {config.us_test_number}")
    logger.info(f"CA test number: {config.ca_test_number}")
    logger.info(f"Webhook URL: {config.test_webhook_base_url}")

    # Get test cases
    test_cases = get_test_cases(args)
    logger.info(f"Selected {len(test_cases)} test(s)")

    if args.dry_run:
        logger.info("DRY RUN MODE - No SMS will be sent")

    # Create tester
    tester = E2ESMSTester(config)

    # Run tests
    started_at = datetime.now(timezone.utc)
    print(f"\nStarting E2E SMS tests at {started_at.isoformat()}")
    print(f"Running {len(test_cases)} test(s)...\n")

    results = await tester.run_tests(test_cases, dry_run=args.dry_run)

    # Generate report
    report = generate_report(results, started_at)
    report.print_summary()

    # Write JSON report if requested
    if args.json:
        with open(args.json, "w") as f:
            json.dump(report.to_dict(), f, indent=2)
        logger.info(f"JSON report written to: {args.json}")

    # Exit with appropriate code for CI
    if args.ci and not report.all_passed:
        sys.exit(1)


def run():
    """Entry point for module execution."""
    asyncio.run(main())


if __name__ == "__main__":
    run()
