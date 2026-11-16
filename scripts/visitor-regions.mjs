import { readFileSync } from 'node:fs';

const countries = JSON.parse(readFileSync(new URL('../src/assets/geo/country-centers.json', import.meta.url), 'utf8'));
// Approximate administrative representative points, never visitor geolocation.
const provinces = [
  ['北京', 'Beijing', 40, 116], ['天津', 'Tianjin', 39, 117],
  ['河北', 'Hebei', 39, 115], ['山西', 'Shanxi', 37, 112],
  ['内蒙古', 'Inner Mongolia', 44, 113], ['辽宁', 'Liaoning', 41, 123],
  ['吉林', 'Jilin', 43, 126], ['黑龙江', 'Heilongjiang', 47, 128],
  ['上海', 'Shanghai', 31, 121], ['江苏', 'Jiangsu', 33, 119],
  ['浙江', 'Zhejiang', 29, 120], ['安徽', 'Anhui', 32, 117],
  ['福建', 'Fujian', 26, 118], ['江西', 'Jiangxi', 28, 116],
  ['山东', 'Shandong', 36, 118], ['河南', 'Henan', 34, 114],
  ['湖北', 'Hubei', 31, 112], ['湖南', 'Hunan', 28, 112],
  ['广东', 'Guangdong', 23, 113], ['广西', 'Guangxi', 24, 109],
  ['海南', 'Hainan', 19, 110], ['重庆', 'Chongqing', 30, 107],
  ['四川', 'Sichuan', 31, 103], ['贵州', 'Guizhou', 27, 107],
  ['云南', 'Yunnan', 25, 102], ['西藏', 'Tibet', 31, 89],
  ['陕西', 'Shaanxi', 35, 109], ['甘肃', 'Gansu', 37, 103],
  ['青海', 'Qinghai', 36, 96], ['宁夏', 'Ningxia', 37, 106],
  ['新疆', 'Xinjiang', 42, 85], ['台湾', 'Taiwan', 24, 121],
  ['香港', 'Hong Kong', 22.3, 114.2], ['澳门', 'Macao', 22.2, 113.5],
].map(([zh, en, lat, lon], index) => ({ id: `CN-${index}`, zh, en, lat, lon }));

const places = JSON.parse(readFileSync(new URL('./data/visitor-places.json', import.meta.url), 'utf8'));
const normalize = value => value.normalize('NFKC').replace(/./gu, character => places.characters[character] || character)
  .normalize('NFD').replace(/\p{M}/gu, '').replace(/[\s,，·/\\_|.()（）:：\p{Pd}]+/gu, '').toLowerCase();
export const regionCatalog = new Map([
  ...countries.map(row => ({ ...row, level: 'country' })),
  ...provinces.map(row => ({ ...row, level: 'subdivision', country: 'CN' })),
].map(row => [row.id, row]));
const subdivisions = new Map();
const cityIndexes = new Map();
const stateIndexes = new Map();
const add = (indexes, key, alias, row) => {
  if (!alias || alias.length > 150) return;
  if (!indexes.has(key)) indexes.set(key, new Map());
  const index = indexes.get(key), name = normalize(alias);
  if (!name) return;
  if (!index.has(name)) index.set(name, new Set());
  index.get(name).add(row.id);
};
const chineseStateSuffix = /(?:省|州|市|特别行政区|自治区)$/;
for (const [code, zh, en, lat, lon, names] of places.admin1) {
  const country = code.split('.')[0];
  const legacy = country === 'CN' && provinces.find(row => normalize(zh).startsWith(normalize(row.zh)) || normalize(row.en) === normalize(en));
  const row = legacy ? { ...regionCatalog.get(legacy.id), admin1: code } : {
    id: `ADM1:${code}`, country, admin1: code, level: 'subdivision', lat, lon,
    zh: `${regionCatalog.get(country).zh} · ${zh}`, en: `${en}, ${regionCatalog.get(country).en}`,
  };
  regionCatalog.set(row.id, row); subdivisions.set(code, row);
  for (const name of [...names, zh, en]) {
    add(stateIndexes, country, name, row);
    // Short administrative codes must match whole fields, never word substrings.
    if (/\p{Script=Han}/u.test(name)) add(stateIndexes, country, name.replace(chineseStateSuffix, ''), row);
  }
}
// Preserve all original Chinese province IDs, including small regions not in
// Natural Earth's administrative lookup, so old cached snapshots stay valid.
for (const row of provinces) for (const name of [row.zh, row.en]) add(stateIndexes, 'CN', name, row);
for (const [geonameId, country, admin1, zh, en, lat, lon, names] of places.cities) {
  const state = subdivisions.get(admin1);
  const municipality = country === 'CN' && ['北京', '天津', '上海', '重庆'].find(name => zh === name || zh === name + '市');
  const row = municipality ? provinces.find(p => p.zh === municipality) : {
    id: `CITY:${geonameId}`, country, admin1, level: 'city', lat, lon,
    zh: `${state?.zh || regionCatalog.get(country).zh} · ${zh}`,
    en: `${en}, ${state?.en || regionCatalog.get(country).en}`,
  };
  if (!municipality) regionCatalog.set(row.id, row);
  for (const name of [...names, zh, en]) {
    add(cityIndexes, country, name, row);
    add(cityIndexes, admin1, name, row);
    if (/^[\u3400-\u9fff]+$/.test(name)) {
      const short = name.replace(/市$/, '');
      for (const alias of [short, short + '市']) {
        add(cityIndexes, country, alias, row); add(cityIndexes, admin1, alias, row);
      }
    }
  }
}
const aliases = new Map();
for (const country of countries) {
  for (const label of [country.zh, country.en, ...country.aliases]) {
    if (label.length >= 2) aliases.set(normalize(label), country);
  }
}
for (const [label, id] of [['美国', 'US'], ['英国', 'GB'], ['俄罗斯', 'RU'], ['韩国', 'KR'], ['朝鲜', 'KP'], ['越南', 'VN'], ['中国', 'CN'], ['中国内地', 'CN'], ['中国大陆', 'CN']]) {
  aliases.set(normalize(label), regionCatalog.get(id));
}
const legacyRegions = { HK: 'CN-32', MO: 'CN-33', TW: 'CN-31' };
for (const [label, id] of [['台湾省', 'TW'], ['中国台湾', 'TW'], ['中国台湾省', 'TW'], ['中国香港', 'HK'], ['香港特别行政区', 'HK'], ['中国香港特别行政区', 'HK'], ['中国澳门', 'MO'], ['澳门特别行政区', 'MO'], ['中国澳门特别行政区', 'MO']]) {
  aliases.set(normalize(label), regionCatalog.get(id));
}

export function identifyRegion(value) {
  if (typeof value !== 'string' || value.length > 150) return null;
  const normalized = normalize(value);
  // Identify the country before provinces: an overseas city with a Chinese
  // substring must not accidentally become a Chinese province.
  const match = countryAliases.find(([label]) => normalized === label ||
    (normalized.startsWith(label) && (/\p{Script=Han}/u.test(label) || prefixBoundary(value, label.length))));
  const legacyProvince = !match && provinces.find(row => normalized.startsWith(normalize(row.zh)) || normalized === normalize(row.en));
  const country = match?.[1] || (legacyProvince ? regionCatalog.get('CN') : null);
  if (!country) return null;
  const remainder = match ? normalized.slice(match[0].length) : normalized;
  if (!remainder) return regionCatalog.get(legacyRegions[country.id] || country.id);
  const stateIndex = stateIndexes.get(country.id);
  // An exact state name (e.g. New York) is not enough to infer its namesake
  // city. Only a separate, unambiguous city name may refine that state.
  const exactState = unique(stateIndex?.get(remainder));
  if (exactState) return exactState;
  const exactCity = unique(cityIndexes.get(country.id)?.get(remainder));
  if (exactCity) return exactCity;
  const rawRemainder = match ? afterPrefix(value, match[0].length) : value.trim();
  const stateMatch = stateNames.get(country.id)?.find(name => remainder.startsWith(name) &&
    (/\p{Script=Han}/u.test(name) || prefixBoundary(rawRemainder, name.length)));
  const state = stateMatch ? unique(stateIndex.get(stateMatch)) : legacyProvince;
  if (state) {
    const tail = stateMatch ? remainder.slice(stateMatch.length) : remainder;
    const city = unique(cityIndexes.get(state.admin1)?.get(tail));
    return city || state;
  }
  // With no state, a city must be unique within the identified country.
  // Never choose the largest/popular city when multiple places share a name.
  return unique(cityIndexes.get(country.id)?.get(remainder)) || regionCatalog.get(legacyRegions[country.id] || country.id);
}

const countryAliases = [...aliases.entries()].sort((a, b) => b[0].length - a[0].length);
const stateNames = new Map([...stateIndexes].map(([country, index]) => [country, [...index.keys()].sort((a, b) => b.length - a.length)]));
function unique(ids) {
  return ids?.size === 1 ? regionCatalog.get(ids.values().next().value) : null;
}
function afterPrefix(value, length) {
  const text = value.trim();
  let end = 0;
  while (end < text.length && normalize(text.slice(0, end)).length < length) end++;
  return text.slice(end).replace(/^[\s,，·/\\_|.-]+/, '');
}
function prefixBoundary(value, length) {
  const text = value.trim();
  let end = 0;
  while (end < text.length && normalize(text.slice(0, end)).length < length) end++;
  return end === text.length || /[\s,，·/\\_|.()（）:：\p{Pd}]/u.test(text[end]);
}

export function aggregateRegions(rows) {
  const counts = new Map();
  let unknown = 0;
  for (const row of rows) {
    const region = identifyRegion(row.region);
    if (region) counts.set(region.id, (counts.get(region.id) || 0) + 1);
    else unknown++;
  }
  // Only catalog IDs and counts leave CI, never raw region strings or rows.
  return { counts: [...counts].map(([id, sessions]) => ({ id, sessions })), unknown };
}
