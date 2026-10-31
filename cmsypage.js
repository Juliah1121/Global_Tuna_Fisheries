(function () {
  const T = window.TU;
  const $ = (id) => document.getElementById(id);
  const rf = $('cm-rf'), grp = $('cm-grp'), zone = $('cm-zone'), q = $('cm-q');
  let sortKey = null, sortDir = 1;
  rf.addEventListener('change', () => dash.setParams({ crf: rf.value || null }));
  grp.addEventListener('change', () => dash.setParams({ cgrp: grp.value || null }));
  zone.addEventListener('change', () => dash.setParams({ czone: zone.value || null }));
  q.addEventListener('input', () => dash.setParams({ cq: q.value || null }));
  $('cm-table').querySelectorAll('th button').forEach((b) =>
    b.addEventListener('click', () => {
      if (sortKey === b.dataset.k) sortDir = -sortDir; else { sortKey = b.dataset.k; sortDir = 1; }
      dash.setParams({ csort: sortKey + ':' + sortDir });
    }));
  $('cm-table').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-key]');
    if (tr) T.openUnit(tr.dataset.key);
  });
  $('cm-table').addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-key]');
    if (tr && e.key === 'Enter') T.openUnit(tr.dataset.key);
  });

  T.zoneCell = (z) => {
    const s = T.el('span', { class: 'tu-zone' });
    const d = T.el('span', { class: 'tu-dot' });
    d.style.background = T.zoneColor(z);
    s.append(d, document.createTextNode(z));
    return s;
  };

  dash.onData(() => {
    if ($('cmsy').hidden) return;
    const st = T.status(['cmsy_results']);
    if (st !== 'ok') { T.state($('cm-kobe'), st); return; }
    $('cm-kobe').classList.remove('dash-skeleton');
    const P = dash.params();
    const R = T.results();
    rf.replaceChildren(new Option('全部組織', ''), ...T.RF_ORDER.filter((x) => R.some((r) => r.rfmo === x)).map((x) => new Option(`${x} ${T.RF[x]}`, x)));
    rf.value = P.crf || '';
    const groups = Array.from(new Set(R.map((r) => r.group)));
    grp.replaceChildren(new Option('全部類別', ''), ...groups.map((g) => new Option(g, g)));
    grp.value = P.cgrp || '';
    zone.value = P.czone || '';
    if (document.activeElement !== q) q.value = P.cq || '';
    if (P.csort) { const [k, d] = P.csort.split(':'); sortKey = k; sortDir = Number(d); }

    const term = (P.cq || '').trim().toLowerCase();
    let rows = R.filter((r) => (!P.crf || r.rfmo === P.crf) && (!P.cgrp || r.group === P.cgrp) && (!P.czone || r.zone === P.czone) &&
      (!term || [r.unit, r.name, r.ocean, r.stock, r.sp].join(' ').toLowerCase().includes(term)));
    $('cm-count').textContent = `${rows.length} / ${R.length} 個系群`;

    // Kobe
    const pts = rows.map((r) => ({
      b: r.b, f: r.f, color: T.zoneColor(r.zone), shape: T.SHAPE[r.rfmo], id: r.unit, size: 80,
      short: r.name + (['印度洋單一系群', '東太平洋', '中西太平洋', '全球單一系群'].includes(r.stock) ? '' : '·' + r.unit.split('_').pop()),
      label: `${r.name}｜${r.ocean}｜${r.stock}`,
      lines: [['組織', r.rfmo], ['B/Bmsy', `${d3.format('.2f')(r.b)}（${d3.format('.2f')(r.b_lo)}–${d3.format('.2f')(r.b_hi)}）`],
        ['F/Fmsy', `${d3.format('.2f')(r.f)}（${d3.format('.2f')(r.f_lo)}–${d3.format('.2f')(r.f_hi)}）`], ['MSY', T.fmt0(r.msy) + ' t']],
    }));
    if (pts.length) T.kobe($('cm-kobe'), { points: pts, xMax: 2, yMax: 4, onClick: (d) => T.openUnit(d.id), labels: pts.length <= 25, height: 440 });
    else $('cm-kobe').replaceChildren(T.el('p', { class: 'tu-note' }, '沒有符合條件的系群。'));

    // table
    if (sortKey) {
      rows = rows.slice().sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'zh-Hant')) * sortDir;
      });
    }
    $('cm-table').querySelectorAll('th').forEach((th) => {
      const k = th.querySelector('button').dataset.k;
      th.setAttribute('aria-sort', k === sortKey ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
    });
    const tb = $('cm-table').querySelector('tbody');
    tb.replaceChildren(...rows.map((r) => {
      const tr = T.el('tr', { class: 'tu-click', tabindex: '0', 'data-key': r.unit });
      const c = (v, cls) => { const td = T.el('td', { class: cls || null }); if (v instanceof Node) td.appendChild(v); else td.textContent = v; return td; };
      tr.append(c(r.raw.unit), c(r.raw.name), c(r.raw.ocean), c(r.raw.stock), c(r.raw.end, 'tu-num'), c(T.fmt(r.msy), 'tu-num'),
        c(r.raw.b, 'tu-num'), c(r.raw.f, 'tu-num'), c(T.zoneCell(r.zone)), c(r.raw.resilience));
      return tr;
    }));
  });
})();
