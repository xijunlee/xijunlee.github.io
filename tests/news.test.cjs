'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = page => fs.readFileSync(path.join(__dirname, '..', 'dist', page), 'utf8');
const plain = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const url = 'https://mp.weixin.qq.com/s/jWIteYBeANt8cLuzGKr5eA';

for (const [home, archive, category, message] of [
  ['index.html', 'archive-zh.html', '学术报告', '在 RLChina 2026 作学术报告。'],
  ['en.html', 'archive.html', 'TALK', 'Gave a talk at RLChina 2026.'],
]) {
  test(`${home}: RLChina talk is the latest news and is archived without inventing a topic`, () => {
    const html = read(home);
    const news = html.match(/<section[^>]*id="news"[\s\S]*?<\/section>/)[0];
    const rows = [...news.matchAll(/<a class="news-row"[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0]);
    assert.equal(rows.length, 4);
    assert.ok(rows[0].includes('datetime="2026-11-08"'));
    assert.ok(rows[0].includes(`<span class="news-category">${category}</span>`));
    assert.equal(plain(rows[0].match(/<p>([\s\S]*?)<\/p>/)[1]), message);
    assert.ok(rows[0].includes(`href="${url}" target="_blank" rel="noopener noreferrer"`));
    assert.ok(html.includes(home === 'index.html' ? '全部 23 条动态' : 'All 23 updates'));
    const archiveNews = read(archive).match(/<section[^>]*data-archive-key="News"[\s\S]*?<\/section>/)[0];
    const items = [...archiveNews.matchAll(/<li><p>([\s\S]*?)<\/p>\s*<\/li>/g)].map(m => m[1]);
    assert.equal(items.length, 23);
    assert.ok(plain(items[0]).startsWith(`[11-08-2026] ${message}`));
    assert.ok(items[0].includes(`href="${url}" target="_blank" rel="noopener noreferrer"`));
    assert.equal(items.filter(item => item.includes('RLChina 2026')).length, 1);
    assert.ok(archiveNews.includes('[08-23-2026]'));
    assert.ok(archiveNews.includes('https://mp.weixin.qq.com/s/ODOji8dj_Ly097QpgFToGg'));
  });
}
