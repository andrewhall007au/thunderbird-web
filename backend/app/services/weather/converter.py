"""
Weather format converter for bridging international and legacy systems.

Phase 6: International Weather (WTHR-10)

Converts between:
- NormalizedDailyForecast (from WeatherRouter / international providers)
- CellForecast (used by formatters / legacy BOM system)

The WeatherRouter returns NormalizedDailyForecast with single rain_amount
values, while the formatters expect CellForecast with rain_min/rain_max
ranges. This module handles the conversion.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from app.services.weather.base import NormalizedDailyForecast, NormalizedForecast
from app.services.bom import CellForecast, ForecastPeriod
from config.settings import TZ_HOBART

logger = logging.getLogger(__name__)


def normalized_to_cell_forecast(
    normalized: NormalizedDailyForecast,
    lat: float,
    lon: float,
    target_elevation: int = 0,
    cell_id: str = "GPS",
    geohash: str = ""
) -> CellForecast:
    """
    Convert NormalizedDailyForecast to CellForecast.

    This allows international weather data (from WeatherRouter) to be
    used with existing formatters that expect CellForecast.

    Elevation handling:
    - The normalized forecast contains model_elevation (where temps are valid)
    - The target_elevation is where the user wants the forecast
    - CellForecast.base_elevation is set to model_elevation so formatters
      can apply lapse rate adjustments correctly

    Args:
        normalized: Forecast from WeatherRouter (includes model_elevation)
        lat: GPS latitude (for reference)
        lon: GPS longitude (for reference)
        target_elevation: User's target elevation in meters (for display)
        cell_id: Cell identifier (default "GPS" for GPS coordinates)
        geohash: Geohash string (optional, used for BOM compatibility)

    Returns:
        CellForecast compatible with formatters
        - base_elevation is the model elevation (for lapse rate calculations)

    Conversion notes:
    - rain_amount (single value) -> rain_min=0, rain_max=amount
    - cloud_base estimated from cloud_cover (no direct mapping)
    - cape (convective available potential energy) set to 0 (not provided)
    - period name derived from timestamp hour
    """
    # Use model elevation from provider (where temperature data is valid)
    # This allows formatters to correctly apply lapse rate adjustments
    model_elevation = normalized.model_elevation
    if model_elevation is None:
        # Fallback to target elevation if model elevation not available
        model_elevation = target_elevation
        logger.warning(f"No model_elevation in forecast, using target_elevation={target_elevation}m")

    periods = []
    for period in normalized.periods:
        converted = _convert_period(period, model_elevation)
        if converted:
            periods.append(converted)

    now = datetime.now(TZ_HOBART)

    # Determine source name for display
    source = normalized.provider.lower().replace(" ", "_")
    if "open-meteo" in source.lower():
        source = "openmeteo"
    elif "nws" in source.lower():
        source = "nws"
    elif "met office" in source.lower():
        source = "metoffice"
    elif "environment canada" in source.lower():
        source = "envcanada"

    return CellForecast(
        cell_id=cell_id,
        geohash=geohash,
        lat=lat,
        lon=lon,
        base_elevation=model_elevation,  # Model elevation for lapse rate calculations
        periods=periods,
        fetched_at=normalized.fetched_at,
        expires_at=now + timedelta(hours=1),  # Standard 1-hour cache
        is_cached=False,
        cache_age_hours=0.0,
        source=source
    )


def _convert_period(period: NormalizedForecast, base_elevation: int) -> Optional[ForecastPeriod]:
    """
    Convert a single NormalizedForecast period to ForecastPeriod.

    Args:
        period: Single period from NormalizedDailyForecast
        base_elevation: Base elevation for cloud base calculation

    Returns:
        ForecastPeriod or None if conversion fails
    """
    try:
        # Determine period name from hour
        hour = period.timestamp.hour
        if hour < 6:
            period_name = "N"  # Night/early morning
        elif hour < 12:
            period_name = "AM"
        elif hour < 18:
            period_name = "PM"
        else:
            period_name = "N"  # Evening/night

        # Convert rain_amount to rain_min/rain_max range
        # Use 0 as min and actual amount as max
        rain_amount = period.rain_amount or 0.0
        rain_min = 0.0
        rain_max = round(rain_amount, 1)

        # Convert snow_amount to snow_min/snow_max range
        snow_amount = period.snow_amount or 0.0
        snow_min = 0.0
        snow_max = round(snow_amount, 1)

        # Estimate cloud base from cloud cover
        # Higher cloud cover typically means lower cloud base
        cloud_cover = period.cloud_cover or 0
        if cloud_cover >= 80:
            cloud_base = 600  # Low clouds
        elif cloud_cover >= 60:
            cloud_base = 900
        elif cloud_cover >= 40:
            cloud_base = 1200
        elif cloud_cover >= 20:
            cloud_base = 1500
        else:
            cloud_base = 2000  # High/scattered or clear

        # Use provided freezing level or estimate from temperature
        if period.freezing_level is not None:
            freezing_level = period.freezing_level
        else:
            # Estimate freezing level from max temp
            # ~6.5C per 1000m (standard lapse rate)
            if period.temp_max <= 0:
                freezing_level = base_elevation
            else:
                height_to_freeze = (period.temp_max / 0.65) * 100
                freezing_level = int(base_elevation + height_to_freeze)

        # Wind values
        wind_avg = int(period.wind_avg or 0)
        wind_max = int(period.wind_max or wind_avg + 10)

        return ForecastPeriod(
            datetime=period.timestamp,
            period=period_name,
            temp_min=period.temp_min,
            temp_max=period.temp_max,
            rain_chance=period.rain_chance or 0,
            rain_min=rain_min,
            rain_max=rain_max,
            snow_min=snow_min,
            snow_max=snow_max,
            wind_avg=wind_avg,
            wind_max=wind_max,
            cloud_cover=cloud_cover,
            cloud_base=cloud_base,
            freezing_level=freezing_level,
            cape=0  # CAPE not provided by most international providers
        )

    except Exception as e:
        logger.warning(f"Error converting forecast period: {e}")
        return None


def cell_to_normalized_forecast(
    cell: CellForecast,
    country_code: str = "AU"
) -> NormalizedDailyForecast:
    """
    Convert CellForecast to NormalizedDailyForecast.

    This is the reverse conversion, useful if we need to pass BOM
    data through systems expecting NormalizedDailyForecast.

    Args:
        cell: CellForecast from BOM service
        country_code: Country code (default "AU" for BOM)

    Returns:
        NormalizedDailyForecast
    """
    from app.services.weather.base import NormalizedForecast, NormalizedDailyForecast

    periods = []
    for period in cell.periods:
        # Use max rain as the amount (conservative estimate)
        rain_amount = period.rain_max if period.rain_max else 0.0
        snow_amount = period.snow_max if period.snow_max else 0.0

        normalized_period = NormalizedForecast(
            provider="BOM",
            lat=cell.lat,
            lon=cell.lon,
            timestamp=period.datetime,
            temp_min=period.temp_min,
            temp_max=period.temp_max,
            rain_chance=period.rain_chance,
            rain_amount=rain_amount,
            wind_avg=float(period.wind_avg),
            wind_max=float(period.wind_max),
            wind_direction="",  # BOM doesn't provide direction in ForecastPeriod
            cloud_cover=period.cloud_cover,
            freezing_level=period.freezing_level,
            snow_amount=snow_amount,
            description=""
        )
        periods.append(normalized_period)

    return NormalizedDailyForecast(
        provider="BOM",
        lat=cell.lat,
        lon=cell.lon,
        country_code=country_code,
        periods=periods,
        alerts=[],
        fetched_at=cell.fetched_at,
        is_fallback=False,
        model_elevation=cell.base_elevation,
    )
