const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const now = new Date('2026-10-12T20:00:00Z'); // 2026-10-13 04:00 UTC+8.
function snapshot(overrides = {}) {
  return {
    schema: 1, source: '51LA', maskId: '3RSi0ApWyvRKOoCj',
    updatedAt: '2026-10-12T19:05:00Z', attemptedDay: '2026-10-13',
    overview: { pv: 0, uv: 0 },
    days: [{ day: '2026-10-12', total: 0, collected: 0, unknown: 0, complete: true, counts: [] }],
    ...overrides,
  };
}
test('03:00 primary and 04:00/05:00/06:00 backups are scheduled in China time', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy-pages.yml', `file://${__filename}`), 'utf8');
  const schedules = [...workflow.matchAll(/cron:\s*'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(schedules, ['0 19 * * *', '0 20 * * *', '0 21 * * *', '0 22 * * *']);
  const format = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short' });
  for (const [index, utcHour] of [19, 20, 21, 22].entries()) {
    assert.equal(format.format(new Date(`2026-10-12T${utcHour}:00:00Z`)), `2026-10-13 0${index + 3}:00`);
  }
  assert.match(workflow, /needs: plan\s+if: needs\.plan\.outputs\.should_run == 'true'/);
  assert.match(workflow, /LA_RETRY_SYNC: \$\{\{ github\.event_name == 'schedule' \}\}/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name != 'schedule' \}\}/);
  assert.match(workflow, /key: 51la-public-v2-.*github\.run_id.*github\.run_attempt/);
  assert.match(workflow, /deploy:\s+needs: build/);
});
test('successful published data, including real zero counts, skips scheduled build and deployment', async () => {
  const { shouldRunDeployment } = await import('../scripts/check-51la-sync.mjs');
  let calls = 0;
  const decision = await shouldRunDeployment({ scheduled: true, now, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(new URL(url).origin, 'https://xijunlee.github.io');
    assert.equal(new URL(url).pathname, '/visitor-data.json');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => snapshot() };
  } });
  assert.equal(calls, 1);
  assert.equal(decision, false);
});
test('stale or overview-only data allows a scheduled backup to recover', async () => {
  const { shouldRunDeployment } = await import('../scripts/check-51la-sync.mjs');
  for (const value of [snapshot({ days: [] }), snapshot({ updatedAt: '2026-10-11T19:05:00Z', attemptedDay: '2026-10-12' }), null]) {
    assert.equal(await shouldRunDeployment({ scheduled: true, now, fetchImpl: async () => ({ ok: true, json: async () => value }) }), true);
  }
});
test('unreadable published data never invents daily success or prevents recovery', async () => {
  const { shouldRunDeployment } = await import('../scripts/check-51la-sync.mjs');
  for (const fetchImpl of [
    async () => { throw new Error('connection failed'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }),
  ]) {
    assert.equal(await shouldRunDeployment({ scheduled: true, now, fetchImpl }), true);
  }
});
test('manual runs and code pushes always build, even with successful daily data', async () => {
  const { shouldRunDeployment } = await import('../scripts/check-51la-sync.mjs');
  let calls = 0;
  assert.equal(await shouldRunDeployment({ scheduled: false, now, fetchImpl: async () => { calls++; throw new Error('must not fetch'); } }), true);
  assert.equal(calls, 0);
});
