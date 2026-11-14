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
    assert.ok(html.includes('styles.css?v=17'));
    for (const id of ['LmiqwT1bEiHADOkVMXnce8qOnTh', 'HmnBwR5TIigUQlk3G5XcwjuwnBg']) assert.ok(html.includes(id));
  });
}

test('filled-intake badges use a readable neutral treatment and recruitment tags can wrap', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  assert.match(css, /\.hero-refined \.position-list\{grid-template-columns:fit-content\(75%\) minmax\(0,1fr\)\}/);
  assert.match(css, /\.admission-filled\{[^}]*padding-inline:\.5rem;[^}]*white-space:normal/);
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
      assert.ok(block.includes(`<span class="recruit-email-address">${recruitmentEmail}</span>`));
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
    assert.ok(html.includes('styles.css?v=17'));
  });
}

test('application email uses typography only and keeps the complete address on one line', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  assert.match(css, /\.hero-refined \.recruit-email\{[^}]*padding:0;border:0;[^}]*background:transparent;[^}]*font-size:\.9375rem;[^}]*font-weight:600;[^}]*white-space:nowrap/);
  assert.match(css, /\.recruit-email-address\{flex:0 0 auto;white-space:nowrap;overflow-wrap:normal;word-break:normal\}/);
  assert.match(css, /\.application-card>\.button\[href\^="mailto:"\]\{[^}]*padding:0;border:0;background:transparent;[^}]*font-size:\.9375rem;[^}]*white-space:nowrap/);
  assert.match(css, /\.legacy-content \.archive-recruit a\[href\^="mailto:"\]\{display:inline-block;[^}]*border:0;[^}]*background:transparent;[^}]*white-space:nowrap/);
  const rules = css.slice(css.indexOf('/* Emphasize the full email address'));
  assert.doesNotMatch(rules, /text-overflow:ellipsis|overflow:hidden|background:#|border:1px/);
});

test('application step numbers use a medium blue-grey with readable, restrained contrast', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  assert.match(css, /\.application-card li>span\{color:#5f778d;font-weight:500\}/);
  const luminance = hex => {
    const channels = hex.match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  };
  const contrast = (luminance('fbfdff') + .05) / (luminance('5f778d') + .05);
  assert.ok(contrast >= 4.5 && contrast < 6);
  for (const page of ['index.html', 'en.html']) {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    const application = html.match(/<div class="application-card">[\s\S]*?<\/ol>/)[0];
    assert.deepEqual([...application.matchAll(/<li><span>(\d{2})<\/span>/g)].map(m => m[1]), ['01', '02', '03']);
  }
});
