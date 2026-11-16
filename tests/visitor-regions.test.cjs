const test = require('node:test');
const assert = require('node:assert/strict');
const modules = () => import('../scripts/visitor-regions.mjs');

test('cities within one country have different points, without changing country-only records', async () => {
  const { identifyRegion, aggregateRegions } = await modules();
  const la = identifyRegion('美国/加利福尼亚州/洛杉矶');
  const ny = identifyRegion('美国/纽约州/纽约市');
  assert.equal(la.id, 'CITY:5368361'); assert.equal(la.level, 'city');
  assert.equal(ny.id, 'CITY:5128581'); assert.equal(ny.level, 'city');
  assert.notEqual(la.lon, ny.lon);
  const result = aggregateRegions(['美国/加利福尼亚州/洛杉矶', '美国/纽约州/纽约市', '美国', '美国'].map(region => ({ region })));
  assert.deepEqual(result.counts.map(r => [r.id, r.sessions]), [[la.id, 1], [ny.id, 1], ['US', 2]]);
});

test('known states survive missing/unrecognized cities and country-only values stay coarse', async () => {
  const { identifyRegion } = await modules();
  for (const name of ['美国/加利福尼亚', 'United States California', 'US/CA/unknown-city']) {
    assert.equal(identifyRegion(name).id, 'ADM1:US.CA');
  }
  for (const name of ['美国', 'United States', 'US/unknown-state/unknown-city', '美国上海']) {
    assert.equal(identifyRegion(name).id, 'US');
  }
  assert.equal(identifyRegion('unrecognized private region'), null);
  assert.equal(identifyRegion('USCalifornia'), null);
  assert.equal(identifyRegion('US/Massachusettsville').id, 'US');
});

test('Chinese/English names, codes, traditional characters and explicit city suffixes agree', async () => {
  const { identifyRegion } = await modules();
  for (const name of ['美国/加利福尼亚州/洛杉矶市', '美國/加利福尼亞州/洛杉磯', 'United States California Los Angeles', 'US/CA/Los Angeles']) {
    assert.equal(identifyRegion(name)?.id, 'CITY:5368361', name);
  }
  assert.equal(identifyRegion('美国/加利福尼亚州/旧金山').id, 'CITY:5391959');
  assert.equal(identifyRegion('中国 浙江省 杭州市').id, 'CITY:1808926');
  assert.equal(identifyRegion('浙江省杭州市').id, 'CITY:1808926');
  assert.equal(identifyRegion('中国台湾省台北市').id, 'CITY:1668341');
  assert.equal(identifyRegion('香港').id, 'CN-32');
  assert.equal(identifyRegion('澳门').id, 'CN-33');
  assert.equal(identifyRegion('台湾').id, 'CN-31');
});

test('ambiguous cities require a state, and exact state names do not imply a namesake city', async () => {
  const { identifyRegion } = await modules();
  assert.equal(identifyRegion('美国/Springfield').id, 'US');
  assert.equal(identifyRegion('美国/Illinois/Springfield').id, 'CITY:4250542');
  assert.equal(identifyRegion('美国/Massachusetts/Springfield').id, 'CITY:4951788');
  assert.equal(identifyRegion('美国/纽约州/洛杉矶').id, 'ADM1:US.NY');
  assert.equal(identifyRegion('United States New York').id, 'ADM1:US.NY');
  assert.equal(identifyRegion('United States New York City').id, 'CITY:5128581');
});

test('the same city name in different countries never shares a point', async () => {
  const { identifyRegion } = await modules();
  const london = identifyRegion('United Kingdom London');
  const ontario = identifyRegion('Canada Ontario London');
  assert.equal(london.country, 'GB'); assert.equal(london.level, 'city');
  assert.equal(ontario.country, 'CA'); assert.equal(ontario.level, 'city');
  assert.notEqual(london.id, ontario.id);
  assert.equal(identifyRegion('日本/东京都/东京')?.id, 'CITY:1850147');
});

test('fine locations survive sync/cache validation while raw visitor fields are removed', async () => {
  const { synchronize, validateSnapshot, publicSnapshot } = await import('../scripts/sync-51la.mjs');
  const rows = [{ region: '美国/加利福尼亚州/洛杉矶', ip: 'private-ip', uuid: 'private-id', srcUrl: 'private-url' }, { region: '美国/纽约州', ip: 'private-ip' }, { region: '美国' }];
  const snapshot = await synchronize({ now: new Date('2026-11-16T01:00:00Z'), request: async endpoint => endpoint.includes('overview') ? { bean: { totalPv: 23, totalUv: 8 } } : { data: rows, total: rows.length } });
  assert.deepEqual(snapshot.overview, { pv: 23, uv: 8 });
  assert.deepEqual(snapshot.geography.regions.map(r => r.level), ['city', 'subdivision', 'country']);
  assert.equal(snapshot.days[0].collected, 3);
  const restored = publicSnapshot(validateSnapshot(snapshot));
  assert.deepEqual(restored, snapshot);
  assert.doesNotMatch(JSON.stringify(snapshot), /private|srcUrl|admin1|aliases/);
  for (const region of snapshot.geography.regions) assert.deepEqual(Object.keys(region).sort(), ['en', 'id', 'lat', 'level', 'lon', 'sessions', 'zh']);
});

test('existing country/province history remains valid and is not redistributed into cities', async () => {
  const { MASK_ID } = await import('../scripts/51la-client.mjs');
  const { validateSnapshot, publicSnapshot } = await import('../scripts/sync-51la.mjs');
  const old = { schema: 1, source: '51LA', maskId: MASK_ID, updatedAt: '2026-11-15T00:00:00Z', overview: { pv: 23, uv: 8 }, attemptedDay: '2026-11-15', days: [{ day: '2026-11-14', total: 9, collected: 9, unknown: 0, complete: true, counts: [{ id: 'US', sessions: 7 }, { id: 'CN-8', sessions: 2 }] }] };
  const migrated = publicSnapshot(validateSnapshot(old));
  assert.equal(migrated.geography.regions[0].id, 'US');
  assert.equal(migrated.geography.regions[0].sessions, 7);
  assert.equal(migrated.geography.regions.some(r => r.level === 'city'), false);
});

test('explicit source diagnostic uses one page and reveals only dates and aggregate counts', async () => {
  const { inspectRegionPrecision } = await import('../scripts/inspect-51la-regions.mjs');
  const calls = [];
  const result = await inspectRegionPrecision({
    now: new Date('2026-11-16T00:00:00Z'),
    snapshot: { days: [{ day: '2026-11-11', counts: [{ id: 'US', sessions: 2 }] }] },
    request: async (endpoint, params) => { calls.push({ endpoint, params }); return { total: 3, data: [
      { region: '美国', ip: 'private-ip' },
      { region: '美国/加利福尼亚州/洛杉矶', uuid: 'private-id' },
      { region: 'unknown private region', srcUrl: 'private-url' },
    ] }; },
  });
  assert.equal(calls.length, 1); assert.equal(calls[0].params.day, '2026-11-11');
  assert.deepEqual(result.us, { city: 1, subdivision: 0, country: 1, additionalLocation: 1 });
  assert.equal(result.levels.unknown, 1);
  assert.doesNotMatch(JSON.stringify(result), /private|ip|uuid|srcUrl|洛杉矶/);
});
