import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { MASK_ID, createClient, chinaDay, sessionPage } from './51la-client.mjs';
import { aggregateRegions, regionCatalog } from './visitor-regions.mjs';

const integer = value => Number.isSafeInteger(value) && value >= 0;
export function validateSnapshot(value) {
  if (value?.schema !== 1 || value.source !== '51LA' || value.maskId !== MASK_ID) return null;
  if (value.updatedAt != null && (!Number.isFinite(Date.parse(value.updatedAt)) || !integer(value.overview?.pv) || !integer(value.overview?.uv))) return null;
  if (!Array.isArray(value.days) || value.days.length > 90) return null;
  for (const day of value.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.day) || !integer(day.total) || !integer(day.collected) || !integer(day.unknown) || typeof day.complete !== 'boolean' || !Array.isArray(day.counts)) return null;
    if (day.counts.some(row => !regionCatalog.has(row.id) || !integer(row.sessions))) return null;
    if (day.counts.reduce((sum, row) => sum + row.sessions, day.unknown) !== day.collected || day.collected > day.total) return null;
  }
  // Reconstruct a strict public allowlist, discarding any unexpected fields.
  return {
    schema: 1, source: '51LA', maskId: MASK_ID,
    updatedAt: value.updatedAt ?? null,
    attemptedDay: /^\d{4}-\d{2}-\d{2}$/.test(value.attemptedDay) ? value.attemptedDay : null,
    overview: value.updatedAt ? { pv: value.overview.pv, uv: value.overview.uv } : null,
    days: value.days.map(day => ({ day: day.day, total: day.total, collected: day.collected, unknown: day.unknown, complete: day.complete, counts: day.counts.map(row => ({ id: row.id, sessions: row.sessions })) })),
  };
}

export function publicSnapshot(snapshot) {
  const days = snapshot.days.toSorted((a, b) => a.day.localeCompare(b.day)).slice(-90);
  const counts = new Map();
  for (const day of days) for (const row of day.counts) {
    const entry = counts.get(row.id) || { ...regionCatalog.get(row.id), sessions: 0 };
    entry.sessions += row.sessions;
    // Only safe, fixed catalog names / representative coordinates are published.
    delete entry.aliases;
    counts.set(row.id, entry);
  }
  return {
    ...snapshot, days,
    geography: {
      from: days[0]?.day ?? null, to: days.at(-1)?.day ?? null,
      complete: days.every(day => day.complete),
      unknown: days.reduce((sum, day) => sum + day.unknown, 0),
      regions: [...counts.values()].toSorted((a, b) => b.sessions - a.sessions),
    },
  };
}

export async function synchronize({ previous, request, now = new Date() }) {
  const snapshot = validateSnapshot(previous) || { schema: 1, source: '51LA', maskId: MASK_ID, updatedAt: null, attemptedDay: null, overview: null, days: [] };
  const today = chinaDay(now);
  if (snapshot.attemptedDay === today) return publicSnapshot(snapshot);
  snapshot.attemptedDay = today;
  try {
    const overview = (await request('/open/overview/get')).bean;
    if (!integer(overview?.totalPv) || !integer(overview?.totalUv)) throw new Error('51LA: invalid overview totals');
    snapshot.overview = { pv: overview.totalPv, uv: overview.totalUv };
    snapshot.updatedAt = now.toISOString();
    // Fetch a completed China-time day, not an unfinished day that would lose
    // evening visits. At most two detail pages: 3 API calls/day, <=93/month.
    const day = chinaDay(new Date(now.getTime() - 86400000));
    const first = sessionPage(await request('/open/visitor/detail/list', { day, page: 1, size: 100 }));
    if (!integer(first.total)) throw new Error('51LA: invalid geographic record total');
    let rows = first.data;
    if (first.total > rows.length && first.total > 100) {
      const second = sessionPage(await request('/open/visitor/detail/list', { day, page: 2, size: 100 }));
      rows = [...rows, ...second.data];
    }
    if (rows.length > first.total) throw new Error('51LA: inconsistent geographic page totals');
    const { counts, unknown } = aggregateRegions(rows);
    snapshot.days = snapshot.days.filter(row => row.day !== day);
    snapshot.days.push({ day, total: first.total, collected: rows.length, complete: rows.length === first.total, counts, unknown });
    console.log(`51LA synchronized: PV=${overview.totalPv}, UV=${overview.totalUv}; ${rows.length}/${first.total} sessions for ${day}.`);
  } catch (error) {
    // No provider message, visitor rows, keys, signatures or raw URLs in logs.
    console.warn(`51LA sync deferred; last valid public data retained. ${error.message.startsWith('51LA:') ? error.message : '51LA: unexpected sync failure'}`);
  }
  return publicSnapshot(snapshot);
}

async function main() {
  let previous;
  try { previous = validateSnapshot(JSON.parse(await readFile('.cache/51la/visitor-data.json', 'utf8'))); } catch {}
  if (!previous) {
    try {
      const response = await fetch('https://xijunlee.github.io/visitor-data.json', { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (response.ok) previous = validateSnapshot(await response.json());
    } catch {}
  }
  let snapshot;
  try { snapshot = await synchronize({ previous, request: createClient() }); }
  catch { snapshot = publicSnapshot(previous || { schema: 1, source: '51LA', maskId: MASK_ID, updatedAt: null, attemptedDay: null, overview: null, days: [] }); console.warn('51LA Secrets unavailable; retained data or unavailable state published.'); }
  await mkdir('.cache/51la', { recursive: true });
  const data = JSON.stringify(snapshot);
  await writeFile('.cache/51la/visitor-data.json', data);
  await writeFile('dist/visitor-data.json', data);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('51LA: cannot write public snapshot'); process.exitCode = 1; });
