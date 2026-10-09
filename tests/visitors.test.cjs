'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const parentCode = fs.readFileSync(path.join(root, 'src/visitors.js'), 'utf8');
const childCode = fs.readFileSync(path.join(root, 'src/visitor-globe.js'), 'utf8');
const childHTML = fs.readFileSync(path.join(root, 'src/visitor-globe.html'), 'utf8');
const statsURL = 'https://mapmyvisitors.com/web/1c8rq';

function homepage(lang = 'zh', hostname = 'xijunlee.github.io') {
  const nodes = new Map([
    ['[data-visitor-visual]', { dataset: {}, frames: [], append(frame) { this.frames.push(frame); } }],
    ['[data-visitor-status]', { hidden: true, textContent: 'Loading' }],
    ['[data-visitor-details]', { hidden: false, href: statsURL }],
    ['[data-visitor-visits]', { textContent: '—' }],
    ['[data-visitor-locations]', { textContent: '—' }],
  ]);
  const section = { querySelector: selector => nodes.get(selector) };
  const frame = { contentWindow: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const timers = new Map();
  let listener;
  vm.runInNewContext(parentCode, {
    URL, URLSearchParams, Intl,
    location: { hostname },
    document: {
      baseURI: `https://${hostname}/${lang === 'en' ? 'en.html' : 'index.html'}`,
      body: { dataset: { lang } },
      querySelector: selector => selector === '.visitor-section' ? section : null,
      createElement: tag => { assert.equal(tag, 'iframe'); return frame; },
    },
    window: { addEventListener: (name, callback) => { assert.equal(name, 'message'); listener = callback; } },
    setTimeout: callback => { timers.set(1, callback); return 1; },
    clearTimeout: id => timers.delete(id),
  });
  const message = (data, source = frame.contentWindow) => listener({ data, source, origin: 'null' });
  return { nodes, frame, timers, message };
}

function globe(lang = 'zh-CN', reducedMotion = false) {
  let link = null;
  let points = [];
  let observer;
  const messages = [];
  const microtasks = [];
  const styles = [];
  const document = {
    documentElement: {}, body: {},
    head: { append: style => styles.push(style) },
    createElement: tag => { assert.equal(tag, 'style'); return {}; },
    querySelector: selector => {
      if (selector === '#mmvst_a') return link;
      // Returning only the first group prevents counting mirrored SVG points.
      assert.equal(selector, '.svg_points');
      return { querySelectorAll: selector => { assert.equal(selector, 'circle[title]'); return points; } };
    },
  };
  vm.runInNewContext(childCode, {
    URLSearchParams, document,
    location: { search: `?lang=${lang}` },
    parent: { postMessage: (data, origin) => messages.push({ ...data, origin }) },
    MutationObserver: class {
      constructor(callback) { observer = callback; }
      observe(target, options) { assert.equal(target, document.body); assert.equal(options.subtree, true); }
    },
    queueMicrotask: callback => microtasks.push(callback),
    requestAnimationFrame: () => { throw new Error('Offscreen animation frames must not gate statistics'); },
    matchMedia: () => ({ matches: reducedMotion }),
  });
  return {
    document, messages, styles, microtasks,
    setMarkers(rows, href = statsURL) {
      link = { href, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
      points = rows.map(([title, cx, cy]) => ({ getAttribute: name => ({ title, cx, cy })[name] }));
      return link;
    },
    mutate() { observer(); },
    flush() { while (microtasks.length) microtasks.shift()(); },
  };
}

for (const lang of ['zh', 'en']) {
  test(`${lang}: uses a real HTTPS iframe, preserving the sandbox`, () => {
    const page = homepage(lang);
    const frameURL = new URL(page.frame.src);
    assert.equal(frameURL.protocol, 'https:');
    assert.equal(frameURL.pathname, '/visitor-globe.html');
    assert.equal(frameURL.searchParams.get('lang'), lang === 'en' ? 'en' : 'zh-CN');
    assert.equal(frameURL.searchParams.get('v'), '2');
    assert.equal('srcdoc' in page.frame, false);
    assert.equal(page.frame.attributes.sandbox, 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
    assert.equal(page.nodes.get('[data-visitor-visual]').frames.length, 1);
  });

  test(`${lang}: actual iframe messages reveal the globe and populate statistics`, () => {
    const page = homepage(lang);
    page.message({ type: 'homepage-visitor-globe', visits: 1234, locations: 5, statsURL });
    assert.equal(page.nodes.get('[data-visitor-visits]').textContent, '1,234');
    assert.equal(page.nodes.get('[data-visitor-locations]').textContent, '5');
    assert.equal(page.nodes.get('[data-visitor-status]').hidden, true);
    assert.equal(page.nodes.get('[data-visitor-visual]').dataset.state, 'ready');
    assert.equal(page.timers.size, 0);
  });

  test(`${lang}: local homepage previews never create the live counter`, () => {
    const page = homepage(lang, 'localhost');
    assert.equal(page.nodes.get('[data-visitor-visual]').frames.length, 0);
    assert.equal(page.timers.size, 0);
    assert.match(page.nodes.get('[data-visitor-status]').textContent, lang === 'en' ? /published homepage/ : /正式上线/);
  });
}

test('shared official embed is parser-loaded after the statistics bridge', () => {
  const embed = childHTML.match(/<script id="mmvst_globe" src="([^"]+)"><\/script>/);
  assert.ok(embed);
  const url = new URL(embed[1].replaceAll('&amp;', '&'));
  assert.equal(url.origin, 'https://mapmyvisitors.com');
  assert.equal(url.pathname, '/globe.js');
  assert.equal(url.searchParams.get('d'), 'SacDpCibu7P_YwKchCIJVW6hz5sEw_uXBXHV2r2ttcc');
  assert.equal(url.searchParams.get('w'), '224');
  assert.ok(childHTML.indexOf('src="visitor-globe.js?v=2"') < childHTML.indexOf('id="mmvst_globe"'));
  for (const page of ['index.html', 'en.html']) {
    assert.match(fs.readFileSync(path.join(root, 'src', page), 'utf8'), /src="visitors\.js\?v=2" defer/);
  }
});

test('regression: legacy jQuery data URL normalization now keeps HTTPS', () => {
  // These are the location-dependent URL expressions in jQuery 1.12.4,
  // the dependency loaded by the official globe script.
  const rurl = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/;
  const normalize = (locationHref, url) => url.replace(/^\/\//, rurl.exec(locationHref.toLowerCase())[1] + '//');
  const page = homepage();
  for (const endpoint of ['//mapmyvisitors.com/globe_call_home.js', '//mapmyvisitors.com/ajax/globe']) {
    assert.equal(normalize('about:srcdoc', endpoint), 'about:' + endpoint);
    assert.equal(normalize(page.frame.src, endpoint), 'https:' + endpoint);
  }
});

test('offscreen globe publishes via microtasks, deduplicates locations, and includes unknown visits', () => {
  const child = globe();
  assert.equal(child.messages.length, 0);
  const link = child.setMarkers([
    ['3 visits from Shanghai, China', '100', '200'],
    ['2 recent visits from Shanghai, China', '100', '200'],
    ['1 visit from Unknown Location', '50', '50'],
    ['4 visits from London, United Kingdom', '300', '400'],
    ['Unrecognized title', '0', '0'],
  ]);
  child.mutate(); child.mutate();
  assert.equal(child.microtasks.length, 1);
  child.flush();
  assert.deepEqual(child.messages, [{ type: 'homepage-visitor-globe', visits: 10, locations: 2, statsURL, origin: 'https://xijunlee.github.io' }]);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(child.document.documentElement.lang, 'zh-CN');
});

test('English bridge and reduced-motion preferences are preserved', () => {
  const child = globe('en', true);
  assert.equal(child.document.documentElement.lang, 'en');
  assert.equal(child.document.title, 'Homepage visitor globe');
  assert.match(child.styles[0].textContent, /transform:none!important/);
  const link = child.setMarkers([]);
  child.mutate(); child.flush();
  assert.equal(link.attributes['aria-label'], 'MapMyVisitors statistics');
  assert.equal(child.messages[0].visits, 0);
});

test('parent rejects spoofed, malformed, or untrusted statistics messages', () => {
  const page = homepage();
  const data = { type: 'homepage-visitor-globe', visits: 3, locations: 1, statsURL };
  page.message(data, {});
  for (const bad of [{ visits: -1 }, { visits: '3' }, { locations: 1.5 }, { statsURL: 'https://example.com/web/1c8rq' }, { type: 'untrusted' }]) {
    page.message({ ...data, ...bad });
  }
  assert.equal(page.nodes.get('[data-visitor-visits]').textContent, '—');
  assert.equal(page.nodes.get('[data-visitor-visual]').dataset.state, undefined);
  assert.equal(page.timers.size, 1);
});

test('late valid statistics recover after the network timeout', () => {
  const page = homepage();
  page.timers.get(1)();
  assert.match(page.nodes.get('[data-visitor-status]').textContent, /暂时无法加载/);
  page.message({ type: 'homepage-visitor-globe', visits: 1, locations: 0, statsURL });
  assert.equal(page.nodes.get('[data-visitor-status]').hidden, true);
  assert.equal(page.nodes.get('[data-visitor-visual]').dataset.state, 'ready');
});
