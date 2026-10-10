'use strict';
(() => {
  // One 51LA application covers both languages and the full academic archives.
  // Local previews, copied deployments and the legacy globe iframe must not
  // generate pageviews. Start collection independently of the footer widget.
  if (location.hostname !== 'xijunlee.github.io') return;
  if (window.__homepage51LAStarted || document.getElementById('LA_COLLECT')) return;
  window.__homepage51LAStarted = true;

  const script = document.createElement('script');
  script.id = 'LA_COLLECT';
  script.charset = 'UTF-8';
  script.src = 'https://sdk.51.la/js-sdk-pro.min.js';
  script.async = true;
  script.dataset.state = 'loading';
  script.onload = () => {
    if (typeof window.LA?.init !== 'function') {
      script.dataset.state = 'unavailable';
      return;
    }
    try {
      window.LA.init({ id: '3RSi0ApWyvRKOoCj', ck: '3RSi0ApWyvRKOoCj' });
      // This records SDK initialization, not a claim that the collector server
      // has received the pageview. Receipt is checked in the 51LA dashboard.
      script.dataset.state = 'initialized';
    } catch {
      script.dataset.state = 'unavailable';
    }
  };
  script.onerror = () => { script.dataset.state = 'unavailable'; };
  document.head.append(script);
})();
