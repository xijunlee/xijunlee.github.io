"""Reduce public gazetteers to an offline city/subdivision lookup (no visitor data).

Usage: python3 scripts/prepare-visitor-places.py cities15000.zip admin1.geojson TSCharacters.txt admin1CodesASCII.txt
Sources and licenses: src/assets/geo/ATTRIBUTION.md. Input hashes are recorded.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
city_path, admin_path, character_path, admin_code_path = map(Path, sys.argv[1:])
characters = {}
for line in character_path.read_text().splitlines():
    if line and not line.startswith('#'):
        key, value = line.split('\t')
        characters[ord(key)] = value.split(' ')[0]

def simplified(value):
    return value.translate(characters)

def aliases(values):
    result = set()
    for value in values:
        if not value or len(value) > 80:
            continue
        result.add(value)
        result.add(simplified(value))
    return sorted(result)

countries = {row['id'] for row in json.loads((root / 'src/assets/geo/country-centers.json').read_text())}
admins = {}
for feature in json.loads(admin_path.read_text())['features']:
    p = feature['properties']
    code = p.get('gn_a1_code') or ''
    country = p.get('iso_a2')
    if country not in countries or p.get('gn_level') != 1 or not code.startswith(country + '.') or not p.get('name'):
        continue
    lat, lon = p.get('latitude'), p.get('longitude')
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        continue
    names = [p.get(key) for key in ['name', 'name_en', 'name_zh', 'name_zht', 'gn_name']]
    names += (p.get('name_alt') or '').split('|') + (p.get('name_local') or '').split('|')
    names += [p.get('iso_3166_2'), p.get('postal')]
    en = p.get('name_en') or p['name']
    zh = simplified(p.get('name_zh') or p.get('name_zht') or en)
    # Tuple columns: GeoNames admin code, Chinese/English names, lat/lon, aliases.
    admins.setdefault(code, [code, zh, en, round(lat, 4), round(lon, 4), aliases(names)])

cities = []
seats = {}
with zipfile.ZipFile(city_path) as archive:
    for line in archive.read('cities15000.txt').decode('utf-8').splitlines():
        row = line.split('\t')
        country, admin = row[8], row[10]
        if country not in countries:
            continue
        alternatives = row[3].split(',')
        cjk = [n for n in alternatives if re.fullmatch(r'[\u3400-\u9fff]{2,30}', n)]
        latin = [n for n in alternatives if re.fullmatch(r"[A-Za-z][A-Za-z '\-\.]{2,59}", n)]
        en = row[2] or row[1]
        zh = simplified(cjk[0]) if cjk else en
        names = aliases([row[1], row[2]] + cjk + latin)
        code = country + '.' + admin
        # Missing administrative centers can use an explicitly identified
        # administrative/national capital inside that division as a schematic
        # point. This never promotes a visitor record to city precision.
        if row[7] in ('PPLA', 'PPLC'):
            rank = (row[7] == 'PPLA', int(row[14]))
            if code not in seats or rank > seats[code][0]:
                seats[code] = (rank, round(float(row[4]), 4), round(float(row[5]), 4))
        # Tuple columns: GeoNames ID, country, admin code, names, lat/lon, aliases.
        cities.append([row[0], country, country + '.' + admin, zh, en,
                       round(float(row[4]), 4), round(float(row[5]), 4), names])

for line in admin_code_path.read_text().splitlines():
    code, name, ascii_name, _ = line.split('\t')
    if code in admins or code.split('.')[0] not in countries or code not in seats:
        continue
    _, lat, lon = seats[code]
    admins[code] = [code, name, ascii_name, lat, lon, aliases([name, ascii_name])]

data = {
    'schema': 1,
    'characters': {chr(key): value for key, value in characters.items()},
    'sources': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [city_path, admin_path, character_path, admin_code_path]},
    'admin1': sorted(admins.values()),
    'cities': sorted(cities, key=lambda row: int(row[0])),
}
output = root / 'scripts/data/visitor-places.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Prepared {len(data["admin1"])} subdivisions and {len(cities)} cities; {output.stat().st_size} bytes. No visitor data.')
