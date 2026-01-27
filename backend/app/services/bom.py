"""
Weather Service
Based on THUNDERBIRD_SPEC_v2.4 Sections 4.1, 6.7, 12.1

Primary: BOM undocumented API (api.weather.bom.gov.au)
Fallback: Open-Meteo API (api.open-meteo.com) - provides more fields
"""

import asyncio
import random
import geohash2
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass
import httpx
from zoneinfo import ZoneInfo

from config.settings import settings, BOMGridConfig, TZ_HOBART

logger = logging.getLogger(__name__)


def parse_iso_datetime(dt_string: str) -> datetime:
    """Parse ISO datetime string, handling 'Z' suffix for UTC."""
    # Python's fromisoformat doesn't handle 'Z' suffix
    if dt_string.endswith('Z'):
        dt_string = dt_string[:-1] + '+00:00'
    return datetime.fromisoformat(dt_string)


@dataclass
class ForecastPeriod:
    """Single forecast period data."""
    datetime: datetime
    period: str  # 'N', 'AM', 'PM'
    
    # Temperature
    temp_min: float
    temp_max: float
    
    # Precipitation
    rain_chance: int  # percentage
    rain_min: float
    rain_max: float
    snow_min: float
    snow_max: float
    
    # Wind
    wind_avg: int
    wind_max: int
    
    # Cloud/visibility
    cloud_cover: int  # percentage
    cloud_base: int  # meters AGL
    
    # Freezing level
    freezing_level: int  # meters ASL
    
    # Thunderstorm
    cape: int  # J/kg


@dataclass
class CellForecast:
    """Complete forecast for a weather zone (formerly called 'BOM cell')."""
    cell_id: str  # Our zone identifier (e.g., "201-117"), not a BOM concept
    geohash: str  # BOM API uses geohash for lookups
    lat: float
    lon: float
    base_elevation: int
    
    periods: List[ForecastPeriod]
    
    fetched_at: datetime
    expires_at: datetime
    is_cached: bool = False
    cache_age_hours: float = 0.0
    source: str = "bom"  # 'bom' or 'mock'


class BOMService:
    """
    Weather forecast service.
    
    Primary: BOM undocumented API (api.weather.bom.gov.au)
    - Powers the official BOM Weather app
    - Uses geohash for location lookups
    - Provides temp, rain, wind (avg + gusts)
    
    Fallback: Open-Meteo API (api.open-meteo.com)
    - Provides additional fields: freezing_level, snowfall, cloud_cover
    - 7-day forecasts, hourly resolution
    - No rate limits, fully documented
    """
    
    BOM_API_BASE = "https://api.weather.bom.gov.au/v1"
    OPENMETEO_API_BASE = "https://api.open-meteo.com/v1/forecast"
    OPENMETEO_ELEVATION_API = "https://api.open-meteo.com/v1/elevation"
    
    def __init__(self, use_mock: bool = None):
        self.use_mock = use_mock if use_mock is not None else settings.MOCK_BOM_API
        self._client: Optional[httpx.AsyncClient] = None
        self._elevation_cache: Dict[str, int] = {}  # Cache elevation lookups
    
    async def get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with BOM-compatible headers."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
            )
        return self._client
    
    async def get_grid_elevation(self, lat: float, lon: float) -> int:
        """
        Get the 90m DEM elevation at a specific lat/lon point.

        NOTE: This is the POINT elevation, not the BOM model orography.
        BOM temperatures are valid for the cell-average elevation, not this value.
        Use get_cell_model_elevation() for the elevation BOM temps are based on.

        Returns elevation in meters (integer).
        """
        # Round to 3 decimal places for cache key (gives ~100m precision)
        cache_key = f"{lat:.3f},{lon:.3f}"
        
        if cache_key in self._elevation_cache:
            return self._elevation_cache[cache_key]
        
        try:
            client = await self.get_client()
            response = await client.get(
                self.OPENMETEO_ELEVATION_API,
                params={"latitude": lat, "longitude": lon}
            )
            response.raise_for_status()
            data = response.json()
            
            elevation = int(data.get("elevation", [0])[0])
            self._elevation_cache[cache_key] = elevation
            logger.info(f"Grid elevation at ({lat}, {lon}): {elevation}m")
            return elevation
            
        except Exception as e:
            logger.warning(f"Failed to get grid elevation: {e}, using default 500m")
            return 500  # Fallback default

    async def get_cell_model_elevation(self, lat: float, lon: float, cell_id: str = "") -> int:
        """
        Get the estimated model orography (cell average elevation) for a location.

        BOM ACCESS model uses ~2.2km x 2.2km grid cells with averaged terrain.
        Temperatures are valid at 2m above this model orography.

        This method samples a 2.2km grid centered on the location using
        Open Topo Data API and returns the average elevation.

        Args:
            lat: User's latitude
            lon: User's longitude
            cell_id: Unused (kept for API compatibility)

        Returns:
            Estimated model orography (cell average elevation) in meters
        """
        from app.services.elevation import get_cell_elevation_data

        try:
            cell_data = await get_cell_elevation_data(lat, lon, cell_id)
            return int(cell_data.average_elevation)
        except Exception as e:
            logger.warning(f"Failed to get cell model elevation: {e}")
            # Fallback to point elevation
            return await self.get_grid_elevation(lat, lon)

    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _lat_lon_to_geohash(self, lat: float, lon: float, precision: int = 6) -> str:
        """Convert lat/lon to geohash (6 chars = ~1km precision)."""
        return geohash2.encode(lat, lon, precision=precision)
    
    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7,
        resolution: str = "3hourly"
    ) -> CellForecast:
        """
        Get forecast for a location.
        
        Args:
            lat: Latitude
            lon: Longitude
            days: Number of forecast days (1-7)
            resolution: "3hourly" or "hourly"
        
        Returns:
            CellForecast with periods
        """
        # Calculate our cell ID for caching/grouping
        cell = BOMGridConfig.lat_lon_to_cell(lat, lon)
        cell_id = BOMGridConfig.cell_to_string(*cell)
        
        # Convert to geohash for BOM API
        geohash = self._lat_lon_to_geohash(lat, lon)
        
        if self.use_mock:
            return self._generate_mock_forecast(cell_id, geohash, lat, lon, days, resolution)
        
        return await self._fetch_real_forecast(cell_id, geohash, lat, lon, days, resolution)
    
    async def get_hourly_forecast(
        self,
        lat: float,
        lon: float,
        hours: int = 12
    ) -> CellForecast:
        """
        Get hourly forecast for next N hours (for FORECAST command).

        Args:
            lat: Latitude
            lon: Longitude
            hours: Number of hours (default 12)

        Returns:
            CellForecast with hourly periods
        """
        return await self.get_forecast(lat, lon, days=2, resolution="hourly")

    async def get_daily_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7
    ) -> CellForecast:
        """
        Get daily forecast for next N days (for CAST7, CAMPS7, PEAKS7 commands).

        Args:
            lat: Latitude
            lon: Longitude
            days: Number of days (default 7)

        Returns:
            CellForecast with daily periods
        """
        cell = BOMGridConfig.lat_lon_to_cell(lat, lon)
        cell_id = BOMGridConfig.cell_to_string(*cell)
        geohash = self._lat_lon_to_geohash(lat, lon)

        if self.use_mock:
            grid_elevation = await self.get_grid_elevation(lat, lon)
            return self._generate_mock_forecast(cell_id, geohash, lat, lon, days, "daily", grid_elevation)

        client = await self.get_client()

        # Try BOM daily endpoint first
        try:
            url = f"{self.BOM_API_BASE}/locations/{geohash}/forecasts/daily"
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            logger.info(f"BOM API success for {geohash} (daily)")

            # Extract BOM's cell identifier from response metadata
            # forecast_region is a string (e.g., "Hobart"), not an object
            bom_cell_id = data.get("metadata", {}).get("forecast_region", cell_id)

            # Get cell model elevation (average elevation across the BOM cell)
            model_elevation = await self.get_cell_model_elevation(lat, lon, bom_cell_id)

            return self._parse_bom_daily_response(bom_cell_id, geohash, lat, lon, data, days, model_elevation)

        except httpx.HTTPError as e:
            logger.warning(f"BOM daily API failed for {geohash}: {e}")

        # Fall back to Open-Meteo
        # Note: Open-Meteo returns temps already downscaled to 90m DEM, so use point elevation
        grid_elevation = await self.get_grid_elevation(lat, lon)
        logger.info(f"Falling back to Open-Meteo for daily forecast at {lat}, {lon}")
        return await self._fetch_openmeteo_forecast(
            cell_id, geohash, lat, lon, days, resolution="hourly", grid_elevation=grid_elevation
        )

    def _parse_bom_daily_response(
        self,
        cell_id: str,
        geohash: str,
        lat: float,
        lon: float,
        data: Dict[str, Any],
        days: int,
        grid_elevation: int = 500
    ) -> CellForecast:
        """
        Parse BOM daily API response.

        Response structure:
        {
            "data": [
                {
                    "date": "2026-01-22T16:00:00Z",
                    "temp_max": 25,
                    "temp_min": 17,
                    "rain": {"chance": 20, "amount": {"min": 0, "max": null}},
                    "icon_descriptor": "mostly_sunny",
                    ...
                }
            ]
        }
        """
        periods = []
        now = datetime.now(TZ_HOBART)

        for day_data in data.get("data", [])[:days]:
            try:
                date_str = day_data.get("date")
                if not date_str:
                    continue

                period_time = parse_iso_datetime(date_str)
                local_time = period_time.astimezone(TZ_HOBART)

                # Get temperature
                temp_max = day_data.get("temp_max")
                temp_min = day_data.get("temp_min")

                # Skip if no temp data
                if temp_max is None and temp_min is None:
                    continue

                temp_max = temp_max if temp_max is not None else (temp_min + 10 if temp_min else 20)
                temp_min = temp_min if temp_min is not None else (temp_max - 10 if temp_max else 10)

                # Get rain data
                rain = day_data.get("rain", {})
                rain_amount = rain.get("amount", {})
                rain_chance = rain.get("chance", 0) or 0
                rain_min = rain_amount.get("min", 0) or 0
                rain_max = rain_amount.get("max") or rain_amount.get("upper_range", 0) or 0

                # Estimate wind from icon/conditions (BOM daily doesn't include wind)
                icon = day_data.get("icon_descriptor", "")
                if "storm" in icon or "wind" in icon:
                    wind_avg, wind_max = 35, 55
                elif "shower" in icon or "rain" in icon:
                    wind_avg, wind_max = 25, 40
                else:
                    wind_avg, wind_max = 15, 25

                # Estimate cloud cover from icon
                if "sunny" in icon:
                    cloud_cover = 10
                elif "mostly_sunny" in icon:
                    cloud_cover = 30
                elif "cloudy" in icon:
                    cloud_cover = 70
                elif "overcast" in icon:
                    cloud_cover = 90
                else:
                    cloud_cover = 50

                # Calculate freezing level and cloud base
                freezing_level = self.calculate_freezing_level(temp_max, grid_elevation)
                cloud_base = 800 if cloud_cover > 70 else 1500

                period = ForecastPeriod(
                    datetime=local_time,
                    period="DAY",
                    temp_min=temp_min,
                    temp_max=temp_max,
                    rain_chance=rain_chance,
                    rain_min=rain_min,
                    rain_max=rain_max,
                    snow_min=0,
                    snow_max=0,
                    wind_avg=wind_avg,
                    wind_max=wind_max,
                    cloud_cover=cloud_cover,
                    cloud_base=cloud_base,
                    freezing_level=freezing_level,
                    cape=0
                )
                periods.append(period)

            except (KeyError, ValueError) as e:
                logger.warning(f"Error parsing BOM daily period: {e}")
                continue

        return CellForecast(
            cell_id=cell_id,
            geohash=geohash,
            lat=lat,
            lon=lon,
            base_elevation=grid_elevation,
            periods=periods,
            fetched_at=now,
            expires_at=now + timedelta(hours=settings.BOM_CACHE_TTL_HOURS),
            is_cached=False,
            source="bom"
        )

    async def _fetch_real_forecast(
        self,
        cell_id: str,
        geohash: str,
        lat: float,
        lon: float,
        days: int,
        resolution: str = "3hourly"
    ) -> CellForecast:
        """
        Fetch real forecast from weather APIs.
        
        Primary: BOM API (hourly or 3-hourly)
        Fallback: Open-Meteo API (if BOM fails)
        
        Args:
            resolution: "hourly" or "3hourly"
        """
        client = await self.get_client()
        
        # Choose BOM endpoint based on resolution
        endpoint = "hourly" if resolution == "hourly" else "3-hourly"

        # Try BOM first
        try:
            url = f"{self.BOM_API_BASE}/locations/{geohash}/forecasts/{endpoint}"
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            logger.info(f"BOM API success for {geohash} ({endpoint})")

            # Extract BOM's cell identifier from response metadata
            # forecast_region is a string (e.g., "Hobart"), not an object
            bom_cell_id = data.get("metadata", {}).get("forecast_region", cell_id)

            # Get cell model elevation (average elevation across the BOM cell)
            # This is the elevation BOM temperatures are valid for
            model_elevation = await self.get_cell_model_elevation(lat, lon, bom_cell_id)

            if resolution == "hourly":
                return self._parse_bom_hourly_response(bom_cell_id, geohash, lat, lon, data, days, model_elevation)
            else:
                return self._parse_bom_3hourly_response(bom_cell_id, geohash, lat, lon, data, days, model_elevation)
            
        except httpx.HTTPError as e:
            logger.warning(f"BOM API failed for {geohash}: {e}")

        # Fall back to Open-Meteo
        # Note: Open-Meteo returns temps already downscaled to 90m DEM, so use point elevation
        grid_elevation = await self.get_grid_elevation(lat, lon)
        try:
            logger.info(f"Falling back to Open-Meteo for {lat}, {lon}")
            return await self._fetch_openmeteo_forecast(cell_id, geohash, lat, lon, days, resolution, grid_elevation)
            
        except httpx.HTTPError as e:
            logger.error(f"Open-Meteo API also failed: {e}")
            
            # Last resort: mock data (only if configured)
            if settings.BOM_FALLBACK_TO_MOCK:
                logger.warning("Falling back to mock forecast (both APIs failed)")
                return self._generate_mock_forecast(cell_id, geohash, lat, lon, days, resolution, grid_elevation)
            
            raise BOMAPIError(f"All weather APIs failed: {e}")
    
    async def _fetch_openmeteo_forecast(
        self,
        cell_id: str,
        geohash: str,
        lat: float,
        lon: float,
        days: int,
        resolution: str = "3hourly",
        grid_elevation: int = 500
    ) -> CellForecast:
        """
        Fetch forecast from Open-Meteo API.
        
        Open-Meteo provides more fields than BOM:
        - freezing_level_height (direct, no calculation needed)
        - snowfall (cm)
        - cloud_cover (%)
        - wind_gusts_10m
        
        Args:
            resolution: "hourly" or "3hourly"
            grid_elevation: DEM elevation at this point (for temp adjustments)
        """
        client = await self.get_client()
        
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join([
                "temperature_2m",
                "precipitation_probability",
                "precipitation",
                "rain",
                "snowfall",
                "wind_speed_10m",
                "wind_gusts_10m",
                "wind_direction_10m",
                "cloud_cover",
                "freezing_level_height"
            ]),
            "timezone": "Australia/Hobart",
            "forecast_days": min(days, 7)
        }
        
        response = await client.get(self.OPENMETEO_API_BASE, params=params)
        response.raise_for_status()
        data = response.json()
        
        return self._parse_openmeteo_response(cell_id, geohash, lat, lon, data, days, resolution, grid_elevation)
    
    def _parse_openmeteo_response(
        self,
        cell_id: str,
        geohash: str,
        lat: float,
        lon: float,
        data: Dict[str, Any],
        days: int,
        resolution: str = "3hourly",
        grid_elevation: int = 500
    ) -> CellForecast:
        """
        Parse Open-Meteo hourly API response.
        
        Args:
            grid_elevation: DEM elevation at this point (temps are for this elevation)
        
        Response structure:
        {
            "hourly": {
                "time": ["2026-01-05T00:00", ...],
                "temperature_2m": [12, 11, ...],
                "precipitation_probability": [30, 40, ...],
                "precipitation": [0.1, 0.5, ...],
                "snowfall": [0, 0, ...],
                "wind_speed_10m": [25, 30, ...],
                "wind_gusts_10m": [45, 50, ...],
                "cloud_cover": [75, 80, ...],
                "freezing_level_height": [1500, 1400, ...]
            }
        }
        """
        periods = []
        now = datetime.now(TZ_HOBART)
        
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        
        # Step size: 1 for hourly, 3 for 3-hourly
        step = 1 if resolution == "hourly" else 3
        
        for i in range(0, len(times), step):
            if resolution == "3hourly" and i + 2 >= len(times):
                break
            
            try:
                # Parse time
                period_time = parse_iso_datetime(times[i])
                period_time = period_time.replace(tzinfo=TZ_HOBART)
                
                # Determine period name
                hour = period_time.hour
                if resolution == "hourly":
                    # For hourly, use hour as period (e.g., "06", "07", etc.)
                    period_name = f"{hour:02d}"
                else:
                    # For 3-hourly, use N/AM/PM
                    if hour < 6:
                        period_name = "N"
                    elif hour < 12:
                        period_name = "AM"
                    elif hour < 18:
                        period_name = "PM"
                    else:
                        period_name = "N"
                
                # For hourly, use single hour; for 3-hourly, aggregate
                agg_range = range(i, i+1) if resolution == "hourly" else range(i, min(i+3, len(times)))
                
                temps = [hourly["temperature_2m"][j] for j in agg_range 
                         if hourly["temperature_2m"][j] is not None]
                precip_probs = [hourly["precipitation_probability"][j] for j in agg_range
                                if hourly["precipitation_probability"][j] is not None]
                precips = [hourly["precipitation"][j] for j in agg_range
                           if hourly["precipitation"][j] is not None]
                snowfalls = [hourly["snowfall"][j] for j in agg_range
                             if hourly.get("snowfall", [None]*len(times))[j] is not None]
                wind_speeds = [hourly["wind_speed_10m"][j] for j in agg_range
                               if hourly["wind_speed_10m"][j] is not None]
                wind_gusts = [hourly["wind_gusts_10m"][j] for j in agg_range
                              if hourly["wind_gusts_10m"][j] is not None]
                cloud_covers = [hourly["cloud_cover"][j] for j in agg_range
                                if hourly["cloud_cover"][j] is not None]
                freezing_levels = [hourly["freezing_level_height"][j] for j in agg_range
                                   if hourly.get("freezing_level_height", [None]*len(times))[j] is not None]
                
                # Calculate aggregates (or single values for hourly)
                temp_min = min(temps) if temps else 10
                temp_max = max(temps) if temps else 15
                rain_chance = max(precip_probs) if precip_probs else 0
                rain_total = sum(precips) if precips else 0
                snow_total = sum(snowfalls) if snowfalls else 0
                wind_avg = int(sum(wind_speeds) / len(wind_speeds)) if wind_speeds else 20
                wind_max = int(max(wind_gusts)) if wind_gusts else wind_avg + 15
                cloud_cover = int(sum(cloud_covers) / len(cloud_covers)) if cloud_covers else 50
                freezing_level = int(sum(freezing_levels) / len(freezing_levels)) if freezing_levels else 1500
                
                # Estimate cloud base from cloud cover
                cloud_base = 800 if cloud_cover > 80 else (1000 if cloud_cover > 50 else 1500)
                
                period = ForecastPeriod(
                    datetime=period_time,
                    period=period_name,
                    temp_min=temp_min,
                    temp_max=temp_max,
                    rain_chance=rain_chance,
                    rain_min=0,  # Open-Meteo doesn't provide min
                    rain_max=round(rain_total, 1),
                    snow_min=0,
                    snow_max=round(snow_total, 1),  # Direct from API!
                    wind_avg=wind_avg,
                    wind_max=wind_max,
                    cloud_cover=cloud_cover,  # Direct from API!
                    cloud_base=cloud_base,
                    freezing_level=freezing_level,  # Direct from API!
                    cape=0  # Open-Meteo has this but we're not using it
                )
                periods.append(period)
                
            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Error parsing Open-Meteo period {i}: {e}")
                continue
        
        return CellForecast(
            cell_id=cell_id,
            geohash=geohash,
            lat=lat,
            lon=lon,
            base_elevation=grid_elevation,  # Actual DEM elevation for temp adjustments
            periods=periods,
            fetched_at=now,
            expires_at=now + timedelta(hours=settings.BOM_CACHE_TTL_HOURS),
            is_cached=False,
            source="openmeteo"
        )
    
    def _parse_bom_hourly_response(
        self,
        cell_id: str,
        geohash: str,
        lat: float,
        lon: float,
        data: Dict[str, Any],
        days: int,
        grid_elevation: int = 500
    ) -> CellForecast:
        """
        Parse BOM hourly API response.
        
        Args:
            grid_elevation: DEM elevation at this point (temps are for this elevation)
        
        Response structure similar to 3-hourly but with hourly intervals.
        """
        periods = []
        now = datetime.now(TZ_HOBART)
        cutoff = now + timedelta(days=days)
        
        for period_data in data.get("data", []):
            try:
                period_time = parse_iso_datetime(period_data["time"])
                
                # Convert to local time for display
                local_time = period_time.astimezone(TZ_HOBART)
                
                # Skip periods beyond requested days
                if local_time > cutoff:
                    continue
                
                # For hourly, use LOCAL hour as period name (e.g., "06", "07")
                hour = local_time.hour
                period_name = f"{hour:02d}"
                
                # Extract rain data
                rain = period_data.get("rain", {})
                rain_amount = rain.get("amount", {})
                rain_chance = rain.get("chance", 0) or 0
                rain_min = rain_amount.get("min", 0) or 0
                rain_max = rain_amount.get("max", 0) or 0
                
                # Extract wind data
                wind = period_data.get("wind", {})
                wind_avg = wind.get("speed_kilometre", 20) or 20
                wind_max = wind.get("gust_speed_kilometre", wind_avg + 10) or (wind_avg + 10)
                
                # Temperature
                temp = period_data.get("temp", 10)
                temp_min = temp - 1
                temp_max = temp + 1
                
                # Calculate freezing level from temperature
                freezing_level = self.calculate_freezing_level(temp, 800)
                
                # Snow estimate (if temp < 2 and rain)
                snow_max = (rain_max / 3) if temp < 2 and rain_max > 0 else 0
                snow_min = snow_max * 0.3
                
                # Cloud - estimate from rain chance
                cloud_cover = min(100, rain_chance + 30) if rain_chance > 0 else random.randint(20, 50)
                cloud_base = 800 if cloud_cover > 80 else 1200
                
                period = ForecastPeriod(
                    datetime=local_time,  # Store local time
                    period=period_name,
                    temp_min=temp_min,
                    temp_max=temp_max,
                    rain_chance=rain_chance,
                    rain_min=rain_min,
                    rain_max=rain_max,
                    snow_min=round(snow_min, 1),
                    snow_max=round(snow_max, 1),
                    wind_avg=wind_avg,
                    wind_max=wind_max,
                    cloud_cover=cloud_cover,
                    cloud_base=cloud_base,
                    freezing_level=freezing_level,
                    cape=0
                )
                periods.append(period)
                
            except (KeyError, ValueError) as e:
                logger.warning(f"Error parsing BOM hourly period: {e}")
                continue
        
        # BOM provides temps at 2m height above the grid cell's average terrain elevation
        # Use the actual grid elevation for proper lapse rate adjustment to waypoint elevation

        return CellForecast(
            cell_id=cell_id,
            geohash=geohash,
            lat=lat,
            lon=lon,
            base_elevation=grid_elevation,  # Grid cell elevation for lapse rate adjustment
            periods=periods,
            fetched_at=now,
            expires_at=now + timedelta(hours=settings.BOM_CACHE_TTL_HOURS),
            is_cached=False,
            source="bom"
        )

    def _parse_bom_3hourly_response(
        self,
        cell_id: str,
        geohash: str,
        lat: float,
        lon: float,
        data: Dict[str, Any],
        days: int,
        grid_elevation: int = 500
    ) -> CellForecast:
        """
        Parse BOM 3-hourly API response.
        
        Response structure:
        {
            "data": [
                {
                    "time": "2026-01-05T09:00:00+11:00",
                    "temp": 18,
                    "rain": {"amount": {"min": 0, "max": 1}, "chance": 30},
                    "wind": {"speed_kilometre": 25, "gust_speed_kilometre": 40},
                    ...
                }
            ],
            "metadata": {...}
        }
        """
        periods = []
        now = datetime.now(TZ_HOBART)
        cutoff = now + timedelta(days=days)
        
        for period_data in data.get("data", []):
            try:
                period_time = parse_iso_datetime(period_data["time"])
                
                # Convert to local time for display
                local_time = period_time.astimezone(TZ_HOBART)
                
                # Skip periods beyond requested days
                if local_time > cutoff:
                    continue
                
                # Determine period name based on LOCAL hour
                hour = local_time.hour
                if hour < 6:
                    period_name = "N"  # Night/early morning
                elif hour < 12:
                    period_name = "AM"
                elif hour < 18:
                    period_name = "PM"
                else:
                    period_name = "N"  # Evening/night
                
                # Extract rain data
                rain = period_data.get("rain", {})
                rain_amount = rain.get("amount", {})
                rain_chance = rain.get("chance", 0) or 0
                rain_min = rain_amount.get("min", 0) or 0
                rain_max = rain_amount.get("max", 0) or 0
                
                # Extract wind data
                wind = period_data.get("wind", {})
                wind_avg = wind.get("speed_kilometre", 20) or 20
                wind_max = wind.get("gust_speed_kilometre", wind_avg + 10) or (wind_avg + 10)
                
                # Temperature
                temp = period_data.get("temp", 10)
                temp_feels = period_data.get("temp_feels_like", temp)
                
                # Estimate temp range from single value
                temp_max = temp
                temp_min = temp - 3 if period_name == "PM" else temp - 1
                
                # Calculate freezing level from temperature
                freezing_level = self.calculate_freezing_level(temp, 800)
                
                # Snow estimate (if temp < 2 and rain)
                snow_max = (rain_max / 3) if temp < 2 and rain_max > 0 else 0
                snow_min = snow_max * 0.3
                
                # Cloud - estimate from rain chance
                cloud_cover = min(100, rain_chance + 30) if rain_chance > 0 else random.randint(20, 50)
                cloud_base = 800 if cloud_cover > 80 else 1200
                
                period = ForecastPeriod(
                    datetime=local_time,  # Store local time
                    period=period_name,
                    temp_min=temp_min,
                    temp_max=temp_max,
                    rain_chance=rain_chance,
                    rain_min=rain_min,
                    rain_max=rain_max,
                    snow_min=round(snow_min, 1),
                    snow_max=round(snow_max, 1),
                    wind_avg=wind_avg,
                    wind_max=wind_max,
                    cloud_cover=cloud_cover,
                    cloud_base=cloud_base,
                    freezing_level=freezing_level,
                    cape=0  # BOM doesn't provide CAPE in this endpoint
                )
                periods.append(period)
                
            except (KeyError, ValueError) as e:
                print(f"Error parsing period: {e}")
                continue

        # BOM provides temps at 2m height above the grid cell's average terrain elevation
        # Use the actual grid elevation for proper lapse rate adjustment to waypoint elevation

        return CellForecast(
            cell_id=cell_id,
            geohash=geohash,
            lat=lat,
            lon=lon,
            base_elevation=grid_elevation,  # Grid cell elevation for lapse rate adjustment
            periods=periods,
            fetched_at=now,
            expires_at=now + timedelta(hours=settings.BOM_CACHE_TTL_HOURS),
            is_cached=False,
            source="bom"
        )

    def _generate_mock_forecast(
        self,
        cell_id: str,
        geohash: str,
        lat: float,
        lon: float,
        days: int,
        resolution: str = "3hourly",
        grid_elevation: int = 500
    ) -> CellForecast:
        """
        Generate realistic mock forecast data for testing.
        Based on typical Tasmania southwest weather patterns.
        
        Args:
            resolution: "hourly" or "3hourly"
        """
        periods = []
        now = datetime.now(TZ_HOBART)
        base_date = now.date()
        
        # Weather pattern simulation
        # Tasmania southwest: predominantly westerly, wet, variable
        base_temp = random.randint(5, 12)
        base_rain_chance = random.randint(40, 80)
        weather_trend = random.choice(["improving", "stable", "deteriorating"])
        
        if resolution == "hourly":
            # Generate hourly data for specified days
            for day_offset in range(days):
                current_date = base_date + timedelta(days=day_offset)
                
                trend_modifier = {
                    "improving": -day_offset * 5,
                    "stable": 0,
                    "deteriorating": day_offset * 5
                }[weather_trend]
                
                for hour in range(24):
                    period_dt = datetime.combine(current_date, datetime.min.time().replace(hour=hour))
                    period_dt = period_dt.replace(tzinfo=TZ_HOBART)
                    
                    # Temperature varies by hour (cooler at night, warmer midday)
                    hour_temp_offset = -3 if hour < 6 or hour > 20 else (3 if 10 <= hour <= 16 else 0)
                    temp_base = base_temp + hour_temp_offset + random.randint(-1, 1)
                    temp_min = temp_base - 1
                    temp_max = temp_base + 2
                    
                    # Rain chance with trend
                    rain_chance = max(0, min(100, base_rain_chance + trend_modifier + random.randint(-10, 10)))
                    rain_max = (rain_chance / 100) * random.uniform(1, 5) if rain_chance > 30 else random.uniform(0, 1)
                    
                    # Snow if cold enough
                    snow_max = max(0, (rain_max / 3) if temp_max < 2 else 0)
                    
                    # Wind - Roaring Forties pattern
                    wind_avg = random.randint(20, 40)
                    wind_max = wind_avg + random.randint(8, 20)
                    
                    # Cloud
                    cloud_cover = max(0, min(100, rain_chance + random.randint(-10, 20)))
                    cloud_base = random.randint(600, 1200) if cloud_cover > 70 else random.randint(1200, 2000)
                    
                    # Freezing level
                    freezing_level = int(800 + (temp_max * 150))
                    
                    periods.append(ForecastPeriod(
                        datetime=period_dt,
                        period=f"{hour:02d}",  # Hour as period name
                        temp_min=temp_min,
                        temp_max=temp_max,
                        rain_chance=rain_chance,
                        rain_min=0,
                        rain_max=round(rain_max, 1),
                        snow_min=0,
                        snow_max=round(snow_max, 1),
                        wind_avg=wind_avg,
                        wind_max=wind_max,
                        cloud_cover=cloud_cover,
                        cloud_base=cloud_base,
                        freezing_level=freezing_level,
                        cape=0
                    ))
        else:
            # Generate 3-hourly data (existing logic)
            for day_offset in range(days):
                current_date = base_date + timedelta(days=day_offset)
                
                trend_modifier = {
                    "improving": -day_offset * 5,
                    "stable": 0,
                    "deteriorating": day_offset * 5
                }[weather_trend]
                
                # Generate 4 periods per day: N (previous night), AM, PM, N
                for period_idx, period_name in enumerate(["N", "AM", "PM", "N"]):
                    if day_offset == 0 and period_idx == 0:
                        continue  # Skip previous night for first day
                    
                    hour = {0: 0, 1: 9, 2: 15, 3: 21}[period_idx]
                    period_dt = datetime.combine(current_date, datetime.min.time().replace(hour=hour))
                    period_dt = period_dt.replace(tzinfo=TZ_HOBART)
                
                # Temperature varies by period
                temp_base = base_temp + random.randint(-2, 2)
                if period_name == "N":
                    temp_min = temp_base - 3
                    temp_max = temp_base + 1
                elif period_name == "AM":
                    temp_min = temp_base - 1
                    temp_max = temp_base + 4
                else:  # PM
                    temp_min = temp_base + 2
                    temp_max = temp_base + 7
                
                # Rain chance with trend
                rain_chance = max(0, min(100, base_rain_chance + trend_modifier + random.randint(-10, 10)))
                rain_max = (rain_chance / 100) * random.uniform(5, 15) if rain_chance > 30 else random.uniform(0, 3)
                rain_min = rain_max * random.uniform(0.2, 0.5)
                
                # Snow if cold enough
                snow_max = max(0, (rain_max / 3) if temp_max < 2 else 0)
                snow_min = snow_max * random.uniform(0, 0.5)
                
                # Wind - Roaring Forties pattern
                wind_avg = random.randint(25, 45)
                wind_max = wind_avg + random.randint(10, 25)
                
                # Cloud
                cloud_cover = max(0, min(100, rain_chance + random.randint(-10, 20)))
                cloud_base = random.randint(600, 1200) if cloud_cover > 70 else random.randint(1200, 2000)
                
                # Freezing level
                freezing_level = int(800 + (temp_max * 150))
                
                # CAPE (thunderstorm energy)
                cape = random.randint(0, 150) if cloud_cover > 80 and temp_max > 10 else 0
                
                periods.append(ForecastPeriod(
                    datetime=period_dt,
                    period=period_name,
                    temp_min=temp_min,
                    temp_max=temp_max,
                    rain_chance=rain_chance,
                    rain_min=round(rain_min, 1),
                    rain_max=round(rain_max, 1),
                    snow_min=round(snow_min, 1),
                    snow_max=round(snow_max, 1),
                    wind_avg=wind_avg,
                    wind_max=wind_max,
                    cloud_cover=cloud_cover,
                    cloud_base=cloud_base,
                    freezing_level=freezing_level,
                    cape=cape
                ))
        
        return CellForecast(
            cell_id=cell_id,
            geohash=geohash,
            lat=lat,
            lon=lon,
            base_elevation=grid_elevation,  # Use passed grid elevation
            periods=periods,
            fetched_at=now,
            expires_at=now + timedelta(hours=settings.BOM_CACHE_TTL_HOURS),
            is_cached=False,
            source="mock"
        )
    
    def calculate_freezing_level(
        self,
        base_temp: float,
        base_elevation: float,
        lapse_rate: float = 0.65
    ) -> int:
        """
        Calculate freezing level from base temperature.
        Section 6.7.2
        """
        if base_temp <= 0:
            return int(base_elevation)
        
        height_to_freeze = (base_temp / lapse_rate) * 100
        return int(base_elevation + height_to_freeze)
    
    def adjust_temp_for_elevation(
        self,
        base_temp: float,
        base_elevation: float,
        target_elevation: float,
        lapse_rate: float = 0.65
    ) -> float:
        """
        Adjust temperature for elevation difference.
        Section 12.2
        """
        elevation_diff = target_elevation - base_elevation
        temp_adjustment = (elevation_diff / 100) * lapse_rate
        return base_temp - temp_adjustment


class BOMAPIError(Exception):
    """BOM API error."""
    pass


# Singleton instance
_bom_service: Optional[BOMService] = None


def get_bom_service() -> BOMService:
    """Get BOM service singleton."""
    global _bom_service
    if _bom_service is None:
        _bom_service = BOMService()
    return _bom_service
