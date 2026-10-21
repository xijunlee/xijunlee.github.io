'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = page => fs.readFileSync(path.join(root, 'dist', page), 'utf8');
const plain = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const items = html => [...html.matchAll(/<li><p>([\s\S]*?)<\/p>\s*<\/li>/g)].map(match => plain(match[1]));
const sections = html => new Map([...html.matchAll(/<section\b[^>]*data-archive-key="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)]
  .map(match => [match[1], match[2]]));
const chairKey = 'Area Chair &amp; Program Committee';
const expectedRoles = ['ICML 2027', 'ICLR 2027', 'NeurIPS 2026', 'ICLR 2026'];

for (const [archive, homepage, zh] of [['archive-zh.html', 'index.html', true], ['archive.html', 'en.html', false]]) {
  test(`${archive}: academic service covers every chair invitation in news exactly once`, () => {
    const source = sections(read(archive));
    const invitations = items(source.get('News'))
      .filter(row => /受邀担任|invited/i.test(row) && /领域主席|Area Chair/.test(row))
      .map(row => row.match(/\b(ICML|ICLR|NeurIPS)\s+(20\d{2})\b/).slice(1).join(' '));
    assert.equal(invitations.length, 4);
    const service = items(source.get(chairKey));
    const roles = service.map(row => row.match(/\((ICML|ICLR|NeurIPS)\)\s+(20\d{2})/).slice(1).join(' '));
    assert.deepEqual(roles, expectedRoles);
    assert.deepEqual([...roles].sort(), [...invitations].sort());
    assert.equal(new Set(roles).size, roles.length);
    assert.ok(service.every(row => row.includes(zh ? '领域主席（Area Chair）' : 'Area Chair')));
    for (const role of ['ICML 2027', 'ICLR 2027', 'ICLR 2026']) {
      assert.ok(service[roles.indexOf(role)].includes(zh ? '受邀担任' : '(invited)'));
    }
    assert.equal(items(source.get('News')).length, 22);
  });

  test(`${archive}: Top Area Chair recognition appears in service, honors and biography`, () => {
    const source = sections(read(archive));
    const service = items(source.get(chairKey));
    const honor = zh ? '优秀领域主席（Top Area Chair）' : 'Top Area Chair';
    assert.ok(service.find(row => row.includes('(NeurIPS) 2026')).includes(honor));
    const awards = items(source.get('Selected Award'));
    assert.equal(awards.filter(row => row.includes('NeurIPS 2026') && row.includes(honor)).length, 1);
    assert.equal(awards.length, 16);
    const biography = plain(source.get('About'));
    assert.ok(biography.includes(`NeurIPS 2026 ${honor}`));
    assert.match(biography, zh ? /受邀担任 ICML 2027 领域主席/ : /invited to serve as an Area Chair for ICML 2027/);
    const reviewers = items(source.get('Conference Reviewer'));
    assert.equal(reviewers.length, 13);
    assert.ok(reviewers.some(row => row.includes('(ICML) 2026') && row.includes('Gold Reviewer')));
    assert.ok(reviewers.some(row => row.includes('(NeurIPS) 2025') && row.includes('Top Reviewer')));
    assert.ok(reviewers.every(row => !row.includes('Top Area Chair') && !row.includes('(ICML) 2027')));
  });

  test(`${homepage}: service highlight includes updated chairs and recognition without dropping prior honors`, () => {
    const html = read(homepage);
    const cards = [...html.matchAll(/<a class="highlight"[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
    const service = cards.find(card => card.includes(`href="${archive}#service"`));
    assert.ok(service);
    const copy = plain(service);
    assert.ok(copy.includes(`ICML / ICLR / NeurIPS ${zh ? '领域主席' : 'Area Chair'}`));
    assert.ok(copy.includes(`NeurIPS 2026 ${zh ? '优秀领域主席' : 'Top Area Chair'}`));
    assert.ok(copy.includes(zh ? 'ICML 2027 受邀' : 'ICML 2027 invited'));
    assert.ok(copy.includes(`ICML 2026 ${zh ? '金牌审稿人' : 'Gold Reviewer'}`));
    assert.ok(html.includes(zh ? '全部 22 条动态' : 'All 22 updates'));
  });
}
