import { createHash, createDecipheriv, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const MASK_ID = '3RSi0ApWyvRKOoCj';
const ENDPOINTS = new Set(['/open/overview/get', '/open/visitor/detail/list', '/open/site/list']);
const RESPONSE_CODES = new Set(['0000', '5005', '5006', '5007', '5008', '5009', '7001', '9001']);
const safeResponseCode = payload => RESPONSE_CODES.has(String(payload?.code)) ? String(payload.code) : 'unknown';

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

export function sessionPage(response) {
  const page = response.bean && typeof response.bean === 'object' && !Array.isArray(response.bean)
    ? response.bean : response;
  const total = page.total;
  // Successful empty queries may omit `data`, unlike the populated example.
  const data = Array.isArray(page.data) ? page.data : total === 0 && page.data == null ? [] : null;
  if (!data) {
    const fields = ['bean', 'data', 'total', 'pages', 'curPage', 'pageSize'];
    const shape = Object.fromEntries(fields.map(key => [key,
      page[key] === null ? 'null' : Array.isArray(page[key]) ? 'array' : typeof page[key],
    ]));
    // Allowlisted field types only: never log visitor rows or API body values.
    throw new Error(`51LA: unsupported visitor page format (${JSON.stringify(shape)})`);
  }
  return { data, total, pages: page.pages };
}

export function createClient({ accessKey = process.env.LA_ACCESS_KEY, secretKey = process.env.LA_SECRET_KEY, fetchImpl = fetch } = {}) {
  accessKey = accessKey?.trim();
  secretKey = secretKey?.trim();
  if (!accessKey || !secretKey) throw new Error('51LA: missing LA_ACCESS_KEY or LA_SECRET_KEY in Actions Secrets');
  return async (path, params = {}) => {
    if (!ENDPOINTS.has(path)) throw new Error('51LA: unsupported API endpoint');
    const nonce = randomBytes(2).toString('hex');
    const timestamp = String(Date.now());
    const body = { ...params, ...(path === '/open/site/list' ? {} : { maskId: MASK_ID }), accessKey, nonce, timestamp, sign: signature(accessKey, secretKey, nonce, timestamp) };
    let response;
    try {
      response = await fetchImpl(`https://v6-open.51.la${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error('51LA: API network request failed');
    }
    let payload;
    try { payload = await response.json(); } catch {
      if (!response.ok) throw new Error(`51LA: API HTTP ${response.status}; API error unknown (non-JSON response)`);
      throw new Error('51LA: API returned invalid JSON');
    }
    const code = safeResponseCode(payload);
    // Error responses may contain a useful provider code even on HTTP 401.
    // Log only documented codes, never raw messages, bodies, keys or signatures.
    if (!response.ok) throw new Error(`51LA: API HTTP ${response.status}; API error ${code}`);
    if (payload?.success !== true || code !== '0000') {
      throw new Error(`51LA: API error ${code}`);
    }
    return decodeResponse(payload, secretKey);
  };
}

export function overviewSummary(response) {
  const value = response?.bean;
  const count = name => Number.isSafeInteger(value?.[name]) && value[name] >= 0 ? value[name] : null;
  return Object.fromEntries([['today', 'cur'], ['yesterday', 'before'], ['cumulative', 'total']].map(([period, prefix]) =>
    [period, { pv: count(`${prefix}Pv`), uv: count(`${prefix}Uv`), ip: count(`${prefix}Ip`) }]
  ));
}

export function homepageSiteSummary(response) {
  if (!Array.isArray(response?.data)) throw new Error('51LA: unsupported application list format');
  const matchesDomain = value => typeof value === 'string' && value.split(/[,\s]+/).some(domain => {
    try { return new URL(domain.includes('://') ? domain : `https://${domain}`).hostname === 'xijunlee.github.io'; }
    catch { return false; }
  });
  const matchesId = row => row?.maskId === MASK_ID;
  return {
    configuredAppVisible: response.data.some(matchesId),
    applications: response.data.filter(row => row && (matchesId(row) || matchesDomain(row.domain))).map(row => ({
      maskId: typeof row.maskId === 'string' && /^[A-Za-z0-9]{8,64}$/.test(row.maskId) ? row.maskId : null,
      configuredApp: matchesId(row), homepageDomain: matchesDomain(row.domain),
      ...Object.fromEntries(['todayPv', 'todayUv', 'todayIp', 'yesterdayPv', 'yesterdayUv', 'yesterdayIp'].map(name =>
        [name, Number.isSafeInteger(row[name]) && row[name] >= 0 ? row[name] : null]
      )),
    })),
  };
}

async function probe() {
  if (!process.env.LA_ACCESS_KEY?.trim() || !process.env.LA_SECRET_KEY?.trim()) {
    // Only boolean configuration metadata is logged. Never read alternative
    // credential values or send an unrelated key to the analytics service.
    if (process.env.LA_CONFIG_NAMES) console.log(`51LA credential-name presence (no values): ${process.env.LA_CONFIG_NAMES}`);
  }
  const request = createClient();
  if (process.argv.includes('--compare-statistics')) {
    // Two read-only requests. Only project app IDs, match flags and numeric
    // aggregate counters are logged; no unrelated apps or raw fields.
    for (const [label, endpoint, summarize] of [
      ['application comparison', '/open/site/list', homepageSiteSummary],
      ['counter comparison', '/open/overview/get', overviewSummary],
    ]) {
      try { console.log(`51LA ${label}: ${JSON.stringify(summarize(await request(endpoint)))}`); }
      catch (error) { console.warn(`51LA ${label}: ${error.message.startsWith('51LA:') ? error.message : '51LA: unexpected diagnostic failure'}`); }
    }
    return;
  }
  if (!process.argv.includes('--regions-only')) {
    const overview = await request('/open/overview/get');
    const { totalPv, totalUv } = overview.bean || {};
    if (![totalPv, totalUv].every(value => Number.isSafeInteger(value) && value >= 0)) {
      throw new Error('51LA: API overview is missing valid totalPv / totalUv fields');
    }
    console.log(`51LA Secrets and signed overview request verified: PV=${totalPv}, UV=${totalUv}.`);
  }
  const regions = sessionPage(await request('/open/visitor/detail/list', { day: chinaDay(), page: 1, size: 100 }));
  console.log(`51LA geographic detail access verified: ${regions.data.length} session records returned; no private records are logged.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  probe().catch(error => { console.error(error.message); process.exitCode = 1; });
}
