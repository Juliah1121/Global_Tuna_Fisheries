(function () {
  const T = (window.TU = {});
  T.RF = { IATTC: '東太平洋', ICCAT: '大西洋及地中海', IOTC: '印度洋', WCPFC: '中西太平洋', CCSBT: '南方黑鮪（全球）', 'WCPFC+IATTC': '全太平洋' };
  T.RF_ORDER = ['ICCAT', 'IOTC', 'IATTC', 'WCPFC', 'CCSBT', 'WCPFC+IATTC'];
  T.fmt = d3.format(',');
  T.fmt0 = d3.format(',.0f');
  T.fmt1 = d3.format(',.1f');
  T.pct = d3.format('.0%');
  T.compact = (v) => new Intl.NumberFormat('zh-TW', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  T.tonnes = (v) => (v == null || isNaN(v) ? '—' : T.fmt0(v) + ' 公噸');

  // ---------- data cache ----------
  const cache = new Map();
  T.rows = (id, parse) => {
    const d = dash.data(id);
    if (d.status !== 'ok') return null;
    const c = cache.get(id);
    if (c && c.src === d.data) return c.rows;
    const rows = parse ? d.data.map(parse) : d.data;
    cache.set(id, { src: d.data, rows });
    return rows;
  };
  T.status = (ids) => {
    const s = ids.map((id) => dash.data(id).status);
    if (s.every((x) => x === 'ok')) return 'ok';
    if (s.some((x) => x === 'error' || x === 'connect' || x === 'declined' || x === 'missing')) return 'error';
    return 'loading';
  };
  T.num = (v) => (v === '' || v == null ? null : +v);
  T.catchRows = () =>
    T.rows('catches', (r) => ({ rfmo: r.rfmo, sp: r.sp, cc: r.cc, gear: r.gear, year: +r.year, t: +r.t }));
  T.lookup = (id, key, val) => {
    const rows = T.rows(id);
    if (!rows) return {};
    const k = '__lk_' + key + val;
    if (!rows[k]) Object.defineProperty(rows, k, { value: Object.fromEntries(rows.map((r) => [r[key], r[val]])) });
    return rows[k];
  };
  T.results = () =>
    T.rows('cmsy_results', (r) => {
      const o = { ...r };
      ['start', 'end', 'max_catch', 'last_catch', 'r', 'r_lo', 'r_hi', 'k', 'k_lo', 'k_hi', 'msy', 'msy_lo', 'msy_hi', 'bmsy', 'fmsy',
        'catch_msy', 'b', 'b_lo', 'b_hi', 'f', 'f_lo', 'f_hi', 'p_red', 'p_yellow', 'p_orange', 'p_green', 'bk'].forEach((c) => (o[c] = T.num(r[c])));
      o.raw = r;
      return o;
    });

  // ---------- colors ----------
  T.css = (name) => getComputedStyle(document.getElementById('dash-root') || document.documentElement).getPropertyValue(name).trim();
  T.zoneColor = (z) => {
    const bad = T.css('--color-bad') || '#c0392b', warn = T.css('--color-warn') || '#b7950b', ok = T.css('--color-ok') || '#1e8449';
    return { 紅: bad, 黃: warn, 橙: d3.interpolateRgb(bad, warn)(0.5), 綠: ok }[z] || T.css('--color-fg-muted');
  };
  T.rfColor = (rf) => {
    const i = T.RF_ORDER.indexOf(rf);
    return dash.colors[(i < 0 ? 7 : i) % dash.colors.length];
  };
  T.zoneName = { 紅: '過漁且資源不足', 黃: '資源不足、漁獲壓力未過高', 橙: '資源足夠、漁獲壓力過高', 綠: '健康' };

  // ---------- helpers ----------
  T.el = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  T.state = (el, st) => {
    el.classList.toggle('dash-skeleton', st === 'loading');
    if (st === 'error') {
      el.replaceChildren(T.el('div', { class: 'tu-failed' }, '無法載入資料'));
    } else if (st === 'loading') {
      el.replaceChildren();
    }
  };
  T.visible = (el) => el && el.offsetParent !== null && el.clientWidth > 0;

  // tooltip
  T.tip = (box) => {
    let t = box.querySelector(':scope > .tu-tip');
    if (!t) {
      t = T.el('div', { class: 'tu-tip', role: 'status' });
      t.hidden = true;
      box.appendChild(t);
    }
    return {
      show(ev, head, lines) {
        t.replaceChildren();
        if (head) t.appendChild(T.el('div', { class: 'tu-tip-h' }, head));
        lines.forEach(([label, value, color]) => {
          const row = T.el('div', { class: 'tu-tip-r' });
          if (color) {
            const sw = T.el('span', { class: 'tu-sw' });
            sw.style.background = color;
            row.appendChild(sw);
          }
          row.appendChild(T.el('span', { class: 'tu-tip-l' }, label));
          row.appendChild(T.el('span', { class: 'tu-tip-v' }, value));
          t.appendChild(row);
        });
        t.hidden = false;
        const bb = box.getBoundingClientRect();
        let x = ev.clientX - bb.left + 12, y = ev.clientY - bb.top + 12;
        const w = t.offsetWidth, h = t.offsetHeight;
        if (x + w > bb.width) x = Math.max(0, ev.clientX - bb.left - w - 12);
        if (y + h > bb.height) y = Math.max(0, ev.clientY - bb.top - h - 12);
        t.style.left = x + 'px';
        t.style.top = y + 'px';
      },
      hide() { t.hidden = true; },
    };
  };

  // measure text width in an svg
  T.textW = (svg, strings, cls = 'tu-tick') => {
    const g = svg.append('g').attr('class', cls).attr('visibility', 'hidden');
    let w = 0;
    strings.forEach((s) => {
      const n = g.append('text').text(s).node();
      w = Math.max(w, n.getComputedTextLength());
    });
    g.remove();
    return w;
  };
  T.svg = (el, h) => {
    const w = Math.max(260, el.clientWidth);
    const old = el.querySelector(':scope > svg');
    if (old) old.remove();
    const svg = d3.select(el).insert('svg', ':first-child').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`).attr('height', h);
    return { svg, w, h };
  };
  T.axisStyle = (g) => {
    g.attr('font-size', null).attr('font-family', null).attr('class', 'tu-axis');
    g.select('.domain').style('stroke', 'var(--cds-chart-axis)');
    g.selectAll('.tick line').style('stroke', 'var(--cds-chart-grid)');
    g.selectAll('.tick text').style('fill', 'var(--color-fg-muted)');
  };
  T.yearTicks = (x, w) => {
    const [a, b] = x.domain();
    const n = Math.max(2, Math.floor(w / 70));
    return x.ticks(n).filter((v) => Number.isInteger(v) && v >= a && v <= b);
  };

  // ---------- time series: lines + bands ----------
  // opts: {height, series:[{name,color,values:[{x,y}],lo?,hi?,dash?}], yFmt, ref:{y,label}, yMin, yMax, xDomain, yLabel}
  T.lineChart = (el, o) => {
    const { svg, w, h } = T.svg(el, o.height || 260);
    const all = o.series.flatMap((s) => s.values.filter((p) => p.y != null && !isNaN(p.y)));
    if (!all.length) return;
    const xs = o.xDomain || d3.extent(all, (d) => d.x);
    let yMax = o.yMax ?? d3.max(o.series.flatMap((s) => s.values.map((p) => Math.max(p.y ?? 0, s.hi ? 0 : 0, p.hi ?? 0))));
    if (o.ref) yMax = Math.max(yMax, o.ref.y * 1.15);
    const y = d3.scaleLinear([o.yMin ?? 0, yMax * 1.05], [h - 26, 10]).nice();
    const yf = o.yFmt || T.compact;
    const ml = T.textW(svg, y.ticks(5).map(yf)) + 10;
    const lastLab = o.endLabels ? T.textW(svg, o.series.map((s) => s.name)) + 8 : 6;
    const x = d3.scaleLinear(xs, [ml, w - lastLab]);
    svg.append('g').attr('transform', `translate(0,${h - 26})`).call(d3.axisBottom(x).tickValues(T.yearTicks(x, w - ml)).tickFormat(d3.format('d')).tickSizeOuter(0)).call(T.axisStyle);
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(yf).tickSize(-(w - ml - lastLab))).call(T.axisStyle).call((g) => g.select('.domain').remove());
    if (o.ref) {
      svg.append('line').attr('x1', ml).attr('x2', w - lastLab).attr('y1', y(o.ref.y)).attr('y2', y(o.ref.y)).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
      if (o.ref.label) svg.append('text').attr('class', 'tu-tick').attr('x', w - lastLab - 2).attr('y', y(o.ref.y) - 4).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').text(o.ref.label);
    }
    o.series.forEach((s) => {
      const v = s.values.filter((p) => p.y != null && !isNaN(p.y));
      if (v.some((p) => p.lo != null)) {
        svg.append('path').datum(v).style('fill', s.color).attr('fill-opacity', 0.15).attr('stroke', 'none')
          .attr('d', d3.area().x((d) => x(d.x)).y0((d) => y(d.lo)).y1((d) => y(Math.min(d.hi, y.domain()[1]))));
      }
      svg.append('path').datum(v).attr('fill', 'none').style('stroke', s.color).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
        .attr('stroke-dasharray', s.dash || null).attr('d', d3.line().x((d) => x(d.x)).y((d) => y(d.y)));
      if (o.endLabels && v.length) {
        const p = v[v.length - 1];
        svg.append('text').attr('class', 'tu-tick').attr('x', x(p.x) + 4).attr('y', y(p.y) + 4).style('fill', s.color).text(s.name);
      }
    });
    // hover
    const tip = T.tip(el);
    const years = Array.from(new Set(all.map((d) => d.x))).sort((a, b) => a - b);
    const rule = svg.append('line').attr('y1', 10).attr('y2', h - 26).style('stroke', 'var(--cds-chart-axis)').attr('visibility', 'hidden');
    svg.append('rect').attr('x', ml).attr('y', 0).attr('width', Math.max(0, w - ml - lastLab)).attr('height', h - 26).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [mx] = d3.pointer(ev);
        const yr = years[Math.max(0, Math.min(years.length - 1, d3.bisectCenter(years, x.invert(mx))))];
        rule.attr('x1', x(yr)).attr('x2', x(yr)).attr('visibility', 'visible');
        const lines = o.series.map((s) => {
          const p = s.values.find((q) => q.x === yr);
          const val = p && p.y != null ? yf(p.y) + (p.lo != null ? `（${yf(p.lo)}–${yf(p.hi)}）` : '') : '—';
          return [s.name, val, o.series.length > 1 ? s.color : null];
        });
        tip.show(ev, String(yr), lines);
      })
      .on('pointerleave', () => { rule.attr('visibility', 'hidden'); tip.hide(); });
  };

  // ---------- stacked area over years ----------
  // keys ordered, data: [{year, key:value...}], names: key->label
  T.stackChart = (el, o) => {
    const { svg, w, h } = T.svg(el, o.height || 300);
    if (!o.data.length) return;
    const st = d3.stack().keys(o.keys).value((d, k) => d[k] || 0)(o.data);
    const yMax = d3.max(st, (s) => d3.max(s, (d) => d[1])) || 1;
    const y = d3.scaleLinear([0, yMax], [h - 26, 10]).nice();
    const ml = T.textW(svg, y.ticks(5).map(T.compact)) + 10;
    const x = d3.scaleLinear(d3.extent(o.data, (d) => d.year), [ml, w - 6]);
    svg.append('g').attr('transform', `translate(0,${h - 26})`).call(d3.axisBottom(x).tickValues(T.yearTicks(x, w - ml)).tickFormat(d3.format('d')).tickSizeOuter(0)).call(T.axisStyle);
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(T.compact).tickSize(-(w - ml - 6))).call(T.axisStyle).call((g) => g.select('.domain').remove());
    svg.append('g').selectAll('path').data(st).join('path')
      .style('fill', (d, i) => o.colors[i]).attr('fill-opacity', 0.85).style('stroke', 'var(--color-panel)').attr('stroke-width', 0.5)
      .attr('d', d3.area().x((d) => x(d.data.year)).y0((d) => y(d[0])).y1((d) => y(d[1])));
    const tip = T.tip(el);
    const years = o.data.map((d) => d.year);
    const rule = svg.append('line').attr('y1', 10).attr('y2', h - 26).style('stroke', 'var(--color-fg)').attr('stroke-opacity', 0.5).attr('visibility', 'hidden');
    svg.append('rect').attr('x', ml).attr('width', Math.max(0, w - ml - 6)).attr('height', h - 26).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [mx] = d3.pointer(ev);
        const i = Math.max(0, Math.min(years.length - 1, d3.bisectCenter(years, x.invert(mx))));
        const d = o.data[i];
        rule.attr('x1', x(d.year)).attr('x2', x(d.year)).attr('visibility', 'visible');
        const tot = o.keys.reduce((s, k) => s + (d[k] || 0), 0);
        const lines = o.keys.map((k, j) => [o.names[k] || k, T.fmt0(d[k] || 0) + ' t', o.colors[j]]).filter((l, j) => (d[o.keys[j]] || 0) > 0).reverse();
        lines.push(['合計', T.fmt0(tot) + ' t', null]);
        tip.show(ev, String(d.year), lines);
      })
      .on('pointerleave', () => { rule.attr('visibility', 'hidden'); tip.hide(); });
  };
  T.legend = (el, keys, names, colors) => {
    el.replaceChildren(...keys.map((k, i) => {
      const s = T.el('span', { class: 'tu-leg' });
      const sw = T.el('span', { class: 'tu-sw' });
      sw.style.background = colors[i];
      s.append(sw, document.createTextNode(names[k] || k));
      return s;
    }));
  };

  // ---------- horizontal bar list ----------
  T.barList = (el, items, o = {}) => {
    const max = d3.max(items, (d) => d.value) || 1;
    el.replaceChildren(...items.map((d) => {
      const row = T.el('div', { class: 'tu-bar' + (o.onClick ? ' tu-click' : ''), tabindex: o.onClick ? '0' : null });
      const lab = T.el('div', { class: 'tu-bar-l' }, d.label);
      const track = T.el('div', { class: 'tu-bar-t' });
      const fill = T.el('div', { class: 'tu-bar-f' });
      fill.style.width = Math.max(0.5, (d.value / max) * 100) + '%';
      fill.style.background = d.color || dash.colors[0];
      track.appendChild(fill);
      const val = T.el('div', { class: 'tu-bar-v' }, d.text);
      row.append(lab, track, val);
      if (o.onClick) {
        row.addEventListener('click', () => o.onClick(d));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter') o.onClick(d); });
      }
      return row;
    }));
  };

  // ---------- Kobe plot ----------
  // o: {points:[{b,f,label,color,shape,id,lines}], traj:[{b,f,year}], cloud:[{b,f}], xMax, yMax, onClick, height}
  T.kobe = (el, o) => {
    const size = Math.min(el.clientWidth, o.maxSize || 760);
    const { svg, w, h } = T.svg(el, o.height || Math.max(280, Math.min(560, size * 0.85)));
    const pts = (o.points || []).concat(o.traj || []);
    const xMax = o.xMax || Math.max(2, (d3.max(pts, (d) => d.b) || 1) * 1.1);
    const yMax = o.yMax || Math.max(2, Math.min(5, (d3.max(pts, (d) => d.f) || 1) * 1.1));
    const y = d3.scaleLinear([0, yMax], [h - 34, 8]);
    const ml = T.textW(svg, y.ticks(6).map(d3.format('.1f'))) + 26;
    const x = d3.scaleLinear([0, xMax], [ml, w - 8]);
    const z = [['紅', 0, 1, 1, yMax], ['黃', 0, 1, 0, 1], ['橙', 1, xMax, 1, yMax], ['綠', 1, xMax, 0, 1]];
    svg.append('g').selectAll('rect').data(z).join('rect')
      .attr('x', (d) => x(d[1])).attr('width', (d) => x(d[2]) - x(d[1])).attr('y', (d) => y(d[4])).attr('height', (d) => y(d[3]) - y(d[4]))
      .attr('fill', (d) => T.zoneColor(d[0])).attr('fill-opacity', 0.13);
    svg.append('g').attr('transform', `translate(0,${h - 34})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor((w - ml) / 70))).tickSizeOuter(0)).call(T.axisStyle);
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('.1f')).tickSizeOuter(0)).call(T.axisStyle);
    svg.append('line').attr('x1', x(1)).attr('x2', x(1)).attr('y1', y(0)).attr('y2', y(yMax)).style('stroke', 'var(--color-fg)').attr('stroke-opacity', 0.6);
    svg.append('line').attr('x1', x(0)).attr('x2', x(xMax)).attr('y1', y(1)).attr('y2', y(1)).style('stroke', 'var(--color-fg)').attr('stroke-opacity', 0.6);
    svg.append('text').attr('class', 'tu-tick').attr('x', (ml + w) / 2).attr('y', h - 4).attr('text-anchor', 'middle').style('fill', 'var(--color-fg-muted)').text('B/Bmsy');
    svg.append('text').attr('class', 'tu-tick').attr('transform', `translate(10,${(h - 34) / 2}) rotate(-90)`).attr('text-anchor', 'middle').style('fill', 'var(--color-fg-muted)').text('F/Fmsy');
    const cx = (v) => x(Math.min(v, xMax * 0.995)), cy = (v) => y(Math.min(v, yMax * 0.99));
    if (o.cloud && o.cloud.length) {
      svg.append('g').selectAll('circle').data(o.cloud).join('circle').attr('cx', (d) => cx(d.b)).attr('cy', (d) => cy(d.f)).attr('r', 1.8)
        .style('fill', 'var(--color-fg-muted)').attr('fill-opacity', 0.25);
    }
    const tip = T.tip(el);
    if (o.traj && o.traj.length) {
      svg.append('path').datum(o.traj).attr('fill', 'none').style('stroke', 'var(--color-fg)').attr('stroke-width', 1.2).attr('stroke-linejoin', 'round')
        .attr('d', d3.line().x((d) => cx(d.b)).y((d) => cy(d.f)));
      svg.append('g').selectAll('circle').data(o.traj).join('circle').attr('cx', (d) => cx(d.b)).attr('cy', (d) => cy(d.f)).attr('r', 3)
        .style('fill', 'var(--color-fg)')
        .on('pointermove', (ev, d) => tip.show(ev, String(d.year), [['B/Bmsy', d3.format('.2f')(d.b)], ['F/Fmsy', d3.format('.2f')(d.f)]]))
        .on('pointerleave', () => tip.hide());
      const f0 = o.traj[0], f1 = o.traj[o.traj.length - 1];
      svg.append('rect').attr('x', cx(f0.b) - 5).attr('y', cy(f0.f) - 5).attr('width', 10).attr('height', 10).style('fill', 'var(--color-panel)').style('stroke', 'var(--color-fg)').attr('stroke-width', 1.5);
      svg.append('path').attr('d', d3.symbol(d3.symbolTriangle, 110)()).attr('transform', `translate(${cx(f1.b)},${cy(f1.f)})`).style('fill', 'var(--color-panel)').style('stroke', 'var(--color-fg)').attr('stroke-width', 1.5);
      const lab = (d, t, dy) => svg.append('text').attr('class', 'tu-tick').attr('x', cx(d.b) + 8).attr('y', cy(d.f) + dy).style('fill', 'var(--color-fg)').text(t);
      lab(f0, String(f0.year), 4);
      lab(f1, String(f1.year), -6);
    }
    if (o.points && o.points.length) {
      const sym = { circle: d3.symbolCircle, square: d3.symbolSquare, triangle: d3.symbolTriangle, diamond: d3.symbolDiamond, star: d3.symbolStar, cross: d3.symbolCross };
      svg.append('g').selectAll('path').data(o.points).join('path')
        .attr('d', (d) => d3.symbol(sym[d.shape] || d3.symbolCircle, d.size || 70)())
        .attr('transform', (d) => `translate(${cx(d.b)},${cy(d.f)})`)
        .style('fill', (d) => d.color).attr('fill-opacity', 0.85).style('stroke', 'var(--color-panel)').attr('stroke-width', 1)
        .attr('class', o.onClick ? 'tu-click' : null)
        .on('pointermove', (ev, d) => tip.show(ev, d.label, d.lines || []))
        .on('pointerleave', () => tip.hide())
        .on('click', (ev, d) => o.onClick && o.onClick(d));
      if (o.labels) {
        // simple collision-avoiding labels
        const placed = [];
        o.points.forEach((d) => {
          const px = cx(d.b) + 6, py = cy(d.f) - 5;
          const tw = d.short.length * 11;
          if (px + tw > w) return;
          if (placed.some((p) => Math.abs(p[0] - px) < tw && Math.abs(p[1] - py) < 12)) return;
          placed.push([px, py]);
          svg.append('text').attr('class', 'tu-tick tu-plab').attr('x', px).attr('y', py).style('fill', 'var(--color-fg)').text(d.short);
        });
      }
    }
  };

  // ---------- tabs ----------
  T.TABS = ['overview', 'catch', 'quota', 'cmsy', 'detail', 'issf', 'method'];
  T.showTab = (id, push = true) => {
    if (!T.TABS.includes(id)) id = 'overview';
    document.querySelectorAll('.tu-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    document.querySelectorAll('.tu-page').forEach((p) => (p.hidden = p.id !== id));
    if (push) dash.setLink(id);
    dash.setParams({ tab: id });
  };
  T.openUnit = (unit) => {
    dash.setParams({ unit });
    T.showTab('detail');
    const top = document.getElementById('tu-top');
    if (top) top.scrollIntoView({ block: 'start' });
  };
})();
