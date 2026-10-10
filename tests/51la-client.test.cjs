const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

test('51LA signature follows the documented sorted SHA256 uppercase format', async () => {
  const { signature } = await import('../scripts/51la-client.mjs');
  const expected = createHash('sha256').update('accessKey=example&nonce=abcd&secretKey=test-secret&timestamp=1234567890123').digest('hex').toUpperCase();
  assert.equal(signature('example', 'test-secret', 'abcd', '1234567890123'), expected);
});

test('China reporting days use Asia/Shanghai rather than runner UTC', async () => {
  const { chinaDay } = await import('../scripts/51la-client.mjs');
  assert.equal(chinaDay(new Date('2026-10-09T16:01:00Z')), '2026-10-10');
});

test('client requires Secrets and only sends a signed request to the approved HTTPS API', async () => {
  const { createClient, MASK_ID } = await import('../scripts/51la-client.mjs');
  assert.throws(() => createClient({ accessKey: '', secretKey: '' }), /missing/);
  let called = false;
  const request = createClient({ accessKey: 'test-access', secretKey: 'test-secret', fetchImpl: async (url, options) => {
    called = true;
    assert.equal(url, 'https://v6-open.51.la/open/overview/get');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.maskId, MASK_ID);
    assert.equal(body.accessKey, 'test-access');
    assert.equal('secretKey' in body, false);
    assert.match(body.nonce, /^[a-f\d]{4}$/);
    assert.match(body.sign, /^[A-F\d]{64}$/);
    return { ok: true, json: async () => ({ success: true, code: '0000', bean: { totalPv: 3, totalUv: 2 } }) };
  } });
  await assert.rejects(request('/not-approved'), /unsupported/);
  assert.equal(called, false);
  const result = await request('/open/overview/get');
  assert.equal(result.bean.totalPv, 3);
});

test('API failure diagnostics never disclose returned credentials or private data', async () => {
  const { createClient } = await import('../scripts/51la-client.mjs');
  const request = createClient({ accessKey: 'test-access', secretKey: 'test-secret', fetchImpl: async () => ({
    ok: true, json: async () => ({ success: false, code: '5009', message: 'test-secret and private visitor data' }),
  }) });
  await assert.rejects(request('/open/overview/get'), { message: '51LA: API error 5009' });
});

test('HTTP 401 preserves only documented provider codes, not response messages or private fields', async () => {
  const { createClient } = await import('../scripts/51la-client.mjs');
  for (const code of ['5005', '5006', '5007', '5008', '5009']) {
    let bodyReads = 0;
    const request = createClient({ accessKey: 'test-access', secretKey: 'test-secret', fetchImpl: async () => ({
      ok: false, status: 401, json: async () => {
        bodyReads++;
        return { success: false, code, message: 'test-secret and private visitor data', accessKey: 'test-access', sign: 'private-signature', data: [{ ip: 'private-ip' }] };
      },
    }) });
    await assert.rejects(request('/open/overview/get'), { message: `51LA: API HTTP 401; API error ${code}` });
    assert.equal(bodyReads, 1);
  }
});

test('HTTP failures with unknown or non-JSON responses stay safe and cannot become successful data', async () => {
  const { createClient } = await import('../scripts/51la-client.mjs');
  const cases = [
    { payload: { code: 'test-secret', message: 'private-data' }, expected: 'unknown' },
    { payload: { code: '1234', message: 'private-data' }, expected: 'unknown' },
    { payload: null, expected: 'unknown' },
    { payload: { success: true, code: '0000', bean: { totalPv: 999 } }, expected: '0000' },
  ];
  for (const { payload, expected } of cases) {
    const request = createClient({ accessKey: 'test-access', secretKey: 'test-secret', fetchImpl: async () => ({
      ok: false, status: 401, json: async () => payload,
    }) });
    await assert.rejects(request('/open/overview/get'), { message: `51LA: API HTTP 401; API error ${expected}` });
  }
  const request = createClient({ accessKey: 'test-access', secretKey: 'test-secret', fetchImpl: async () => ({
    ok: false, status: 401, json: async () => { throw new Error('private response body'); },
  }) });
  await assert.rejects(request('/open/overview/get'), { message: '51LA: API HTTP 401; API error unknown (non-JSON response)' });
});

test('visitor pages handle nested and empty successful responses without guessing', async () => {
  const { sessionPage } = await import('../scripts/51la-client.mjs');
  assert.deepEqual(sessionPage({ total: 0, pages: 0 }), { data: [], total: 0, pages: 0 });
  const row = { region: '上海' };
  assert.deepEqual(sessionPage({ bean: { data: [row], total: 1, pages: 1 } }), { data: [row], total: 1, pages: 1 });
  assert.throws(() => sessionPage({ total: 8, data: null, secretKey: 'private-example' }), error => {
    assert.match(error.message, /unsupported visitor page format/);
    assert.equal(error.message.includes('private-example'), false);
    return true;
  });
});

test('read-only application diagnostics use only the approved account-list endpoint without a site mask', async () => {
  const { createClient } = await import('../scripts/51la-client.mjs');
  const request = createClient({ accessKey: 'test-access', secretKey: 'test-secret', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://v6-open.51.la/open/site/list');
    const body = JSON.parse(options.body);
    assert.equal('maskId' in body, false);
    assert.equal('secretKey' in body, false);
    return { ok: true, json: async () => ({ success: true, code: '0000', data: [] }) };
  } });
  assert.deepEqual((await request('/open/site/list')).data, []);
});

test('diagnostics compare separate counter periods without guessing or logging extra fields', async () => {
  const { overviewSummary } = await import('../scripts/51la-client.mjs');
  assert.deepEqual(overviewSummary({ bean: {
    curPv: 23, curUv: 8, curIp: 7, beforePv: 10, beforeUv: 5, beforeIp: 4,
    totalPv: 40, totalUv: 12, totalIp: 10, accessKey: 'private', sign: 'private',
  } }), {
    today: { pv: 23, uv: 8, ip: 7 }, yesterday: { pv: 10, uv: 5, ip: 4 }, cumulative: { pv: 40, uv: 12, ip: 10 },
  });
  assert.deepEqual(overviewSummary({ bean: { totalPv: 0, totalUv: 0, curPv: 'private', curUv: -1 } }), {
    today: { pv: null, uv: null, ip: null }, yesterday: { pv: null, uv: null, ip: null }, cumulative: { pv: 0, uv: 0, ip: null },
  });
});

test('application diagnostics exclude unrelated apps and private fields while checking exact homepage ownership', async () => {
  const { homepageSiteSummary, MASK_ID } = await import('../scripts/51la-client.mjs');
  const report = homepageSiteSummary({ data: [
    { maskId: MASK_ID, domain: 'https://xijunlee.github.io/', todayPv: 23, todayUv: 8, todayIp: 7, secretKey: 'private', siteName: 'private' },
    { maskId: 'HomepageApp12345', domain: 'example.org,xijunlee.github.io', todayPv: 2 },
    { maskId: 'UnrelatedApp1234', domain: 'xijunlee.github.io.attacker.example', siteName: 'private' },
    { maskId: 'AnotherApp12345', domain: 'https://xijunlee.github.io@attacker.example/' },
    null,
  ] });
  assert.equal(report.configuredAppVisible, true);
  assert.equal(report.applications.length, 2);
  assert.equal(report.applications[0].homepageDomain, true);
  assert.equal(report.applications[0].todayPv, 23);
  assert.equal(report.applications[1].configuredApp, false);
  assert.equal(JSON.stringify(report).includes('private'), false);
  assert.equal(JSON.stringify(report).includes('UnrelatedApp'), false);
  assert.throws(() => homepageSiteSummary({ data: null }), /unsupported application list/);
});
