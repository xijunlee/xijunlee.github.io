'use strict';
(() => {
  const english = new URLSearchParams(location.search).get('lang') === 'en';
  document.documentElement.lang = english ? 'en' : 'zh-CN';
  document.title = english ? 'Homepage visitor globe' : '主页访客地球仪';

  // The official globe owns all visitor data and rendering. Notify the parent
  // only that it has loaded; never infer totals or locations from map markers.
  let scheduled = false;
  const publish = () => {
    scheduled = false;
    const link = document.querySelector('#mmvst_a');
    if (!link || !/^https:\/\/mapmyvisitors\.com\/web\/[a-z0-9]+\/?$/i.test(link.href)) return;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', english ? 'MapMyVisitors statistics' : 'MapMyVisitors 访问统计');
    parent.postMessage({
      type: 'homepage-visitor-globe',
      statsURL: link.href,
    }, 'https://xijunlee.github.io');
  };
  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      // requestAnimationFrame may be suspended in a transparent/offscreen iframe.
      // Readiness must reach the parent before visitors scroll to the footer.
      queueMicrotask(publish);
    }
  }).observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['href'],
  });
  publish();

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const motion = document.createElement('style');
    motion.textContent = '.mmvst_map_f,.mmvst_map_b,.mmvst_dots{transform:none!important}';
    document.head.append(motion);
  }
})();
