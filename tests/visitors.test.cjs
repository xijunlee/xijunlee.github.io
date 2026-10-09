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
  let observer;
  const messages = [];
  const microtasks = [];
  const styles = [];
  const document = {
    documentElement: {}, body: {},
    head: { append: style => styles.push(style) },
    createElement: tag => { assert.equal(tag, 'style'); return {}; },
    querySelector: selector => {
      // Fail if the bridge ever resumes reading markers to derive statistics.
      assert.equal(selector, '#mmvst_a');
      return link;
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
    setSourceLink(href = statsURL) {
      link = { href, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
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
    assert.equal(frameURL.searchParams.get('v'), '3');
    assert.equal('srcdoc' in page.frame, false);
    assert.equal(page.frame.attributes.sandbox, 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
    assert.equal(page.nodes.get('[data-visitor-visual]').frames.length, 1);
  });

  test(`${lang}: official widget readiness reveals the globe without copying counters`, () => {
    const page = homepage(lang);
    page.message({ type: 'homepage-visitor-globe', statsURL });
    assert.equal(page.nodes.get('[data-visitor-details]').href, statsURL);
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
  assert.equal(url.searchParams.get('w'), '160');
  assert.match(childHTML, /body\{width:160px/);
  assert.ok(childHTML.indexOf('src="visitor-globe.js?v=3"') < childHTML.indexOf('id="mmvst_globe"'));
  for (const page of ['index.html', 'en.html']) {
    assert.match(fs.readFileSync(path.join(root, 'src', page), 'utf8'), /src="visitors\.js\?v=3" defer/);
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

test('offscreen bridge reports only official readiness and never calculates marker totals', () => {
  const child = globe();
  assert.equal(child.messages.length, 0);
  const link = child.setSourceLink();
  child.mutate(); child.mutate();
  assert.equal(child.microtasks.length, 1);
  child.flush();
  assert.deepEqual(child.messages, [{ type: 'homepage-visitor-globe', statsURL, origin: 'https://xijunlee.github.io' }]);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(child.document.documentElement.lang, 'zh-CN');
});

test('English bridge and reduced-motion preferences are preserved', () => {
  const child = globe('en', true);
  assert.equal(child.document.documentElement.lang, 'en');
  assert.equal(child.document.title, 'Homepage visitor globe');
  assert.match(child.styles[0].textContent, /transform:none!important/);
  const link = child.setSourceLink();
  child.mutate(); child.flush();
  assert.equal(link.attributes['aria-label'], 'MapMyVisitors statistics');
  assert.equal('visits' in child.messages[0], false);
  assert.equal('locations' in child.messages[0], false);
});

test('parent rejects spoofed, malformed, or untrusted widget messages', () => {
  const page = homepage();
  const data = { type: 'homepage-visitor-globe', statsURL };
  page.message(data, {});
  for (const bad of [{ statsURL: null }, { statsURL: 'http://mapmyvisitors.com/web/1c8rq' }, { statsURL: 'https://example.com/web/1c8rq' }, { type: 'untrusted' }]) {
    page.message({ ...data, ...bad });
  }
  assert.equal(page.nodes.get('[data-visitor-visual]').dataset.state, undefined);
  assert.equal(page.timers.size, 1);
});

test('late valid statistics recover after the network timeout', () => {
  const page = homepage();
  page.timers.get(1)();
  assert.match(page.nodes.get('[data-visitor-status]').textContent, /暂时无法加载/);
  page.message({ type: 'homepage-visitor-globe', statsURL });
  assert.equal(page.nodes.get('[data-visitor-status]').hidden, true);
  assert.equal(page.nodes.get('[data-visitor-visual]').dataset.state, 'ready');
});

test('both homepage footers remove derived counters and the unwanted introductions', () => {
  for (const page of ['index.html', 'en.html']) {
    const source = fs.readFileSync(path.join(root, 'src', page), 'utf8');
    const section = source.match(/<section class="visitor-section[^]*?<\/section>/)[0];
    assert.doesNotMatch(section, /data-visitor-visits|data-visitor-locations|visitor-metrics/);
    assert.doesNotMatch(section, /谢谢你，从世界各地来访|地球仪上的光点，记录着|Thank you for visiting, wherever you are|Every point on the globe marks/);
    assert.match(section, /href="https:\/\/mapmyvisitors.com\/web\/1c8rq"/);
  }
  assert.doesNotMatch(childCode, /svg_points|circle\[title\]|locations\.add|visits \+=/);
});
