'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'src/analytics.js'), 'utf8');
const snippet = fs.readFileSync(path.join(root, 'content/51la-snippet.html'), 'utf8');
const initialization = snippet.match(/<script>([\s\S]*?)<\/script>/)[1];

function collector(hostname = 'xijunlee.github.io', existing = null) {
  const scripts = [];
  const calls = [];
  const window = { LA: { init: options => calls.push({ ...options }) } };
  const context = vm.createContext({
    location: { hostname }, window,
    document: {
      getElementById: id => {
        assert.equal(id, 'LA_COLLECT');
        return existing || scripts.find(script => script.id === id) || null;
      },
      createElement: tag => { assert.equal(tag, 'script'); return { dataset: {} }; },
      head: { append: script => scripts.push(script) },
    },
  });
  const run = () => vm.runInContext(code, context);
  run();
  return { scripts, calls, window, run };
}

test('loads the supplied official 51LA SDK asynchronously over HTTPS', () => {
  const page = collector();
  assert.equal(page.scripts.length, 1);
  const script = page.scripts[0];
  assert.equal(script.id, 'LA_COLLECT');
  assert.equal(script.charset, 'UTF-8');
  assert.equal(script.src, 'https://sdk.51.la/js-sdk-pro.min.js');
  assert.equal(script.async, true);
  assert.equal(script.dataset.state, 'loading');
  assert.equal(page.calls.length, 0);
  script.onload();
  assert.deepEqual(page.calls, [{ id: '3RSi0ApWyvRKOoCj', ck: '3RSi0ApWyvRKOoCj' }]);
  assert.equal(script.dataset.state, 'initialized');
});

test('local previews and copied deployments never send production pageviews', () => {
  for (const host of ['localhost', '127.0.0.1', '', 'example.com', 'xijunlee.github.io.example.com']) {
    const page = collector(host);
    assert.equal(page.scripts.length, 0);
    assert.equal(page.calls.length, 0);
  }
});

test('duplicate execution or an existing tracker does not create a second collector', () => {
  const page = collector();
  page.run();
  assert.equal(page.scripts.length, 1);
  page.scripts[0].onload();
  assert.equal(page.calls.length, 1);
  assert.equal(collector('xijunlee.github.io', {}).scripts.length, 0);
});

test('a network failure, missing SDK, or SDK exception does not break the page', () => {
  const network = collector();
  assert.doesNotThrow(() => network.scripts[0].onerror());
  assert.equal(network.scripts[0].dataset.state, 'unavailable');
  assert.equal(network.calls.length, 0);
  const missing = collector();
  delete missing.window.LA;
  assert.doesNotThrow(() => missing.scripts[0].onload());
  assert.equal(missing.scripts[0].dataset.state, 'unavailable');
  const broken = collector();
  broken.window.LA.init = () => { throw new Error('SDK initialization failed'); };
  assert.doesNotThrow(() => broken.scripts[0].onload());
  assert.equal(broken.scripts[0].dataset.state, 'unavailable');
});

test('both homepages and archives expose exactly one official SDK and inline initialization in their HTML', () => {
  for (const file of ['index.html', 'en.html', 'archive.html', 'archive-zh.html']) {
    const html = fs.readFileSync(path.join(root, 'dist', file), 'utf8');
    const head = html.split('</head>')[0];
    assert.equal((head.match(/id="LA_COLLECT"/g) || []).length, 1, file);
    assert.equal((head.match(/LA\.init\(/g) || []).length, 1, file);
    const tag = head.match(/<script charset="UTF-8" id="LA_COLLECT" src="https:\/\/sdk\.51\.la\/js-sdk-pro\.min\.js"><\/script>/);
    assert.ok(tag, file);
    assert.ok(head.indexOf('LA.init(') > tag.index, file);
    assert.doesNotMatch(html, /src="analytics\.js/, file);
  }
  const iframe = fs.readFileSync(path.join(root, 'src/visitor-globe.html'), 'utf8');
  assert.doesNotMatch(iframe, /analytics\.js|LA_COLLECT|3RSi0ApWyvRKOoCj/);
  assert.equal(fs.readFileSync(path.join(root, 'dist/analytics.js'), 'utf8'), code);
});

test('standard inline installation initializes the supplied application exactly once', () => {
  const calls = [];
  const LA = { init: options => calls.push({ ...options }) };
  const tag = { dataset: {} };
  const context = vm.createContext({ location: { hostname: 'xijunlee.github.io' }, window: { LA }, LA, document: { getElementById: () => tag } });
  vm.runInContext(initialization, context);
  vm.runInContext(initialization, context);
  assert.deepEqual(calls, [{ id: '3RSi0ApWyvRKOoCj', ck: '3RSi0ApWyvRKOoCj' }]);
  assert.equal(tag.dataset.state, 'initialized');
});

test('standard installation never initializes on local previews or copied deployments', () => {
  for (const hostname of ['localhost', '127.0.0.1', '', 'example.com', 'xijunlee.github.io.example.com']) {
    const LA = { init() { throw new Error('must never be called'); } };
    const window = { LA };
    vm.runInNewContext(initialization, { location: { hostname }, window, LA });
    assert.equal(window.__homepage51LAStarted, undefined);
  }
});

test('missing or failing SDK cannot break subsequent page scripts', () => {
  assert.doesNotThrow(() => vm.runInNewContext(initialization, { location: { hostname: 'xijunlee.github.io' }, window: {} }));
  const LA = { init() { throw new Error('SDK error'); } };
  const tag = { dataset: {} };
  assert.doesNotThrow(() => vm.runInNewContext(initialization, { location: { hostname: 'xijunlee.github.io' }, window: { LA }, LA, document: { getElementById: () => tag } }));
  assert.equal(tag.dataset.state, 'unavailable');
});

test('collection is separate from public statistics and does not contain data API credentials', () => {
  assert.doesNotMatch(code, /accessKey|secretKey|v6-open|\bfetch\(|visitor-total/);
  assert.doesNotMatch(code, /IntersectionObserver|requestAnimationFrame|scroll|DOMContentLoaded/);
  assert.doesNotMatch(snippet, /accessKey|secretKey|v6-open|\bfetch\(|visitor-total/);
});
