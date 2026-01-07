#!/usr/bin/env python3
"""
Extract Western Arthurs route data directly from spec Cell sections.
This is the source of truth - no guessing.
"""

import re
import json
from pathlib import Path

SPEC_PATH = Path(__file__).parent.parent.parent / "docs" / "THUNDERBIRD_SPEC_v2.4.md"
ROUTES_DIR = Path(__file__).parent.parent / "config" / "routes"


def extract_wa_from_spec():
    """Extract all WA waypoints from the Cell WA-XX sections."""
    
    with open(SPEC_PATH) as f:
        spec_text = f.read()
    
    # Find the WA cell section (between "Cell WA-01" and "11.2.2 Western Arthurs JSON")
    wa_section_match = re.search(
        r'\*\*Cell WA-01\*\*.*?(?=####\s+11\.2\.2)',
        spec_text,
        re.DOTALL
    )
    
    if not wa_section_match:
        print("ERROR: Could not find WA cell section")
        return None
    
    wa_section = wa_section_match.group(0)
    
    # Extract each cell
    cell_pattern = re.compile(
        r'\*\*Cell WA-(\d+)\*\* \(BOM index: (\d+-\d+)\)',
        re.MULTILINE
    )
    
    cells = {}
    camps = []
    peaks = []
    
    # Split by cell headers
    cell_splits = re.split(r'\*\*Cell WA-\d+\*\*', wa_section)
    cell_headers = cell_pattern.findall(wa_section)
    
    for i, (cell_num, bom_index) in enumerate(cell_headers):
        cell_text = cell_splits[i + 1] if i + 1 < len(cell_splits) else ""
        
        cells[f"WA-{cell_num}"] = bom_index
        
        # Extract camps from this cell
        # Pattern: | CODE | Name | lat | lon | elev | verified |
        camp_pattern = re.compile(
            r'\| ([A-Z]{5}) \| ([^|]+) \| (-?\d+\.\d+) \| (\d+\.\d+) \| (\d+)m \| ([^|]+) \|'
        )
        
        for match in camp_pattern.finditer(cell_text):
            code, name, lat, lon, elev, verified = match.groups()
            camps.append({
                'code': code.strip(),
                'name': name.strip(),
                'lat': float(lat),
                'lon': float(lon),
                'elevation': int(elev),
                'bom_cell': bom_index,
                'verified': '✓' in verified or 'Wikidata' in verified or 'OSM' in verified,
                'type': 'camp'
            })
        
        # Extract peaks from this cell
        # Pattern: | Name | lat | lon | elev | type | verified |
        peak_pattern = re.compile(
            r'\| ([^|]+) \| (-?\d+\.\d+) \| (\d+\.\d+) \| (\d+)m \| (Side-trip|On-route) \| ([^|]+) \|'
        )
        
        for match in peak_pattern.finditer(cell_text):
            name, lat, lon, elev, peak_type, verified = match.groups()
            # Generate 5-char code from name
            code = generate_peak_code(name.strip())
            peaks.append({
                'code': code,
                'name': name.strip(),
                'lat': float(lat),
                'lon': float(lon),
                'elevation': int(elev),
                'bom_cell': bom_index,
                'verified': '✓' in verified,
                'type': peak_type.lower().replace('-', '_')
            })
    
    return {
        'cells': cells,
        'camps': camps,
        'peaks': peaks,
        'bom_cells': sorted(set(cells.values()))
    }


def generate_peak_code(name):
    """Generate 5-char code from peak name."""
    # Remove common prefixes
    name = name.replace('Mt ', '').replace('The ', '')
    # Take first 5 chars, uppercase
    code = name.upper()[:5]
    # Remove spaces
    code = code.replace(' ', '')
    # Pad if needed
    return code[:5].ljust(5, 'X')


def extract_camp_route_membership():
    """Determine which camps are A-K vs Full only."""
    
    with open(SPEC_PATH) as f:
        spec_text = f.read()
    
    # Find the route membership table
    membership = {}
    
    # Pattern for rows like: | LAKEF | Lake Fortuna | Both |
    pattern = re.compile(r'\| ([A-Z]{5}) \| [^|]+ \| (Both|Full only|A-K only) \|')
    
    for match in pattern.finditer(spec_text):
        code, route = match.groups()
        membership[code] = route
    
    return membership


def build_wa_route_json(data, membership, route_type='full'):
    """Build the JSON config for WA route."""
    
    # Filter camps based on route type
    if route_type == 'ak':
        camps = [c for c in data['camps'] if membership.get(c['code'], 'Both') in ['Both', 'A-K only']]
        route_id = "western_arthurs_ak"
        name = "Western Arthurs (Alpha-Kappa)"
        short_name = "WA A-K"
    else:
        camps = data['camps']
        route_id = "western_arthurs_full"
        name = "Western Arthurs (Full Traverse)"
        short_name = "WA Full"
    
    # Get unique BOM cells for included camps
    included_cells = set(c['bom_cell'] for c in camps)
    
    # Filter peaks to only those in included cells
    peaks = [p for p in data['peaks'] if p['bom_cell'] in included_cells]
    
    return {
        'route_id': route_id,
        'name': name,
        'short_name': short_name,
        'region': 'Tasmania',
        'distance_km': 57 if route_type == 'ak' else 79,
        'typical_days': '6-8' if route_type == 'ak' else '10-12',
        'grade': 5,
        'grade_description': 'Expert - technical scrambling, remote',
        'is_loop': True,
        'elevation_config': {
            'camp_typical': 850,
            'peak_typical': 1100,
            'peak_min': 1000,
            'peak_max': 1200
        },
        'camps': camps,
        'peaks': peaks,
        'bom_cells': sorted(included_cells),
        'total_locations': len(camps) + len(peaks)
    }


if __name__ == "__main__":
    print("=" * 60)
    print("EXTRACTING WESTERN ARTHURS FROM SPEC")
    print("=" * 60)
    
    # Extract data
    data = extract_wa_from_spec()
    if not data:
        exit(1)
    
    print(f"\nExtracted from spec:")
    print(f"  Camps: {len(data['camps'])}")
    print(f"  Peaks: {len(data['peaks'])}")
    print(f"  BOM Cells: {len(data['bom_cells'])}")
    print(f"  Total: {len(data['camps']) + len(data['peaks'])} locations")
    
    # Get route membership
    membership = extract_camp_route_membership()
    print(f"\nRoute membership found for {len(membership)} camps")
    
    # Build A-K route
    ak_route = build_wa_route_json(data, membership, 'ak')
    print(f"\nA-K Route:")
    print(f"  Camps: {len(ak_route['camps'])}")
    print(f"  Peaks: {len(ak_route['peaks'])}")
    print(f"  BOM Cells: {len(ak_route['bom_cells'])}")
    print(f"  Total: {ak_route['total_locations']} locations")
    
    # Build Full route
    full_route = build_wa_route_json(data, membership, 'full')
    print(f"\nFull Traverse Route:")
    print(f"  Camps: {len(full_route['camps'])}")
    print(f"  Peaks: {len(full_route['peaks'])}")
    print(f"  BOM Cells: {len(full_route['bom_cells'])}")
    print(f"  Total: {full_route['total_locations']} locations")
    
    # List camps
    print("\n" + "-" * 40)
    print("A-K CAMPS:")
    for c in ak_route['camps']:
        print(f"  {c['code']}: {c['name']} ({c['bom_cell']})")
    
    print("\nFULL TRAVERSE CAMPS:")
    for c in full_route['camps']:
        marker = " [Full only]" if membership.get(c['code']) == 'Full only' else ""
        print(f"  {c['code']}: {c['name']} ({c['bom_cell']}){marker}")
    
    # Save JSON files
    print("\n" + "=" * 60)
    print("SAVING JSON FILES")
    print("=" * 60)
    
    ROUTES_DIR.mkdir(parents=True, exist_ok=True)
    
    ak_path = ROUTES_DIR / "western_arthurs_ak.json"
    with open(ak_path, 'w') as f:
        json.dump(ak_route, f, indent=2)
    print(f"  Saved: {ak_path}")
    
    full_path = ROUTES_DIR / "western_arthurs_full.json"
    with open(full_path, 'w') as f:
        json.dump(full_route, f, indent=2)
    print(f"  Saved: {full_path}")
