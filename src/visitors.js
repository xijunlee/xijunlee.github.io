'use strict';
(() => {
  // One MapMyVisitors counter for both homepage languages.
  const widgetId = 'SacDpCibu7P_YwKchCIJVW6hz5sEw_uXBXHV2r2ttcc';
  const section = document.querySelector('.visitor-section');
  if (!section) return;

  const english = document.body.dataset.lang === 'en';
  const visual = section.querySelector('[data-visitor-visual]');
  const status = section.querySelector('[data-visitor-status]');
  const details = section.querySelector('[data-visitor-details]');
  status.hidden = false;
  const copy = english ? {
    title: 'Rotating globe showing homepage visitor locations',
    unavailable: 'Visitor statistics are temporarily unavailable. Please try again later.',
    preview: 'Live visitor statistics are enabled on the published homepage.',
  } : {
    title: '显示主页访客来源地点的旋转地球仪',
    unavailable: '访客统计暂时无法加载，请稍后再试。',
    preview: '访客统计在正式上线的主页中启用。',
  };

  // Do not pollute the live counter with local previews or copied deployments.
  if (location.hostname !== 'xijunlee.github.io') {
    status.textContent = copy.preview;
    return;
  }

  const widgetURL = new URL('https://mapmyvisitors.com/globe.js');
  widgetURL.search = new URLSearchParams({
    d: widgetId, w: '224', cl: 'ffffff', co: '2d78ad', ct: '17344f',
    cmo: '2d78ad', cmn: 'dc6256',
  }).toString();

  // Isolate the provider's legacy CSS/jQuery from the rest of the homepage.
  // Read only the displayed, aggregated markers: mirrored SVG groups are
  // excluded, and unknown locations are not counted as geographic sources.
  function observeGlobe() {
    let scheduled = false;
    const publish = () => {
      scheduled = false;
      const link = document.querySelector('#mmvst_a');
      if (!link || !/^https:\/\/mapmyvisitors\.com\/web\//.test(link.href)) return;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', 'MapMyVisitors statistics');
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
        requestAnimationFrame(publish);
      }
    }).observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['title', 'href'],
    });
    publish();
    // Keep the globe still for visitors who prefer reduced motion.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const motion = document.createElement('style');
      motion.textContent = '.mmvst_map_f,.mmvst_map_b,.mmvst_dots{transform:none!important}';
      document.head.append(motion);
    }
  }

  const frame = document.createElement('iframe');
  frame.className = 'visitor-frame';
  frame.title = copy.title;
  frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const fallbackTimer = setTimeout(() => { status.textContent = copy.unavailable; }, 20000);
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.data?.type !== 'homepage-visitor-globe') return;
    const { visits, locations, statsURL } = event.data;
    if (!Number.isSafeInteger(visits) || visits < 0 || !Number.isSafeInteger(locations) || locations < 0) return;
    if (typeof statsURL !== 'string' || !/^https:\/\/mapmyvisitors\.com\/web\/[a-z0-9]+\/?$/i.test(statsURL)) return;
    clearTimeout(fallbackTimer);
    const format = new Intl.NumberFormat(english ? 'en' : 'zh-CN');
    section.querySelector('[data-visitor-visits]').textContent = format.format(visits);
    section.querySelector('[data-visitor-locations]').textContent = format.format(locations);
    details.href = statsURL;
    details.hidden = false;
    status.hidden = true;
    visual.dataset.state = 'ready';
  });
  frame.srcdoc = `<!doctype html><html lang="${english ? 'en' : 'zh-CN'}"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>html,body{margin:0;background:transparent}body{width:224px;margin:0 auto;padding-top:4px}#mmvst_a{display:block}#tooltiper{font-family:Arial,sans-serif}</style>
    </head><body>
    <script>(${observeGlobe.toString()})();<\/script>
    <script id="mmvst_globe" src="${widgetURL.href.replace(/&/g, '&amp;')}"><\/script>
    </body></html>`;
  visual.append(frame);
})();
