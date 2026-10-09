'use strict';
(() => {
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

  const frame = document.createElement('iframe');
  frame.className = 'visitor-frame';
  frame.title = copy.title;
  frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const fallbackTimer = setTimeout(() => { status.textContent = copy.unavailable; }, 20000);
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.data?.type !== 'homepage-visitor-globe') return;
    const { statsURL } = event.data;
    if (typeof statsURL !== 'string' || !/^https:\/\/mapmyvisitors\.com\/web\/[a-z0-9]+\/?$/i.test(statsURL)) return;
    clearTimeout(fallbackTimer);
    details.href = statsURL;
    details.hidden = false;
    status.hidden = true;
    visual.dataset.state = 'ready';
  });
  // The legacy provider resolves protocol-relative AJAX URLs using location.href.
  // A real HTTPS document is required: srcdoc/blob documents produce about:/blob:
  // data requests even if a <base> element points at the published homepage.
  const frameURL = new URL('visitor-globe.html', document.baseURI);
  frameURL.search = new URLSearchParams({ lang: english ? 'en' : 'zh-CN', v: '3' }).toString();
  frame.src = frameURL.href;
  visual.append(frame);
})();
