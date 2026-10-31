'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const audit = require('./fixtures/preprints-2026-10-28.json');
const read = page => fs.readFileSync(path.join(root, 'dist', page), 'utf8');
const plain = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const section = (html, key) => [...html.matchAll(/<section\b[^>]*data-archive-key="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)]
  .find(match => match[1] === key)[2];
const context = { window: {} };
vm.runInNewContext(read('data.js'), context);
const papers = context.window.ACADEMIC_DATA.papers;

test('Scholar audit covers the complete profile and accounts for every preprint candidate', () => {
  assert.equal(audit.scholarRows, 60);
  assert.match(audit.scholarPagination, /Show more disabled/);
  assert.equal(audit.added.length, 9);
  assert.equal(audit.added.filter(p => p.id).length, 8);
  assert.equal(audit.preprintCandidates, audit.added.length + audit.alreadyPresent.length + audit.alreadyAccepted.length);
  assert.equal(papers.length, 61);
  assert.equal(papers.filter(p => p.venue === 'Preprint').length, 20);
  assert.equal(new Set(papers.map(p => p.id)).size, papers.length);
  const vla = papers.filter(p => p.title === audit.alreadyAccepted[0].title);
  assert.equal(vla.length, 1);
  assert.equal(vla[0].venue, 'ICML');
  assert.equal(vla[0].rank, 'A');
});

test('new preprints preserve verified titles, full author order, years and primary-source links', () => {
  for (const expected of audit.added) {
    const matches = papers.filter(p => p.title === expected.title);
    assert.equal(matches.length, 1, expected.title);
    const paper = matches[0];
    assert.equal(paper.venue, 'Preprint');
    assert.equal(paper.rank, 'other');
    assert.equal(paper.year, expected.year);
    assert.equal(plain(paper.authors_html), expected.authors.join(', '));
    assert.ok(paper.authors_html.includes('<b>Xijun Li</b>'));
    assert.equal(paper.links[0].href, expected.url);
    assert.equal(paper.links[0].label, expected.label);
    assert.ok(!paper.title.includes('preprint-year'));
    assert.ok(!paper.title.endsWith(String(expected.year)));
  }
});

for (const [page, language] of [['archive-zh.html', 'zh'], ['archive.html', 'en']]) {
  test(`${language}: complete archive adds nine records without replacing old preprints or adding news`, () => {
    const html = read(page);
    const preprints = section(html, 'Preprint');
    const entries = [...preprints.matchAll(/<li><p>([\s\S]*?)<\/p>\s*<\/li>/g)].map(m => m[1]);
    assert.equal(entries.length, 20);
    for (const [i, expected] of audit.added.entries()) {
      assert.ok(plain(entries[i]).includes(expected.title));
      assert.ok(entries[i].includes(`<span class="preprint-year">${expected.year}</span>`));
      assert.ok(entries[i].includes(`href="${expected.url}" target="_blank" rel="noopener noreferrer"`));
    }
    for (const oldId of ['2201.06216', '2303.08066', '24566554', '2211.08251', '2201.06213', '2309.03208', '2310.14161', '2203.04755', '2203.02878', '2202.01256', '347211']) {
      assert.ok(preprints.includes(oldId), oldId);
    }
    const news = section(html, 'News');
    assert.equal((news.match(/<li>/g) || []).length, 22);
    for (const paper of audit.added) assert.ok(!plain(news).includes(paper.title));
  });
}

function homepage(language) {
  const list = { innerHTML: '' };
  const search = { value: '', addEventListener() {} };
  const status = { textContent: '' };
  const buttons = ['A', 'B', 'C', 'other', 'all'].map(filter => ({
    dataset: { filter }, classList: { toggle() {} }, setAttribute() {},
    addEventListener(event, callback) { this[event] = callback; },
  }));
  const document = {
    body: { dataset: { lang: language } },
    querySelector: selector => ({ '#paper-list': list, '#paper-search': search, '#paper-status': status })[selector] || null,
    querySelectorAll: selector => selector === '[data-filter]' ? buttons : [],
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/app.js'), 'utf8'), { document, window: context.window });
  return { list, status, buttons };
}

for (const language of ['zh', 'en']) {
  test(`${language}: homepage filters expose every new preprint with correct counters and years`, () => {
    const { list, status, buttons } = homepage(language);
    assert.match(status.textContent, /24/);
    buttons.find(b => b.dataset.filter === 'other').click();
    assert.match(status.textContent, /28/);
    for (const p of audit.added) {
      assert.ok(list.innerHTML.includes(p.title));
      assert.ok(list.innerHTML.includes(`href="${p.url}"`));
      assert.ok(list.innerHTML.includes(`<div class="paper-year">${p.year}</div>`));
    }
    assert.ok(list.innerHTML.includes(language === 'zh' ? '预印本 / 技术报告' : 'Preprint / technical report'));
    buttons.find(b => b.dataset.filter === 'all').click();
    assert.match(status.textContent, /61/);
    const html = read(language === 'zh' ? 'index.html' : 'en.html');
    assert.ok(html.includes(language === 'zh' ? '另有 20 篇预印本与技术报告' : 'Plus 20 preprints and technical reports'));
    assert.ok(html.includes('data.js?v=5'));
    assert.equal((html.match(/class="news-row"/g) || []).length, 4);
    const news = html.match(/<section[^>]*id="news"[\s\S]*?<\/section>/)[0];
    for (const p of audit.added) assert.ok(!plain(news).includes(p.title));
  });
}
