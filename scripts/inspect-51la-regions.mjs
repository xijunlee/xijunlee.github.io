// Explicit diagnostic only: one read-only API page, aggregate counts in logs.
import { pathToFileURL } from 'node:url';
import { createClient, chinaDay, sessionPage } from './51la-client.mjs';
import { identifyRegion, regionCatalog } from './visitor-regions.mjs';

export async function inspectRegionPrecision({ snapshot, request, now = new Date() }) {
  const earliest = chinaDay(new Date(now.getTime() - 14 * 86400000));
  const yesterday = chinaDay(new Date(now.getTime() - 86400000));
  // Pick a recent, already-public recorded day with US traffic if possible.
  // Do not query accounts, unrelated sites, or visitor-specific IP filters.
  const day = snapshot?.days?.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.day) && row.day >= earliest && row.day <= yesterday)
    .toSorted((a, b) => b.day.localeCompare(a.day))
    .find(row => row.counts?.some(count => count.sessions > 0 && (count.id === 'US' || regionCatalog.get(count.id)?.country === 'US')))?.day || yesterday;
  const page = sessionPage(await request('/open/visitor/detail/list', { day, page: 1, size: 100 }));
  const result = { day, total: page.total, inspected: page.data.length, levels: { city: 0, subdivision: 0, country: 0, unknown: 0 }, us: { city: 0, subdivision: 0, country: 0, additionalLocation: 0 } };
  for (const row of page.data) {
    const region = identifyRegion(row.region);
    result.levels[region?.level || 'unknown']++;
    if (region?.id === 'US' || region?.country === 'US') {
      result.us[region.level]++;
      const suffix = row.region.trim().match(/^(?:美[国國]|美利[坚堅]合[众眾][国國]|United States(?: of America)?|USA|US)(.*)$/i)?.[1];
      if (suffix?.replace(/[\s\p{P}]/gu, '')) result.us.additionalLocation++;
    }
  }
  return result;
}

async function main() {
  let snapshot;
  try {
    const response = await fetch(`https://xijunlee.github.io/visitor-data.json?precision=${Date.now()}`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (response.ok) snapshot = await response.json();
  } catch {}
  const result = await inspectRegionPrecision({ snapshot, request: createClient() });
  console.log(`51LA source geographic precision: ${JSON.stringify(result)}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.warn(error.message?.startsWith('51LA:') ? error.message : '51LA: geographic precision diagnostic unavailable'); process.exitCode = 1; });
}
