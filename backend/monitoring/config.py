"""
Monitoring Configuration
Loads monitoring-specific settings from environment variables.
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional


class MonitoringSettings(BaseSettings):
    """Monitoring service configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

    # Target URLs
    MONITOR_PRODUCTION_URL: str = Field(default="https://thunderbird.bot", alias="PRODUCTION_URL")

    # Database
    MONITOR_DB_PATH: str = Field(default="backend/monitoring/monitoring.db", alias="MONITORING_DB_PATH")

    # Alert recipients
    MONITOR_ALERT_PHONE_NUMBERS: list[str] = Field(default=[], alias="ALERT_PHONE_NUMBERS")
    MONITOR_ALERT_EMAIL_ADDRESSES: list[str] = Field(default=[], alias="ALERT_EMAIL_ADDRESSES")

    # Check intervals (minutes)
    MONITOR_CHECK_INTERVALS: dict = Field(default={
        "health_check": 1,
        "beta_signup_flow": 5,
        "checkout_flow": 15,
        "login_flow": 10,
        "weather_api": 10,
        "sms_webhook": 1440,  # daily
        "db_query_performance": 5,
        "external_api_latency": 10,
    }, alias="CHECK_INTERVALS")

    # Alert thresholds
    MONITOR_CONSECUTIVE_FAILURES_BEFORE_ALERT: int = Field(default=2, alias="CONSECUTIVE_FAILURES_BEFORE_ALERT")
    MONITOR_SMS_RATE_LIMIT_PER_HOUR: int = Field(default=10, alias="SMS_RATE_LIMIT_PER_HOUR")

    # Metrics retention
    MONITOR_RETENTION_DAYS: int = Field(default=90, alias="METRICS_RETENTION_DAYS")

    # Performance thresholds
    MONITOR_DB_QUERY_SLOW_THRESHOLD_MS: float = Field(default=500.0, alias="DB_QUERY_SLOW_THRESHOLD_MS")
    MONITOR_EXTERNAL_API_SLOW_THRESHOLD_MS: float = Field(default=5000.0, alias="EXTERNAL_API_SLOW_THRESHOLD_MS")

    # Production database path (for direct query performance checks)
    MONITOR_PRODUCTION_DB_PATH: str = Field(default="/root/overland-weather/backend/production.db", alias="PRODUCTION_DB_PATH")

    # Import credentials from parent settings (no prefix)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    RESEND_API_KEY: str = ""
    STRIPE_SECRET_KEY: str = ""

    @property
    def PRODUCTION_URL(self) -> str:
        """Alias for backward compatibility."""
        return self.MONITOR_PRODUCTION_URL

    @property
    def MONITORING_DB_PATH(self) -> str:
        """Alias for backward compatibility."""
        return self.MONITOR_DB_PATH

    @property
    def ALERT_PHONE_NUMBERS(self) -> list[str]:
        """Alias for backward compatibility."""
        return self.MONITOR_ALERT_PHONE_NUMBERS

    @property
    def ALERT_EMAIL_ADDRESSES(self) -> list[str]:
        """Alias for backward compatibility."""
        return self.MONITOR_ALERT_EMAIL_ADDRESSES

    @property
    def CHECK_INTERVALS(self) -> dict:
        """Alias for backward compatibility."""
        return self.MONITOR_CHECK_INTERVALS

    @property
    def CONSECUTIVE_FAILURES_BEFORE_ALERT(self) -> int:
        """Alias for backward compatibility."""
        return self.MONITOR_CONSECUTIVE_FAILURES_BEFORE_ALERT

    @property
    def SMS_RATE_LIMIT_PER_HOUR(self) -> int:
        """Alias for backward compatibility."""
        return self.MONITOR_SMS_RATE_LIMIT_PER_HOUR

    @property
    def METRICS_RETENTION_DAYS(self) -> int:
        """Alias for backward compatibility."""
        return self.MONITOR_RETENTION_DAYS

    @property
    def DB_QUERY_SLOW_THRESHOLD_MS(self) -> float:
        """Alias for backward compatibility."""
        return self.MONITOR_DB_QUERY_SLOW_THRESHOLD_MS

    @property
    def EXTERNAL_API_SLOW_THRESHOLD_MS(self) -> float:
        """Alias for backward compatibility."""
        return self.MONITOR_EXTERNAL_API_SLOW_THRESHOLD_MS

    @property
    def PRODUCTION_DB_PATH(self) -> str:
        """Alias for backward compatibility."""
        return self.MONITOR_PRODUCTION_DB_PATH

    @property
    def twilio_configured(self) -> bool:
        """Check if Twilio is configured for SMS alerts."""
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN)

    @property
    def resend_configured(self) -> bool:
        """Check if Resend is configured for email alerts."""
        return bool(self.RESEND_API_KEY)


# Global settings instance
settings = MonitoringSettings()
