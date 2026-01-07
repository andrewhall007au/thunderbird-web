"""
Forecast Generation Service
Generates formatted forecast messages for users based on their route and position.
"""

import logging
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple
from dataclasses import dataclass

from config.settings import TZ_HOBART
from app.services.bom import get_bom_service, CellForecast
from app.services.formatter import ForecastFormatter, LightCalculator
from app.services.routes import get_route, Route, Waypoint

logger = logging.getLogger(__name__)


@dataclass
class ForecastMessage:
    """A single forecast SMS message."""
    content: str
    segment_num: int
    total_segments: int
    camp_code: Optional[str] = None


class ForecastGenerator:
    """
    Generates forecast messages for a user's trip.
    """
    
    def __init__(self):
        self.bom_service = get_bom_service()
        self.formatter = ForecastFormatter()
    
    async def generate_morning_forecast(
        self,
        route_id: str,
        current_position: Optional[str],
        current_day: int,
        duration_days: int,
        wind_threshold: str = "moderate"
    ) -> List[ForecastMessage]:
        """
        Generate 6AM morning forecast - hourly for today.
        
        Returns list of ForecastMessage objects.
        """
        route = get_route(route_id)
        if not route:
            return [ForecastMessage(
                content=f"Error: Route {route_id} not found",
                segment_num=1,
                total_segments=1
            )]
        
        # Get camps ahead of current position
        camps_ahead = self._get_camps_ahead(route, current_position, current_day)
        if not camps_ahead:
            return [ForecastMessage(
                content="No camps ahead - you may have completed the route!",
                segment_num=1,
                total_segments=1
            )]
        
        messages = []
        
        # Generate hourly forecast for first camp ahead (today's destination)
        target_camp = camps_ahead[0]
        
        try:
            forecast = await self.bom_service.get_hourly_forecast(
                lat=target_camp.lat,
                lon=target_camp.lon,
                hours=12
            )
            
            # Get nearby peaks for this camp
            nearby_peaks = self._get_nearby_peaks(route, target_camp)
            peak_elevation = nearby_peaks[0].elevation if nearby_peaks else route.peak_typical_elevation
            
            # Format hourly forecast
            content = self._format_hourly_message(
                route=route,
                forecast=forecast,
                camp=target_camp,
                peak_elevation=peak_elevation,
                wind_threshold=wind_threshold
            )
            
            messages.append(ForecastMessage(
                content=content,
                segment_num=1,
                total_segments=1,
                camp_code=target_camp.code
            ))
            
        except Exception as e:
            logger.error(f"Error generating hourly forecast: {e}")
            messages.append(ForecastMessage(
                content=f"⚡ Forecast temporarily unavailable. Try again later.",
                segment_num=1,
                total_segments=1
            ))
        
        return messages
    
    async def generate_evening_forecast(
        self,
        route_id: str,
        current_position: Optional[str],
        current_day: int,
        duration_days: int,
        wind_threshold: str = "moderate"
    ) -> List[ForecastMessage]:
        """
        Generate 6PM evening forecast - 7-day summary for camps ahead.
        
        Returns list of ForecastMessage objects (one per weather zone).
        """
        route = get_route(route_id)
        if not route:
            return [ForecastMessage(
                content=f"Error: Route {route_id} not found",
                segment_num=1,
                total_segments=1
            )]
        
        # Get camps ahead of current position
        camps_ahead = self._get_camps_ahead(route, current_position, current_day)
        if not camps_ahead:
            return [ForecastMessage(
                content="No camps ahead - you may have completed the route!",
                segment_num=1,
                total_segments=1
            )]
        
        # Group camps by weather zone (BOM cell)
        zones = self._group_camps_by_zone(camps_ahead)
        
        messages = []
        total = len(zones)
        
        for idx, (zone_id, zone_camps) in enumerate(zones.items(), 1):
            representative_camp = zone_camps[0]
            
            try:
                forecast = await self.bom_service.get_forecast(
                    lat=representative_camp.lat,
                    lon=representative_camp.lon,
                    days=7
                )
                
                # Get nearby peaks for this zone
                nearby_peaks = self._get_peaks_in_zone(route, zone_id)
                peak_elevation = nearby_peaks[0].elevation if nearby_peaks else route.peak_typical_elevation
                
                # Format detailed forecast
                content = self._format_detailed_message(
                    forecast=forecast,
                    camps=zone_camps,
                    peaks=nearby_peaks,
                    camp_elevation=representative_camp.elevation,
                    peak_elevation=peak_elevation,
                    message_num=idx,
                    total_messages=total,
                    wind_threshold=wind_threshold
                )
                
                messages.append(ForecastMessage(
                    content=content,
                    segment_num=idx,
                    total_segments=total,
                    camp_code=representative_camp.code
                ))
                
            except Exception as e:
                logger.error(f"Error generating forecast for zone {zone_id}: {e}")
                messages.append(ForecastMessage(
                    content=f"[{idx}/{total}] Forecast unavailable for {representative_camp.name}",
                    segment_num=idx,
                    total_segments=total
                ))
        
        return messages
    
    def _get_camps_ahead(
        self,
        route: Route,
        current_position: Optional[str],
        current_day: int
    ) -> List[Waypoint]:
        """Get list of camps ahead of current position."""
        if not current_position:
            # If no position set, return all camps
            return route.camps
        
        # Find current position index
        current_idx = -1
        for idx, camp in enumerate(route.camps):
            if camp.code == current_position:
                current_idx = idx
                break
        
        if current_idx == -1:
            # Position not found, return all camps
            return route.camps
        
        # Return camps after current position
        return route.camps[current_idx + 1:]
    
    def _get_nearby_peaks(self, route: Route, camp: Waypoint) -> List[Waypoint]:
        """Get peaks near a camp (same BOM cell)."""
        return [p for p in route.peaks if p.bom_cell == camp.bom_cell]
    
    def _get_peaks_in_zone(self, route: Route, zone_id: str) -> List[Waypoint]:
        """Get all peaks in a weather zone."""
        return [p for p in route.peaks if p.bom_cell == zone_id]
    
    def _group_camps_by_zone(self, camps: List[Waypoint]) -> dict:
        """Group camps by BOM cell/weather zone."""
        zones = {}
        for camp in camps:
            zone_id = camp.bom_cell
            if zone_id not in zones:
                zones[zone_id] = []
            zones[zone_id].append(camp)
        return zones
    
    def _format_hourly_message(
        self,
        route: Route,
        forecast: CellForecast,
        camp: Waypoint,
        peak_elevation: int,
        wind_threshold: str
    ) -> str:
        """Format hourly forecast message using ForecastFormatter."""
        # Use the existing ForecastFormatter - it has proper range formatting
        now = datetime.now(TZ_HOBART)
        
        # Get nearby peaks from route
        nearby_peaks = self._get_nearby_peaks(route, camp)
        peak_names = [p.code for p in nearby_peaks] if nearby_peaks else []
        
        formatted = self.formatter.format_hourly_today(
            forecast=forecast,
            cell_name=camp.name,
            cell_status="current",
            camp_elevation=camp.elevation,
            peak_elevation=peak_elevation,
            camp_names=[camp.code],
            peak_names=peak_names,
            message_num=1,
            total_messages=1,
            start_hour=now.hour,  # Start from current hour
            end_hour=min(now.hour + 12, 23)  # Next 12 hours, max 23
        )
        
        return formatted
    
    def _format_detailed_message(
        self,
        forecast: CellForecast,
        camps: List[Waypoint],
        peaks: List[Waypoint],
        camp_elevation: int,
        peak_elevation: int,
        message_num: int,
        total_messages: int,
        wind_threshold: str
    ) -> str:
        """Format detailed 7-day forecast message."""
        lines = []
        
        # Header
        camp_names = [c.name for c in camps[:3]]  # First 3 camps
        zone_name = camps[0].name if len(camps) == 1 else f"{camps[0].name} area"
        
        lines.append(f"[{message_num}/{total_messages}] {zone_name}")
        
        # Light hours
        light = LightCalculator.get_light_hours(camps[0].lat, camps[0].lon, date.today())
        lines.append(light)
        lines.append("")
        
        # Camp section
        lines.append(f"Camp {camp_elevation}m")
        lines.append("Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        # Format periods for camp level
        prev_day = None
        for period in forecast.periods[:8]:
            day = period.datetime.day
            period_code = self._get_period_code(period.datetime, prev_day == day)
            
            temp_adj = self._adjust_temp_for_elevation(
                period.temp_max,
                forecast.lat,
                camp_elevation
            )
            
            line = (
                f"{period_code}|{temp_adj:.0f}|{period.rain_chance}|"
                f"{period.rain_min:.0f}-{period.rain_max:.0f}|"
                f"{period.snow_min:.0f}-{period.snow_max:.0f}|"
                f"{period.wind_avg}|{period.wind_max}|"
                f"{period.cloud_cover}|"
                f"{period.cloud_base // 100}|"
                f"{period.freezing_level // 100}|"
            )
            danger = self._calculate_danger(period, camp_elevation, wind_threshold)
            line += danger
            lines.append(line)
            prev_day = day
        
        # Camp codes
        camp_codes = ' '.join([c.code for c in camps[:5]])
        lines.append(f"Camps: {camp_codes}")
        lines.append("")
        
        # Peak section
        if peaks:
            lines.append(f"Peak {peak_elevation}m")
            lines.append("Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
            
            prev_day = None
            for period in forecast.periods[:8]:
                day = period.datetime.day
                period_code = self._get_period_code(period.datetime, prev_day == day)
                
                temp_adj = self._adjust_temp_for_elevation(
                    period.temp_max,
                    forecast.lat,
                    peak_elevation
                )
                
                line = (
                    f"{period_code}|{temp_adj:.0f}|{period.rain_chance}|"
                    f"{period.rain_min:.0f}-{period.rain_max:.0f}|"
                    f"{period.snow_min:.0f}-{period.snow_max:.0f}|"
                    f"{period.wind_avg}|{period.wind_max}|"
                    f"{period.cloud_cover}|"
                    f"{period.cloud_base // 100}|"
                    f"{period.freezing_level // 100}|"
                )
                danger = self._calculate_danger(period, peak_elevation, wind_threshold)
                line += danger
                lines.append(line)
                prev_day = day
            
            peak_codes = ' '.join([p.code for p in peaks[:5]])
            lines.append(f"Peaks: {peak_codes}")
        
        return '\n'.join(lines)
    
    def _get_period_code(self, dt: datetime, is_continuation: bool) -> str:
        """Get period code like '7a', 'p', 'n'."""
        hour = dt.hour
        day = dt.day
        
        if hour < 6:
            code = "n"  # night
        elif hour < 12:
            code = "a"  # morning
        elif hour < 18:
            code = "p"  # afternoon
        else:
            code = "n"  # night
        
        if is_continuation:
            return code
        else:
            return f"{day}{code}"
    
    def _adjust_temp_for_elevation(
        self,
        temp: float,
        base_lat: float,
        target_elevation: int,
        base_elevation: int = 500
    ) -> float:
        """Adjust temperature for elevation using lapse rate."""
        # Standard lapse rate: ~6.5°C per 1000m
        lapse_rate = 6.5 / 1000
        elevation_diff = target_elevation - base_elevation
        return temp - (elevation_diff * lapse_rate)
    
    def _calculate_danger(
        self,
        period,
        elevation: int,
        wind_threshold: str
    ) -> str:
        """Calculate danger indicator."""
        danger = ""
        
        # Wind thresholds
        thresholds = {
            "cautious": 40,
            "moderate": 50,
            "experienced": 60
        }
        wind_limit = thresholds.get(wind_threshold, 50)
        
        # Check conditions
        hazards = 0
        
        if period.wind_max >= 70:
            hazards += 2
        elif period.wind_max >= wind_limit:
            hazards += 1
        
        if period.rain_max >= 10:
            hazards += 1
        
        if period.snow_max >= 5:
            hazards += 1
        
        if period.cloud_cover >= 90 and period.cloud_base < elevation:
            hazards += 1  # Whiteout risk
        
        if period.freezing_level < elevation:
            hazards += 1
        
        # Convert to symbols
        if hazards >= 3:
            danger = "!!!"
        elif hazards >= 2:
            danger = "!!"
        elif hazards >= 1:
            danger = "!"
        
        # Thunderstorm indicator
        if period.cape >= 400:
            danger += "|TS!"
        elif period.cape >= 200:
            danger += "|TS?"
        
        return danger


# Singleton instance
_generator = None

def get_forecast_generator() -> ForecastGenerator:
    """Get forecast generator singleton."""
    global _generator
    if _generator is None:
        _generator = ForecastGenerator()
    return _generator
