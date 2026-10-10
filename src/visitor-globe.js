'use strict';
// All drawing code and land outlines are hosted with the homepage. No analytics
// SDK, visitor endpoint or external CDN is loaded by the globe itself.
window.HomepageGlobe = async ({ root, regions, english }) => {
  if (!window.d3?.geoOrthographic || !window.topojson?.feature) throw new Error('local drawing library unavailable');
  const response = await fetch('assets/geo/land-110m.json', { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('local land outlines unavailable');
  const topology = await response.json();
  const land = topojson.feature(topology, topology.objects.land);
  const ns = 'http://www.w3.org/2000/svg';
  const element = (tag, attributes = {}) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const svg = element('svg', { viewBox: '0 0 160 160', class: 'visitor-globe', role: 'img', 'aria-label': english ? 'Visitor source regions, at country or province level' : '访客来源地区地球仪，按国家或省级汇总' });
  const title = element('title');
  title.textContent = english ? '51LA visitor source regions; approximate representative positions' : '51LA 访客来源；光点为地区示意位置，非访客精确定位';
  svg.append(title);
  const defs = element('defs');
  const ocean = element('radialGradient', { id: 'visitor-ocean', cx: '32%', cy: '25%', r: '80%' });
  ocean.append(element('stop', { offset: '0%', 'stop-color': '#f1f9fd' }), element('stop', { offset: '100%', 'stop-color': '#b4d4e7' }));
  defs.append(ocean); svg.append(defs);
  const sphere = element('circle', { cx: 80, cy: 80, r: 73, fill: 'url(#visitor-ocean)', stroke: '#a7c9de', 'stroke-width': 0.6 });
  const grid = element('path', { fill: 'none', stroke: '#b5d1e1', 'stroke-width': 0.35, opacity: 0.7 });
  const coast = element('path', { fill: '#4187b1', stroke: '#f0f8fc', 'stroke-width': 0.35 });
  const points = element('g');
  svg.append(sphere, grid, coast, points);
  const dots = regions.map(region => {
    const dot = element('circle', { r: Math.min(4, 2 + Math.log2(region.sessions + 1) * 0.3), fill: '#df6553', stroke: '#fff', 'stroke-width': 0.65 });
    const tooltip = element('title');
    tooltip.textContent = `${english ? region.en : region.zh} · ${region.sessions} ${english ? 'recorded sessions' : '次已记录会话'}`;
    dot.append(tooltip); points.append(dot);
    return { dot, region };
  });
  const projection = d3.geoOrthographic().scale(73).translate([80, 80]).clipAngle(90);
  const path = d3.geoPath(projection);
  const graticule = d3.geoGraticule10();
  const center = regions[0] ? [regions[0].lon, regions[0].lat] : [105, 25];
  const latitude = Math.max(-45, Math.min(45, center[1]));
  let longitude = center[0];
  const draw = () => {
    projection.rotate([-longitude, -latitude]);
    grid.setAttribute('d', path(graticule));
    coast.setAttribute('d', path(land));
    for (const { dot, region } of dots) {
      const visible = d3.geoDistance([longitude, latitude], [region.lon, region.lat]) < Math.PI / 2;
      dot.setAttribute('display', visible ? 'inline' : 'none');
      if (visible) { const [x, y] = projection([region.lon, region.lat]); dot.setAttribute('cx', x); dot.setAttribute('cy', y); }
    }
  };
  root.append(svg);
  root.dataset.state = 'ready';
  draw(); // Not gated on requestAnimationFrame when the footer is offscreen.
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, hovered = false, frame = 0, last = null;
  const animate = timestamp => {
    frame = 0;
    if (!visible || hovered || document.hidden || motion.matches) { last = null; return; }
    if (last !== null) longitude += Math.min(100, timestamp - last) * 0.006;
    last = timestamp;
    draw(); frame = requestAnimationFrame(animate);
  };
  const resume = () => { if (!frame && visible && !hovered && !document.hidden && !motion.matches) frame = requestAnimationFrame(animate); };
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume(); }).observe(root);
  root.addEventListener('pointerenter', () => { hovered = true; });
  root.addEventListener('pointerleave', () => { hovered = false; resume(); });
  document.addEventListener('visibilitychange', resume);
  motion.addEventListener('change', resume);
};
