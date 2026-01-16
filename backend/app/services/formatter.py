"""
Forecast Formatter Service
Based on THUNDERBIRD_SPEC_v2.4 Sections 5, 6
"""

from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from astral import LocationInfo
from astral.sun import sun

from config.settings import settings, DangerThresholds, TZ_HOBART
from app.services.bom import ForecastPeriod, CellForecast


@dataclass
class FormattedPeriod:
    """Single formatted forecast period for SMS."""
    day_label: str  # e.g., "7n", "8a", "p", "n" (lowercase period codes)
    temp_range: str  # e.g., "2-8"
    rain_pct: str  # e.g., "70%"
    rain_range: str  # e.g., "2-8"
    snow_range: str  # e.g., "0-2"
    wind_avg: str  # e.g., "35"
    wind_max: str  # e.g., "48"
    cloud_pct: str  # e.g., "75%"
    cloud_base: str  # e.g., "9"
    freeze_level: str  # e.g., "11"
    danger: str  # e.g., "!", "!!", "!!!"
    thunder: str  # e.g., "", "TS?", "TS!"
    
    def to_line(self) -> str:
        """Format as pipe-separated line."""
        danger_thunder = self.danger
        if self.thunder:
            danger_thunder += f"|{self.thunder}" if self.danger else self.thunder
        
        return (
            f"{self.day_label}|{self.temp_range}|{self.rain_pct}|{self.rain_range}|"
            f"{self.snow_range}|{self.wind_avg}|{self.wind_max}|{self.cloud_pct}|"
            f"{self.cloud_base}|{self.freeze_level}|{danger_thunder}"
        ).rstrip("|")


class DangerCalculator:
    """
    Calculate danger rating from forecast data.
    Section 6.3
    """
    
    def __init__(self, wind_threshold: str = "moderate"):
        # Set wind threshold based on user preference
        thresholds = {
            "cautious": DangerThresholds.WIND_CAUTIOUS,
            "moderate": DangerThresholds.WIND_MODERATE,
            "experienced": DangerThresholds.WIND_EXPERIENCED
        }
        self.wind_warning = thresholds.get(wind_threshold, DangerThresholds.WIND_MODERATE)
    
    def calculate(
        self,
        peak_elev: int,
        freezing_level: int,
        cloud_base: int,
        cloud_pct: int,
        wind_max: int,
        rain_mm: float,
        snow_cm: float,
        cape: int
    ) -> Tuple[str, str]:
        """
        Calculate danger rating and thunderstorm indicator.
        
        Returns: (danger_symbol, thunder_indicator)
        """
        hazards = 0
        thunder = ""
        
        # Ice: peak above freezing level
        if peak_elev > freezing_level:
            hazards += 1
        
        # Blind: peak in cloud with high coverage
        if peak_elev > cloud_base and cloud_pct >= DangerThresholds.CLOUD_BLIND:
            hazards += 1
        
        # Wind: dangerous gusts
        if wind_max >= self.wind_warning:
            hazards += 1
        
        # Precip: significant wet + cold
        if rain_mm >= DangerThresholds.PRECIP_SIGNIFICANT and snow_cm >= DangerThresholds.SNOW_SIGNIFICANT:
            hazards += 1
        
        # Thunderstorm indicator
        if cape >= DangerThresholds.CAPE_HIGH:
            thunder = "TS!"
        elif cape >= DangerThresholds.CAPE_MODERATE:
            thunder = "TS?"
        
        # Extreme wind override
        if wind_max >= DangerThresholds.WIND_EXTREME:
            return "!!!", thunder
        
        # Hazard count to symbol
        if hazards >= 3:
            danger = "!!!"
        elif hazards == 2:
            danger = "!!"
        elif hazards == 1:
            danger = "!"
        else:
            danger = ""
        
        return danger, thunder


class LightCalculator:
    """
    Calculate sunrise/sunset (civil twilight) times.
    Section 6.7.1
    """
    
    @staticmethod
    def get_light_hours(lat: float, lon: float, for_date: date) -> str:
        """
        Calculate light hours for a location.
        
        Returns: "Light HH:MM-HH:MM (Xh Ym)"
        Uses colons in time to prevent iOS auto-linking as phone number.
        """
        location = LocationInfo(
            latitude=lat,
            longitude=lon,
            timezone="Australia/Hobart"
        )
        
        try:
            s = sun(location.observer, date=for_date)
            sunrise = s["sunrise"].astimezone(TZ_HOBART)
            sunset = s["sunset"].astimezone(TZ_HOBART)
            
            # Use colons to prevent iOS auto-linking
            sunrise_str = sunrise.strftime("%H:%M")
            sunset_str = sunset.strftime("%H:%M")
            
            duration = sunset - sunrise
            hours = duration.seconds // 3600
            minutes = (duration.seconds % 3600) // 60
            
            return f"Light {sunrise_str}-{sunset_str} ({hours}h{minutes:02d}m)"
        except Exception:
            # Fallback for edge cases
            return "Light 05:00-21:00"


class ForecastFormatter:
    """
    Format weather forecasts for SMS delivery.
    """
    
    def __init__(self, wind_threshold: str = "moderate"):
        self.danger_calc = DangerCalculator(wind_threshold)
    
    def format_period(
        self,
        period: ForecastPeriod,
        day_number: int,
        is_continuation: bool,
        target_elevation: int,
        is_hourly: bool = False,
        base_elevation: int = 0
    ) -> FormattedPeriod:
        """
        Format a single forecast period.
        
        Args:
            period: Raw forecast period
            day_number: Day of month
            is_continuation: If True, don't include day number
            target_elevation: Elevation to adjust temperature for (camp or peak)
            is_hourly: If True, use hourly format (06, 07, etc.)
            base_elevation: BOM grid point elevation (0 = sea level assumption)
        """
        if is_hourly:
            # For hourly format, period is already "06", "07", etc.
            day_label = period.period
        else:
            # Period code mapping: AM->a, PM->p, N->n (lowercase for clarity)
            period_code = {"AM": "a", "PM": "p", "N": "n"}.get(period.period, period.period.lower())
            
            # Day label
            if is_continuation:
                day_label = period_code
            else:
                day_label = f"{day_number}{period_code}"
        
        # Adjust temperature for elevation using lapse rate (6.5°C per 1000m)
        lapse_rate = 6.5 / 1000
        elevation_diff = target_elevation - base_elevation
        temp_adjustment = elevation_diff * lapse_rate
        
        adjusted_min = period.temp_min - temp_adjustment
        adjusted_max = period.temp_max - temp_adjustment
        
        # Temperature range (adjusted for elevation)
        temp_range = f"{int(adjusted_min)}-{int(adjusted_max)}"
        
        # Rain probability
        rain_pct = f"{period.rain_chance}%"
        
        # Rain range
        rain_range = f"{int(period.rain_min)}-{int(period.rain_max)}"
        
        # Snow range
        snow_range = f"{int(period.snow_min)}-{int(period.snow_max)}"
        
        # Wind
        wind_avg = str(period.wind_avg)
        wind_max = str(period.wind_max)
        
        # Cloud
        cloud_pct = f"{period.cloud_cover}%"
        cloud_base = str(period.cloud_base // 100)  # Convert to display units
        
        # Freezing level
        freeze_level = str(period.freezing_level // 100)  # Convert to display units
        
        # Danger rating (use target elevation for danger calculation)
        danger, thunder = self.danger_calc.calculate(
            peak_elev=target_elevation,
            freezing_level=period.freezing_level,
            cloud_base=period.cloud_base,
            cloud_pct=period.cloud_cover,
            wind_max=period.wind_max,
            rain_mm=period.rain_max,
            snow_cm=period.snow_max,
            cape=period.cape
        )
        
        return FormattedPeriod(
            day_label=day_label,
            temp_range=temp_range,
            rain_pct=rain_pct,
            rain_range=rain_range,
            snow_range=snow_range,
            wind_avg=wind_avg,
            wind_max=wind_max,
            cloud_pct=cloud_pct,
            cloud_base=cloud_base,
            freeze_level=freeze_level,
            danger=danger,
            thunder=thunder
        )
    
    def format_detailed(
        self,
        forecast: CellForecast,
        cell_name: str,
        cell_status: str,
        camp_elevation: int,
        peak_elevation: int,
        camp_names: List[str],
        peak_names: List[str],
        message_num: int,
        total_messages: int
    ) -> str:
        """
        Format detailed forecast (tonight + tomorrow).
        Section 5.5
        """
        lines = []
        
        # Header
        lines.append(f"[{message_num}/{total_messages}] {cell_name} ({cell_status})")
        
        # Light hours
        if forecast.periods:
            first_date = forecast.periods[0].datetime.date()
            light_hours = LightCalculator.get_light_hours(
                forecast.lat, forecast.lon, first_date
            )
            lines.append(light_hours)
        
        lines.append("")  # Blank line
        
        # Camp section
        lines.append(f"Camp {camp_elevation}m")
        lines.append("Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        # Format camp periods (first 4-8 periods)
        prev_day = None
        for period in forecast.periods[:8]:
            day = period.datetime.day
            is_continuation = (prev_day == day)
            
            formatted = self.format_period(
                period, day, is_continuation, camp_elevation,
                base_elevation=forecast.base_elevation
            )
            lines.append(formatted.to_line())
            prev_day = day
        
        lines.append(f"Camps: {' '.join(camp_names)}")
        lines.append("")
        
        # Peak section
        lines.append(f"Peak {peak_elevation}m")
        lines.append("Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        # Format peak periods (adjusted for elevation)
        prev_day = None
        for period in forecast.periods[:8]:
            day = period.datetime.day
            is_continuation = (prev_day == day)
            
            formatted = self.format_period(
                period, day, is_continuation, peak_elevation,
                base_elevation=forecast.base_elevation
            )
            lines.append(formatted.to_line())
            prev_day = day
        
        # Peak names - wrap if too long
        peak_str = ' '.join(peak_names)
        if len(peak_str) > 30:
            # Split into two lines
            mid = len(peak_names) // 2
            lines.append(f"Peaks: {' '.join(peak_names[:mid])}")
            lines.append(f"       {' '.join(peak_names[mid:])}")
        else:
            lines.append(f"Peaks: {peak_str}")
        
        return '\n'.join(lines)
    
    def format_summary(
        self,
        forecast: CellForecast,
        cell_name: str,
        elevation: int,
        location_names: List[str],
        message_num: int,
        total_messages: int
    ) -> str:
        """
        Format 7-day summary.
        Section 5.6
        """
        lines = []
        
        # Header
        lines.append(f"[{message_num}/{total_messages}] {cell_name}")
        lines.append(f"{elevation}m 7-day")
        lines.append("Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        # Get one period per day (use PM for daytime summary)
        daily_periods = {}
        for period in forecast.periods:
            day = period.datetime.date()
            if period.period == "PM" or day not in daily_periods:
                daily_periods[day] = period
        
        # Format up to 7 days
        days_shown = 0
        for day in sorted(daily_periods.keys())[:7]:
            period = daily_periods[day]
            day_num = day.day
            
            formatted = self.format_period(
                period, day_num, False, elevation,
                base_elevation=forecast.base_elevation
            )
            lines.append(formatted.to_line())
            days_shown += 1
        
        lines.append(f"Loc: {' '.join(location_names)}")
        
        return '\n'.join(lines)
    
    def format_return_segment(
        self,
        waypoint_forecasts: List[Tuple[str, CellForecast, int]],
        message_num: int,
        total_messages: int
    ) -> str:
        """
        Format RETURN segment for loop routes.
        Section 5.10
        
        Args:
            waypoint_forecasts: List of (name, forecast, elevation)
        """
        lines = []
        
        lines.append(f"[{message_num}/{total_messages}] RETURN")
        lines.append("Descent waypoint forecasts")
        lines.append("")
        
        for name, forecast, elevation in waypoint_forecasts:
            lines.append(f"{name} ({elevation}m)")
            lines.append("Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
            
            # Get PM periods for each day
            daily_periods = {}
            for period in forecast.periods:
                day = period.datetime.date()
                if period.period == "PM":
                    daily_periods[day] = period
            
            # Show 7 days
            for day in sorted(daily_periods.keys())[:7]:
                period = daily_periods[day]
                formatted = self.format_period(
                    period, day.day, False, elevation,
                    base_elevation=forecast.base_elevation
                )
                lines.append(formatted.to_line())
            
            lines.append("")
        
        return '\n'.join(lines).rstrip()
    
    def format_hourly_today(
        self,
        forecast: CellForecast,
        cell_name: str,
        cell_status: str,
        camp_elevation: int,
        peak_elevation: int,
        camp_names: List[str],
        peak_names: List[str],
        message_num: int,
        total_messages: int,
        start_hour: int = 6,
        end_hour: int = 18
    ) -> str:
        """
        Format hourly forecast for today (6AM push).
        Section 8.4 - TODAY HOURLY format.
        
        Args:
            start_hour: First hour to include (default 6)
            end_hour: Last hour to include (default 18)
        """
        lines = []
        
        # Header
        lines.append(f"[{message_num}/{total_messages}] {cell_name} ({cell_status})")
        
        # Light hours
        if forecast.periods:
            first_date = forecast.periods[0].datetime.date()
            light_hours = LightCalculator.get_light_hours(
                forecast.lat, forecast.lon, first_date
            )
            lines.append(light_hours)
        
        lines.append("")
        
        # Camp section - TODAY HOURLY
        lines.append(f"Camp {camp_elevation}m - TODAY HOURLY")
        lines.append("Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        # Filter to today's hours in range
        today = datetime.now(TZ_HOBART).date()
        for period in forecast.periods:
            if period.datetime.date() == today:
                hour = period.datetime.hour
                if start_hour <= hour <= end_hour:
                    formatted = self.format_period(
                        period, 0, False, camp_elevation, 
                        is_hourly=True, base_elevation=forecast.base_elevation
                    )
                    lines.append(formatted.to_line())
        
        lines.append(f"Camps: {' '.join(camp_names)}")
        lines.append("")
        
        # Peak section - TODAY HOURLY
        lines.append(f"Peak {peak_elevation}m - TODAY HOURLY")
        lines.append("Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        for period in forecast.periods:
            if period.datetime.date() == today:
                hour = period.datetime.hour
                if start_hour <= hour <= end_hour:
                    formatted = self.format_period(
                        period, 0, False, peak_elevation, 
                        is_hourly=True, base_elevation=forecast.base_elevation
                    )
                    lines.append(formatted.to_line())
        
        # Peak names
        peak_str = ' '.join(peak_names)
        if len(peak_str) > 30:
            mid = len(peak_names) // 2
            lines.append(f"Peaks: {' '.join(peak_names[:mid])}")
            lines.append(f"       {' '.join(peak_names[mid:])}")
        else:
            lines.append(f"Peaks: {peak_str}")
        
        return '\n'.join(lines)
    
    def format_cast(
        self,
        forecast: CellForecast,
        waypoint_code: str,
        waypoint_name: str,
        waypoint_elevation: int,
        hours: int = 12
    ) -> str:
        """
        Format on-demand CAST forecast - next N hours from now.
        Shows hourly data for the specified waypoint.
        """
        lines = []
        
        # Header
        lines.append(f"CAST {waypoint_code}")
        lines.append(f"{waypoint_name} ({waypoint_elevation}m)")
        
        # Light hours
        now = datetime.now(TZ_HOBART)
        light_str = LightCalculator.get_light_hours(forecast.lat, forecast.lon, now.date())
        lines.append(light_str)
        lines.append("")
        
        # Column headers
        lines.append("Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        # Get next N hours of forecast data
        current_hour = now.replace(minute=0, second=0, microsecond=0)
        end_time = current_hour + timedelta(hours=hours)
        
        period_count = 0
        for period in forecast.periods:
            # Include periods from now until end_time
            if current_hour <= period.datetime < end_time:
                formatted = self.format_period(
                    period, 0, False, waypoint_elevation,
                    is_hourly=True, base_elevation=forecast.base_elevation
                )
                lines.append(formatted.to_line())
                period_count += 1
        
        if period_count == 0:
            lines.append("(No forecast data available)")
        
        return '\n'.join(lines)
    
    def format_3hourly_tomorrow(
        self,
        forecast: CellForecast,
        cell_name: str,
        cell_status: str,
        camp_elevation: int,
        peak_elevation: int,
        camp_names: List[str],
        peak_names: List[str],
        message_num: int,
        total_messages: int
    ) -> str:
        """
        Format 3-hourly forecast for tomorrow (6PM push).
        Section 5.5 - TOMORROW 3-HOURLY format.
        
        Shows tonight (n) + tomorrow's 3-hourly intervals (06, 09, 12, 15, 18, 21)
        """
        lines = []
        
        # Header
        lines.append(f"[{message_num}/{total_messages}] {cell_name} ({cell_status})")
        
        # Light hours
        if forecast.periods:
            tomorrow = datetime.now(TZ_HOBART).date() + timedelta(days=1)
            light_hours = LightCalculator.get_light_hours(
                forecast.lat, forecast.lon, tomorrow
            )
            lines.append(light_hours)
        
        lines.append("")
        
        # Camp section - TOMORROW 3-HOURLY
        lines.append(f"Camp {camp_elevation}m - TOMORROW 3-HOURLY")
        lines.append("Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        # Get relevant periods: tonight's night + tomorrow's 3-hourly
        today = datetime.now(TZ_HOBART).date()
        tomorrow = today + timedelta(days=1)
        
        # Filter and format periods
        for period in forecast.periods:
            period_date = period.datetime.date()
            hour = period.datetime.hour
            
            # Tonight's night period
            if period_date == today and period.period == "N" and hour >= 18:
                day_label = f"{today.day}n"
                lines.append(self._format_3hourly_period(period, day_label, camp_elevation))
            # Tomorrow's 3-hourly (06, 09, 12, 15, 18, 21)
            elif period_date == tomorrow and hour in [6, 9, 12, 15, 18, 21]:
                if hour == 6:
                    day_label = f"{tomorrow.day}/06"
                else:
                    day_label = f"{hour:02d}"
                lines.append(self._format_3hourly_period(period, day_label, camp_elevation))
        
        lines.append(f"Camps: {' '.join(camp_names)}")
        lines.append("")
        
        # Peak section - TOMORROW 3-HOURLY
        lines.append(f"Peak {peak_elevation}m - TOMORROW 3-HOURLY")
        lines.append("Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        for period in forecast.periods:
            period_date = period.datetime.date()
            hour = period.datetime.hour
            
            if period_date == today and period.period == "N" and hour >= 18:
                day_label = f"{today.day}n"
                lines.append(self._format_3hourly_period(period, day_label, peak_elevation))
            elif period_date == tomorrow and hour in [6, 9, 12, 15, 18, 21]:
                if hour == 6:
                    day_label = f"{tomorrow.day}/06"
                else:
                    day_label = f"{hour:02d}"
                lines.append(self._format_3hourly_period(period, day_label, peak_elevation))
        
        # Peak names
        peak_str = ' '.join(peak_names)
        if len(peak_str) > 30:
            mid = len(peak_names) // 2
            lines.append(f"Peaks: {' '.join(peak_names[:mid])}")
            lines.append(f"       {' '.join(peak_names[mid:])}")
        else:
            lines.append(f"Peaks: {peak_str}")
        
        return '\n'.join(lines)
    
    def _format_3hourly_period(
        self,
        period: ForecastPeriod,
        day_label: str,
        elevation: int
    ) -> str:
        """Helper to format a single 3-hourly period with custom day label."""
        danger, thunder = self.danger_calc.calculate(
            peak_elev=elevation,
            freezing_level=period.freezing_level,
            cloud_base=period.cloud_base,
            cloud_pct=period.cloud_cover,
            wind_max=period.wind_max,
            rain_mm=period.rain_max,
            snow_cm=period.snow_max,
            cape=period.cape
        )
        
        danger_thunder = danger
        if thunder:
            danger_thunder += f"|{thunder}" if danger else thunder
        
        return (
            f"{day_label}|{int(period.temp_min)}-{int(period.temp_max)}|"
            f"{period.rain_chance}%|{int(period.rain_min)}-{int(period.rain_max)}|"
            f"{int(period.snow_min)}-{int(period.snow_max)}|"
            f"{period.wind_avg}|{period.wind_max}|"
            f"{period.cloud_cover}%|{period.cloud_base // 100}|"
            f"{period.freezing_level // 100}|{danger_thunder}"
        ).rstrip("|")
    
    def format_forecast_command(
        self,
        camp_forecast: CellForecast,
        peak_forecast: CellForecast,
        camp_name: str,
        peak_name: str,
        camp_elevation: int,
        peak_elevation: int,
        hours: int = 12
    ) -> str:
        """
        Format FORECAST command response (next 12 hours hourly).
        Section 8.7.2
        """
        lines = []
        now = datetime.now(TZ_HOBART)
        
        # Header
        lines.append("THUNDERBIRD ⚡ NEXT 12HRS")
        lines.append(now.strftime("%a %d %b %H:%M"))
        lines.append("")
        
        # Camp section
        lines.append(f"{camp_name} Camp {camp_elevation}m")
        lines.append("Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        count = 0
        for period in camp_forecast.periods:
            if period.datetime >= now and count < hours:
                formatted = self.format_period(
                    period, 0, False, camp_elevation, 
                    is_hourly=True, base_elevation=camp_forecast.base_elevation
                )
                lines.append(formatted.to_line())
                count += 1
        
        lines.append("")
        
        # Peak section
        lines.append(f"{peak_name} Peak {peak_elevation}m (nearest)")
        lines.append("Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D")
        
        count = 0
        for period in peak_forecast.periods:
            if period.datetime >= now and count < hours:
                formatted = self.format_period(
                    period, 0, False, peak_elevation, 
                    is_hourly=True, base_elevation=peak_forecast.base_elevation
                )
                lines.append(formatted.to_line())
                count += 1
        
        # Weather window summary
        lines.append("")
        lines.append(self._get_weather_window_summary(camp_forecast, peak_forecast, hours))
        
        return '\n'.join(lines)
    
    def _get_weather_window_summary(
        self,
        camp_forecast: CellForecast,
        peak_forecast: CellForecast,
        hours: int
    ) -> str:
        """Generate a brief weather window summary."""
        now = datetime.now(TZ_HOBART)
        
        # Find periods with improving conditions
        improving_hour = None
        for period in peak_forecast.periods:
            if period.datetime >= now:
                # Check if conditions are easing
                if period.wind_max < 40 and period.rain_chance < 40:
                    improving_hour = period.datetime.hour
                    break
        
        if improving_hour is not None:
            if improving_hour <= now.hour + 2:
                return "Window: Good conditions now"
            else:
                return f"Window: Conditions easing from {improving_hour}:00"
        else:
            return "Window: Monitor conditions closely"


# Helper function for adjusting temperature
def adjust_temp_for_elevation(
    base_temp: float,
    base_elev: float,
    target_elev: float,
    lapse_rate: float = 0.65
) -> float:
    """Adjust temperature for elevation using lapse rate."""
    elevation_diff = target_elev - base_elev
    temp_adjustment = (elevation_diff / 100) * lapse_rate
    return base_temp - temp_adjustment

# =============================================================================

# =============================================================================
# V3.0 FORMATTER ADDITIONS - Add to end of formatter.py
# =============================================================================

# Precipitation Formatting (Prec column - v3.0)
def format_precipitation(min_val: int, max_val: int, is_snow: bool = False) -> str:
    """
    Format precipitation as R#-# (rain mm) or S#-# (snow cm).
    v3.0 merged Rn and Sn columns into single Prec column.
    """
    prefix = "S" if is_snow else "R"
    return f"{prefix}{min_val}-{max_val}"


def determine_precip_type(elevation: int, freezing_level: int) -> str:
    """
    Determine precipitation type based on elevation vs freezing level.
    Returns: "rain", "snow", or "mixed"
    """
    if freezing_level > elevation + 200:
        return "rain"
    elif freezing_level < elevation - 100:
        return "snow"
    return "snow"  # Default to snow for safety


# Wind Direction Formatting (Wd column - v3.0)
COMPASS_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def format_wind_direction(degrees) -> str:
    """
    Convert wind direction degrees to compass direction.
    Returns: N, NE, E, SE, S, SW, W, NW
    
    Handles both numeric degrees and string direction inputs.
    """
    # Handle string input (already a direction)
    if isinstance(degrees, str):
        return degrees.upper()
    
    # Handle numeric input
    try:
        degrees = int(degrees) % 360
        index = round(degrees / 45) % 8
        return COMPASS_DIRECTIONS[index]
    except (ValueError, TypeError):
        return "W"  # Default to westerly


def is_unusual_wind_direction(direction: str) -> bool:
    """
    Check if wind direction is unusual for Tasmania.
    Tasmania is in Roaring Forties - westerly winds are normal.
    """
    normal_directions = {"W", "NW", "SW"}
    return direction.upper() not in normal_directions


# Column Headers (v3.0 - no CB column)
def get_forecast_header() -> str:
    """
    Get column header for hourly forecast.
    v3.0: Added Prec, Wd. Removed CB.
    """
    return "Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|FL|D"


def get_daily_header() -> str:
    """Get column header for daily forecast."""
    return "Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|FL|D"


# GSM-7 Safety
GSM7_UNSAFE = set("°€£¥©®←→↑↓∞≠≤≥÷×¿¡")


def is_gsm7_safe(char: str) -> bool:
    """Check if character is safe for GSM-7 encoding."""
    return char not in GSM7_UNSAFE


def format_temperature(temp: int) -> str:
    """Format temperature without degree symbol (GSM-7 safe)."""
    return str(temp)


# V3.0 Formatters
class FormatCAST12:
    """Format 12-hour hourly forecast."""
    
    @staticmethod
    def format(location_name: str, elevation: int, forecast_data: dict, date) -> str:
        """Format 12-hour forecast as single message (~450 chars)."""
        lines = []
        date_str = date.strftime("%d/%m")
        lines.append(f"{location_name} {elevation}m {date_str}")
        lines.append(get_forecast_header())
        
        periods = forecast_data.get("periods", [])[:12]
        for i, period in enumerate(periods):
            # Extract hour from time string or use index
            time_val = period.get("time", "")
            if isinstance(time_val, str) and len(time_val) >= 13:
                hour = int(time_val[11:13])
            else:
                hour = i  # Fallback to index
            
            # Determine precip type
            fl = period.get("freezing_level", 2000)
            if isinstance(fl, str):
                try:
                    fl = int(fl)
                except ValueError:
                    fl = 2000
            
            precip_type = determine_precip_type(elevation, fl)
            
            if precip_type == "snow":
                prec = format_precipitation(
                    int(period.get("snow_min", 0)),
                    int(period.get("snow_max", 0)),
                    is_snow=True
                )
            else:
                prec = format_precipitation(
                    int(period.get("rain_min", 0)),
                    int(period.get("rain_max", 0)),
                    is_snow=False
                )
            
            wd = format_wind_direction(period.get("wind_direction", 270))
            
            row = (
                f"{hour:02d}|"
                f"{period.get('temp_min', 0)}-{period.get('temp_max', 10)}|"
                f"{period.get('rain_chance', 0)}%|"
                f"{prec}|"
                f"{period.get('wind_avg', 0)}|"
                f"{period.get('wind_max', 0)}|"
                f"{wd}|"
                f"{period.get('cloud_cover', 0)}%|"
                f"{fl // 100}|"
                f"{period.get('danger', '')}"
            )
            lines.append(row)
        
        return "\n".join(lines)


class FormatCAST24:
    """Format 24-hour hourly forecast."""
    
    @staticmethod
    def format(location_name: str, elevation: int, forecast_data: dict, date) -> str:
        """Format as single long string."""
        lines = []
        date_str = date.strftime("%d/%m")
        lines.append(f"{location_name} {elevation}m {date_str}")
        lines.append(get_forecast_header())
        
        periods = forecast_data.get("periods", [])[:24]
        for i, period in enumerate(periods):
            time_val = period.get("time", "")
            if isinstance(time_val, str) and len(time_val) >= 13:
                hour = int(time_val[11:13])
            else:
                hour = i
            
            fl = period.get("freezing_level", 2000)
            if isinstance(fl, str):
                try:
                    fl = int(fl)
                except ValueError:
                    fl = 2000
            
            precip_type = determine_precip_type(elevation, fl)
            
            if precip_type == "snow":
                prec = format_precipitation(
                    int(period.get("snow_min", 0)),
                    int(period.get("snow_max", 0)),
                    is_snow=True
                )
            else:
                prec = format_precipitation(
                    int(period.get("rain_min", 0)),
                    int(period.get("rain_max", 0)),
                    is_snow=False
                )
            
            wd = format_wind_direction(period.get("wind_direction", 270))
            
            row = (
                f"{hour:02d}|"
                f"{period.get('temp_min', 0)}-{period.get('temp_max', 10)}|"
                f"{period.get('rain_chance', 0)}%|"
                f"{prec}|"
                f"{period.get('wind_avg', 0)}|"
                f"{period.get('wind_max', 0)}|"
                f"{wd}|"
                f"{period.get('cloud_cover', 0)}%|"
                f"{fl // 100}|"
                f"{period.get('danger', '')}"
            )
            lines.append(row)
        
        return "\n".join(lines)
    
    @staticmethod
    def format_multi(location_name: str, elevation: int, forecast_data: dict, date) -> list:
        """Format as multiple SMS messages."""
        full = FormatCAST24.format(location_name, elevation, forecast_data, date)
        
        messages = []
        lines = full.split("\n")
        
        current = []
        current_len = 0
        part = 1
        
        for line in lines:
            if current_len + len(line) + 1 > 400 and current:
                messages.append("\n".join(current))
                current = []
                current_len = 0
                part += 1
            current.append(line)
            current_len += len(line) + 1
        
        if current:
            messages.append("\n".join(current))
        
        # Add part numbers
        total = len(messages)
        messages = [f"[{i+1}/{total}]\n{m}" for i, m in enumerate(messages)]
        
        return messages


class FormatCAST7:
    """Format 7-day camp summary."""
    
    @staticmethod
    def format(route_name: str, forecast_data: dict, start_date=None, date=None) -> str:
        """
        Format 7-day summary for all camps.
        
        forecast_data structure:
        {
            "LAKEO": [
                {"day": "Mon", "date": "15/01", "temp": "5-12", ...},
                ...
            ],
            ...
        }
        """
        lines = [f"{route_name} 7-DAY FORECAST"]
        lines.append(get_daily_header())
        
        # Generate 7 day labels
        from datetime import timedelta
        if start_date is None:
            start_date = date
        day_labels = []
        # Use date param if start_date not provided
        if start_date is None:
            start_date = date
        for i in range(7):
            d = start_date + timedelta(days=i)
            day_labels.append(d.strftime("%a"))  # Mon, Tue, etc.
        
        for camp_code, days in forecast_data.items():
            lines.append(f"\n{camp_code}:")
            for i, day in enumerate(days[:7]):
                if isinstance(day, dict):
                    # Full day data
                    day_label = day.get("day", day_labels[i] if i < len(day_labels) else f"D{i+1}")
                    tmp = day.get("temp", day.get("temp_range", "?-?"))
                    rn = day.get("rain_chance", day.get("%rn", "?"))
                    prec = day.get("prec", "R0-0")
                    wa = day.get("wind_avg", day.get("wa", "?"))
                    wm = day.get("wind_max", day.get("wm", "?"))
                    wd = day.get("wind_dir", day.get("wd", "W"))
                    cd = day.get("cloud", day.get("%cd", "?"))
                    fl = day.get("freezing_level", day.get("fl", "?"))
                    d = day.get("danger", day.get("d", ""))
                    
                    lines.append(f"  {day_label}|{tmp}|{rn}%|{prec}|{wa}|{wm}|{wd}|{cd}%|{fl}|{d}")
                else:
                    # Simple day marker
                    lines.append(f"  {day_labels[i] if i < len(day_labels) else f'D{i+1}'}|?|?|?|?|?|?|?|?|")
        
        return "\n".join(lines)
    
    @staticmethod
    def format_multi(route_name: str, forecast_data: dict, start_date=None, date=None) -> list:
        """Format as multiple messages if needed."""
        full = FormatCAST7.format(route_name, forecast_data, start_date=start_date, date=date)
        
        # Split by camp if too long
        if len(full) <= 450:
            return [full]
        
        messages = []
        lines = full.split("\n")
        
        current = [lines[0], lines[1]]  # Header
        current_len = len(lines[0]) + len(lines[1]) + 2
        
        for line in lines[2:]:
            if line.startswith("\n") or (current_len + len(line) > 400 and len(current) > 2):
                if current:
                    messages.append("\n".join(current))
                current = [lines[0], lines[1]]  # Repeat header
                current_len = len(lines[0]) + len(lines[1]) + 2
            current.append(line)
            current_len += len(line) + 1
        
        if current and len(current) > 2:
            messages.append("\n".join(current))
        
        # Add part numbers
        total = len(messages)
        if total > 1:
            messages = [f"[{i+1}/{total}]\n{m}" for i, m in enumerate(messages)]
        
        return messages


class FormatPEAKS:
    """Format 7-day peak summary."""
    
    @staticmethod
    def format(route_name: str, forecast_data: dict, start_date=None, date=None) -> str:
        """
        Format 7-day peaks summary with FL column.
        
        Shows freezing level prominently since that's key for peaks.
        """
        lines = [f"{route_name} PEAKS 7-DAY"]
        lines.append("Peak|Day|FL|Wm|D")
        
        from datetime import timedelta
        if start_date is None:
            start_date = date
        
        for peak_code, days in forecast_data.items():
            for i, day in enumerate(days[:7]):
                d = start_date + timedelta(days=i)
                day_label = d.strftime("%a")
                
                if isinstance(day, dict):
                    fl = day.get("freezing_level", day.get("fl", "?"))
                    wm = day.get("wind_max", day.get("wm", "?"))
                    danger = day.get("danger", day.get("d", ""))
                    lines.append(f"{peak_code}|{day_label}|{fl}|{wm}|{danger}")
                else:
                    lines.append(f"{peak_code}|{day_label}|?|?|")
        
        return "\n".join(lines)
