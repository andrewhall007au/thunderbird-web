#!/usr/bin/env python3
"""
Import GPX file to route library (admin use).

Usage:
    python import_library_route.py path/to/route.gpx --name "Western Arthurs" --country "Australia" --region "Tasmania"
"""
import argparse
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import gpxpy
from app.models.custom_route import RouteLibraryStore


def parse_gpx(gpx_content: str) -> dict:
    """Parse GPX file to structured data."""
    gpx = gpxpy.parse(gpx_content)

    # Extract track
    track_coords = []
    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                track_coords.append([point.longitude, point.latitude])

    # Extract waypoints
    waypoints = []
    for wp in gpx.waypoints:
        waypoints.append({
            'name': wp.name or 'Waypoint',
            'lat': wp.latitude,
            'lng': wp.longitude,
            'elevation': wp.elevation or 0
        })

    return {
        'track_geojson': {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': track_coords
            }
        },
        'waypoints': waypoints,
        'metadata': {
            'name': gpx.name,
            'description': gpx.description
        }
    }


def main():
    parser = argparse.ArgumentParser(description='Import GPX to route library')
    parser.add_argument('gpx_file', help='Path to GPX file')
    parser.add_argument('--name', required=True, help='Route name')
    parser.add_argument('--description', default='', help='Route description')
    parser.add_argument('--country', required=True, help='Country')
    parser.add_argument('--region', default='', help='Region')
    parser.add_argument('--difficulty', type=int, default=3, help='Difficulty 1-5')
    parser.add_argument('--distance', type=float, help='Distance in km')
    parser.add_argument('--days', default='', help='Typical days (e.g., "5-7")')

    args = parser.parse_args()

    # Read and parse GPX
    gpx_path = Path(args.gpx_file)
    if not gpx_path.exists():
        print(f"Error: File not found: {gpx_path}")
        sys.exit(1)

    print(f"Parsing {gpx_path}...")
    gpx_content = gpx_path.read_text()
    gpx_data = parse_gpx(gpx_content)

    # Calculate distance if not provided
    distance = args.distance
    if distance is None and gpx_data['track_geojson']['geometry']['coordinates']:
        # Rough distance estimate from track points
        coords = gpx_data['track_geojson']['geometry']['coordinates']
        distance = len(coords) * 0.05  # Very rough estimate
        print(f"Estimated distance: {distance:.1f} km")

    # Create library entry
    store = RouteLibraryStore()
    route = store.create(
        name=args.name,
        description=args.description,
        gpx_data=gpx_data,
        country=args.country,
        region=args.region,
        difficulty_grade=args.difficulty,
        distance_km=distance,
        typical_days=args.days
    )

    print(f"Created library route: {route.name} (ID: {route.id})")
    print(f"  Country: {route.country}")
    print(f"  Region: {route.region}")
    print(f"  Waypoints: {len(gpx_data.get('waypoints', []))}")
    print(f"  Track points: {len(gpx_data['track_geojson']['geometry']['coordinates'])}")


if __name__ == '__main__':
    main()
