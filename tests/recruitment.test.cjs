'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

for (const [page, label, masters, interns, role] of [
  ['index.html', '2027级博士已招满', '硕士生', '科研实习生 · 长期招收', '助理教授 · 博士生导师'],
  ['en.html', '2027 Ph.D. intake full', 'Master', 'Research interns · Year-round', 'Assistant Professor · Ph.D. Advisor'],
]) {
  test(`${page}: both recruitment areas show the filled 2027 intake without closing other opportunities`, () => {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    for (const selector of ['position-list', 'join-positions']) {
      const tags = html.match(new RegExp('<div class="' + selector + '">([\\s\\S]*?)</div>'))[1];
      assert.ok(tags.includes('<span class="admission-filled">' + label + '</span>'));
      assert.ok(tags.includes('<span>' + masters + '</span>'));
      assert.ok(tags.includes('<span class="internship-highlight">' + interns + '</span>'));
    }
    assert.equal(html.split('class="admission-filled"').length - 1, 2);
    assert.ok(html.includes(role));
    assert.ok(html.includes('styles.css?v=13'));
    for (const id of ['LmiqwT1bEiHADOkVMXnce8qOnTh', 'HmnBwR5TIigUQlk3G5XcwjuwnBg']) assert.ok(html.includes(id));
  });
}

test('filled-intake badges use a readable neutral treatment and recruitment tags can wrap', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  assert.match(css, /\.hero-refined \.position-list\{grid-template-columns:minmax\(0,1fr\) max-content\}/);
  assert.match(css, /\.hero-refined \.position-list>\.admission-filled,\.join-positions>\.admission-filled\{[^}]*background:#e8eef3;[^}]*color:#4d6172;[^}]*white-space:normal/);
  assert.match(css, /\.join-positions\{flex-wrap:wrap\}/);
});

const recruitmentEmail = 'sjtu_l2o_recruiter@163.com';
for (const page of ['index.html', 'en.html']) {
  test(`${page}: recruitment links and visible addresses use only the dedicated application mailbox`, () => {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    const recruit = html.match(/<aside class="recruit-card"[\s\S]*?<\/aside>/)[0];
    const join = html.match(/<section class="join-section"[\s\S]*?<\/section>/)[0];
    for (const block of [recruit, join]) {
      const links = [...block.matchAll(/href="mailto:([^"]+)"/g)];
      assert.equal(links.length, 1);
      assert.equal(links[0][1].split('?')[0], recruitmentEmail);
      assert.ok(block.includes(`>${recruitmentEmail} <span>`));
      assert.ok(!block.includes('lixijun@sjtu.edu.cn'));
      assert.ok(!block.includes('hotmail'));
    }
    assert.match(join, /mailto:sjtu_l2o_recruiter@163\.com\?subject=/);
    const heroLinks = html.match(/<div class="hero-links">[\s\S]*?<\/div>/)[0];
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
    for (const block of [heroLinks, footer]) assert.ok(block.includes('mailto:lixijun@sjtu.edu.cn'));
    assert.ok(!html.includes('{{RECRUITMENT_EMAIL}}'));
  });
}

for (const page of ['archive-zh.html', 'archive.html']) {
  test(`${page}: full-profile applications use the dedicated mailbox while general contact details stay intact`, () => {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    const recruit = html.match(/<div class="infoblock archive-recruit"[\s\S]*?<\/ul>/)[0];
    assert.ok(recruit.includes(`href="mailto:${recruitmentEmail}"`));
    assert.ok(recruit.includes(`>${recruitmentEmail} ↗</a>`));
    assert.ok(!recruit.includes('lixijun@sjtu.edu.cn'));
    assert.ok(!recruit.includes('hotmail'));
    assert.ok(html.includes('lixijun AT sjtu DOT edu DOT cn'));
    assert.ok(html.includes('xijun.lee AT hotmail DOT com'));
  });
}
