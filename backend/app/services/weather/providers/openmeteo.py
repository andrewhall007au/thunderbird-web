"""
Open-Meteo weather provider - universal fallback for any coordinates.

Phase 6: International Weather (WTHR-04 through WTHR-10)

Open-Meteo provides:
- Global coverage (any coordinates)
- Free, no API key required
- 7-16 day forecasts with hourly resolution
- Model selection (best_match, meteofrance, meteoswiss, icon_eu, gfs)

Country-specific models:
- France: Meteo-France AROME (1.5-2.5km resolution)
- Switzerland: MeteoSwiss ICON-CH (1-2km resolution)
- Italy/Europe: DWD ICON-EU (7km resolution)
- NZ/South Africa: best_match (auto-selects optimal model)

Used as:
- Universal fallback when country-specific APIs fail
- Primary provider for countries without native API (FR, IT, CH, NZ, ZA)
- Reference implementation for normalization patterns
"""
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Union

import httpx

from app.services.weather.base import (
    WeatherProvider,
    NormalizedForecast,
    NormalizedDailyForecast,
    WeatherAlert,
    RecentPrecipitation,
)

logger = logging.getLogger(__name__)


class OpenMeteoModel(str, Enum):
    """
    Available Open-Meteo weather models.

    Each model targets specific regions with varying resolution:
    - BEST_MATCH: Auto-selects best model for coordinates (default)
    - METEOFRANCE: France AROME model (1.5-2.5km) - excellent for France/Alps
    - ICON_EU: European DWD ICON model (7km) - covers all of Europe
    - ICON_CH: MeteoSwiss ICON-CH2 model (2km) - excellent for Swiss Alps
    - GEM: Canadian GEM model (2.5km HRDPS regional, 15km global)
    - HRRR: US NOAA HRRR model (3km) - high resolution for CONUS
    - JMA: Japan Meteorological Agency MSM model (5km) - excellent for Japan
    - ECMWF: European Centre model (9km global) - best global model
    - GFS: US NOAA GFS model (25km global) - fallback for global coverage
    """
    BEST_MATCH = "best_match"
    METEOFRANCE = "meteofrance"
    ICON_EU = "icon_eu"
    ICON_CH = "icon_ch"  # MeteoSwiss 2km for Switzerland
    GEM = "gem"          # Canadian GEM 2.5km HRDPS regional
    HRRR = "hrrr"        # US NOAA HRRR 3km - excellent for US!
    JMA = "jma"          # Japan JMA MSM 5km - excellent for Japan!
    ECMWF = "ecmwf"      # 9km global - best for NZ, ZA
    GFS = "gfs"


# Model-specific API endpoints
# Note: ICON_CH uses the standard forecast endpoint with models parameter
# HRRR uses the GFS endpoint with models=hrrr_conus parameter
MODEL_ENDPOINTS = {
    OpenMeteoModel.BEST_MATCH: "https://api.open-meteo.com/v1/forecast",
    OpenMeteoModel.METEOFRANCE: "https://api.open-meteo.com/v1/meteofrance",
    OpenMeteoModel.ICON_EU: "https://api.open-meteo.com/v1/dwd-icon",
    OpenMeteoModel.ICON_CH: "https://api.open-meteo.com/v1/forecast",  # Uses models=meteoswiss_icon_ch2
    OpenMeteoModel.GEM: "https://api.open-meteo.com/v1/gem",  # Canadian GEM HRDPS
    OpenMeteoModel.HRRR: "https://api.open-meteo.com/v1/gfs",  # Uses models=hrrr_conus
    OpenMeteoModel.JMA: "https://api.open-meteo.com/v1/jma",  # Japan MSM 5km
    OpenMeteoModel.ECMWF: "https://api.open-meteo.com/v1/ecmwf",
    OpenMeteoModel.GFS: "https://api.open-meteo.com/v1/gfs",
}

# Human-readable model names for provider identification
MODEL_NAMES = {
    OpenMeteoModel.BEST_MATCH: "Open-Meteo",
    OpenMeteoModel.METEOFRANCE: "Open-Meteo (Meteo-France)",
    OpenMeteoModel.ICON_EU: "Open-Meteo (DWD ICON)",
    OpenMeteoModel.ICON_CH: "Open-Meteo (MeteoSwiss)",
    OpenMeteoModel.GEM: "Open-Meteo (GEM)",
    OpenMeteoModel.HRRR: "Open-Meteo (HRRR)",
    OpenMeteoModel.JMA: "Open-Meteo (JMA)",
    OpenMeteoModel.ECMWF: "Open-Meteo (ECMWF)",
    OpenMeteoModel.GFS: "Open-Meteo (GFS)",
}

# Legacy string-based endpoint mapping (for backwards compatibility)
OPENMETEO_ENDPOINTS = {
    "best_match": "https://api.open-meteo.com/v1/forecast",
    "meteofrance": "https://api.open-meteo.com/v1/meteofrance",
    "icon_eu": "https://api.open-meteo.com/v1/dwd-icon",
    "icon_ch": "https://api.open-meteo.com/v1/forecast",
    "gem": "https://api.open-meteo.com/v1/gem",
    "hrrr": "https://api.open-meteo.com/v1/gfs",
    "jma": "https://api.open-meteo.com/v1/jma",
    "ecmwf": "https://api.open-meteo.com/v1/ecmwf",
    "gfs": "https://api.open-meteo.com/v1/gfs",
}

# Country-to-model mapping for optimal regional forecasts
# Maps ISO 3166-1 alpha-2 country codes to best available model
COUNTRY_TO_MODEL = {
    "US": OpenMeteoModel.HRRR,         # USA - HRRR 3km (CONUS only)
    "CA": OpenMeteoModel.GEM,          # Canada - GEM HRDPS 2.5km regional
    "FR": OpenMeteoModel.METEOFRANCE,  # France - AROME 1.5-2.5km
    "CH": OpenMeteoModel.ICON_CH,      # Switzerland - MeteoSwiss ICON-CH2 2km
    "IT": OpenMeteoModel.ICON_EU,      # Italy - ICON 7km (no better option)
    "JP": OpenMeteoModel.JMA,          # Japan - JMA MSM 5km
    "NZ": OpenMeteoModel.ECMWF,        # New Zealand - ECMWF 9km (best available)
    "ZA": OpenMeteoModel.ECMWF,        # South Africa - ECMWF 9km (best available)
    # Other European countries could use ICON_EU
    # Other countries default to BEST_MATCH
}


def get_model_for_country(country_code: str) -> OpenMeteoModel:
    """
    Get the optimal Open-Meteo model for a country code.

    Args:
        country_code: ISO 3166-1 alpha-2 country code (e.g., "FR", "CH", "NZ")

    Returns:
        OpenMeteoModel for best regional coverage
    """
    return COUNTRY_TO_MODEL.get(country_code.upper(), OpenMeteoModel.BEST_MATCH)


def create_provider_for_country(country_code: str) -> "OpenMeteoProvider":
    """
    Create an OpenMeteoProvider configured for a specific country.

    Args:
        country_code: ISO 3166-1 alpha-2 country code (e.g., "FR", "CH", "NZ")

    Returns:
        OpenMeteoProvider with optimal model for the country
    """
    model = get_model_for_country(country_code)
    return OpenMeteoProvider(model=model)


# Wind direction conversion (degrees to compass)
WIND_DIRECTIONS = [
    (0, 22.5, "N"),
    (22.5, 67.5, "NE"),
    (67.5, 112.5, "E"),
    (112.5, 157.5, "SE"),
    (157.5, 202.5, "S"),
    (202.5, 247.5, "SW"),
    (247.5, 292.5, "W"),
    (292.5, 337.5, "NW"),
    (337.5, 360, "N"),
]


def degrees_to_compass(degrees: Optional[float]) -> str:
    """Convert wind direction in degrees to compass direction."""
    if degrees is None:
        return "N"
    degrees = degrees % 360
    for low, high, direction in WIND_DIRECTIONS:
        if low <= degrees < high:
            return direction
    return "N"


def parse_iso_datetime(dt_string: str) -> datetime:
    """Parse ISO datetime string from Open-Meteo API."""
    # Open-Meteo returns "2026-01-21T00:00" format (no timezone)
    # The timezone is specified separately in response
    if "T" in dt_string:
        return datetime.fromisoformat(dt_string)
    return datetime.fromisoformat(dt_string + "T00:00:00")


class OpenMeteoProvider(WeatherProvider):
    """
    Open-Meteo weather provider for global coverage.

    Supports model selection for regional optimization:
    - BEST_MATCH (default): Auto-selects best model for coordinates
    - METEOFRANCE: France AROME model (1.5-2.5km resolution)
    - ICON_EU: European DWD ICON model (7km) - covers Switzerland, Italy, all Europe
    - GFS: US NOAA GFS model (25km global coverage)

    Country-to-model mapping:
    - France (FR): METEOFRANCE - high resolution AROME model
    - Switzerland (CH): ICON_EU - excellent Alpine coverage
    - Italy (IT): ICON_EU - covers Dolomites and Alps
    - New Zealand (NZ): BEST_MATCH - auto-selects optimal global model
    - South Africa (ZA): BEST_MATCH - auto-selects optimal global model
    """

    def __init__(
        self,
        model: Union[OpenMeteoModel, str] = OpenMeteoModel.BEST_MATCH,
        timeout: float = 30.0,
    ):
        """
        Initialize Open-Meteo provider.

        Args:
            model: Model to use (OpenMeteoModel enum or string for backwards compat)
            timeout: HTTP request timeout in seconds
        """
        # Support both enum and string model specification
        if isinstance(model, str):
            try:
                self.model = OpenMeteoModel(model)
            except ValueError:
                logger.warning(f"Unknown model '{model}', falling back to BEST_MATCH")
                self.model = OpenMeteoModel.BEST_MATCH
        else:
            self.model = model

        self.timeout = timeout
        self._endpoint = MODEL_ENDPOINTS[self.model]
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def provider_name(self) -> str:
        """Human-readable provider name including model used."""
        return MODEL_NAMES.get(self.model, f"Open-Meteo ({self.model.value})")

    @property
    def supports_alerts(self) -> bool:
        """Open-Meteo does not support weather alerts."""
        return False

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers={
                    "User-Agent": "Thunderbird-Weather/1.0",
                    "Accept": "application/json",
                },
            )
        return self._client

    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7
    ) -> NormalizedDailyForecast:
        """
        Get normalized forecast for coordinates.

        Fetches hourly data and aggregates into 3-hour periods for
        consistency with other providers.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            days: Number of forecast days (1-16)

        Returns:
            NormalizedDailyForecast with 3-hour period forecasts
        """
        client = await self._get_client()

        # Build request parameters
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join([
                "temperature_2m",
                "dew_point_2m",  # For LCL cloud base calculation
                "precipitation_probability",
                "precipitation",
                "rain",
                "snowfall",
                "wind_speed_10m",
                "wind_gusts_10m",
                "wind_direction_10m",
                "cloud_cover",
                "freezing_level_height",
                "cape",  # Convective Available Potential Energy (J/kg) for storm prediction
            ]),
            "timezone": "auto",
            "forecast_days": min(days, 16),
            "past_days": 3,  # Get last 72 hours for trail condition assessment
        }

        # MeteoSwiss ICON-CH requires explicit model parameter
        if self.model == OpenMeteoModel.ICON_CH:
            params["models"] = "meteoswiss_icon_ch2"  # 2km, 5-day forecast
        # HRRR requires explicit model parameter (uses GFS endpoint)
        elif self.model == OpenMeteoModel.HRRR:
            params["models"] = "hrrr_conus"  # 3km, US CONUS only

        logger.info(
            f"Fetching Open-Meteo forecast for ({lat}, {lon}), {days} days, "
            f"model={self.model.value}"
        )

        try:
            response = await client.get(self._endpoint, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            logger.error(f"Open-Meteo API error: {e}")
            raise

        # Extract model elevation from response (90m DEM by default)
        model_elevation = data.get("elevation")
        if model_elevation is not None:
            model_elevation = int(model_elevation)

        return self._parse_response(lat, lon, data, model_elevation)

    def _parse_response(
        self,
        lat: float,
        lon: float,
        data: dict,
        model_elevation: Optional[int] = None
    ) -> NormalizedDailyForecast:
        """
        Parse Open-Meteo API response and normalize to our format.

        Aggregates hourly data into 3-hour periods for consistency
        with the existing BOM provider pattern.

        Also calculates recent precipitation from past_days data for
        trail condition assessment.

        Args:
            lat: Latitude
            lon: Longitude
            data: API response data
            model_elevation: Elevation in meters that temperature data is valid for
                           (from API's 90m DEM downscaling)
        """
        periods: List[NormalizedForecast] = []
        fetched_at = datetime.now(timezone.utc)

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])

        # Calculate recent precipitation from past data
        recent_precip = self._calculate_recent_precipitation(hourly, times, fetched_at)

        if not times:
            logger.warning("Empty response from Open-Meteo API")
            return NormalizedDailyForecast(
                provider=self.provider_name,
                lat=lat,
                lon=lon,
                country_code="",  # Will be set by caller
                periods=[],
                alerts=[],
                fetched_at=fetched_at,
                is_fallback=False,
                model_elevation=model_elevation,
            )

        # Aggregate hourly data into 3-hour periods
        step = 3
        for i in range(0, len(times), step):
            if i + step > len(times):
                break

            try:
                # Parse timestamp for period start
                period_time = parse_iso_datetime(times[i])

                # Get the 3-hour range for aggregation
                agg_range = range(i, min(i + step, len(times)))

                # Extract values, handling None gracefully
                temps = self._get_values(hourly, "temperature_2m", agg_range)
                dewpoints = self._get_values(hourly, "dew_point_2m", agg_range)
                precip_probs = self._get_values(hourly, "precipitation_probability", agg_range)
                precips = self._get_values(hourly, "precipitation", agg_range)
                snowfalls = self._get_values(hourly, "snowfall", agg_range)
                wind_speeds = self._get_values(hourly, "wind_speed_10m", agg_range)
                wind_gusts = self._get_values(hourly, "wind_gusts_10m", agg_range)
                wind_dirs = self._get_values(hourly, "wind_direction_10m", agg_range)
                cloud_covers = self._get_values(hourly, "cloud_cover", agg_range)
                freezing_levels = self._get_values(hourly, "freezing_level_height", agg_range)
                cape_values = self._get_values(hourly, "cape", agg_range)

                # Calculate aggregates
                temp_min = min(temps) if temps else 10.0
                temp_max = max(temps) if temps else 15.0
                dewpoint = round(sum(dewpoints) / len(dewpoints), 1) if dewpoints else None
                rain_chance = int(max(precip_probs)) if precip_probs else 0
                rain_amount = sum(precips) if precips else 0.0
                snow_amount = sum(snowfalls) if snowfalls else 0.0
                wind_avg = sum(wind_speeds) / len(wind_speeds) if wind_speeds else 20.0
                wind_max = max(wind_gusts) if wind_gusts else wind_avg + 15
                wind_direction = degrees_to_compass(wind_dirs[0] if wind_dirs else None)
                cloud_cover = int(sum(cloud_covers) / len(cloud_covers)) if cloud_covers else 50
                freezing_level = int(sum(freezing_levels) / len(freezing_levels)) if freezing_levels else None
                cape = int(max(cape_values)) if cape_values else None  # Max CAPE in period (peak storm potential)

                # Generate description
                description = self._generate_description(
                    temp_max, rain_chance, rain_amount, snow_amount, wind_max, cloud_cover
                )

                period = NormalizedForecast(
                    provider=self.provider_name,
                    lat=lat,
                    lon=lon,
                    timestamp=period_time,
                    temp_min=round(temp_min, 1),
                    temp_max=round(temp_max, 1),
                    rain_chance=rain_chance,
                    rain_amount=round(rain_amount, 1),
                    wind_avg=round(wind_avg, 1),
                    wind_max=round(wind_max, 1),
                    wind_direction=wind_direction,
                    cloud_cover=cloud_cover,
                    dewpoint=dewpoint,  # For LCL cloud base calculation
                    freezing_level=freezing_level,
                    snow_amount=round(snow_amount, 1),
                    cape=cape,  # Storm potential indicator
                    description=description,
                    alerts=[],
                )
                periods.append(period)

            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Error parsing Open-Meteo period {i}: {e}")
                continue

        logger.info(f"Parsed {len(periods)} periods from Open-Meteo response (elevation={model_elevation}m)")

        return NormalizedDailyForecast(
            provider=self.provider_name,
            lat=lat,
            lon=lon,
            country_code="",  # Will be set by caller based on coordinates
            periods=periods,
            alerts=[],  # Open-Meteo doesn't support alerts
            fetched_at=fetched_at,
            is_fallback=False,
            model_elevation=model_elevation,
            recent_precip=recent_precip,
        )

    def _get_values(
        self,
        hourly: dict,
        key: str,
        indices: range
    ) -> List[float]:
        """Extract non-None values for given indices from hourly data."""
        values = hourly.get(key, [])
        result = []
        for i in indices:
            if i < len(values) and values[i] is not None:
                result.append(float(values[i]))
        return result

    def _calculate_recent_precipitation(
        self,
        hourly: dict,
        times: List[str],
        now: datetime
    ) -> RecentPrecipitation:
        """
        Calculate recent precipitation totals from past hourly data.

        Sums precipitation for the last 24, 48, and 72 hours to help
        assess trail conditions (mud, stream levels, snow pack).

        Args:
            hourly: Hourly data from Open-Meteo response
            times: List of ISO datetime strings
            now: Current timestamp

        Returns:
            RecentPrecipitation with 24h/48h/72h totals
        """
        rain_values = hourly.get("precipitation", [])
        snow_values = hourly.get("snowfall", [])

        rain_24h = 0.0
        rain_48h = 0.0
        rain_72h = 0.0
        snow_24h = 0.0
        snow_48h = 0.0
        snow_72h = 0.0

        for i, time_str in enumerate(times):
            try:
                period_time = parse_iso_datetime(time_str)
                # Make period_time timezone-aware if it isn't
                if period_time.tzinfo is None:
                    period_time = period_time.replace(tzinfo=timezone.utc)

                hours_ago = (now - period_time).total_seconds() / 3600

                # Only count past hours (negative hours_ago means future)
                if hours_ago < 0:
                    continue

                rain = rain_values[i] if i < len(rain_values) and rain_values[i] is not None else 0.0
                snow = snow_values[i] if i < len(snow_values) and snow_values[i] is not None else 0.0

                if hours_ago <= 24:
                    rain_24h += rain
                    snow_24h += snow
                if hours_ago <= 48:
                    rain_48h += rain
                    snow_48h += snow
                if hours_ago <= 72:
                    rain_72h += rain
                    snow_72h += snow

            except (ValueError, TypeError):
                continue

        logger.debug(
            f"Recent precipitation: rain={rain_24h:.1f}/{rain_48h:.1f}/{rain_72h:.1f}mm, "
            f"snow={snow_24h:.1f}/{snow_48h:.1f}/{snow_72h:.1f}cm"
        )

        return RecentPrecipitation(
            rain_24h=round(rain_24h, 1),
            rain_48h=round(rain_48h, 1),
            rain_72h=round(rain_72h, 1),
            snow_24h=round(snow_24h, 1),
            snow_48h=round(snow_48h, 1),
            snow_72h=round(snow_72h, 1),
        )

    def _generate_description(
        self,
        temp_max: float,
        rain_chance: int,
        rain_amount: float,
        snow_amount: float,
        wind_max: float,
        cloud_cover: int
    ) -> str:
        """Generate a text summary of conditions."""
        parts = []

        # Temperature
        if temp_max < 0:
            parts.append("Freezing")
        elif temp_max < 10:
            parts.append("Cold")
        elif temp_max > 25:
            parts.append("Hot")

        # Precipitation
        if snow_amount > 0:
            if snow_amount > 5:
                parts.append("heavy snow")
            else:
                parts.append("snow")
        elif rain_amount > 0 or rain_chance > 50:
            if rain_amount > 10:
                parts.append("heavy rain")
            elif rain_chance > 70:
                parts.append("likely rain")
            elif rain_chance > 30:
                parts.append("possible rain")

        # Wind
        if wind_max > 60:
            parts.append("strong winds")
        elif wind_max > 40:
            parts.append("windy")

        # Cloud
        if cloud_cover < 20:
            parts.append("clear")
        elif cloud_cover > 80:
            parts.append("cloudy")
        elif cloud_cover > 50:
            parts.append("partly cloudy")

        if not parts:
            return "Mild conditions"

        return ", ".join(parts).capitalize()
