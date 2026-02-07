"""
SMS Service (Twilio Integration)
Based on THUNDERBIRD_SPEC_v2.4 Sections 8.9, 12.8, 12.9
"""

import asyncio
import re
from datetime import datetime
from typing import Optional, List, Tuple
from dataclasses import dataclass
import logging

from twilio.rest import Client
from twilio.request_validator import RequestValidator

from config.settings import settings, TZ_HOBART, SMSCostConfig

logger = logging.getLogger(__name__)


@dataclass
class SMSMessage:
    """SMS message data."""
    to: str
    body: str
    segments: int
    cost_cents: int
    sid: Optional[str] = None
    sent_at: Optional[datetime] = None
    error: Optional[str] = None


class PhoneUtils:
    """
    Phone number utilities.
    Section 12.8
    """
    
    @staticmethod
    def normalize(phone: str) -> str:
        """
        Normalize Australian phone number to E.164 format.
        
        Accepts: 0412345678, +61412345678, 61412345678
        Returns: +61412345678
        
        Raises: ValueError if invalid format
        """
        # Strip all non-digits
        digits = re.sub(r'\D', '', phone)
        
        # Handle various formats
        if digits.startswith('61') and len(digits) == 11:
            return f'+{digits}'
        elif digits.startswith('0') and len(digits) == 10:
            return f'+61{digits[1:]}'
        elif len(digits) == 9:
            return f'+61{digits}'
        else:
            raise ValueError(f"Invalid AU phone number: {phone}")
    
    @staticmethod
    def mask(phone: str) -> str:
        """
        Mask phone for logging.
        +61412345678 → +614***5678
        """
        if len(phone) < 8:
            return "***"
        return phone[:4] + '***' + phone[-4:]
    
    @staticmethod
    def is_valid_au_mobile(phone: str) -> bool:
        """Check if phone is valid Australian mobile."""
        try:
            normalized = PhoneUtils.normalize(phone)
            # Must start with +614 (mobile prefix)
            return normalized.startswith('+614')
        except ValueError:
            return False


class SMSCostCalculator:
    """
    Calculate SMS segment count and cost.
    """
    
    @staticmethod
    def count_segments(message: str) -> int:
        """
        Count SMS segments for a message.
        GSM-7 encoding: 160 chars single, 153 chars per segment multi
        Unicode: 70 chars single, 67 chars per segment multi
        """
        # Check if message requires Unicode
        is_unicode = any(ord(c) > 127 for c in message)
        
        length = len(message)
        
        if is_unicode:
            if length <= SMSCostConfig.UNICODE_SINGLE_LIMIT:
                return 1
            return (length + SMSCostConfig.UNICODE_MULTI_LIMIT - 1) // SMSCostConfig.UNICODE_MULTI_LIMIT
        else:
            if length <= SMSCostConfig.GSM_SINGLE_LIMIT:
                return 1
            return (length + SMSCostConfig.GSM_MULTI_LIMIT - 1) // SMSCostConfig.GSM_MULTI_LIMIT
    
    @staticmethod
    def calculate_cost(segments: int, provider: str = "twilio") -> int:
        """
        Calculate cost in cents for given segments.
        """
        if provider == "cellcast":
            rate = SMSCostConfig.CELLCAST_COST_AUD
        else:
            rate = SMSCostConfig.TWILIO_COST_AUD
        
        return int(segments * rate * 100)


class SMSService:
    """
    SMS sending and receiving service.
    Handles Twilio integration, rate limiting, and batch sending.
    """
    
    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.from_number = settings.TWILIO_PHONE_NUMBER  # Default fallback
        self.from_number_au = getattr(settings, 'TWILIO_PHONE_NUMBER_AU', None)
        self.from_number_us = getattr(settings, 'TWILIO_PHONE_NUMBER_US', None)
        self._client: Optional[Client] = None
        self._validator: Optional[RequestValidator] = None

    def _get_from_number(self, to: str) -> str:
        """
        Select appropriate Twilio number based on destination country.
        Uses local numbers to minimize international SMS costs.

        Args:
            to: Destination phone number (E.164 format)

        Returns:
            Best Twilio number for this destination
        """
        # Australian destinations: use AU number if available
        if to.startswith('+61') and self.from_number_au:
            return self.from_number_au

        # US destinations: use US number if available
        elif to.startswith('+1') and self.from_number_us:
            return self.from_number_us

        # International: prefer US toll-free (cheaper international rates)
        elif self.from_number_us:
            return self.from_number_us

        # Fallback to default
        return self.from_number
    
    @property
    def client(self) -> Client:
        """Get or create Twilio client."""
        if self._client is None:
            if not self.account_sid or not self.auth_token:
                raise SMSError("Twilio credentials not configured")
            self._client = Client(self.account_sid, self.auth_token)
        return self._client
    
    @property
    def validator(self) -> RequestValidator:
        """Get or create request validator."""
        if self._validator is None:
            if not self.auth_token:
                raise SMSError("Twilio auth token not configured")
            self._validator = RequestValidator(self.auth_token)
        return self._validator
    
    def validate_webhook(
        self,
        url: str,
        params: dict,
        signature: str
    ) -> bool:
        """
        Validate incoming Twilio webhook signature.
        Section 12.9.1
        
        Args:
            url: Full request URL
            params: Request form parameters
            signature: X-Twilio-Signature header value
        
        Returns:
            True if valid, False otherwise
        """
        return self.validator.validate(url, params, signature)
    
    async def send_message(
        self,
        to: str,
        body: str,
        command_type: str = None,
        message_type: str = "response"
    ) -> SMSMessage:
        """
        Send a single SMS message.

        Args:
            to: Recipient phone number (will be normalized)
            body: Message content
            command_type: Command that triggered this (CAST12, CAST7, etc.)
            message_type: Type of message (response, onboarding, safecheck, etc.)

        Returns:
            SMSMessage with send result
        """
        try:
            normalized_to = PhoneUtils.normalize(to)
        except ValueError as e:
            return SMSMessage(
                to=to,
                body=body,
                segments=0,
                cost_cents=0,
                error=str(e)
            )

        segments = SMSCostCalculator.count_segments(body)
        cost_cents = SMSCostCalculator.calculate_cost(segments)
        cost_aud = cost_cents / 100.0

        try:
            # Select optimal number for destination country
            from_number = self._get_from_number(normalized_to)

            message = self.client.messages.create(
                to=normalized_to,
                from_=from_number,
                body=body
            )

            logger.info(
                f"SMS sent to {PhoneUtils.mask(normalized_to)}: "
                f"{segments} segments, {len(body)} chars"
            )

            # Log to database for analytics
            self._log_message(normalized_to, message_type, command_type, body, segments, cost_aud, True)

            return SMSMessage(
                to=normalized_to,
                body=body,
                segments=segments,
                cost_cents=cost_cents,
                sid=message.sid,
                sent_at=datetime.now(TZ_HOBART)
            )

        except Exception as e:
            logger.error(f"SMS send failed to {PhoneUtils.mask(normalized_to)}: {e}")

            # Log failed message too
            self._log_message(normalized_to, message_type, command_type, body, segments, 0, False)

            return SMSMessage(
                to=normalized_to,
                body=body,
                segments=segments,
                cost_cents=0,
                error=str(e)
            )

    def _log_message(self, phone: str, message_type: str, command_type: str, content: str, segments: int, cost_aud: float, success: bool):
        """Log message to database for analytics."""
        try:
            from app.models.database import user_store
            user_store.log_message(
                user_phone=phone,
                direction="outbound",
                message_type=message_type,
                command_type=command_type,
                content=content[:500],  # Truncate for storage
                segments=segments,
                cost_aud=cost_aud,
                success=success
            )
        except Exception as e:
            logger.warning(f"Failed to log message to database: {e}")
    
    async def send_batch(
        self,
        to: str,
        messages: List[str],
        delay: float = None
    ) -> List[SMSMessage]:
        """
        Send multiple SMS messages with ordering delay.
        Section 8.9
        
        Args:
            to: Recipient phone number
            messages: List of message bodies
            delay: Delay between messages (default from settings)
        
        Returns:
            List of SMSMessage results
        """
        if delay is None:
            delay = settings.SMS_INTER_MESSAGE_DELAY
        
        results = []
        
        for i, body in enumerate(messages):
            if i > 0:
                await asyncio.sleep(delay)
            
            result = await self.send_message(to, body)
            results.append(result)
            
            if result.error:
                # Stop on first error
                logger.error(f"Batch send stopped at message {i+1}: {result.error}")
                break
        
        return results
    
    async def send_with_retry(
        self,
        to: str,
        body: str,
        max_retries: int = None,
        retry_delay: float = None
    ) -> SMSMessage:
        """
        Send SMS with retry on failure.
        
        Args:
            to: Recipient phone number
            body: Message content
            max_retries: Maximum retry attempts (default from settings)
            retry_delay: Delay between retries (default from settings)
        
        Returns:
            SMSMessage with final result
        """
        if max_retries is None:
            max_retries = settings.SMS_MAX_RETRIES
        if retry_delay is None:
            retry_delay = settings.SMS_RETRY_DELAY
        
        last_result = None
        
        for attempt in range(max_retries + 1):
            if attempt > 0:
                await asyncio.sleep(retry_delay)
                logger.info(f"Retry {attempt}/{max_retries} for {PhoneUtils.mask(to)}")
            
            result = await self.send_message(to, body)
            last_result = result
            
            if not result.error:
                return result
        
        return last_result


class InputSanitizer:
    """
    Input sanitization utilities.
    Section 12.9.3
    """
    
    @staticmethod
    def sanitize_sms(message: str) -> str:
        """
        Clean incoming SMS for processing.
        
        - Strip whitespace
        - Convert to uppercase
        - Remove non-alphanumeric (except space)
        """
        cleaned = message.strip().upper()
        cleaned = re.sub(r'[^A-Z0-9 ]', '', cleaned)
        return cleaned
    
    @staticmethod
    def extract_command(message: str) -> Tuple[str, str]:
        """
        Extract command and arguments from SMS.
        
        Returns: (command, remaining_text)
        """
        sanitized = InputSanitizer.sanitize_sms(message)
        parts = sanitized.split(maxsplit=1)
        
        command = parts[0] if parts else ""
        remaining = parts[1] if len(parts) > 1 else ""
        
        return command, remaining


class SMSError(Exception):
    """SMS service error."""
    pass


# Singleton instance
_sms_service: Optional[SMSService] = None


def get_sms_service() -> SMSService:
    """Get SMS service singleton."""
    global _sms_service
    if _sms_service is None:
        _sms_service = SMSService()
    return _sms_service
