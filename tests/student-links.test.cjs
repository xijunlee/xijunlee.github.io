'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = page => fs.readFileSync(path.join(__dirname, '..', 'dist', page), 'utf8');
const correct = 'http://www.se.sjtu.edu.cn/Data/View/641';
const obsolete = 'https://mp.weixin.qq.com/s/3x_Zj_OL7N2nzZq-ZgEDLg';

for (const page of ['archive-zh.html', 'archive.html']) {
  test(`${page}: all five Challenge Cup student news links use the confirmed school report`, () => {
    const html = read(page);
    const students = html.match(/<section[^>]*data-archive-key="Supervised and Co-supervised Students"[\s\S]*?<\/section>/)[0];
    const entries = [...students.matchAll(/<li><p>[\s\S]*?<\/p>\s*<\/li>/g)].map(m => m[0]);
    for (const name of ['Jiexiang Yang', 'Jinghao Wang', 'Zhengdong He', 'Ye Zhu', 'Junqing Song']) {
      const entry = entries.find(item => item.includes(name));
      assert.ok(entry);
      assert.ok(entry.includes(`href="${correct}" target="_blank" rel="noopener noreferrer"`));
    }
    assert.equal(students.split(correct).length - 1, 5);
    assert.ok(students.includes('JiexiangYang-OutstandingThesis.jpg'));
    assert.ok(students.includes('JiexiangYang-OutstandingThesis2.jpg'));
    assert.ok(!html.includes(obsolete));
  });
}

for (const page of ['index.html', 'en.html']) {
  test(`${page}: student achievement report uses the same corrected destination`, () => {
    const html = read(page);
    const people = html.match(/<section[^>]*id="people"[\s\S]*?<\/section>/)[0];
    assert.ok(people.includes(`href="${correct}" target="_blank" rel="noopener noreferrer"`));
    assert.ok(!html.includes(obsolete));
    assert.ok(html.includes('challenge_cup_certificate.jpg'));
  });
}
