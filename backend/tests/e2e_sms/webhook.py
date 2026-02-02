"""
Test Webhook Endpoint for E2E SMS Testing

This FastAPI router captures responses sent to test numbers.
Mount this on your staging server to receive and store SMS responses
from the Thunderbird number during E2E testing.

Usage:
    # In your FastAPI app
    from tests.e2e_sms.webhook import router as test_webhook_router
    app.include_router(test_webhook_router, prefix="/test-webhook")
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .harness import register_response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["test-webhook"])


class TestWebhookStatus(BaseModel):
    """Status response for test webhook."""
    status: str
    message: str
    timestamp: str


# Store recent responses for debugging
_recent_responses: list[dict] = []
MAX_STORED_RESPONSES = 100


@router.post("/sms")
async def capture_sms_response(request: Request):
    """
    Webhook endpoint for test numbers to receive SMS responses.

    Twilio sends POST requests here when the Thunderbird number
    replies to our test numbers.

    Configure your test Twilio numbers to point to:
    https://your-staging.com/test-webhook/sms
    """
    try:
        form_data = await request.form()
        params = dict(form_data)

        from_number = params.get("From", "")  # Thunderbird's number
        to_number = params.get("To", "")      # Our test number
        body = params.get("Body", "")
        message_sid = params.get("MessageSid", "")

        logger.info(f"Test webhook received SMS:")
        logger.info(f"  From: {from_number}")
        logger.info(f"  To: {to_number}")
        logger.info(f"  Body: {body[:100]}...")

        # Register the response so the test harness can pick it up
        register_response(to_number, body, from_number)

        # Store for debugging
        _recent_responses.append({
            "from": from_number,
            "to": to_number,
            "body": body[:500],
            "message_sid": message_sid,
            "received_at": datetime.now(timezone.utc).isoformat(),
        })

        # Trim stored responses
        while len(_recent_responses) > MAX_STORED_RESPONSES:
            _recent_responses.pop(0)

        # Return empty TwiML (don't send a reply to the reply)
        twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
        return Response(content=twiml, media_type="application/xml")

    except Exception as e:
        logger.exception("Error processing test webhook")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def test_webhook_status() -> TestWebhookStatus:
    """
    Health check endpoint for test webhook.

    Use this to verify the webhook is reachable before running tests.
    """
    return TestWebhookStatus(
        status="ok",
        message="Test webhook is operational",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/recent")
async def get_recent_responses(limit: int = 10):
    """
    Get recent responses received by the test webhook.

    Useful for debugging test failures.
    """
    return {
        "responses": _recent_responses[-limit:],
        "total_stored": len(_recent_responses),
    }


@router.delete("/clear")
async def clear_responses():
    """
    Clear all stored responses.

    Call this before a test run to ensure clean state.
    """
    _recent_responses.clear()
    return {"status": "cleared"}
