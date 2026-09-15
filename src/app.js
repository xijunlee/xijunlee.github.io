'use strict';
(() => {
  const language = document.body.dataset.lang === 'en' ? 'en' : 'zh';
  const menuLabels = language === 'en'
    ? { open: 'Open navigation', close: 'Close navigation' }
    : { open: '展开导航', close: '收起导航' };
  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  menuButton?.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    menuButton.setAttribute('aria-label', expanded ? menuLabels.open : menuLabels.close);
    mobileNav.hidden = expanded;
  });
  mobileNav?.addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', menuLabels.open);
  });

  const data = window.ACADEMIC_DATA;
  if (!data) return;
  const copy = language === 'en' ? {
    labels:{all:'All publications and preprints',A:'CCF A',B:'CCF B',C:'CCF C',other:'Other papers, preprints and theses'}, spotlight:'✧ Spotlight',
    empty:'No matching publications. Try another query or select “All”.', search:'Search', read:'Read', archive:'archive.html#publication',
    notes:{'竞赛报告':'Competition paper','论文类型待核对 · 会议 CCF A':'Paper type pending · venue is CCF A','硕士学位论文':'Master thesis','CCF 目录外':'Outside CCF directory','预印本 / 技术报告':'Preprint / technical report'}
  } : {
    labels:{all:'全部论文与预印本',A:'CCF A 类',B:'CCF B 类',C:'CCF C 类',other:'其他论文、预印本与学位论文'}, spotlight:'✧ 亮点论文',
    empty:'没有找到匹配的论文。试试其他关键词，或选择“全部”。', search:'搜索', read:'阅读', archive:'archive-zh.html#publication', notes:{}
  };
  const list = document.querySelector('#paper-list');
  const search = document.querySelector('#paper-search');
  const status = document.querySelector('#paper-status');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  let activeFilter = 'A';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function renderPaper(p) {
    const href = esc(p.links[0]?.href || copy.archive);
    const badge = p.rank === 'other' ? (copy.notes[p.note] || p.note) : `CCF ${p.rank}`;
    const links = p.links.map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join('');
    const authors = p.authors_html;
    const description = language === 'en' ? p.description_en : p.description;
    return `<article class="paper"><div class="paper-meta"><div class="paper-venue">${esc(p.venue)}</div><div class="paper-year">${p.year || '—'}</div><span class="ccf-badge">${esc(badge)}</span></div><div><h3><a href="${href}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a></h3>${description ? `<p class="paper-description">${esc(description)}</p>` : ''}<p class="paper-authors">${authors}</p><div class="paper-resources">${p.spotlight ? `<span class="spotlight">${copy.spotlight}</span>` : ''}${links}</div></div><a class="paper-arrow" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${copy.read} ${esc(p.title)}">↗</a></article>`;
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    let papers = data.papers.filter(p => (activeFilter === 'all' || p.rank === activeFilter) && p.search.toLocaleLowerCase().includes(query));
    papers.sort((a,b) => (b.year || 0) - (a.year || 0) || a.id - b.id);
    list.innerHTML = papers.length ? papers.map(renderPaper).join('') : `<p class="empty-result">${copy.empty}</p>`;
    status.textContent = `${copy.labels[activeFilter]} · ${papers.length}${language === 'zh' ? ' 条' : ''}${query ? ` · ${copy.search} “${search.value.trim()}”` : ''}`;
    buttons.forEach(button => {
      const selected = button.dataset.filter === activeFilter;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }

  buttons.forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.filter; render(); }));
  search.addEventListener('input', render);
  document.querySelectorAll('[data-pub-query]').forEach(link => link.addEventListener('click', () => {
    activeFilter = 'all'; search.value = link.dataset.pubQuery; render();
  }));
  render();
})();
