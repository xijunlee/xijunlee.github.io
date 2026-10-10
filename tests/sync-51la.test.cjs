const test = require('node:test');
const assert = require('node:assert/strict');
const now = new Date('2026-10-10T02:17:00Z');
async function modules() { return { ...await import('../scripts/sync-51la.mjs'), ...await import('../scripts/visitor-regions.mjs') }; }
function mockRequest(rows = []) {
  const calls = [];
  return { calls, request: async (endpoint, params) => {
    calls.push({ endpoint, params });
    if (endpoint.includes('overview')) return { bean: { totalPv: 99, totalUv: 20 } };
    const start = (params.page - 1) * 100;
    return { data: rows.slice(start, start + 100), total: rows.length, pages: Math.ceil(rows.length / 100) };
  } };
}
test('country and province mapping never publishes raw visitor identifiers', async () => {
  const { aggregateRegions, identifyRegion } = await modules();
  assert.equal(identifyRegion('中国 浙江省 杭州市').zh, '浙江');
  assert.equal(identifyRegion('美国/加利福尼亚').id, 'US');
  assert.equal(identifyRegion('China Shanghai').zh, '上海');
  assert.equal(identifyRegion('unsupported private region'), null);
  const result = aggregateRegions([{ region: '上海', ip: 'private-ip', uuid: 'private-id' }, { region: 'unsupported private region' }]);
  assert.equal(result.counts[0].sessions, 1);
  assert.equal(result.unknown, 1);
  assert.equal(JSON.stringify(result).includes('private'), false);
});
test('sync uses real totals and completed China-time days; repeated deployments spend no API calls', async () => {
  const { synchronize } = await modules();
  const { calls, request } = mockRequest([{ region: '上海', ip: 'private-ip', uuid: 'private-id' }]);
  const first = await synchronize({ request, now });
  assert.deepEqual(first.overview, { pv: 99, uv: 20 });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].params.day, '2026-10-09');
  assert.equal(first.geography.regions[0].sessions, 1);
  assert.equal(JSON.stringify(first).includes('private'), false);
  const second = await synchronize({ previous: first, request, now });
  assert.equal(calls.length, 2);
  assert.deepEqual(second, first);
});
test('a second detail page completes 150 sessions within a three-call daily budget', async () => {
  const { synchronize } = await modules();
  const { calls, request } = mockRequest(Array.from({ length: 150 }, () => ({ region: '美国' })));
  const data = await synchronize({ request, now });
  assert.equal(calls.length, 3);
  assert.equal(data.days[0].collected, 150);
  assert.equal(data.geography.complete, true);
});
test('explicit manual refresh bypasses the daily guard once and replaces rather than duplicates the day', async () => {
  const { synchronize } = await modules();
  const first = await synchronize({ request: mockRequest([{ region: '上海' }]).request, now });
  const { calls, request } = mockRequest([{ region: '上海' }, { region: '浙江' }]);
  const refreshedAt = new Date('2026-10-10T06:00:00Z');
  const refreshed = await synchronize({ previous: first, request, now: refreshedAt, force: true });
  assert.equal(calls.length, 2);
  assert.equal(refreshed.updatedAt, refreshedAt.toISOString());
  assert.equal(refreshed.days.length, 1);
  assert.equal(refreshed.days[0].collected, 2);
  assert.equal(refreshed.geography.regions.length, 2);
  const reused = await synchronize({ previous: refreshed, request, now: refreshedAt });
  assert.equal(calls.length, 2);
  assert.deepEqual(reused, refreshed);
});
test('newer published manual data beats an immutable same-day cache, with cache fallback for unpublished attempts', async () => {
  const { synchronize, latestSnapshot } = await modules();
  const cached = await synchronize({ request: mockRequest().request, now });
  const published = await synchronize({ previous: cached, request: mockRequest([{ region: '上海' }]).request, now: new Date('2026-10-10T06:00:00Z'), force: true });
  assert.equal(latestSnapshot(cached, published).updatedAt, published.updatedAt);
  assert.equal(latestSnapshot(cached, published).days[0].collected, 1);
  assert.equal(latestSnapshot(undefined, cached).updatedAt, cached.updatedAt);
  const failedAttempt = { ...published, attemptedDay: '2026-10-11' };
  assert.equal(latestSnapshot(published, failedAttempt).attemptedDay, '2026-10-11');
  assert.equal(latestSnapshot({ secret: 'private' }), null);
});
test('more than 200 sessions is visibly partial, never silently complete', async () => {
  const { synchronize } = await modules();
  const { calls, request } = mockRequest(Array.from({ length: 201 }, () => ({ region: '上海' })));
  const data = await synchronize({ request, now });
  assert.equal(calls.length, 3);
  assert.equal(data.days[0].collected, 200);
  assert.equal(data.days[0].total, 201);
  assert.equal(data.geography.complete, false);
  assert.equal(data.overview.pv, 99);
});
test('valid empty source response records a completed empty day', async () => {
  const { synchronize } = await modules();
  const data = await synchronize({ request: mockRequest().request, now });
  assert.equal(data.days[0].total, 0);
  assert.equal(data.geography.regions.length, 0);
  assert.equal(data.geography.complete, true);
});
test('API failure retains the last source data and does not retry on every code push', async () => {
  const { synchronize } = await modules();
  const previous = await synchronize({ request: mockRequest([{ region: '上海' }]).request, now: new Date('2026-10-09T02:17:00Z') });
  let calls = 0;
  const request = async () => { calls++; throw new Error('51LA: API error 5006'); };
  const next = await synchronize({ previous, request, now });
  assert.deepEqual(next.overview, previous.overview);
  assert.equal(next.updatedAt, previous.updatedAt);
  assert.deepEqual(next.days, previous.days);
  await synchronize({ previous: next, request, now });
  assert.equal(calls, 1);
});
test('failed forced refresh retains valid data and does not force later ordinary deployments', async () => {
  const { synchronize } = await modules();
  const previous = await synchronize({ request: mockRequest([{ region: '上海' }]).request, now });
  let calls = 0;
  const request = async () => { calls++; throw new Error('51LA: API HTTP 401'); };
  const next = await synchronize({ previous, request, now, force: true });
  assert.equal(calls, 1);
  assert.equal(next.updatedAt, previous.updatedAt);
  assert.deepEqual(next.overview, previous.overview);
  assert.deepEqual(next.days, previous.days);
  await synchronize({ previous: next, request, now });
  assert.equal(calls, 1);
});
test('snapshot validation strips unexpected fields and rejects impossible aggregates', async () => {
  const { synchronize, validateSnapshot } = await modules();
  const data = await synchronize({ request: mockRequest([{ region: '上海' }]).request, now });
  data.secret = 'private'; data.days[0].ip = 'private';
  assert.equal(JSON.stringify(validateSnapshot(data)).includes('private'), false);
  data.days[0].counts[0].sessions = 100;
  assert.equal(validateSnapshot(data), null);
});
