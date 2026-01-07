"""
Thunderbird Backend Configuration
Based on THUNDERBIRD_SPEC_v2.4 Section 12.6
"""

import os
from pathlib import Path
from zoneinfo import ZoneInfo
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )
    
    # Application
    APP_NAME: str = "Thunderbird"
    APP_VERSION: str = "2.7.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # Database
    DATABASE_URL: str = "postgresql://localhost:5432/thunderbird"
    
    # Redis (for caching)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Twilio SMS
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    
    # BOM API (undocumented api.weather.bom.gov.au - no API key required)
    # Just needs User-Agent header, uses geohash for location lookup
    BOM_FALLBACK_TO_MOCK: bool = True  # Fallback to mock if API fails
    
    # Cellcast SMS (alternative provider)
    CELLCAST_API_KEY: str = ""
    CELLCAST_SENDER_ID: str = "Thunderbird"
    
    # Timezone (Section 12.7)
    TIMEZONE: str = "Australia/Hobart"
    
    # Capacity limits (Section 12.10.3)
    MAX_CONCURRENT_USERS: int = 500
    MAX_SMS_PER_DAY: int = 2000
    MAX_BOM_CALLS_PER_DAY: int = 500
    
    # Rate limiting (Section 12.9.2)
    RATE_LIMIT_SMS_PER_PHONE_PER_HOUR: int = 10
    RATE_LIMIT_API_PER_IP_PER_MINUTE: int = 60
    
    # Cache TTL
    BOM_CACHE_TTL_HOURS: int = 6
    BOM_CACHE_MAX_AGE_HOURS: int = 12
    
    # SMS delivery (Section 8.9)
    SMS_INTER_MESSAGE_DELAY: float = 2.5  # seconds
    SMS_BATCH_GAP: float = 5.0  # seconds
    SMS_RETRY_DELAY: float = 30.0  # seconds
    SMS_MAX_RETRIES: int = 3
    
    # Trip limits (Section 8.8)
    TRIP_BUFFER_DAYS: int = 3
    TRIP_MAX_DAYS: int = 14
    TRIP_MAX_EXTENSIONS: int = 3
    
    # Optional monitoring
    SENTRY_DSN: Optional[str] = None
    
    # Admin interface
    ADMIN_PASSWORD: str = "changeme"  # MUST change in production
    ADMIN_SESSION_SECRET: str = "thunderbird-secret-key-change-me"
    
    # Testing
    LIVETEST_ENABLED: bool = False
    MOCK_BOM_API: bool = False


# Global settings instance
settings = Settings()

# Timezone object for use throughout app
TZ_HOBART = ZoneInfo(settings.TIMEZONE)
TZ_UTC = ZoneInfo("UTC")

# Paths
BASE_DIR = Path(__file__).parent.parent
CONFIG_DIR = BASE_DIR / "config"
ROUTES_DIR = CONFIG_DIR / "routes"


# Weather Zone Constants (Section 4.1)
# NOTE: These are OUR zone identifiers for grouping waypoints, not BOM's.
# BOM uses geohash for API lookups. Our zones reduce API calls by grouping
# nearby waypoints (~2-3km) that will have similar weather.
class WeatherZoneConfig:
    """Weather zone configuration for grouping waypoints."""
    LAT_ORIGIN = -39.12  # Northern boundary
    LON_ORIGIN = 142.75  # Western boundary
    LAT_SPACING = 0.02   # Degrees per row (~2.2km)
    LON_SPACING = 0.03   # Degrees per column (~2.5km)
    
    @classmethod
    def lat_lon_to_zone(cls, lat: float, lon: float) -> tuple[int, int]:
        """Convert lat/lon to weather zone indices."""
        row = int((cls.LAT_ORIGIN - lat) / cls.LAT_SPACING)
        col = int((lon - cls.LON_ORIGIN) / cls.LON_SPACING)
        return (row, col)
    
    @classmethod
    def zone_to_string(cls, row: int, col: int) -> str:
        """Format zone as string (e.g., '201-117')."""
        return f"{row}-{col}"
    
    # Backwards compatibility aliases
    @classmethod
    def lat_lon_to_cell(cls, lat: float, lon: float) -> tuple[int, int]:
        """Alias for lat_lon_to_zone (backwards compatibility)."""
        return cls.lat_lon_to_zone(lat, lon)
    
    @classmethod
    def cell_to_string(cls, row: int, col: int) -> str:
        """Alias for zone_to_string (backwards compatibility)."""
        return cls.zone_to_string(row, col)


# Backwards compatibility alias
BOMGridConfig = WeatherZoneConfig


# Danger thresholds (Section 6.3)
class DangerThresholds:
    """Configurable danger rating thresholds."""
    WIND_CAUTIOUS = 40  # km/h
    WIND_MODERATE = 50  # km/h
    WIND_EXPERIENCED = 60  # km/h
    WIND_EXTREME = 70  # km/h
    
    PRECIP_SIGNIFICANT = 5  # mm
    SNOW_SIGNIFICANT = 2  # cm
    
    CLOUD_BLIND = 90  # %
    
    CAPE_MODERATE = 200  # J/kg
    CAPE_HIGH = 400  # J/kg


# SMS cost configuration (Section 10)
class SMSCostConfig:
    """SMS cost per segment by provider."""
    TWILIO_COST_AUD = 0.055
    CELLCAST_COST_AUD = 0.029
    
    # Character limits
    GSM_SINGLE_LIMIT = 160
    GSM_MULTI_LIMIT = 153
    UNICODE_SINGLE_LIMIT = 70
    UNICODE_MULTI_LIMIT = 67
