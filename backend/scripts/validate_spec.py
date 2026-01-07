#!/usr/bin/env python3
"""
Extract route waypoint data directly from THUNDERBIRD_SPEC_v2.4.md

This ensures the JSON config files match the spec exactly.
"""

import re
import json
from pathlib import Path

SPEC_PATH = Path(__file__).parent.parent.parent / "docs" / "THUNDERBIRD_SPEC_v2.4.md"
ROUTES_DIR = Path(__file__).parent.parent / "config" / "routes"


def extract_waypoints_from_spec():
    """Parse the spec and extract all waypoint tables."""
    
    with open(SPEC_PATH) as f:
        spec_text = f.read()
    
    # Pattern to match waypoint rows in tables
    # Format: | CODE | Name | lat | lon | elev | ... |
    camp_pattern = re.compile(
        r'\| ([A-Z]{5}) \| ([^|]+) \| (-?\d+\.\d+) \| (\d+\.\d+) \| (\d+)m'
    )
    
    # Pattern for peaks (name may not be 5-char code)
    peak_pattern = re.compile(
        r'\| (Mt [^|]+|[A-Z][a-z]+ [^|]+|The [^|]+) \| (-?\d+\.\d+) \| (\d+\.\d+) \| (\d+)m \| (Side-trip|On-route)'
    )
    
    camps = []
    peaks = []
    
    for match in camp_pattern.finditer(spec_text):
        code, name, lat, lon, elev = match.groups()
        camps.append({
            'code': code.strip(),
            'name': name.strip(),
            'lat': float(lat),
            'lon': float(lon),
            'elevation': int(elev)
        })
    
    for match in peak_pattern.finditer(spec_text):
        name, lat, lon, elev, peak_type = match.groups()
        peaks.append({
            'name': name.strip(),
            'lat': float(lat),
            'lon': float(lon),
            'elevation': int(elev),
            'type': peak_type.lower().replace('-', '_')
        })
    
    return camps, peaks


def extract_bom_cells_from_spec():
    """Extract BOM cell assignments from spec."""
    
    with open(SPEC_PATH) as f:
        spec_text = f.read()
    
    # Find Cell definitions like: **Cell WA-01** (BOM index: 199-115)
    cell_pattern = re.compile(r'\*\*Cell [A-Z]+-\d+\*\* \(BOM index: (\d+-\d+)\)')
    
    cells = []
    for match in cell_pattern.finditer(spec_text):
        cells.append(match.group(1))
    
    return list(set(cells))  # Unique cells


def get_expected_counts():
    """Extract expected counts from Section 4.3."""
    
    with open(SPEC_PATH) as f:
        spec_text = f.read()
    
    # Find the API Call Reduction table
    wa_match = re.search(r'Western Arthurs \| (\d+) locations \| (\d+) cells', spec_text)
    ot_match = re.search(r'Overland Track \| (\d+) locations \| (\d+) cells', spec_text)
    
    return {
        'western_arthurs': {
            'locations': int(wa_match.group(1)) if wa_match else 0,
            'cells': int(wa_match.group(2)) if wa_match else 0
        },
        'overland_track': {
            'locations': int(ot_match.group(1)) if ot_match else 0,
            'cells': int(ot_match.group(2)) if ot_match else 0
        }
    }


def validate_json_against_spec():
    """Validate that JSON config files match spec counts."""
    
    expected = get_expected_counts()
    errors = []
    
    # Check Western Arthurs
    wa_path = ROUTES_DIR / "western_arthurs_ak.json"
    if wa_path.exists():
        with open(wa_path) as f:
            wa_data = json.load(f)
        
        wa_locations = len(wa_data.get('camps', [])) + len(wa_data.get('peaks', []))
        wa_cells = len(wa_data.get('bom_cells', []))
        
        if wa_locations != expected['western_arthurs']['locations']:
            errors.append(
                f"WA locations: JSON has {wa_locations}, spec says {expected['western_arthurs']['locations']}"
            )
        if wa_cells != expected['western_arthurs']['cells']:
            errors.append(
                f"WA cells: JSON has {wa_cells}, spec says {expected['western_arthurs']['cells']}"
            )
    else:
        errors.append("western_arthurs_ak.json not found")
    
    # Check Overland Track
    ot_path = ROUTES_DIR / "overland_track.json"
    if ot_path.exists():
        with open(ot_path) as f:
            ot_data = json.load(f)
        
        ot_locations = len(ot_data.get('camps', [])) + len(ot_data.get('peaks', []))
        ot_cells = len(ot_data.get('bom_cells', []))
        
        if ot_locations != expected['overland_track']['locations']:
            errors.append(
                f"OT locations: JSON has {ot_locations}, spec says {expected['overland_track']['locations']}"
            )
        if ot_cells != expected['overland_track']['cells']:
            errors.append(
                f"OT cells: JSON has {ot_cells}, spec says {expected['overland_track']['cells']}"
            )
    else:
        errors.append("overland_track.json not found")
    
    return errors


if __name__ == "__main__":
    print("=" * 60)
    print("SPEC VALIDATION")
    print("=" * 60)
    
    # Show expected counts
    expected = get_expected_counts()
    print("\nExpected from spec:")
    print(f"  Western Arthurs: {expected['western_arthurs']['locations']} locations, {expected['western_arthurs']['cells']} cells")
    print(f"  Overland Track:  {expected['overland_track']['locations']} locations, {expected['overland_track']['cells']} cells")
    
    # Validate
    print("\nValidation:")
    errors = validate_json_against_spec()
    
    if errors:
        print("  ❌ FAILED:")
        for e in errors:
            print(f"     - {e}")
    else:
        print("  ✅ All JSON files match spec")
    
    # Extract waypoints for review
    print("\n" + "=" * 60)
    print("EXTRACTED WAYPOINTS FROM SPEC")
    print("=" * 60)
    
    camps, peaks = extract_waypoints_from_spec()
    print(f"\nCamps found: {len(camps)}")
    for c in camps[:10]:
        print(f"  {c['code']}: {c['name']} ({c['lat']}, {c['lon']}) {c['elevation']}m")
    if len(camps) > 10:
        print(f"  ... and {len(camps) - 10} more")
    
    print(f"\nPeaks found: {len(peaks)}")
    for p in peaks[:10]:
        print(f"  {p['name']} ({p['lat']}, {p['lon']}) {p['elevation']}m [{p['type']}]")
    if len(peaks) > 10:
        print(f"  ... and {len(peaks) - 10} more")
    
    # BOM cells
    cells = extract_bom_cells_from_spec()
    print(f"\nBOM cells found: {len(cells)}")
    print(f"  {sorted(cells)}")
