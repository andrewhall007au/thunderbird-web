"""
Elevation service for accurate BOM temperature adjustments.

BOM returns temperature at 2m above MODEL OROGRAPHY, not the user's
precise GPS elevation. This service calculates the cell-average elevation
to enable correct lapse rate adjustments.

Approach:
1. Define a 2.2km x 2.2km grid centered on the user's location
   (matching BOM ACCESS model resolution)
2. Sample elevation across the grid using Open Topo Data API
3. Return grid average as the base elevation for temperature adjustments

The temperature adjustment formula:
  adjustment = (point_elevation - grid_average) * LAPSE_RATE / 100

References:
- BOM ADFD User Guide: "The elevation across each cell is averaged"
- Empirical testing confirms BOM does NOT apply elevation downscaling
"""

import logging
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# Lapse rate for temperature adjustment (°C per 100m)
LAPSE_RATE = 0.65

# Cache for cell boundaries and elevations
_cell_cache: Dict[str, "CellElevationData"] = {}


@dataclass
class CellElevationData:
    """Cached elevation data for a BOM cell."""
    cell_id: str
    north: float
    south: float
    east: float
    west: float
    average_elevation: float
    min_elevation: float
    max_elevation: float
    sample_count: int


async def get_point_elevation(lat: float, lon: float) -> Optional[float]:
    """
    Get elevation at a single point using Open Topo Data API.

    Args:
        lat: Latitude
        lon: Longitude

    Returns:
        Elevation in meters, or None if unavailable
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.opentopodata.org/v1/srtm90m",
                params={"locations": f"{lat},{lon}"}
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "OK" and data.get("results"):
                    return data["results"][0].get("elevation")
    except Exception as e:
        logger.warning(f"Failed to get elevation for ({lat}, {lon}): {e}")

    return None


async def get_bulk_elevations(points: list[Tuple[float, float]]) -> list[Optional[float]]:
    """
    Get elevations for multiple points in a single API call.

    Args:
        points: List of (lat, lon) tuples (max 100)

    Returns:
        List of elevations (None for failed points)
    """
    if not points:
        return []

    if len(points) > 100:
        raise ValueError("Open Topo Data API limit is 100 points per request")

    locations = "|".join(f"{lat},{lon}" for lat, lon in points)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                "https://api.opentopodata.org/v1/srtm90m",
                params={"locations": locations}
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "OK":
                    return [
                        result.get("elevation")
                        for result in data.get("results", [])
                    ]
    except Exception as e:
        logger.warning(f"Failed to get bulk elevations: {e}")

    return [None] * len(points)


async def get_cell_elevation_data(
    lat: float,
    lon: float,
    cell_id: str,
    get_cell_id_func=None  # Optional - not used with fixed grid approach
) -> CellElevationData:
    """
    Get elevation data for a BOM model cell.

    BOM ACCESS model uses ~2.2km x 2.2km grid cells. Since the BOM API
    doesn't expose the exact cell boundaries, we use a fixed grid size
    centered on the query point to sample elevations.

    Args:
        lat: User's latitude
        lon: User's longitude
        cell_id: Identifier for caching (e.g., geohash or region name)
        get_cell_id_func: Unused, kept for API compatibility

    Returns:
        CellElevationData with boundaries and average elevation
    """
    # Use geohash-based cache key for better cache efficiency
    # 5-char geohash = ~5km precision, appropriate for 2.2km cells
    import geohash2
    cache_key = geohash2.encode(lat, lon, precision=5)

    if cache_key in _cell_cache:
        logger.debug(f"Cell elevation cache hit: {cache_key}")
        return _cell_cache[cache_key]

    logger.info(f"Computing elevation data for grid at ({lat:.4f}, {lon:.4f})")

    # BOM ACCESS model uses ~2.2km x 2.2km cells
    # 0.02 degrees latitude ≈ 2.2km
    # 0.02 degrees longitude ≈ 1.4-1.8km at Australian latitudes (cos(42°) ≈ 0.74)
    cell_size_lat = 0.02
    cell_size_lon = 0.025  # Slightly wider to get ~2.2km in east-west

    # Center the cell on the query point
    north = lat + cell_size_lat / 2
    south = lat - cell_size_lat / 2
    east = lon + cell_size_lon / 2
    west = lon - cell_size_lon / 2

    logger.debug(f"Grid bounds: lat [{south:.4f}, {north:.4f}], lon [{west:.4f}, {east:.4f}]")

    # Sample elevation across the cell (7x7 grid = 49 points)
    grid_size = 7
    lat_step = (north - south) / (grid_size - 1)
    lon_step = (east - west) / (grid_size - 1)

    points = []
    for i in range(grid_size):
        for j in range(grid_size):
            p_lat = south + i * lat_step
            p_lon = west + j * lon_step
            points.append((p_lat, p_lon))

    elevations = await get_bulk_elevations(points)
    valid_elevations = [e for e in elevations if e is not None]

    if not valid_elevations:
        logger.error(f"No valid elevations for grid at ({lat:.4f}, {lon:.4f})")
        # Fallback to point elevation
        point_elev = await get_point_elevation(lat, lon)
        valid_elevations = [point_elev or 0]

    avg_elevation = sum(valid_elevations) / len(valid_elevations)

    cell_data = CellElevationData(
        cell_id=cache_key,
        north=north,
        south=south,
        east=east,
        west=west,
        average_elevation=avg_elevation,
        min_elevation=min(valid_elevations),
        max_elevation=max(valid_elevations),
        sample_count=len(valid_elevations)
    )

    # Cache the result
    _cell_cache[cache_key] = cell_data

    logger.info(
        f"Grid {cache_key}: avg={avg_elevation:.0f}m, "
        f"range=[{cell_data.min_elevation:.0f}, {cell_data.max_elevation:.0f}]m"
    )

    return cell_data


def calculate_temperature_adjustment(
    point_elevation: float,
    cell_average_elevation: float
) -> float:
    """
    Calculate temperature adjustment from cell average to point elevation.

    Args:
        point_elevation: User's actual elevation (meters)
        cell_average_elevation: Cell average elevation (meters)

    Returns:
        Temperature adjustment in °C (negative = cooler at higher elevation)
    """
    elevation_diff = point_elevation - cell_average_elevation
    return elevation_diff * LAPSE_RATE / 100


def clear_cell_cache():
    """Clear the cell elevation cache (for testing)."""
    global _cell_cache
    _cell_cache = {}
