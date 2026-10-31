(function () {
  const T = window.TU;
  const $ = (id) => document.getElementById(id);
  const sel = $('dt-unit');
  sel.addEventListener('change', () => dash.setParams({ unit: sel.value }));
  const f2 = d3.format('.2f');

  // set a tile: value element + label with marked CI
  const tile = (id, unit, field, text, lab, lo, hi, fmt) => {
    const v = $(id);
    v.setAttribute('data-where', 'unit=' + unit);
    v.textContent = text;
    const l = $(id + '-l');
    l.replaceChildren(document.createTextNode(lab));
    if (lo) {
      const a = T.el('span', { 'data-source': 'cmsy_results', 'data-field': lo[0], 'data-where': 'unit=' + unit }, fmt(lo[1]));
      const b = T.el('span', { 'data-source': 'cmsy_results', 'data-field': hi[0], 'data-where': 'unit=' + unit }, fmt(hi[1]));
      l.append(document.createTextNode('，95%：'), a, document.createTextNode('–'), b);
    }
  };

  const issfBlock = (unit) => {
    const box = $('dt-issf');
    const d = dash.data('issf_compare');
    if (d.status !== 'ok') { box.replaceChildren(T.el('p', { class: 'tu-note' }, d.status === 'loading' ? '載入中' : '無法載入資料')); return; }
    const row = d.data.find((r) => r.unit === unit);
    if (!row) {
      box.replaceChildren(T.el('p', { class: 'tu-note' }, 'ISSF 報告只涵蓋 23 個主要商業鮪類系群，這個系群沒有對應的正式評估摘要。'));
      return;
    }
    const where = 'issf_stock=' + row.issf_stock;
    const m = (field, text) => T.el('span', { 'data-source': 'issf_compare', 'data-field': field, 'data-where': where }, text);
    const tbl = T.el('table', { class: 'tu-table' });
    const head = T.el('tr');
    ['項目', 'ISSF（正式評估）', 'CMSY++（同參考年度）'].forEach((h) => head.appendChild(T.el('th', {}, h)));
    tbl.appendChild(T.el('thead')).appendChild(head);
    const tb = T.el('tbody');
    const line = (name, a, b) => {
      const tr = T.el('tr');
      const c0 = T.el('td', {}, name), c1 = T.el('td'), c2 = T.el('td');
      c1.append(...a); c2.append(...b);
      tr.append(c0, c1, c2);
      tb.appendChild(tr);
    };
    const txt = (s) => document.createTextNode(s);
    line('系群', [m('issf_stock', row.issf_stock)], [m('unit', row.unit)]);
    line('B/Bmsy', [m('issf_b', row.issf_b || '—'), txt(row.issf_b_years ? `（${row.issf_b_years}）` : '')], [m('cmsy_b_same', row.cmsy_b_same || '—')]);
    line('資源剩餘比例', [txt('SSB/SSB0 '), m('issf_ssb0', row.issf_ssb0 || '—')], [txt('B/k '), m('cmsy_bk_same', row.cmsy_bk_same || '—')]);
    line('F/Fmsy', [m('issf_f', row.issf_f || '—'), txt(row.issf_f_years ? `（${row.issf_f_years}）` : '')], [m('cmsy_f_same', row.cmsy_f_same || '—')]);
    line('MSY（千公噸）', [m('issf_msy_kt', row.issf_msy_kt || '—')], [m('cmsy_msy_kt', row.cmsy_msy_kt || '—')]);
    line('評等／分區', [txt('資源量 '), m('issf_ssb_rating', row.issf_ssb_rating), txt('・漁獲死亡 '), m('issf_f_rating', row.issf_f_rating)], [m('cmsy_zone_same', row.cmsy_zone_same || '—')]);
    line('判定', [txt('資源量：'), m('b_verdict', row.b_verdict || '—')], [txt('漁獲死亡：'), m('f_verdict', row.f_verdict || '—')]);
    tbl.appendChild(tb);
    const wrap = T.el('div', { class: 'tu-tablewrap', style: 'max-height:none' });
    wrap.appendChild(tbl);
    const kids = [wrap];
    if (row.issf_note) kids.push(T.el('p', { class: 'tu-note' }, 'ISSF 備註：' + row.issf_note));
    box.replaceChildren(...kids);
  };

  dash.onData(() => {
    if ($('detail').hidden) return;
    const st = T.status(['cmsy_results', 'cmsy_ts']);
    const charts = ['dt-catch', 'dt-kobe', 'dt-bchart', 'dt-fchart'].map($);
    if (st !== 'ok') { charts.forEach((c) => T.state(c, st)); return; }
    charts.forEach((c) => c.classList.remove('dash-skeleton'));
    const R = T.results();
    const P = dash.params();
    const unit = R.some((r) => r.unit === P.unit) ? P.unit : 'WCPFC_YFT_WCPO';
    // select with optgroups
    if (sel.options.length !== R.length) {
      sel.replaceChildren(...T.RF_ORDER.filter((x) => R.some((r) => r.rfmo === x)).map((x) => {
        const g = T.el('optgroup', { label: `${x} ${T.RF[x]}` });
        R.filter((r) => r.rfmo === x).forEach((r) => g.appendChild(new Option(`${r.name}｜${r.stock}（${r.unit}）`, r.unit)));
        return g;
      }));
    }
    sel.value = unit;
    const r = R.find((x) => x.unit === unit);
    const title = $('dt-title');
    title.setAttribute('data-field', 'name');
    title.setAttribute('data-where', 'unit=' + unit);
    title.textContent = r.raw.name;
    $('dt-sub').textContent = `${r.rfmo}｜${r.ocean}｜${r.stock}｜${r.group}｜Resilience ${r.resilience}｜${r.start}–${r.end}` + (r.note ? `｜${r.note}` : '');

    tile('dt-msy', unit, 'msy', T.fmt(r.msy), 'MSY（公噸）', ['msy_lo', r.msy_lo], ['msy_hi', r.msy_hi], T.fmt);
    tile('dt-b', unit, 'b', r.raw.b, `${r.end} 年 B/Bmsy`, ['b_lo', r.raw.b_lo], ['b_hi', r.raw.b_hi], String);
    tile('dt-f', unit, 'f', r.raw.f, `${r.end} 年 F/Fmsy`, ['f_lo', r.raw.f_lo], ['f_hi', r.raw.f_hi], String);
    tile('dt-r', unit, 'r', r.raw.r, 'r（內在成長率）', ['r_lo', r.raw.r_lo], ['r_hi', r.raw.r_hi], String);
    tile('dt-k', unit, 'k', T.fmt(r.k), 'k（承載量，公噸）', ['k_lo', r.k_lo], ['k_hi', r.k_hi], T.fmt);
    const z = $('dt-zone');
    z.setAttribute('data-where', 'unit=' + unit);
    z.replaceChildren(T.zoneCell(r.zone));
    const zl = $('dt-zone-l');
    zl.replaceChildren(document.createTextNode(T.zoneName[r.zone] + '；各區機率 紅 '),
      T.el('span', { 'data-source': 'cmsy_results', 'data-field': 'p_red', 'data-where': 'unit=' + unit }, r.raw.p_red),
      document.createTextNode('・綠 '),
      T.el('span', { 'data-source': 'cmsy_results', 'data-field': 'p_green', 'data-where': 'unit=' + unit }, r.raw.p_green));

    const ts = T.rows('cmsy_ts', (d) => ({ unit: d.unit, year: +d.year, b: +d.b, b_lo: +d.b_lo, b_hi: +d.b_hi, f: +d.f, f_lo: +d.f_lo, f_hi: +d.f_hi, catch_t: +d.catch_t }))
      .filter((d) => d.unit === unit);
    T.lineChart($('dt-catch'), {
      series: [{ name: '漁獲', color: dash.colors[0], values: ts.map((d) => ({ x: d.year, y: d.catch_t })) }],
      ref: { y: r.msy, label: 'MSY ' + T.compact(r.msy) }, yFmt: T.compact, height: 260,
    });
    T.lineChart($('dt-bchart'), {
      series: [{ name: 'B/Bmsy', color: dash.colors[1], values: ts.map((d) => ({ x: d.year, y: d.b, lo: d.b_lo, hi: d.b_hi })) }],
      ref: { y: 1, label: 'Bmsy' }, yFmt: d3.format('.1f'), height: 260,
    });
    T.lineChart($('dt-fchart'), {
      series: [{ name: 'F/Fmsy', color: dash.colors[3], values: ts.map((d) => ({ x: d.year, y: d.f, lo: d.f_lo, hi: d.f_hi })) }],
      ref: { y: 1, label: 'Fmsy' }, yFmt: d3.format('.1f'), height: 260, yMax: Math.min(6, d3.max(ts, (d) => d.f_hi) || 2),
    });
    const kc = dash.data('kobe_cloud');
    const cloud = kc.status === 'ok' ? T.rows('kobe_cloud', (d) => ({ unit: d.unit, b: +d.b, f: +d.f })).filter((d) => d.unit === unit) : [];
    T.kobe($('dt-kobe'), { traj: ts.map((d) => ({ b: d.b, f: d.f, year: d.year })), cloud, height: 320 });

    // country breakdown
    const box = $('dt-cc');
    const st2 = T.status(['catches', 'countries']);
    if (st2 !== 'ok') T.state(box, st2);
    else {
      box.classList.remove('dash-skeleton');
      const rfs = r.rfmo === 'WCPFC+IATTC' ? ['WCPFC', 'IATTC'] : [r.rfmo];
      const ccName = T.lookup('countries', 'cc', 'name');
      const rows = T.catchRows().filter((d) => rfs.includes(d.rfmo) && d.sp === r.sp && d.year >= r.start);
      const tot = Array.from(d3.rollup(rows, (v) => d3.sum(v, (d) => d.t), (d) => d.cc)).sort((a, b) => b[1] - a[1]);
      const keys = tot.slice(0, 8).map((d) => d[0]);
      const allKeys = tot.length > 8 ? keys.concat(['__other']) : keys;
      const byY = new Map();
      rows.forEach((d) => {
        if (!byY.has(d.year)) byY.set(d.year, { year: d.year });
        const k = keys.includes(d.cc) ? d.cc : '__other';
        byY.get(d.year)[k] = (byY.get(d.year)[k] || 0) + d.t;
      });
      const data = d3.range(r.start, r.end + 1).map((y) => byY.get(y) || { year: y });
      const names = Object.fromEntries(allKeys.map((k) => [k, k === '__other' ? '其他' : (ccName[k] || k)]));
      const colors = allKeys.map((k, i) => (k === '__other' ? 'var(--cds-chart-muted)' : dash.colors[i % dash.colors.length]));
      T.stackChart(box, { keys: allKeys, names, colors, data, height: 300 });
      T.legend($('dt-cc-legend'), allKeys, names, colors);
      const split = r.rfmo === 'ICCAT' && R.filter((x) => x.rfmo === 'ICCAT' && x.sp === r.sp).length > 1;
      $('dt-cc-title').textContent = `${r.name}：${rfs.join('＋')} 國家別漁獲`;
      $('dt-cc-note').textContent = split
        ? '此圖為 ICCAT 該物種所有系群合計（國家別資料未分系群），所以會大於上方 CMSY 使用的系群漁獲。'
        : '該組織此物種各國逐年漁獲，前 8 名分開顯示，其餘併為「其他」。';
    }
    issfBlock(unit);
  });
})();
