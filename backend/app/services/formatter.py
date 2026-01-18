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
        v3.1: Uses combined Prec column (R#-#/S#-#), Wd, and CB columns.
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

        # Column headers - v3.1 format with Prec, Wd, CB
        lines.append(get_forecast_header())

        # Get next N hours of forecast data
        current_hour = now.replace(minute=0, second=0, microsecond=0)
        end_time = current_hour + timedelta(hours=hours)

        period_count = 0
        for period in forecast.periods:
            # Include periods from now until end_time
            if current_hour <= period.datetime < end_time:
                hour = period.datetime.hour

                # Combined precipitation column (R#-#/S#-#)
                prec = format_precipitation_combined(
                    rain_min=int(period.rain_min),
                    rain_max=int(period.rain_max),
                    snow_min=int(period.snow_min),
                    snow_max=int(period.snow_max)
                )

                # Wind direction
                wd = format_wind_direction(getattr(period, 'wind_direction', 270))

                # Cloud base (convert m to hundreds)
                cb = period.cloud_base // 100 if period.cloud_base else 12

                # Freezing level (convert m to hundreds)
                fl = period.freezing_level // 100 if period.freezing_level else 20

                # Danger indicator
                danger = self._calculate_danger(period, waypoint_elevation)

                row = (
                    f"{hour:02d}|"
                    f"{int(period.temp_min)}-{int(period.temp_max)}|"
                    f"{period.rain_chance}%|"
                    f"{prec}|"
                    f"{period.wind_avg}|"
                    f"{period.wind_max}|"
                    f"{wd}|"
                    f"{period.cloud_cover}%|"
                    f"{cb}|"
                    f"{fl}|"
                    f"{danger}"
                )
                lines.append(row)
                period_count += 1

        if period_count == 0:
            lines.append("(No forecast data available)")

        return '\n'.join(lines)

    def _calculate_danger(self, period, elevation: int) -> str:
        """Calculate danger indicator for a period."""
        danger_level = 0

        # Wind danger
        if period.wind_max >= 80:
            danger_level = 3
        elif period.wind_max >= 60:
            danger_level = max(danger_level, 2)
        elif period.wind_max >= 45:
            danger_level = max(danger_level, 1)

        # Cold + wet danger (hypothermia risk)
        if period.temp_max < 5 and period.rain_chance > 50:
            danger_level = max(danger_level, 2)
        elif period.temp_max < 8 and period.rain_chance > 70:
            danger_level = max(danger_level, 1)

        # Snow + elevation danger
        if period.snow_max > 0 and elevation > 1000:
            danger_level = max(danger_level, 1)
        if period.snow_max > 5:
            danger_level = max(danger_level, 2)

        # Freezing level danger
        if period.freezing_level and period.freezing_level < elevation:
            danger_level = max(danger_level, 1)

        return "!" * danger_level if danger_level else ""

    def format_7day(
        self,
        forecast,
        waypoint_code: str,
        waypoint_name: str,
        waypoint_elevation: int
    ) -> str:
        """
        Format 7-day daily forecast for CAST7 command.
        Shows daily summary for a single location.
        """
        lines = []

        # Header
        lines.append(f"CAST7 {waypoint_code}")
        lines.append(f"{waypoint_name} ({waypoint_elevation}m)")
        lines.append("7-Day Forecast")
        lines.append("")

        # Column headers for daily
        lines.append("Day|Tmp|%Rn|Prec|Wa|Wm|%Cd|FL")

        # Get daily periods (typically daily forecasts have one period per day)
        if hasattr(forecast, 'daily_periods') and forecast.daily_periods:
            for period in forecast.daily_periods[:7]:
                day_label = period.datetime.strftime("%a")
                temp_str = f"{int(period.temp_min)}-{int(period.temp_max)}"
                rain_pct = period.rain_chance

                # Precipitation
                if period.snow_max > 0:
                    prec = f"S{int(period.snow_min)}-{int(period.snow_max)}"
                elif period.rain_max > 0:
                    prec = f"R{int(period.rain_min)}-{int(period.rain_max)}"
                else:
                    prec = "-"

                fl = period.freezing_level // 100 if period.freezing_level else "-"

                line = f"{day_label}|{temp_str}|{rain_pct}%|{prec}|{period.wind_avg}|{period.wind_max}|{period.cloud_cover}%|{fl}"
                lines.append(line)
        elif hasattr(forecast, 'periods') and forecast.periods:
            # Fall back to hourly periods, group by day
            from collections import defaultdict
            daily_data = defaultdict(list)
            for period in forecast.periods:
                day_key = period.datetime.strftime("%a")
                daily_data[day_key].append(period)

            for day_label, periods in list(daily_data.items())[:7]:
                if not periods:
                    continue
                temp_min = min(p.temp_min for p in periods)
                temp_max = max(p.temp_max for p in periods)
                rain_pct = max(p.rain_chance for p in periods)
                rain_max = max(p.rain_max for p in periods)
                snow_max = max(p.snow_max for p in periods)
                wind_avg = int(sum(p.wind_avg for p in periods) / len(periods))
                wind_max = max(p.wind_max for p in periods)
                cloud = int(sum(p.cloud_cover for p in periods) / len(periods))
                fl_vals = [p.freezing_level for p in periods if p.freezing_level]
                fl = min(fl_vals) // 100 if fl_vals else "-"

                if snow_max > 0:
                    prec = f"S0-{int(snow_max)}"
                elif rain_max > 0:
                    prec = f"R0-{int(rain_max)}"
                else:
                    prec = "-"

                line = f"{day_label}|{int(temp_min)}-{int(temp_max)}|{rain_pct}%|{prec}|{wind_avg}|{wind_max}|{cloud}%|{fl}"
                lines.append(line)
        else:
            lines.append("(No forecast data available)")

        return '\n'.join(lines)

    def format_7day_summary(
        self,
        forecast,
        waypoint_code: str,
        waypoint_name: str
    ) -> str:
        """
        Format a one-line 7-day summary for CAST7 CAMPS/PEAKS.
        Returns: "LAKEO: 5-15C 40% R0-5"
        """
        if hasattr(forecast, 'daily_periods') and forecast.daily_periods:
            periods = forecast.daily_periods[:7]
        elif hasattr(forecast, 'periods') and forecast.periods:
            periods = forecast.periods
        else:
            return f"{waypoint_code}: No data"

        if not periods:
            return f"{waypoint_code}: No data"

        # Aggregate over 7 days
        temp_min = min(p.temp_min for p in periods)
        temp_max = max(p.temp_max for p in periods)
        rain_pct = max(p.rain_chance for p in periods)
        rain_max = max(p.rain_max for p in periods)
        snow_max = max(getattr(p, 'snow_max', 0) for p in periods)

        if snow_max > 0:
            prec = f"S{int(snow_max)}"
        elif rain_max > 0:
            prec = f"R{int(rain_max)}"
        else:
            prec = "-"

        return f"{waypoint_code}: {int(temp_min)}-{int(temp_max)}C {rain_pct}% {prec}"

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

# Precipitation Formatting (Prec column - v3.1)
def format_precipitation(min_val: int, max_val: int, is_snow: bool = False) -> str:
    """
    Format precipitation as R#-# (rain mm) or S#-# (snow cm).
    Legacy function for backwards compatibility.
    """
    prefix = "S" if is_snow else "R"
    return f"{prefix}{min_val}-{max_val}"


def format_precipitation_combined(
    rain_min: int, rain_max: int,
    snow_min: int, snow_max: int
) -> str:
    """
    Format precipitation showing both rain and snow if present.
    v3.1: Shows both when significant precipitation of each type.

    Returns:
        "R2-4"    - rain only
        "S1-2"    - snow only
        "R2/S1"   - both (rain mm / snow cm, max values only for brevity)
        "-"       - no precipitation
    """
    has_rain = rain_max > 0
    has_snow = snow_max > 0

    if has_rain and has_snow:
        # Both present - show compact format with max values
        return f"R{rain_max}/S{snow_max}"
    elif has_snow:
        return f"S{snow_min}-{snow_max}"
    elif has_rain:
        return f"R{rain_min}-{rain_max}"
    else:
        return "-"


def determine_precip_type(elevation: int, freezing_level: int) -> str:
    """
    Determine likely precipitation type based on elevation vs freezing level.
    Returns: "rain", "snow", or "mixed"

    Note: This is used for forecasting likely type, but actual precip
    should use format_precipitation_combined() to show both if present.
    """
    if freezing_level > elevation + 200:
        return "rain"
    elif freezing_level < elevation - 100:
        return "snow"
    return "mixed"  # Near freezing level - could be either


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


# Column Headers (v3.1 - CB reinstated for alpine safety)
def get_forecast_header() -> str:
    """
    Get column header for hourly forecast.
    v3.1: CB reinstated - critical for alpine safety (in-cloud conditions).
    """
    return "Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D"


def get_daily_header() -> str:
    """Get column header for daily forecast."""
    return "Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D"


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
            
            # Get freezing level
            fl = period.get("freezing_level", 2000)
            if isinstance(fl, str):
                try:
                    fl = int(fl)
                except ValueError:
                    fl = 2000

            # Format precipitation - show both rain and snow if present
            prec = format_precipitation_combined(
                rain_min=int(period.get("rain_min", 0)),
                rain_max=int(period.get("rain_max", 0)),
                snow_min=int(period.get("snow_min", 0)),
                snow_max=int(period.get("snow_max", 0))
            )

            wd = format_wind_direction(period.get("wind_direction", 270))
            cb = period.get("cloud_base", 1200)
            if isinstance(cb, str):
                try:
                    cb = int(cb)
                except ValueError:
                    cb = 1200

            row = (
                f"{hour:02d}|"
                f"{period.get('temp_min', 0)}-{period.get('temp_max', 10)}|"
                f"{period.get('rain_chance', 0)}%|"
                f"{prec}|"
                f"{period.get('wind_avg', 0)}|"
                f"{period.get('wind_max', 0)}|"
                f"{wd}|"
                f"{period.get('cloud_cover', 0)}%|"
                f"{cb // 100}|"
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

            # Format precipitation - show both rain and snow if present
            prec = format_precipitation_combined(
                rain_min=int(period.get("rain_min", 0)),
                rain_max=int(period.get("rain_max", 0)),
                snow_min=int(period.get("snow_min", 0)),
                snow_max=int(period.get("snow_max", 0))
            )

            wd = format_wind_direction(period.get("wind_direction", 270))
            cb = period.get("cloud_base", 1200)
            if isinstance(cb, str):
                try:
                    cb = int(cb)
                except ValueError:
                    cb = 1200

            row = (
                f"{hour:02d}|"
                f"{period.get('temp_min', 0)}-{period.get('temp_max', 10)}|"
                f"{period.get('rain_chance', 0)}%|"
                f"{prec}|"
                f"{period.get('wind_avg', 0)}|"
                f"{period.get('wind_max', 0)}|"
                f"{wd}|"
                f"{period.get('cloud_cover', 0)}%|"
                f"{cb // 100}|"
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
                    cb = day.get("cloud_base", day.get("cb", "?"))
                    fl = day.get("freezing_level", day.get("fl", "?"))
                    d = day.get("danger", day.get("d", ""))

                    lines.append(f"  {day_label}|{tmp}|{rn}%|{prec}|{wa}|{wm}|{wd}|{cd}%|{cb}|{fl}|{d}")
                else:
                    # Simple day marker
                    lines.append(f"  {day_labels[i] if i < len(day_labels) else f'D{i+1}'}|?|?|?|?|?|?|?|?|?|")
        
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


# =============================================================================
# DYNAMIC GROUPING - v3.2
# Groups camps/peaks with similar weather to reduce SMS payload
# =============================================================================

# Grouping thresholds (absolute values)
GROUPING_THRESHOLD_TEMP = 2      # ±2°C
GROUPING_THRESHOLD_RAIN = 2      # ±2mm
GROUPING_THRESHOLD_WIND = 5      # ±5km/h


@dataclass
class WeatherMetrics:
    """Key weather metrics for a location over 7 days."""
    location_code: str
    temp_min: float
    temp_max: float
    rain_max: float
    wind_max: float

    def is_similar_to(self, other: 'WeatherMetrics') -> bool:
        """Check if this location's weather is similar to another."""
        temp_diff = abs((self.temp_min + self.temp_max) / 2 -
                       (other.temp_min + other.temp_max) / 2)
        rain_diff = abs(self.rain_max - other.rain_max)
        wind_diff = abs(self.wind_max - other.wind_max)

        return (temp_diff <= GROUPING_THRESHOLD_TEMP and
                rain_diff <= GROUPING_THRESHOLD_RAIN and
                wind_diff <= GROUPING_THRESHOLD_WIND)


def extract_weather_metrics(location_code: str, forecast_days: list) -> WeatherMetrics:
    """Extract key weather metrics from 7-day forecast data."""
    if not forecast_days:
        return WeatherMetrics(location_code, 0, 0, 0, 0)

    temp_mins = []
    temp_maxs = []
    rain_maxs = []
    wind_maxs = []

    for day in forecast_days[:7]:
        if isinstance(day, dict):
            # Handle various key formats
            temp_str = day.get("temp", day.get("temp_range", "0-0"))
            if isinstance(temp_str, str) and "-" in temp_str:
                parts = temp_str.split("-")
                try:
                    temp_mins.append(float(parts[0]))
                    temp_maxs.append(float(parts[1]))
                except (ValueError, IndexError):
                    pass

            # Rain - extract max from range or direct value
            rain = day.get("rain_max", day.get("rain", 0))
            if isinstance(rain, str):
                # Handle "R0-5" format
                if "-" in rain:
                    try:
                        rain = float(rain.split("-")[1])
                    except (ValueError, IndexError):
                        rain = 0
                else:
                    try:
                        rain = float(rain.replace("R", "").replace("S", ""))
                    except ValueError:
                        rain = 0
            rain_maxs.append(float(rain))

            # Wind max
            wm = day.get("wind_max", day.get("wm", 0))
            try:
                wind_maxs.append(float(wm))
            except (ValueError, TypeError):
                pass

    return WeatherMetrics(
        location_code=location_code,
        temp_min=min(temp_mins) if temp_mins else 0,
        temp_max=max(temp_maxs) if temp_maxs else 0,
        rain_max=max(rain_maxs) if rain_maxs else 0,
        wind_max=max(wind_maxs) if wind_maxs else 0
    )


def group_locations_by_weather(forecast_data: dict) -> List[List[str]]:
    """
    Group locations with similar weather conditions.

    Returns list of groups, where each group is a list of location codes
    that have similar weather (within thresholds).
    """
    # Extract metrics for all locations
    metrics = {}
    for loc_code, days in forecast_data.items():
        metrics[loc_code] = extract_weather_metrics(loc_code, days)

    # Group similar locations using simple clustering
    ungrouped = set(metrics.keys())
    groups = []

    while ungrouped:
        # Start a new group with first ungrouped location
        current = ungrouped.pop()
        group = [current]

        # Find all similar locations
        to_check = list(ungrouped)
        for loc in to_check:
            if metrics[current].is_similar_to(metrics[loc]):
                group.append(loc)
                ungrouped.remove(loc)

        groups.append(sorted(group))

    return groups


def get_group_representative_forecast(group: List[str], forecast_data: dict) -> list:
    """
    Get representative forecast for a group by averaging metrics.
    Uses the first location's structure, averaged with others.
    """
    if not group or not forecast_data:
        return []

    # Use first location as template
    template_days = forecast_data.get(group[0], [])
    if not template_days:
        return []

    result = []
    num_days = min(7, len(template_days))

    for day_idx in range(num_days):
        day_data = {}

        # Collect values from all locations in group for this day
        temps_min, temps_max = [], []
        rain_chances, rain_maxs = [], []
        wind_avgs, wind_maxs = [], []
        cloud_covers, cloud_bases = [], []
        freezing_levels = []

        for loc in group:
            days = forecast_data.get(loc, [])
            if day_idx < len(days) and isinstance(days[day_idx], dict):
                day = days[day_idx]

                # Parse temperature
                temp_str = day.get("temp", day.get("temp_range", "0-0"))
                if isinstance(temp_str, str) and "-" in temp_str:
                    parts = temp_str.split("-")
                    try:
                        temps_min.append(float(parts[0]))
                        temps_max.append(float(parts[1]))
                    except (ValueError, IndexError):
                        pass

                # Rain chance
                rc = day.get("rain_chance", day.get("%rn", 0))
                try:
                    rain_chances.append(int(str(rc).replace("%", "")))
                except ValueError:
                    pass

                # Rain max
                prec = day.get("prec", day.get("rain", "0"))
                if isinstance(prec, str):
                    if "-" in prec:
                        try:
                            rain_maxs.append(float(prec.split("-")[1]))
                        except (ValueError, IndexError):
                            rain_maxs.append(0)
                    else:
                        try:
                            rain_maxs.append(float(prec.replace("R", "").replace("S", "").replace("-", "")))
                        except ValueError:
                            rain_maxs.append(0)
                else:
                    rain_maxs.append(float(prec) if prec else 0)

                # Wind
                try:
                    wind_avgs.append(int(day.get("wind_avg", day.get("wa", 0))))
                except (ValueError, TypeError):
                    pass
                try:
                    wind_maxs.append(int(day.get("wind_max", day.get("wm", 0))))
                except (ValueError, TypeError):
                    pass

                # Cloud
                try:
                    cloud_covers.append(int(str(day.get("cloud", day.get("%cd", 0))).replace("%", "")))
                except (ValueError, TypeError):
                    pass
                try:
                    cloud_bases.append(int(day.get("cloud_base", day.get("cb", 12))))
                except (ValueError, TypeError):
                    pass

                # Freezing level
                try:
                    freezing_levels.append(int(day.get("freezing_level", day.get("fl", 18))))
                except (ValueError, TypeError):
                    pass

        # Build averaged day data
        if template_days[day_idx] and isinstance(template_days[day_idx], dict):
            day_data["day"] = template_days[day_idx].get("day", f"D{day_idx+1}")

        t_min = int(sum(temps_min) / len(temps_min)) if temps_min else 0
        t_max = int(sum(temps_max) / len(temps_max)) if temps_max else 0
        day_data["temp"] = f"{t_min}-{t_max}"

        day_data["rain_chance"] = int(sum(rain_chances) / len(rain_chances)) if rain_chances else 0

        r_max = int(max(rain_maxs)) if rain_maxs else 0
        day_data["prec"] = f"R0-{r_max}" if r_max > 0 else "-"

        day_data["wind_avg"] = int(sum(wind_avgs) / len(wind_avgs)) if wind_avgs else 0
        day_data["wind_max"] = int(max(wind_maxs)) if wind_maxs else 0
        day_data["wind_dir"] = "W"  # Default

        day_data["cloud"] = int(sum(cloud_covers) / len(cloud_covers)) if cloud_covers else 0
        day_data["cloud_base"] = int(sum(cloud_bases) / len(cloud_bases)) if cloud_bases else 12
        day_data["freezing_level"] = int(min(freezing_levels)) if freezing_levels else 18

        # Danger - take worst case
        day_data["danger"] = ""

        result.append(day_data)

    return result


class FormatCAST7Grouped:
    """Format 7-day forecast with dynamic grouping for CAMPS or PEAKS."""

    @staticmethod
    def format(
        route_name: str,
        forecast_data: dict,
        location_type: str,  # "CAMPS" or "PEAKS"
        start_date=None,
        date=None
    ) -> str:
        """
        Format grouped 7-day forecast.

        Groups locations with similar weather (±2°C, ±2mm, ±5km/h)
        to reduce SMS payload.
        """
        lines = []

        # Header with grouping notice
        lines.append(f"CAST7 {location_type} - {route_name}")
        lines.append(f"Grouped within ±{GROUPING_THRESHOLD_TEMP}C ±{GROUPING_THRESHOLD_RAIN}mm ±{GROUPING_THRESHOLD_WIND}km/h")
        lines.append("═" * 30)

        # Group locations by weather similarity
        groups = group_locations_by_weather(forecast_data)

        from datetime import timedelta
        if start_date is None:
            start_date = date

        for zone_idx, group in enumerate(groups, 1):
            # Zone header with location codes
            zone_locs = " ".join(group)
            lines.append(f"\nZONE {zone_idx}: {zone_locs}")
            lines.append(get_daily_header())

            # Get representative forecast for this group
            rep_forecast = get_group_representative_forecast(group, forecast_data)

            for day_idx, day in enumerate(rep_forecast[:7]):
                if start_date:
                    d = start_date + timedelta(days=day_idx)
                    day_label = d.strftime("%a")
                else:
                    day_label = day.get("day", f"D{day_idx+1}")

                tmp = day.get("temp", "?-?")
                rn = day.get("rain_chance", "?")
                prec = day.get("prec", "-")
                wa = day.get("wind_avg", "?")
                wm = day.get("wind_max", "?")
                wd = day.get("wind_dir", "W")
                cd = day.get("cloud", "?")
                cb = day.get("cloud_base", "?")
                fl = day.get("freezing_level", "?")
                danger = day.get("danger", "")

                lines.append(f"{day_label}|{tmp}|{rn}%|{prec}|{wa}|{wm}|{wd}|{cd}%|{cb}|{fl}|{danger}")

        # Summary
        total_locs = sum(len(g) for g in groups)
        lines.append(f"\n{total_locs} locations → {len(groups)} zones")

        return "\n".join(lines)

    @staticmethod
    def format_multi(
        route_name: str,
        forecast_data: dict,
        location_type: str,
        start_date=None,
        date=None
    ) -> list:
        """Format as multiple messages if needed."""
        full = FormatCAST7Grouped.format(
            route_name, forecast_data, location_type,
            start_date=start_date, date=date
        )

        if len(full) <= 450:
            return [full]

        # Split by zone
        messages = []
        sections = full.split("\nZONE ")

        header = sections[0]
        zones = sections[1:] if len(sections) > 1 else []

        current = header
        for zone in zones:
            zone_text = "\nZONE " + zone
            if len(current) + len(zone_text) > 400:
                messages.append(current)
                # Start new message with abbreviated header
                current = f"CAST7 {location_type} (cont.)\n{get_daily_header()}\nZONE " + zone
            else:
                current += zone_text

        if current:
            messages.append(current)

        # Add part numbers
        total = len(messages)
        if total > 1:
            messages = [f"[{i+1}/{total}] {m}" for i, m in enumerate(messages)]

        return messages


class FormatPEAKS:
    """Format 7-day peak summary."""

    @staticmethod
    def format(route_name: str, forecast_data: dict, start_date=None, date=None) -> str:
        """
        Format 7-day peaks summary with full weather data.

        Shows all metrics including CB (cloud base) and FL (freezing level)
        which are critical for peak safety.
        """
        lines = [f"{route_name} PEAKS 7-DAY"]
        lines.append(get_daily_header())

        from datetime import timedelta
        if start_date is None:
            start_date = date

        for peak_code, days in forecast_data.items():
            lines.append(f"\n{peak_code}:")
            for i, day in enumerate(days[:7]):
                d = start_date + timedelta(days=i)
                day_label = d.strftime("%a")

                if isinstance(day, dict):
                    tmp = day.get("temp", day.get("temp_range", "?-?"))
                    rn = day.get("rain_chance", day.get("%rn", "?"))
                    prec = day.get("prec", "R0-0")
                    wa = day.get("wind_avg", day.get("wa", "?"))
                    wm = day.get("wind_max", day.get("wm", "?"))
                    wd = day.get("wind_dir", day.get("wd", "W"))
                    cd = day.get("cloud", day.get("%cd", "?"))
                    cb = day.get("cloud_base", day.get("cb", "?"))
                    fl = day.get("freezing_level", day.get("fl", "?"))
                    danger = day.get("danger", day.get("d", ""))
                    lines.append(f"  {day_label}|{tmp}|{rn}%|{prec}|{wa}|{wm}|{wd}|{cd}%|{cb}|{fl}|{danger}")
                else:
                    lines.append(f"  {day_label}|?|?|?|?|?|?|?|?|?|")
        
        return "\n".join(lines)
