'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'src/visitors.js'), 'utf8');
const globeCode = fs.readFileSync(path.join(root, 'src/visitor-globe.js'), 'utf8');
const topology = JSON.parse(fs.readFileSync(path.join(root, 'src/assets/geo/land-110m.json')));
const data = {
  schema: 1, source: '51LA', updatedAt: '2026-10-10T02:17:00Z',
  overview: { pv: 12345, uv: 6789 }, days: [{ day: '2026-10-09' }],
  geography: { from: '2026-10-09', to: '2026-10-09', complete: true, unknown: 0, regions: [{ id: 'CN-8', zh: '上海', en: 'Shanghai', lat: 31, lon: 121, sessions: 5 }] },
};
async function homepage(lang, snapshot = data, rendererFails = false) {
  const nodes = Object.fromEntries(['status', 'visual', 'total', 'unique', 'updated', 'regions'].map(name => [name, { textContent: '—', hidden: false, removeAttribute() {} }]));
  let rendered;
  const document = { body: { dataset: { lang } }, querySelector: () => ({ querySelector: selector => nodes[selector.match(/data-visitor-(.*)\]/)[1]] }) };
  vm.runInNewContext(code, {
    document, Intl, Date, Number, AbortSignal,
    fetch: async url => { assert.equal(url, 'visitor-data.json'); return { ok: true, json: async () => snapshot }; },
    window: { HomepageGlobe: async options => { if (rendererFails) throw new Error('unavailable'); rendered = options; } },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, rendered };
}

for (const lang of ['zh', 'en']) {
  test(`${lang}: displays source PV / UV independently of map session counts`, async () => {
    const { nodes, rendered } = await homepage(lang);
    assert.equal(nodes.total.textContent, '12,345');
    assert.equal(nodes.unique.textContent, '6,789');
    assert.match(nodes.regions.textContent, /^1 /);
    assert.equal(nodes.status.hidden, true);
    assert.equal(rendered.english, lang === 'en');
    assert.match(nodes.regions.title, /2026-10-09/);
    assert.match(nodes.updated.textContent, /UTC\+8/);
  });
  test(`${lang}: real zero counts are shown but no fake points are added`, async () => {
    const { nodes, rendered } = await homepage(lang, { ...data, overview: { pv: 0, uv: 0 }, geography: { ...data.geography, regions: [] } });
    assert.equal(nodes.total.textContent, '0');
    assert.equal(nodes.unique.textContent, '0');
    assert.equal(rendered.regions.length, 0);
    assert.equal(nodes.regions.textContent, lang === 'en' ? '0 source regions' : '0 个来源地区');
    assert.equal('range' in nodes, false);
  });
  test(`${lang}: unavailable data stays unavailable, not invented zero`, async () => {
    const { nodes, rendered } = await homepage(lang, { ...data, overview: null, updatedAt: null });
    assert.equal(nodes.total.textContent, '—');
    assert.equal(rendered, undefined);
    assert.equal(nodes.status.hidden, false);
  });
  test(`${lang}: map failure preserves the API totals`, async () => {
    const { nodes } = await homepage(lang, data, true);
    assert.equal(nodes.total.textContent, '12,345');
    assert.equal(nodes.status.hidden, false);
  });
  test(`${lang}: partial geographic context remains in the region tooltip without an extra row`, async () => {
    const { nodes } = await homepage(lang, { ...data, geography: { ...data.geography, complete: false, unknown: 3 } });
    assert.match(nodes.regions.title, lang === 'en' ? /Partial/ : /不完整/);
    assert.match(nodes.regions.title, /3 /);
  });
}

function svgNode(tag) {
  return { tag, attributes: {}, children: [], listeners: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...nodes) { this.children.push(...nodes); },
    addEventListener(name, fn) { this.listeners[name] = fn; },
  };
}
async function globe(regions = data.geography.regions) {
  const context = vm.createContext({ console, Math, Number, Array, Set, Map });
  // Run the actual locally vendored drawing libraries, not projection mocks.
  for (const file of ['d3-array.min.js', 'd3-geo.min.js', 'topojson-client.min.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/assets/vendor', file), 'utf8'), context);
  }
  const visual = svgNode('div'); visual.dataset = {};
  Object.assign(context, {
    window: context, AbortSignal,
    document: { createElementNS: (_, tag) => svgNode(tag), addEventListener() {}, hidden: false },
    fetch: async url => { assert.equal(url, 'assets/geo/land-110m.json'); return { ok: true, json: async () => topology }; },
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    IntersectionObserver: class { observe() {} },
    requestAnimationFrame: () => { throw new Error('offscreen rendering must not wait for frames'); },
  });
  vm.runInContext(globeCode, context);
  await context.HomepageGlobe({ root: visual, regions, english: false });
  return visual;
}
test('globe renders real local geometry before animation and clips rear points', async () => {
  const visual = await globe([...data.geography.regions, { zh: '另一面', en: 'Rear', lat: -31, lon: -59, sessions: 2 }]);
  const svg = visual.children[0];
  assert.equal(svg.tag, 'svg');
  assert.match(svg.children.find(row => row.tag === 'path').attributes.d, /^M/);
  const dots = svg.children.find(row => row.tag === 'g').children;
  assert.equal(dots.length, 2);
  assert.equal(dots[0].attributes.display, 'inline');
  assert.equal(dots[1].attributes.display, 'none');
  assert.equal(visual.dataset.state, 'ready');
});
test('empty globe has no artificial location markers', async () => {
  const visual = await globe([]);
  assert.equal(visual.children[0].children.find(row => row.tag === 'g').children.length, 0);
});
test('both homepages restore statistics and map-credit links without branding or verbose region rows', () => {
  for (const filename of ['index.html', 'en.html']) {
    const html = fs.readFileSync(path.join(root, 'src', filename), 'utf8');
    const visitor = html.match(/<section class="visitor-section[\s\S]*?<\/section>/)[0];
    assert.doesNotMatch(visitor, /51LA|data-visitor-range|暂无访客来源记录|No visitor source records/);
    assert.match(visitor, /class="visitor-details" href="https:\/\/v6\.51\.la\/" target="_blank" rel="noopener noreferrer"/);
    assert.ok(visitor.includes(filename === 'index.html' ? '统计数据 ↗' : 'Statistics ↗'));
    assert.match(visitor, /class="visitor-credits" href="assets\/geo\/ATTRIBUTION\.md"[^>]*>Map credits<\/a>/);
    assert.equal(html.split('href="assets/geo/ATTRIBUTION.md"').length - 1, 1);
    assert.ok(visitor.includes('visitor-metrics'));
    assert.ok(html.includes('data-visitor-unique'));
    assert.ok(html.includes('data-visitor-updated'));
    assert.ok(html.includes('visitor-globe.js?v=6'));
    assert.ok(html.includes('styles.css?v=10'));
    assert.equal(html.includes('mapmyvisitors.com'), false);
  }
  assert.equal(globeCode.includes('https://'), false);
  const compatibility = fs.readFileSync(path.join(root, 'src/visitor-globe.html'), 'utf8');
  assert.equal(compatibility.includes('<script'), false);
});

test('compact statistics preserve the shared application-column and centered globe geometry', () => {
  const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  assert.match(styles, /\.join-layout,\.visitor-bar\{[^}]*grid-template-columns:minmax\(0,1fr\) var\(--application-column\)/);
  assert.match(styles, /\.visitor-bar\{align-items:center/);
  assert.match(styles, /\.visitor-metrics\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.visitor-links\{display:flex;flex-wrap:wrap/);
  assert.match(styles, /\.visitor-visual\{[^}]*justify-self:center;[^}]*width:8rem;[^}]*height:8rem/);
});

module.exports = { globe };
