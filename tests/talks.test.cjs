'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const slidesUrl = 'https://xijun-doc.oss-cn-hongkong.aliyuncs.com/clean-%E4%B8%8A%E6%B5%B7%E4%BA%A4%E9%80%9A%E5%A4%A7%E5%AD%A6-%E6%9D%8E%E5%B8%8C%E5%90%9B-updated-v2.pptx';
const eventUrl = 'https://www.xxpie.com/m/album?id=68cd10f434fc6f6580cd4014&amp;source=SHARE_LINK';
const section = (html, key) => [...html.matchAll(/<section\b[^>]*data-archive-key="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)]
  .find(match => match[1] === key)[2];
const items = html => [...html.matchAll(/<li><p>([\s\S]*?)<\/p>\s*<\/li>/g)].map(match => match[1]);

for (const [page, title, label] of [
  ['archive-zh.html', '将图结构先验与语言模型结合用于组合优化', '[幻灯片（PPTX）]'],
  ['archive.html', 'Integrating Graph Structural Priors with Language Models for Combinatorial Optimization', '[slides (PPTX)]'],
]) {
  test(`${page}: the requested presentation is linked from the talk and its original news entry`, () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'dist', page), 'utf8');
    const talks = items(section(html, 'Invited Talk'));
    const news = items(section(html, 'News'));
    assert.equal(talks.length, 5);
    assert.equal(news.length, 22);
    const talk = talks.find(item => item.includes(title));
    const announcement = news.find(item => item.includes('[09-25-2025]'));
    assert.ok(talk);
    assert.ok(announcement);
    for (const entry of [talk, announcement]) {
      const links = [...entry.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/g)];
      const pptLinks = links.filter(match => match[1].includes(`href="${slidesUrl}"`));
      assert.equal(pptLinks.length, 1);
      assert.equal(pptLinks[0][2], label);
      assert.ok(pptLinks[0][1].includes('target="_blank"'));
      assert.ok(pptLinks[0][1].includes('rel="noopener noreferrer"'));
      assert.ok(entry.includes(`href="${eventUrl}"`));
    }
    assert.equal(talks.filter(item => item.includes(slidesUrl)).length, 1);
    assert.equal(news.filter(item => item.includes(slidesUrl)).length, 1);
    assert.equal((html.match(/updated-v2\.pptx/g) || []).length, 2);
  });
}
