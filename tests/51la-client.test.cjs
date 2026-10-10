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
