'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const phyworld = 'PhyWorld: Unified Semantic and Physical Reasoning for Physics-Native 3D Scene Generation';
const cpuPower = 'Cutting CPU Power Without Missing Tails for Polling-Based I/O Frameworks';
const dataContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/data.js'), 'utf8'), dataContext);
const papers = dataContext.window.ACADEMIC_DATA.papers;
const plain = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

test('new papers preserve exact titles, author order, confirmed CCF ranks and presentation metadata', () => {
  const dai = papers.filter(paper => paper.title === phyworld);
  const eurosys = papers.filter(paper => paper.title === cpuPower);
  assert.equal(dai.length, 1);
  assert.equal(eurosys.length, 1);
  assert.equal(dai[0].venue, 'DAI');
  assert.equal(dai[0].rank, 'C');
  assert.equal(dai[0].year, 2026);
  assert.equal(dai[0].oral, true);
  assert.equal(dai[0].corresponding, true);
  assert.equal(plain(dai[0].authors_html), 'Chao Shen, Yunfan Zhou, Zhihai Wang, Xijun Li#, Jianguo Yao, Haibing Guan');
  assert.equal(eurosys[0].venue, 'EuroSys');
  assert.equal(eurosys[0].rank, 'A');
  assert.equal(eurosys[0].year, 2027);
  assert.equal(eurosys[0].cycle, 'Spring');
  assert.equal(eurosys[0].corresponding, false);
  assert.equal(plain(eurosys[0].authors_html), 'Bernhard Linn Hilmarsson, Vamanan Arulchelvan, Arash Tavakkol, Li Liu, Weihong Xu, Xiangyu Zhu, Xijun Li, Shai Bergman, Ji Zhang');
  assert.equal(eurosys[0].links.length, 0);
  assert.equal(dai[0].links[0].label, 'accepted');
  assert.equal(dai[0].links[0].href, 'https://www.adai.ai/dai/2026/accepted-papers.html');
});

test('publication totals and both homepage counters update while preprints remain separate', () => {
  const publications = papers.filter(paper => paper.venue !== 'Preprint');
  assert.equal(publications.length, 40);
  assert.equal(papers.filter(paper => paper.venue === 'Preprint').length, 11);
  for (const [rank, count] of [['A', 24], ['B', 4], ['C', 5], ['other', 7]]) {
    assert.equal(publications.filter(paper => paper.rank === rank).length, count);
  }
  for (const page of ['index.html', 'en.html']) {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    assert.match(html, /<strong>40<span>/);
    assert.match(html, /id="metric-ccf">24<span>/);
    assert.match(html, page === 'index.html' ? /B 类 4 篇 \/ C 类 5 篇/ : /4 B \/ 5 C publications/);
    assert.ok(html.includes(page === 'index.html' ? '全部 22 条动态' : 'All 22 updates'));
    assert.ok(html.includes('data.js?v=3'));
    assert.ok(html.includes('app.js?v=2'));
  }
});

test('both homepages retain four latest news items and archives preserve confirmed acceptance dates', () => {
  for (const page of ['index.html', 'en.html']) {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    const news = html.match(/<section[^>]*id="news"[\s\S]*?<\/section>/)[0];
    assert.deepEqual([...news.matchAll(/datetime="([^"]+)"/g)].map(match => match[1]), ['2026-10-21', '2026-10-10', '2026-09-17', '2026-08-23']);
    assert.ok(news.includes('PhyWorld'));
  }
  for (const page of ['archive-zh.html', 'archive.html']) {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    assert.ok(html.includes('[09-17-2026]'));
    assert.ok(html.includes('[08-21-2026]'));
    assert.ok(html.includes(phyworld));
    assert.ok(html.includes(cpuPower));
    assert.ok(html.includes('ICLR</b> 2027') || html.includes('ICLR 2027'));
    assert.ok(html.includes(page === 'archive-zh.html' ? '表示通讯作者' : 'denotes the corresponding author'));
  }
});

test('ICML 2027 invitation is published consistently without claiming acceptance or exposing email details', () => {
  for (const [homepage, archive, message, category] of [
    ['index.html', 'archive-zh.html', '受邀担任 ICML 2027 领域主席（Area Chair）。', '学术服务'],
    ['en.html', 'archive.html', 'Invited to serve as an Area Chair for ICML 2027.', 'SERVICE'],
  ]) {
    const html = fs.readFileSync(path.join(root, 'dist', homepage), 'utf8');
    const news = html.match(/<section[^>]*id="news"[\s\S]*?<\/section>/)[0];
    const firstRow = news.match(/<a class="news-row"[^>]*>[\s\S]*?<\/a>/)[0];
    assert.ok(firstRow.includes(`href="${archive}#news"`));
    assert.ok(firstRow.includes('<time datetime="2026-10-21">2026.10.21</time>'));
    assert.ok(firstRow.includes(`<span class="news-category">${category}</span>`));
    assert.equal(plain(firstRow.match(/<p>([\s\S]*?)<\/p>/)[1]), message);
    const archiveHtml = fs.readFileSync(path.join(root, 'dist', archive), 'utf8');
    const archiveNews = archiveHtml.match(/<section[^>]*data-archive-key="News"[\s\S]*?<\/section>/)[0];
    const items = [...archiveNews.matchAll(/<li><p>([\s\S]*?)<\/p>\s*<\/li>/g)];
    assert.equal(items.length, 22);
    assert.equal(plain(items[0][1]), `[10-21-2026] ${message}`);
    assert.equal((plain(archiveNews).match(/ICML 2027/g) || []).length, 1);
    assert.doesNotMatch(plain(firstRow + archiveNews), /Dear Xijun|formatting and anonymity|AI tools|We invite you/);
  }
});

test('Chinese news consistently pairs Area Chair titles with their full English equivalents', () => {
  for (const [page, expectedCount] of [['index.html', 2], ['archive-zh.html', 5]]) {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    const section = html.match(page.startsWith('archive')
      ? /<section[^>]*data-archive-key="News"[\s\S]*?<\/section>/
      : /<section[^>]*id="news"[\s\S]*?<\/section>/)[0];
    const titles = [...plain(section).matchAll(/(优秀)?领域主席(（[^）]+）)?/g)];
    assert.equal(titles.length, expectedCount);
    for (const title of titles) {
      assert.equal(title[2], title[1] ? '（Top Area Chair）' : '（Area Chair）');
    }
  }
  for (const page of ['en.html', 'archive.html']) {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    const section = html.match(page.startsWith('archive')
      ? /<section[^>]*data-archive-key="News"[\s\S]*?<\/section>/
      : /<section[^>]*id="news"[\s\S]*?<\/section>/)[0];
    assert.ok(plain(section).includes('NeurIPS 2026 Top Area Chair'));
    assert.doesNotMatch(section, /领域主席|Top AC/);
  }
});

function renderHomepage(language) {
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
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/app.js'), 'utf8'), { document, window: dataContext.window });
  return { list, buttons, status };
}

for (const language of ['zh', 'en']) {
  test(`${language}: filtering preserves Oral, corresponding-author and Spring details`, () => {
    const { list, buttons, status } = renderHomepage(language);
    assert.ok(list.innerHTML.includes(cpuPower));
    assert.ok(list.innerHTML.includes(language === 'zh' ? '2027 · 春季轮' : '2027 · Spring'));
    assert.match(status.textContent, /24/);
    const staticHtml = fs.readFileSync(path.join(root, 'dist', language === 'zh' ? 'index.html' : 'en.html'), 'utf8');
    assert.ok(staticHtml.includes(language === 'zh' ? '2027 · 春季轮' : '2027 · Spring'));
    buttons.find(button => button.dataset.filter === 'C').click();
    assert.ok(list.innerHTML.includes(phyworld));
    assert.ok(list.innerHTML.includes('CCF C'));
    assert.ok(list.innerHTML.includes('>Oral</span>'));
    assert.ok(list.innerHTML.includes(language === 'zh' ? '# 通讯作者' : '# Corresponding author'));
    assert.match(status.textContent, /5/);
    buttons.find(button => button.dataset.filter === 'all').click();
    assert.match(status.textContent, /51/);
    assert.ok(list.innerHTML.includes(phyworld));
    assert.ok(list.innerHTML.includes(cpuPower));
  });
}
