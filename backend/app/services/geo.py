"""
Geo service for offline country detection from GPS coordinates.

Phase 6: International Weather (WTHR-09, WTHR-10)

Uses geopip library for polygon-based country lookup with bounding box
fallback for the 9 countries supported by the weather router.

Supported countries:
- AU: Australia (legacy BOM service)
- US: National Weather Service
- CA: Environment Canada
- GB: Met Office
- FR: France (Open-Meteo Meteo-France model)
- IT: Italy (Open-Meteo ICON-EU model)
- CH: Switzerland (Open-Meteo ICON-EU model)
- NZ: New Zealand (Open-Meteo)
- ZA: South Africa (Open-Meteo)
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import geopip for polygon-based lookup
try:
    import geopip
    GEOPIP_AVAILABLE = True
except ImportError:
    GEOPIP_AVAILABLE = False
    logger.warning("geopip not available, using bounding box fallback only")


# Bounding boxes for supported countries (min_lat, max_lat, min_lon, max_lon)
# These are approximate and used as fallback when geopip fails or is unavailable
COUNTRY_BOUNDING_BOXES = {
    "AU": (-44.0, -10.0, 112.0, 154.0),   # Australia
    "US": (24.0, 50.0, -125.0, -66.0),     # Continental US (excludes AK, HI)
    "CA": (42.0, 84.0, -141.0, -52.0),     # Canada
    "GB": (49.0, 61.0, -8.0, 2.0),         # Great Britain
    "FR": (41.0, 51.5, -5.5, 10.0),        # France (mainland)
    "IT": (35.5, 47.5, 6.5, 19.0),         # Italy
    "CH": (45.8, 47.9, 5.9, 10.6),         # Switzerland
    "NZ": (-47.5, -34.0, 166.0, 179.0),    # New Zealand
    "ZA": (-35.0, -22.0, 16.0, 33.0),      # South Africa
}

# Countries that are supported by the weather router
SUPPORTED_COUNTRIES = set(COUNTRY_BOUNDING_BOXES.keys())


def get_country_from_coordinates(lat: float, lon: float) -> Optional[str]:
    """
    Get ISO 3166-1 alpha-2 country code from GPS coordinates.

    Uses geopip library for accurate polygon-based lookup when available,
    with bounding box fallback for supported countries.

    Args:
        lat: Latitude (-90 to 90)
        lon: Longitude (-180 to 180)

    Returns:
        Country code ('US', 'AU', 'NZ', etc.) or None if location is
        outside all supported countries.

    Example:
        >>> get_country_from_coordinates(40.71, -74.00)  # NYC
        'US'
        >>> get_country_from_coordinates(-33.86, 151.21)  # Sydney
        'AU'
        >>> get_country_from_coordinates(0.0, 0.0)  # Middle of ocean
        None
    """
    # Validate inputs
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        logger.warning(f"Invalid coordinates: lat={lat}, lon={lon}")
        return None

    # Try geopip first for accurate polygon-based lookup
    if GEOPIP_AVAILABLE:
        try:
            result = geopip.search(lng=lon, lat=lat)
            if result:
                country_code = result.get("ISO3166-1-Alpha-2")
                if country_code and country_code in SUPPORTED_COUNTRIES:
                    logger.debug(f"geopip: ({lat}, {lon}) -> {country_code}")
                    return country_code
                elif country_code:
                    # Country detected but not supported
                    logger.debug(f"geopip: ({lat}, {lon}) -> {country_code} (unsupported)")
                    return None
        except Exception as e:
            logger.warning(f"geopip lookup failed: {e}, trying bounding box")

    # Fallback: check bounding boxes
    # Check more specific countries first (smaller boxes)
    # Order by approximate area (smallest first) to handle overlapping regions
    check_order = ["CH", "GB", "NZ", "ZA", "IT", "FR", "CA", "US", "AU"]

    for country_code in check_order:
        min_lat, max_lat, min_lon, max_lon = COUNTRY_BOUNDING_BOXES[country_code]
        if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
            logger.debug(f"bbox: ({lat}, {lon}) -> {country_code}")
            return country_code

    # No supported country found
    logger.debug(f"No supported country found for ({lat}, {lon})")
    return None


def is_australian(lat: float, lon: float) -> bool:
    """
    Check if coordinates are in Australia.

    This is a convenience function for the legacy BOM flow which
    should continue to use BOM service for Australian locations.

    Args:
        lat: Latitude
        lon: Longitude

    Returns:
        True if coordinates are in Australia
    """
    return get_country_from_coordinates(lat, lon) == "AU"


def get_supported_countries() -> list:
    """
    Get list of supported country codes.

    Returns:
        List of ISO 3166-1 alpha-2 country codes
    """
    return list(SUPPORTED_COUNTRIES)
