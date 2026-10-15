'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');

for (const [filename, href, lang, label, accessibleLabel] of [
  ['index.html', 'en.html', 'en', 'English', 'Switch to English'],
  ['en.html', 'index.html', 'zh-CN', '中文', '切换到中文'],
]) {
  test(`${filename}: a full-language button is visible in the top header without opening the menu`, () => {
    const html = readFileSync(join(root, 'src', filename), 'utf8');
    const header = html.match(/<div class="container header-inner homepage-header">([\s\S]*?)<nav id="mobile-nav"/)[1];
    const link = header.match(/<a class="language-switch"[\s\S]*?<\/a>/)[0];
    assert.ok(link.includes(`href="${href}"`));
    assert.ok(link.includes(`lang="${lang}"`));
    assert.ok(link.includes(`hreflang="${lang}"`));
    assert.ok(link.includes(`aria-label="${accessibleLabel}"`));
    assert.ok(link.includes(`<span>${label}</span>`));
    assert.match(link, /<svg[^>]+aria-hidden="true"[^>]+focusable="false"/);
    assert.doesNotMatch(link, /\shidden(?:\s|>)|onclick=|target=/);
    assert.equal((header.match(/class="language-switch"/g) || []).length, 1);
    assert.ok(html.includes('styles.css?v=12'));
  });
}
test('language buttons have a high-contrast treatment and mobile sizing without changing archive selectors', () => {
  const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
  const languageButton = css.match(/\.language-switch\{([^}]+)\}/)[1];
  assert.ok(languageButton.includes('background:var(--sjtu-blue);color:#fff'));
  assert.ok(languageButton.includes('min-height:2.75rem'));
  assert.ok(languageButton.includes('flex:0 0 auto'));
  assert.match(css, /@media\(max-width:900px\)\{\.homepage-header \.language-switch\{margin-left:auto\}\}/);
  assert.match(css, /@media\(max-width:680px\)\{\.language-switch\{[^}]*min-height:2\.5rem/);
  assert.match(css, /@media\(max-width:360px\)\{[^\n]*\.homepage-header \.site-logo\{width:128px\}/);
});
