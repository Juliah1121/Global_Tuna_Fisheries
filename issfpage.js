(function () {
  const T = window.TU;
  const $ = (id) => document.getElementById(id);

  // scatter with 1:1 line. o: {pts:[{x,y,label,color,unit}], log, xLab, yLab, refs:true}
  const scatter = (el, o) => {
    const { svg, w, h } = T.svg(el, 300);
    if (!o.pts.length) return;
    const vals = o.pts.flatMap((d) => [d.x, d.y]);
    const lo = o.log ? d3.min(vals) / 1.5 : 0, hi = d3.max(vals) * 1.12;
    const S = o.log ? d3.scaleLog : d3.scaleLinear;
    const fmt = o.log ? T.compact : d3.format('.1f');
    const y = S([lo, hi], [h - 34, 10]);
    if (!o.log) y.nice();
    const yt = o.log ? y.ticks(4).filter((v) => [1, 2, 5].includes(+String(v)[0])) : y.ticks(5);
    const ml = T.textW(svg, yt.map(fmt)) + 26;
    const x = S(y.domain(), [ml, w - 10]);
    svg.append('g').attr('transform', `translate(0,${h - 34})`).call(d3.axisBottom(x).tickValues(yt).tickFormat(fmt).tickSizeOuter(0)).call(T.axisStyle);
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).tickValues(yt).tickFormat(fmt).tickSize(-(w - ml - 10))).call(T.axisStyle).call((g) => g.select('.domain').remove());
    const d0 = y.domain();
    svg.append('line').attr('x1', x(d0[0])).attr('y1', y(d0[0])).attr('x2', x(d0[1])).attr('y2', y(d0[1])).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
    if (o.refs) {
      svg.append('line').attr('x1', x(1)).attr('x2', x(1)).attr('y1', y(d0[0])).attr('y2', y(d0[1])).style('stroke', 'var(--cds-chart-axis)');
      svg.append('line').attr('y1', y(1)).attr('y2', y(1)).attr('x1', x(d0[0])).attr('x2', x(d0[1])).style('stroke', 'var(--cds-chart-axis)');
    }
    svg.append('text').attr('class', 'tu-tick').attr('x', (ml + w) / 2).attr('y', h - 4).attr('text-anchor', 'middle').style('fill', 'var(--color-fg-muted)').text(o.xLab);
    svg.append('text').attr('class', 'tu-tick').attr('transform', `translate(10,${(h - 34) / 2}) rotate(-90)`).attr('text-anchor', 'middle').style('fill', 'var(--color-fg-muted)').text(o.yLab);
    const tip = T.tip(el);
    svg.append('g').selectAll('circle').data(o.pts).join('circle')
      .attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y)).attr('r', 5).style('fill', (d) => d.color).attr('fill-opacity', 0.85)
      .style('stroke', 'var(--color-panel)').attr('class', 'tu-click')
      .on('pointermove', (ev, d) => tip.show(ev, d.label, [['ISSF', d3.format(',.2f')(d.x)], ['CMSY++', d3.format(',.2f')(d.y)]]))
      .on('pointerleave', () => tip.hide())
      .on('click', (ev, d) => d.unit && T.openUnit(d.unit));
    const placed = [];
    o.pts.forEach((d) => {
      const px = x(d.x) + 7, py = y(d.y) + 4, tw = d.short.length * 7;
      if (px + tw > w || placed.some((p) => Math.abs(p[0] - px) < tw && Math.abs(p[1] - py) < 12)) return;
      placed.push([px, py]);
      svg.append('text').attr('class', 'tu-tick tu-plab').attr('x', px).attr('y', py).style('fill', 'var(--color-fg)').text(d.short);
    });
  };

  $('is-table').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-unit]');
    if (tr) T.openUnit(tr.dataset.unit);
  });

  dash.onData(() => {
    if ($('issf').hidden) return;
    const st = T.status(['issf_compare']);
    const boxes = ['is-b', 'is-d', 'is-f', 'is-m'].map($);
    if (st !== 'ok') { boxes.forEach((b) => T.state(b, st)); return; }
    boxes.forEach((b) => b.classList.remove('dash-skeleton'));
    const rows = T.rows('issf_compare');
    const n = (v) => (v === '' || v == null ? null : Number(v));
    const direct = (r) => r.match === '直接';
    const mk = (fx, fy, colorBy) => rows.filter((r) => direct(r) && n(r[fx]) != null && n(r[fy]) != null).map((r) => ({
      x: n(r[fx]), y: n(r[fy]), label: `${r.issf_stock} ${r.name}`, short: r.issf_stock, unit: r.unit,
      color: T.zoneColor(r[colorBy] || ''),
    }));
    scatter($('is-b'), { pts: mk('issf_b', 'cmsy_b_same', 'issf_zone'), refs: true, xLab: 'ISSF SSB/SSBmsy', yLab: 'CMSY++ B/Bmsy' });
    scatter($('is-d'), { pts: mk('issf_ssb0', 'cmsy_bk_same', 'issf_zone'), xLab: 'ISSF SSB/SSB0', yLab: 'CMSY++ B/k' });
    scatter($('is-f'), { pts: mk('issf_f', 'cmsy_f_same', 'issf_zone'), refs: true, xLab: 'ISSF F/Fmsy', yLab: 'CMSY++ F/Fmsy' });
    scatter($('is-m'), { pts: mk('issf_msy_kt', 'cmsy_msy_kt', 'issf_zone'), log: true, xLab: 'ISSF MSY（千公噸）', yLab: 'CMSY++ MSY（千公噸）' });

    const tb = $('is-table').querySelector('tbody');
    const cols = ['issf_stock', 'name', 'issf_ssb_rating', 'issf_f_rating', 'cmsy_zone_same', 'issf_b', 'cmsy_b_same', 'issf_ssb0', 'cmsy_bk_same',
      'issf_f', 'cmsy_f_same', 'issf_msy_kt', 'cmsy_msy_kt', 'b_verdict', 'issf_note'];
    const zoneCols = ['issf_ssb_rating', 'issf_f_rating', 'cmsy_zone_same'];
    tb.replaceChildren(...rows.map((r) => {
      const tr = T.el('tr', { class: direct(r) ? 'tu-click' : null, 'data-unit': direct(r) ? r.unit : null });
      cols.forEach((c) => {
        const num = !['issf_stock', 'name', 'b_verdict', 'issf_note'].includes(c) && !zoneCols.includes(c);
        const td = T.el('td', { class: num ? 'tu-num' : null });
        if (zoneCols.includes(c) && r[c]) td.appendChild(T.zoneCell(r[c]));
        else td.textContent = r[c] === '' || r[c] == null ? '' : String(r[c]);
        if (c === 'b_verdict' && r[c] === 'CMSY較悲觀') td.style.color = 'var(--color-bad)';
        tr.appendChild(td);
      });
      return tr;
    }));
  });
})();
