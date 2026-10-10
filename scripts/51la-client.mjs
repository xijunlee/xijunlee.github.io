import { createHash, createDecipheriv, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const MASK_ID = '3RSi0ApWyvRKOoCj';
const ENDPOINTS = new Set(['/open/overview/get', '/open/visitor/detail/list']);

export function signature(accessKey, secretKey, nonce, timestamp) {
  const input = Object.entries({ accessKey, nonce, secretKey, timestamp })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return createHash('sha256').update(input).digest('hex').toUpperCase();
}

export function decodeResponse(response, secretKey) {
  if (typeof response.bean !== 'string') return response;
  if (!/^(?:[a-f\d]{2})+$/i.test(response.bean)) throw new Error('51LA: unsupported encrypted response');
  const key = Buffer.from(secretKey, 'utf8');
  if (![16, 24, 32].includes(key.length)) throw new Error('51LA: invalid encryption key length');
  const decipher = createDecipheriv(`aes-${key.length * 8}-cbc`, key, key.subarray(0, 16));
  let decoded;
  try {
    decoded = JSON.parse(Buffer.concat([decipher.update(Buffer.from(response.bean, 'hex')), decipher.final()]).toString('utf8'));
  } catch {
    throw new Error('51LA: cannot decode encrypted response');
  }
  return Array.isArray(decoded) ? { ...response, bean: undefined, data: decoded } : { ...response, ...decoded, bean: decoded.bean ?? decoded };
}

export function chinaDay(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function createClient({ accessKey = process.env.LA_ACCESS_KEY, secretKey = process.env.LA_SECRET_KEY, fetchImpl = fetch } = {}) {
  accessKey = accessKey?.trim();
  secretKey = secretKey?.trim();
  if (!accessKey || !secretKey) throw new Error('51LA: missing LA_ACCESS_KEY or LA_SECRET_KEY in Actions Secrets');
  return async (path, params = {}) => {
    if (!ENDPOINTS.has(path)) throw new Error('51LA: unsupported API endpoint');
    const nonce = randomBytes(2).toString('hex');
    const timestamp = String(Date.now());
    const body = { ...params, maskId: MASK_ID, accessKey, nonce, timestamp, sign: signature(accessKey, secretKey, nonce, timestamp) };
    let response;
    try {
      response = await fetchImpl(`https://v6-open.51.la${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error('51LA: API network request failed');
    }
    if (!response.ok) throw new Error(`51LA: API HTTP ${response.status}`);
    let payload;
    try { payload = await response.json(); } catch { throw new Error('51LA: API returned invalid JSON'); }
    if (payload.success !== true || String(payload.code) !== '0000') {
      // Never print response bodies, credentials, signatures or visitor records.
      const code = /^\d{4}$/.test(String(payload.code)) ? payload.code : 'unknown';
      throw new Error(`51LA: API error ${code}`);
    }
    return decodeResponse(payload, secretKey);
  };
}

async function probe() {
  if (!process.env.LA_ACCESS_KEY?.trim() || !process.env.LA_SECRET_KEY?.trim()) {
    // Only boolean configuration metadata is logged. Never read alternative
    // credential values or send an unrelated key to the analytics service.
    if (process.env.LA_CONFIG_NAMES) console.log(`51LA credential-name presence (no values): ${process.env.LA_CONFIG_NAMES}`);
  }
  const request = createClient();
  const overview = await request('/open/overview/get');
  const { totalPv, totalUv } = overview.bean || {};
  if (![totalPv, totalUv].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('51LA: API overview is missing valid totalPv / totalUv fields');
  }
  console.log(`51LA Secrets and signed overview request verified: PV=${totalPv}, UV=${totalUv}.`);
  const regions = await request('/open/visitor/detail/list', { day: chinaDay(), page: 1, size: 100 });
  if (!Array.isArray(regions.data)) throw new Error('51LA: API visitor detail response is missing data');
  console.log(`51LA geographic detail access verified: ${regions.data.length} session records returned; no private records are logged.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  probe().catch(error => { console.error(error.message); process.exitCode = 1; });
}
