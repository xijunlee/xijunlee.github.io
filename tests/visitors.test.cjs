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
    ['[data-visitor-total]', { textContent: '—', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; if (name === 'title') delete this.title; } }],
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
  const scripts = [];
  const timers = new Map();
  const intervals = [];
  const listeners = new Map();
  const window = {};
  const embedURL = childHTML.match(/id="mmvst_globe" src="([^"]+)"/)[1].replaceAll('&amp;', '&');
  let timerID = 0;
  const document = {
    documentElement: {}, body: {}, hidden: false,
    head: { append: node => (node.tag === 'style' ? styles : scripts).push(node) },
    createElement: tag => { assert.ok(['style', 'script'].includes(tag)); return { tag, remove() { this.removed = true; } }; },
    getElementById: id => { assert.equal(id, 'mmvst_globe'); return { src: embedURL }; },
    addEventListener: (name, callback) => listeners.set(name, callback),
    querySelector: selector => {
      // Fail if the bridge ever resumes reading markers to derive statistics.
      assert.equal(selector, '#mmvst_a');
      return link;
    },
  };
  vm.runInNewContext(childCode, {
    URL, URLSearchParams, document, window,
    setTimeout: callback => { const id = ++timerID; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => intervals.push({ callback, delay }),
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
    document, messages, styles, scripts, timers, intervals, listeners, microtasks,
    replyCounter(payload, index = scripts.length - 1) {
      const callback = new URL(scripts[index].src).searchParams.get('callback');
      assert.equal(typeof window[callback], 'function');
      window[callback](payload);
    },
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
    assert.equal(frameURL.searchParams.get('v'), '4');
    assert.equal('srcdoc' in page.frame, false);
    assert.equal(page.frame.attributes.sandbox, 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
    assert.equal(page.nodes.get('[data-visitor-visual]').frames.length, 1);
  });

  test(`${lang}: official widget readiness reveals the globe independently of the counter`, () => {
    const page = homepage(lang);
    page.message({ type: 'homepage-visitor-globe', statsURL });
    assert.equal(page.nodes.get('[data-visitor-details]').href, statsURL);
    assert.equal(page.nodes.get('[data-visitor-status]').hidden, true);
    assert.equal(page.nodes.get('[data-visitor-visual]').dataset.state, 'ready');
    assert.equal(page.timers.size, 0);
  });

  test(`${lang}: shows the exact native Total Pageviews value, with localized formatting`, () => {
    const page = homepage(lang);
    page.message({ type: 'homepage-visitor-counter', totalPageviews: 12345 });
    assert.equal(page.nodes.get('[data-visitor-total]').textContent, '12,345');
    assert.equal(page.nodes.get('[data-visitor-visual]').dataset.state, undefined);
    page.message({ type: 'homepage-visitor-counter-unavailable' });
    assert.equal(page.nodes.get('[data-visitor-total]').textContent, '12,345');
    assert.match(page.nodes.get('[data-visitor-total]').title, lang === 'en' ? /source counter/ : /源站计数/);
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
  assert.equal(url.searchParams.get('w'), '128');
  assert.match(childHTML, /body\{width:128px/);
  assert.ok(childHTML.indexOf('src="visitor-globe.js?v=4"') < childHTML.indexOf('id="mmvst_globe"'));
  for (const page of ['index.html', 'en.html']) {
    const source = fs.readFileSync(path.join(root, 'src', page), 'utf8');
    assert.match(source, /src="visitors\.js\?v=4" defer/);
    assert.match(source, /href="styles\.css\?v=4"/);
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

test('offscreen bridge reports official readiness without calculating marker totals', () => {
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
  assert.equal(child.scripts.length, 1);
});

const nativeCounter = count => `_map.container.parent().find('.mapmyvisitors-visitors').html('${count} Total Pageviews');`;

test('counter uses the official read-only endpoint, same account, cache buster and native total label', () => {
  const child = globe();
  child.setSourceLink(); child.mutate(); child.flush();
  const endpoint = new URL(child.scripts[0].src);
  const embed = new URL(childHTML.match(/id="mmvst_globe" src="([^"]+)"/)[1].replaceAll('&amp;', '&'));
  assert.equal(endpoint.origin, 'https://mapmyvisitors.com');
  assert.equal(endpoint.pathname, '/widget_call_home.js');
  assert.equal(endpoint.searchParams.get('d'), embed.searchParams.get('d'));
  assert.equal(endpoint.searchParams.get('t'), 'tt');
  assert.match(endpoint.searchParams.get('_'), /^\d+$/);
  child.replyCounter(nativeCounter('12,345'));
  assert.deepEqual(child.messages[1], { type: 'homepage-visitor-counter', totalPageviews: 12345, origin: 'https://xijunlee.github.io' });
  assert.equal(child.scripts[0].removed, true);
  assert.equal(child.timers.size, 0);
});

test('counter payload is not evaluated and geographic markers are not used as totals', () => {
  const child = globe();
  child.setSourceLink(); child.mutate(); child.flush();
  child.replyCounter(`throw new Error('Do not execute this widget program');${nativeCounter('31')}`);
  assert.equal(child.messages.at(-1).totalPageviews, 31);
  assert.doesNotMatch(childCode, /\beval\s*\(|\bFunction\s*\(/);
});

test('unreadable or invalid source counters report failure without inventing zero', () => {
  for (const payload of [null, {}, '3 Unknown Location visits', nativeCounter(','), nativeCounter('1,,5'), nativeCounter('9007199254740992')]) {
    const child = globe();
    child.setSourceLink(); child.mutate(); child.flush();
    child.replyCounter(payload);
    assert.equal(child.messages.at(-1).type, 'homepage-visitor-counter-unavailable');
    assert.equal(child.messages.some(message => message.type === 'homepage-visitor-counter'), false);
  }
});

test('source counter refreshes every minute only when visible, without concurrent requests', () => {
  const child = globe();
  child.setSourceLink(); child.mutate(); child.flush();
  assert.equal(child.intervals[0].delay, 60000);
  child.intervals[0].callback();
  assert.equal(child.scripts.length, 1);
  child.replyCounter(nativeCounter('31'));
  child.document.hidden = true;
  child.intervals[0].callback();
  assert.equal(child.scripts.length, 1);
  child.document.hidden = false;
  child.listeners.get('visibilitychange')();
  assert.equal(child.scripts.length, 2);
  child.replyCounter(nativeCounter('32'));
  assert.equal(child.messages.at(-1).totalPageviews, 32);
});

test('failed counter requests recover on the next scheduled refresh', () => {
  const child = globe();
  child.setSourceLink(); child.mutate(); child.flush();
  child.timers.values().next().value();
  assert.equal(child.messages.at(-1).type, 'homepage-visitor-counter-unavailable');
  child.intervals[0].callback();
  child.replyCounter(nativeCounter('31'));
  assert.equal(child.messages.at(-1).totalPageviews, 31);
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
  page.message({ type: 'homepage-visitor-counter', totalPageviews: 31 }, {});
  for (const totalPageviews of ['31', -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    page.message({ type: 'homepage-visitor-counter', totalPageviews });
  }
  assert.equal(page.nodes.get('[data-visitor-total]').textContent, '—');
});

test('late valid statistics recover after the network timeout', () => {
  const page = homepage();
  page.timers.get(1)();
  assert.match(page.nodes.get('[data-visitor-status]').textContent, /暂时无法加载/);
  page.message({ type: 'homepage-visitor-globe', statsURL });
  assert.equal(page.nodes.get('[data-visitor-status]').hidden, true);
  assert.equal(page.nodes.get('[data-visitor-visual]').dataset.state, 'ready');
});

test('both footers show native pageviews, not derived geography or unwanted introductions', () => {
  for (const page of ['index.html', 'en.html']) {
    const source = fs.readFileSync(path.join(root, 'src', page), 'utf8');
    const section = source.match(/<section class="visitor-section[^]*?<\/section>/)[0];
    assert.doesNotMatch(section, /data-visitor-visits|data-visitor-locations/);
    assert.match(section, /data-visitor-total/);
    assert.match(section, page === 'en.html' ? /Total pageviews/ : /累计浏览量/);
    assert.doesNotMatch(section, /谢谢你，从世界各地来访|地球仪上的光点，记录着|Thank you for visiting, wherever you are|Every point on the globe marks/);
    assert.match(section, /href="https:\/\/mapmyvisitors.com\/web\/1c8rq"/);
  }
  assert.doesNotMatch(childCode, /svg_points|circle\[title\]|locations\.add|visits \+=/);
});

test('compact footer keeps text and globe side by side and vertically centered, including mobile', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const rules = [...css.matchAll(/\.visitor-section\{([^}]+)\}/g)].map(match => match[1]);
  assert.match(rules[0], /display:flex;align-items:center;justify-content:center;gap:1\.75rem/);
  assert.match(rules[0], /padding-block:\.5rem/);
  assert.ok(rules.every(rule => !/grid-template-columns|flex-direction:column/.test(rule)));
  assert.match(css, /\.visitor-visual\{[^}]*flex:0 0 8rem;[^}]*height:9rem/);
  assert.match(css, /\.visitor-frame\{[^}]*height:9rem/);
});
