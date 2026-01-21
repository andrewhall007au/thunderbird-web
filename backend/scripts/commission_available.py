#!/usr/bin/env python3
"""
Commission availability transition script.

Marks pending commissions as available after 30-day hold period.
Run daily via cron: 0 6 * * * /path/to/python /path/to/commission_available.py

From CONTEXT.md: 30-day hold before commissions become available.
"""
import sys
import os
import logging
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.affiliates import commission_store

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def mark_commissions_available():
    """
    Find pending commissions past their hold period and mark available.

    Returns:
        Number of commissions transitioned
    """
    now = datetime.utcnow()
    transitioned = 0

    # Get all pending commissions
    pending = commission_store.get_pending()

    for commission in pending:
        if not commission.available_at:
            continue

        # available_at is already a datetime object from the store
        available_at = commission.available_at

        if now >= available_at:
            commission_store.mark_available(commission.id)
            transitioned += 1
            logger.info(
                f"Commission {commission.id} marked available "
                f"(affiliate_id={commission.affiliate_id}, amount=${commission.amount_cents/100:.2f})"
            )

    return transitioned


def main():
    """Run commission availability check."""
    logger.info("Starting commission availability check...")

    try:
        count = mark_commissions_available()
        logger.info(f"Completed: {count} commissions marked available")

        # Print summary for cron logs
        print(f"Commission availability: {count} transitioned")
        return 0

    except Exception as e:
        logger.error(f"Error during commission check: {e}")
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
