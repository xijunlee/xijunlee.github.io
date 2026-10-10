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

export const regionCatalog = new Map([...countries, ...provinces].map(row => [row.id, row]));
const normalize = value => value.normalize('NFKC').replace(/[\s,，·/\\_-]+/g, '').toLowerCase();
const aliases = new Map();
for (const country of countries) {
  for (const label of [country.zh, country.en, ...country.aliases]) {
    if (label.length > 2 || /^[A-Z]{2}$/.test(label)) aliases.set(normalize(label), country);
  }
}
for (const [label, id] of [['美国', 'US'], ['英国', 'GB'], ['俄罗斯', 'RU'], ['韩国', 'KR'], ['朝鲜', 'KP'], ['越南', 'VN'], ['中国大陆', 'CN']]) {
  aliases.set(normalize(label), regionCatalog.get(id));
}

export function identifyRegion(value) {
  if (typeof value !== 'string' || value.length > 150) return null;
  const normalized = normalize(value);
  // Identify the country before provinces: an overseas city with a Chinese
  // substring must not accidentally become a Chinese province.
  const country = [...aliases.entries()].sort((a, b) => b[0].length - a[0].length)
    .find(([label]) => normalized === label || ((label.length > 2 || /[\u3400-\u9fff]/.test(label)) && normalized.startsWith(label)))?.[1];
  if (country && country.id !== 'CN') return country;
  const province = provinces.find(row => normalized.includes(normalize(row.zh)) || normalized.endsWith(normalize(row.en)));
  return province || country || null;
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
