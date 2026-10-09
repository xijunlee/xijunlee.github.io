'use strict';
(() => {
  const english = new URLSearchParams(location.search).get('lang') === 'en';
  document.documentElement.lang = english ? 'en' : 'zh-CN';
  document.title = english ? 'Homepage visitor globe' : '主页访客地球仪';

  // Read the provider's displayed aggregates, not mirrored SVG copies.
  // Unknown locations count as visits but not as geographic sources.
  let scheduled = false;
  const publish = () => {
    scheduled = false;
    const link = document.querySelector('#mmvst_a');
    if (!link || !/^https:\/\/mapmyvisitors\.com\/web\/[a-z0-9]+\/?$/i.test(link.href)) return;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', english ? 'MapMyVisitors statistics' : 'MapMyVisitors 访问统计');
    let visits = 0;
    const locations = new Set();
    const points = document.querySelector('.svg_points');
    points?.querySelectorAll('circle[title]').forEach(point => {
      const match = point.getAttribute('title').match(/^(\d+)(?: recent)? visits? from (.+)$/);
      if (!match) return;
      visits += Number(match[1]);
      if (match[2] !== 'Unknown Location') {
        locations.add(`${point.getAttribute('cx')},${point.getAttribute('cy')}`);
      }
    });
    parent.postMessage({
      type: 'homepage-visitor-globe', visits, locations: locations.size,
      statsURL: link.href,
    }, 'https://xijunlee.github.io');
  };
  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      // requestAnimationFrame may be suspended in a transparent/offscreen iframe.
      // Statistics must reach the parent even before visitors scroll to the footer.
      queueMicrotask(publish);
    }
  }).observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['title', 'href'],
  });
  publish();

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const motion = document.createElement('style');
    motion.textContent = '.mmvst_map_f,.mmvst_map_b,.mmvst_dots{transform:none!important}';
    document.head.append(motion);
  }
})();
