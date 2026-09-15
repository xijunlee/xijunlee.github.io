'use strict';
(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  menuButton?.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    menuButton.setAttribute('aria-label', expanded ? '展开导航' : '收起导航');
    mobileNav.hidden = expanded;
  });
  mobileNav?.addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '展开导航');
  });

  const data = window.ACADEMIC_DATA;
  if (!data) return;
  const list = document.querySelector('#paper-list');
  const search = document.querySelector('#paper-search');
  const status = document.querySelector('#paper-status');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  let activeFilter = 'selected';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function renderPaper(p) {
    const href = esc(p.links[0]?.href || 'archive.html#publication');
    const badge = p.rank === 'other' ? p.note : `CCF ${p.rank}`;
    const links = p.links.map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join('');
    const authors = p.authors_html;
    return `<article class="paper"><div class="paper-meta"><div class="paper-venue">${esc(p.venue)}</div><div class="paper-year">${p.year || '—'}</div><span class="ccf-badge">${esc(badge)}</span></div><div><h3><a href="${href}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a></h3>${p.description ? `<p class="paper-description">${esc(p.description)}</p>` : ''}<p class="paper-authors">${authors}</p><div class="paper-resources">${p.spotlight ? '<span class="spotlight">✧ Spotlight</span>' : ''}${links}</div></div><a class="paper-arrow" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="阅读 ${esc(p.title)}">↗</a></article>`;
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    let papers = data.papers.filter(p => (activeFilter === 'all' || (activeFilter === 'selected' ? p.selected : p.rank === activeFilter)) && p.search.toLocaleLowerCase().includes(query));
    if (activeFilter === 'selected') papers.sort((a,b) => data.selected_ids.indexOf(a.id) - data.selected_ids.indexOf(b.id));
    else papers.sort((a,b) => (b.year || 0) - (a.year || 0) || a.id - b.id);
    list.innerHTML = papers.length ? papers.map(renderPaper).join('') : '<p class="empty-result">没有找到匹配的论文。试试其他关键词，或选择“全部”。</p>';
    const labels = {selected:'代表论文',all:'全部论文与预印本',A:'CCF A 类',B:'CCF B 类',C:'CCF C 类',other:'其他论文、预印本与学位论文'};
    status.textContent = `${labels[activeFilter]} · ${papers.length} 条${query ? ` · 搜索“${search.value.trim()}”` : ''}`;
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
