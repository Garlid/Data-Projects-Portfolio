// Horizontal bar chart for the project pages: one or two series, row label above
// its bars, value at each bar tip, and a hover/focus tooltip. Redraws on resize.
//
// barChart(el, {
//   series: [{ name, color }],                 // 1 or 2
//   rows:   [{ label, values: [..], color?, tip: [[name, value], ..] }],
//   max, ticks: [..], fmt: v => string, tickFmt?: v => string,
//   band: { from, to }                          // optional highlighted row range
// })
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // Bar with a 4px rounded data-end and a square baseline
  function barPath(x, y, w, h) {
    const r = Math.min(4, w, h / 2);
    if (w <= 0) return '';
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }

  function draw(root, cfg) {
    root.querySelector('svg')?.remove();
    const W = root.clientWidth;
    const n = cfg.series.length;
    const barH = n === 1 ? 18 : 13, barGap = 3, labelH = 22, rowGap = 16;
    const rowH = labelH + n * barH + (n - 1) * barGap;
    const valueRoom = 64, axisH = 28, top = 4;
    const plotW = Math.max(120, W - valueRoom);
    const H = top + cfg.rows.length * (rowH + rowGap) - rowGap + axisH;
    const x = (v) => (v / cfg.max) * plotW;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': cfg.ariaLabel || '' }, root);

    // Highlight band behind a group of rows
    if (cfg.band) {
      const y0 = top + cfg.band.from * (rowH + rowGap) - 8;
      const y1 = top + (cfg.band.to + 1) * (rowH + rowGap) - rowGap + 8;
      el('rect', { x: -10, y: y0, width: W + 10, height: y1 - y0, rx: 10, fill: 'rgba(58,165,147,.07)' }, svg);
    }

    // Gridlines + tick labels
    const plotBottom = H - axisH + 6;
    cfg.ticks.forEach((t) => {
      const gx = Math.round(x(t)) + .5;
      el('line', { x1: gx, x2: gx, y1: top, y2: plotBottom, stroke: t === 0 ? css('--baseline') : css('--grid'), 'stroke-width': 1 }, svg);
      const tx = el('text', { x: gx, y: H - 6, 'text-anchor': t === 0 ? 'start' : 'middle', 'font-size': 12, fill: css('--text-dim') }, svg);
      tx.textContent = (cfg.tickFmt || cfg.fmt)(t);
    });

    const tip = root.querySelector('.tip') || Object.assign(document.createElement('div'), { className: 'tip' });
    tip.setAttribute('role', 'status');
    root.appendChild(tip);

    cfg.rows.forEach((row, i) => {
      const y = top + i * (rowH + rowGap);
      const g = el('g', { class: 'row', tabindex: 0, 'aria-label': `${row.label}: ` + row.values.map((v, k) => `${cfg.series[k].name} ${cfg.fmt(v)}`).join(', ') }, svg);
      el('rect', { class: 'row-hit', x: -10, y: y - 6, width: W + 10, height: rowH + 12, rx: 8 }, g);

      const lab = el('text', { x: 0, y: y + 15, 'font-size': 14, fill: css('--text') }, g);
      lab.textContent = row.label;

      row.values.forEach((v, k) => {
        const by = y + labelH + k * (barH + barGap);
        const color = row.color || cfg.series[k].color;
        el('path', { class: 'bar', d: barPath(0, by, x(v), barH), style: `fill:${color}` }, g);
        const vt = el('text', { x: x(v) + 8, y: by + barH / 2 + 4.5, 'font-size': 13, fill: css('--text-strong'), 'font-weight': 500 }, g);
        vt.textContent = cfg.fmt(v);
      });

      const show = (evt) => {
        tip.innerHTML = `<b>${row.label}</b>` + (row.tip || row.values.map((v, k) => [cfg.series[k].name, cfg.fmt(v)]))
          .map(([k, v]) => `<div class="tip-row"><span>${k}</span><span>${v}</span></div>`).join('');
        const rb = root.getBoundingClientRect();
        let left, topPx;
        if (evt && evt.clientX) { left = evt.clientX - rb.left + 14; topPx = evt.clientY - rb.top + 14; }
        else { left = Math.min(x(Math.max(...row.values)) + 70, W - 200); topPx = y + rowH; }
        tip.classList.add('on');
        left = Math.max(0, Math.min(left, W - tip.offsetWidth));
        tip.style.left = left + 'px';
        tip.style.top = topPx + 'px';
      };
      const hide = () => tip.classList.remove('on');
      g.addEventListener('mousemove', show);
      g.addEventListener('mouseleave', hide);
      g.addEventListener('focus', () => show());
      g.addEventListener('blur', hide);
    });
  }

  window.barChart = (root, cfg) => {
    draw(root, cfg);
    let w = root.clientWidth;
    new ResizeObserver(() => { if (root.clientWidth !== w) { w = root.clientWidth; draw(root, cfg); } }).observe(root);
  };
})();
