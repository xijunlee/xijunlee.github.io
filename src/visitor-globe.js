'use strict';
(() => {
  const english = new URLSearchParams(location.search).get('lang') === 'en';
  document.documentElement.lang = english ? 'en' : 'zh-CN';
  document.title = english ? 'Homepage visitor globe' : '主页访客地球仪';

  // Read the explicit Total Pageviews label from the same account's official
  // counter endpoint. This read-only data request does not embed another tracker.
  // The returned widget program is never evaluated and markers are never counted.
  let pending = false;
  let requestID = 0;
  const requestCounter = () => {
    if (pending || document.hidden) return;
    const embed = document.getElementById('mmvst_globe');
    if (!embed) return;
    const options = new URL(embed.src).searchParams;
    const endpoint = new URL('https://mapmyvisitors.com/widget_call_home.js');
    for (const key of ['d', 'w', 'cl', 'co', 'ct', 'cmo', 'cmn']) {
      if (options.has(key)) endpoint.searchParams.set(key, options.get(key));
    }
    const callback = `homepageVisitorCounter${++requestID}`;
    endpoint.searchParams.set('t', 'tt');
    endpoint.searchParams.set('callback', callback);
    // Match the official widget's cache:false request rather than reuse a stale
    // CDN response (the endpoint otherwise serves older counter labels).
    endpoint.searchParams.set('_', String(Date.now()));
    const script = document.createElement('script');
    let timer;
    const finish = unavailable => {
      if (window[callback] === undefined) return;
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      pending = false;
      if (unavailable) parent.postMessage({ type: 'homepage-visitor-counter-unavailable' }, 'https://xijunlee.github.io');
    };
    window[callback] = payload => {
      const label = typeof payload === 'string' && payload.match(/\.find\(['"]\.mapmyvisitors-visitors['"]\)\s*\.html\(['"](\d+(?:,\d{3})*) Total Pageviews['"]\)/);
      const totalPageviews = label ? Number(label[1].replaceAll(',', '')) : NaN;
      if (Number.isSafeInteger(totalPageviews) && totalPageviews >= 0) {
        parent.postMessage({ type: 'homepage-visitor-counter', totalPageviews }, 'https://xijunlee.github.io');
        finish(false);
      } else {
        finish(true);
      }
    };
    pending = true;
    script.async = true;
    script.src = endpoint.href;
    script.onerror = () => finish(true);
    timer = setTimeout(() => finish(true), 15000);
    document.head.append(script);
  };

  // The official globe owns all geographic data and rendering. Never infer
  // totals or location counts from its markers.
  let counterStarted = false;
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
    if (!counterStarted) {
      counterStarted = true;
      requestCounter();
      setInterval(requestCounter, 60000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) requestCounter(); });
    }
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
