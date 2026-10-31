dash.calc('rfmo_year', {
  inputs: ['catches'],
  title: '各組織逐年漁獲',
  description: '每個組織每年所有物種、國家、漁法的漁獲量（公噸）加總。',
  fn: (catches) => {
    const m = new Map();
    for (const r of catches) {
      const k = r.rfmo + '|' + r.year;
      m.set(k, (m.get(k) || 0) + Number(r.t));
    }
    return Array.from(m, ([k, t]) => ({ rfmo: k.split('|')[0], year: Number(k.split('|')[1]), t: Math.round(t) }));
  },
});

dash.calc('kpis', {
  inputs: ['catches', 'cmsy_results', 'issf_compare'],
  title: '總覽數字',
  description: '2024 年五組織漁獲合計、國家數、CMSY++ 系群數與分區數，以及與 ISSF 對照的一致數與 MSY 比值中位數。',
  fn: (catches, cmsy_results, issf_compare) => {
    let c2024 = 0;
    const flags = new Set();
    for (const r of catches) {
      if (Number(r.year) === 2024) c2024 += Number(r.t);
      if (!['NEI', 'MIX', 'OTH', 'UNK', 'RES', 'EU', 'GBR-OT'].includes(r.cc)) flags.add(r.cc);
    }
    const zone = (z) => cmsy_results.filter((r) => r.zone === z).length;
    const ratios = issf_compare.map((r) => r.msy_ratio).filter((v) => v !== '' && v != null).map(Number).sort((a, b) => a - b);
    const n = ratios.length;
    const median = n ? (n % 2 ? ratios[(n - 1) / 2] : (ratios[n / 2 - 1] + ratios[n / 2]) / 2) : null;
    const compared = issf_compare.filter((r) => r.b_verdict);
    return [{
      catch_2024: Math.round(c2024),
      n_flags: flags.size,
      n_units: cmsy_results.length,
      n_red: zone('紅'), n_yellow: zone('黃'), n_orange: zone('橙'), n_green: zone('綠'),
      msy_ratio_median: Math.round(median * 100) / 100,
      b_agree: compared.filter((r) => r.b_verdict === '一致').length,
      f_agree: issf_compare.filter((r) => r.f_verdict === '一致').length,
      b_compared: compared.length,
    }];
  },
});

(function () {
  const T = window.TU;
  const kpiEls = document.querySelectorAll('[data-source="kpis"]');
  const SHAPE = { ICCAT: 'circle', IOTC: 'square', IATTC: 'triangle', WCPFC: 'diamond', CCSBT: 'star', 'WCPFC+IATTC': 'cross' };
  T.SHAPE = SHAPE;

  dash.onData(() => {
    // KPIs (also used on other pages)
    const k = dash.data('kpis');
    kpiEls.forEach((el) => {
      if (k.status === 'ok' && k.data[0]) {
        const v = k.data[0][el.dataset.field];
        el.textContent = el.dataset.field === 'catch_2024' ? T.fmt(v) : el.dataset.field === 'msy_ratio_median' ? d3.format('.2f')(v) : String(v);
        el.classList.remove('dash-skeleton');
      } else if (k.status === 'error') {
        el.textContent = '—';
        el.classList.remove('dash-skeleton');
      }
    });

    const page = document.getElementById('overview');
    if (page.hidden) return;

    // stacked catch by RFMO
    const box = document.getElementById('ov-catch');
    const ry = dash.data('rfmo_year');
    if (ry.status !== 'ok') T.state(box, ry.status === 'loading' ? 'loading' : 'error');
    else {
      box.classList.remove('dash-skeleton');
      const keys = ['WCPFC', 'IOTC', 'IATTC', 'ICCAT', 'CCSBT'];
      const by = new Map();
      ry.data.forEach((r) => {
        if (r.year < 1950 || r.year > 2024) return;
        if (!by.has(r.year)) by.set(r.year, { year: r.year });
        by.get(r.year)[r.rfmo] = r.t;
      });
      const data = Array.from(by.values()).sort((a, b) => a.year - b.year);
      const names = Object.fromEntries(keys.map((x) => [x, `${x} ${T.RF[x]}`]));
      const colors = keys.map(T.rfColor);
      T.stackChart(box, { keys, names, colors, data, height: 300 });
      T.legend(document.getElementById('ov-legend'), keys, names, colors);
    }

    // Kobe overview
    const kb = document.getElementById('ov-kobe');
    const st = T.status(['cmsy_results']);
    if (st !== 'ok') { T.state(kb, st); T.state(document.getElementById('ov-zones'), st); return; }
    kb.classList.remove('dash-skeleton');
    const R = T.results();
    const pts = R.map((r) => ({
      b: r.b, f: r.f, color: T.rfColor(r.rfmo), shape: SHAPE[r.rfmo], id: r.unit, label: `${r.name}｜${r.ocean}｜${r.stock}`,
      lines: [['B/Bmsy', d3.format('.2f')(r.b)], ['F/Fmsy', d3.format('.2f')(r.f)], ['MSY', T.fmt0(r.msy) + ' t'], ['分區', r.zone]],
    }));
    T.kobe(kb, { points: pts, xMax: 2, yMax: 4, onClick: (d) => T.openUnit(d.id), height: 420 });
    const rfs = T.RF_ORDER.filter((x) => R.some((r) => r.rfmo === x));
    T.legend(document.getElementById('ov-kobe-legend'), rfs, Object.fromEntries(rfs.map((x) => [x, x])), rfs.map(T.rfColor));

    // zone bars
    const zs = ['紅', '黃', '橙', '綠'];
    const zl = document.getElementById('ov-zone-legend');
    T.legend(zl, zs, Object.fromEntries(zs.map((z) => [z, z + '：' + T.zoneName[z]])), zs.map(T.zoneColor));
    const zb = document.getElementById('ov-zones');
    zb.classList.remove('dash-skeleton');
    zb.replaceChildren(...rfs.map((rf) => {
      const rows = R.filter((r) => r.rfmo === rf);
      const row = T.el('div', { class: 'tu-zbar' });
      row.appendChild(T.el('div', {}, `${rf}（${rows.length}）`));
      const seg = T.el('div', { class: 'tu-zseg' });
      zs.forEach((z) => {
        const n = rows.filter((r) => r.zone === z).length;
        if (!n) return;
        const s = T.el('span', { title: `${z}區 ${n} 個` }, String(n));
        s.style.width = (n / rows.length) * 100 + '%';
        s.style.background = T.zoneColor(z);
        seg.appendChild(s);
      });
      row.appendChild(seg);
      return row;
    }));
  });
})();
