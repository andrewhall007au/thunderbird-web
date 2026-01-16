"""
Danger Rating Calculator (Spec Section 6)

Calculates danger level based on weather conditions.
"""


def calculate_danger(
    wind_max_kmh: float,
    rain_probability: float,
    precip_mm: float,
    temp_c: float,
    freezing_level: int,
    elevation: int = 1000,
    cape: float = 0
) -> str:
    """
    Calculate danger rating based on weather conditions.
    
    Returns:
        "" - No significant danger
        "!" - Moderate danger (caution advised)
        "!!" - High danger (consider alternatives)
        "!!!" - Extreme danger (avoid exposure)
        "TS?" - Thunderstorm possible
        "TS!" - Thunderstorm likely
    """
    danger_level = 0
    thunderstorm = None
    
    # Wind danger (primary factor)
    if wind_max_kmh >= 80:
        danger_level = 3
    elif wind_max_kmh >= 60:
        danger_level = max(danger_level, 2)
    elif wind_max_kmh >= 40:
        danger_level = max(danger_level, 1)
    
    # Precipitation danger
    if precip_mm >= 20:
        danger_level = max(danger_level, 2)
    elif precip_mm >= 10 and rain_probability >= 70:
        danger_level = max(danger_level, 1)
    
    # Snow/ice danger (freezing level below elevation)
    if freezing_level < elevation and precip_mm > 0:
        danger_level = max(danger_level, 2)
    elif freezing_level < elevation + 200 and rain_probability >= 50:
        danger_level = max(danger_level, 1)
    
    # Extreme cold
    if temp_c < -5:
        danger_level = max(danger_level, 1)
    
    # Thunderstorm detection (CAPE-based)
    if cape >= 2000:
        thunderstorm = "TS!"
        danger_level = max(danger_level, 2)
    elif cape >= 500:
        thunderstorm = "TS?"
        danger_level = max(danger_level, 1)
    
    # Build result - !!! takes precedence over thunderstorm markers
    if danger_level >= 3:
        return "!!!"
    elif thunderstorm:
        return thunderstorm
    elif danger_level == 2:
        return "!!"
    elif danger_level == 1:
        return "!"
    return ""


def get_danger_description(rating: str) -> str:
    """Get human-readable description of danger rating."""
    descriptions = {
        "": "Conditions suitable for hiking",
        "!": "Caution advised - moderate conditions",
        "!!": "High danger - consider alternatives",
        "!!!": "Extreme danger - avoid exposure",
        "TS?": "Thunderstorms possible",
        "TS!": "Thunderstorms likely - seek shelter"
    }
    return descriptions.get(rating, "Unknown conditions")
