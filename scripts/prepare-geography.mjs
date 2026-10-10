// Mechanical reduction of the upstream public country database; no visitor data.
// node scripts/prepare-geography.mjs /path/to/mledoze/countries.json
import { readFile, writeFile } from 'node:fs/promises';
const countries = JSON.parse(await readFile(process.argv[2], 'utf8'));
const reduced = countries.map(row => ({
  id: row.cca2,
  zh: row.translations.zho?.common || row.name.common,
  en: row.name.common,
  lat: row.latlng[0], lon: row.latlng[1],
  aliases: [...new Set([row.name.common, row.name.official,
    row.translations.zho?.common, row.translations.zho?.official,
    ...row.altSpellings].filter(Boolean))],
}));
await writeFile(new URL('../src/assets/geo/country-centers.json', import.meta.url), JSON.stringify(reduced));
