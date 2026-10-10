'use strict';
(() => {
  const section = document.querySelector('.visitor-section');
  if (!section) return;
  const english = document.body.dataset.lang === 'en';
  const find = name => section.querySelector(`[data-visitor-${name}]`);
  const status = find('status');
  const format = new Intl.NumberFormat(english ? 'en-US' : 'zh-CN');
  const copy = english ? {
    unavailable: 'Statistics are temporarily unavailable.',
    mapUnavailable: 'The globe could not be loaded.',
    points: 'source regions', unknown: 'sessions without a mapped region',
    partial: 'Partial location data', gaps: 'Recorded days only',
    date: 'Recorded dates', stale: 'Last successful sync', updated: 'Updated',
  } : {
    unavailable: '访客统计暂时无法读取。', mapUnavailable: '地球仪暂时无法加载。',
    points: '个来源地区', unknown: '次会话地域待识别',
    partial: '地域记录不完整', gaps: '仅含已同步日期',
    date: '已同步日期', stale: '上次成功同步', updated: '更新于',
  };
  const setNumber = (name, value) => {
    const node = find(name);
    node.textContent = format.format(value);
    node.removeAttribute('aria-label');
  };
  async function load() {
    try {
      const response = await fetch('visitor-data.json', { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('snapshot unavailable');
      const data = await response.json();
      const validNumber = value => Number.isSafeInteger(value) && value >= 0;
      if (data.schema !== 1 || data.source !== '51LA' || !validNumber(data.overview?.pv) || !validNumber(data.overview?.uv) || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error('invalid snapshot');
      setNumber('total', data.overview.pv);
      setNumber('unique', data.overview.uv);
      const updated = find('updated');
      const date = new Date(data.updatedAt);
      updated.dateTime = date.toISOString();
      const stale = Date.now() - date.getTime() > 172800000;
      updated.textContent = `${stale ? copy.stale : copy.updated} ${new Intl.DateTimeFormat(english ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)} UTC+8`;
      const geo = data.geography;
      if (!Array.isArray(geo?.regions)) throw new Error('invalid geography');
      const regions = geo.regions.filter(row => typeof row.zh === 'string' && typeof row.en === 'string' && Number.isFinite(row.lat) && Math.abs(row.lat) <= 90 && Number.isFinite(row.lon) && Math.abs(row.lon) <= 180 && validNumber(row.sessions) && row.sessions > 0);
      const regionCount = find('regions');
      regionCount.textContent = `${format.format(regions.length)} ${copy.points}`;
      const notes = [];
      if (geo.from && geo.to) notes.push(`${copy.date} ${geo.from}–${geo.to}`);
      if (!geo.complete) notes.push(copy.partial);
      if (geo.from && geo.to && (new Date(geo.to) - new Date(geo.from)) / 86400000 + 1 !== data.days?.length) notes.push(copy.gaps);
      if (validNumber(geo.unknown) && geo.unknown > 0) notes.push(`${format.format(geo.unknown)} ${copy.unknown}`);
      // Keep coverage / partial-data context available on hover without adding
      // an extra visible description row to the compact statistics layout.
      regionCount.title = notes.join(' · ');
      status.hidden = true;
      // Rendering failure cannot erase successfully fetched source totals.
      try {
        await window.HomepageGlobe({ root: find('visual'), regions, english });
      } catch {
        status.textContent = copy.mapUnavailable;
        status.hidden = false;
      }
    } catch {
      status.textContent = copy.unavailable;
      status.hidden = false;
    }
  }
  load();
})();
