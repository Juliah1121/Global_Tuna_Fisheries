(function () {
  const T = window.TU;
  const $ = (id) => document.getElementById(id);
  const selStock = $('qt-stock'), selCc = $('qt-cc'), selYr = $('qt-yr');
  selStock.addEventListener('change', () => dash.setParams({ qstock: selStock.value || null, qyr: null }));
  selCc.addEventListener('change', () => dash.setParams({ qcc: selCc.value || null }));
  selYr.addEventListener('change', () => dash.setParams({ qyr: selYr.value ? Number(selYr.value) : null }));
  const pct = d3.format('.0%');

  const parse = (r) => ({ ...r, year: +r.year, limit_t: +r.limit_t, catch_t: r.catch_t === '' ? null : +r.catch_t, use_ratio: r.use_ratio === '' ? null : +r.use_ratio, raw: r });

  // limit vs catch bars for one year
  const useBars = (el, rows) => {
    const max = d3.max(rows, (d) => Math.max(d.limit_t, d.catch_t || 0)) || 1;
    el.replaceChildren(...rows.map((d) => {
      const row = T.el('div', { class: 'tu-qbar' });
      row.appendChild(T.el('div', { class: 'tu-bar-l' }, d.party));
      const track = T.el('div', { class: 'tu-qtrack' });
      const lim = T.el('div', { class: 'tu-qlim' });
      lim.style.width = (d.limit_t / max) * 100 + '%';
      track.appendChild(lim);
      if (d.catch_t != null) {
        const c = T.el('div', { class: 'tu-qcatch' });
        c.style.width = Math.max(0.3, (d.catch_t / max) * 100) + '%';
        c.style.background = d.use_ratio > 1 ? 'var(--color-bad)' : dash.colors[0];
        track.appendChild(c);
      }
      row.appendChild(track);
      row.appendChild(T.el('div', { class: 'tu-bar-v' },
        `${T.fmt1(d.limit_t)} t` + (d.catch_t != null ? `・漁獲 ${T.fmt1(d.catch_t)}・${pct(d.use_ratio || 0)}` : '・無漁獲資料')));
      return row;
    }));
  };

  dash.onData(() => {
    if ($('quota').hidden) return;
    const st = T.status(['quota']);
    const boxes = [$('qt-trend'), $('qt-bars')];
    if (st !== 'ok') { boxes.forEach((b) => T.state(b, st)); return; }
    boxes.forEach((b) => b.classList.remove('dash-skeleton'));
    const P = dash.params();
    const Q = T.rows('quota', parse);
    const stocks = Array.from(d3.group(Q, (d) => d.rfmo + '|' + d.stock), ([k, v]) => ({ k, name: `${v[0].rfmo}｜${v[0].stock_name}` }));
    const order = ['CCSBT', 'ICCAT', 'IOTC', 'WCPFC', 'IATTC'];
    stocks.sort((a, b) => order.indexOf(a.k.split('|')[0]) - order.indexOf(b.k.split('|')[0]) || a.name.localeCompare(b.name, 'zh-Hant'));
    const sk = stocks.some((s) => s.k === P.qstock) ? P.qstock : 'CCSBT|SBF';
    selStock.replaceChildren(...stocks.map((s) => new Option(s.name, s.k)));
    selStock.value = sk;
    const S = Q.filter((d) => d.rfmo + '|' + d.stock === sk);
    const parties = Array.from(new Set(S.filter((d) => d.cc !== 'TAC').map((d) => d.party))).sort((a, b) => a.localeCompare(b));
    const hasTac = S.some((d) => d.cc === 'TAC');
    selCc.replaceChildren(new Option(hasTac ? 'TAC（總量）' : '全部國家合計', ''), ...parties.map((p) => new Option(p, p)));
    selCc.value = parties.includes(P.qcc) ? P.qcc : '';
    const who = selCc.value;

    // trend: limit vs catch over years
    const years = Array.from(new Set(S.map((d) => d.year))).sort((a, b) => a - b);
    let series;
    if (who) {
      const r = S.filter((d) => d.party === who);
      series = r.map((d) => ({ year: d.year, limit: d.limit_t, catch: d.catch_t }));
    } else if (hasTac) {
      series = S.filter((d) => d.cc === 'TAC').map((d) => ({ year: d.year, limit: d.limit_t, catch: d.catch_t }));
    } else {
      series = years.map((y) => {
        const r = S.filter((d) => d.year === y);
        const withCatch = r.filter((d) => d.catch_t != null);
        return { year: y, limit: d3.sum(r, (d) => d.limit_t), catch: withCatch.length ? d3.sum(withCatch, (d) => d.catch_t) : null };
      });
    }
    $('qt-trend-title').textContent = `${stocks.find((s) => s.k === sk).name}：${who || (hasTac ? 'TAC 與總漁獲' : '各國上限合計與漁獲')}`;
    T.lineChart($('qt-trend'), {
      series: [
        { name: '配額／上限', color: dash.colors[2], values: series.map((d) => ({ x: d.year, y: d.limit })) },
        { name: '實際漁獲', color: dash.colors[0], values: series.filter((d) => d.catch != null).map((d) => ({ x: d.year, y: d.catch })) },
      ],
      yFmt: T.compact, height: 260, endLabels: true, xDomain: d3.extent(years),
    });

    // bars for a year
    const yrs = years.slice().reverse();
    selYr.replaceChildren(...yrs.map((y) => new Option(String(y), String(y))));
    const withCatchYears = years.filter((y) => S.some((d) => d.year === y && d.catch_t != null && d.cc !== 'TAC'));
    const yr = yrs.includes(P.qyr) ? P.qyr : (withCatchYears.length ? withCatchYears[withCatchYears.length - 1] : yrs[0]);
    selYr.value = String(yr);
    const inYr = S.filter((d) => d.year === yr && d.cc !== 'TAC').sort((a, b) => b.limit_t - a.limit_t);
    const tac = S.find((d) => d.year === yr && d.cc === 'TAC');
    $('qt-bars-title').textContent = `${yr} 年各國配額與漁獲`;
    $('qt-bars-note').textContent = (tac ? `TAC ${T.fmt1(tac.limit_t)} t` + (tac.catch_t != null ? `，總漁獲 ${T.fmt1(tac.catch_t)} t（${pct(tac.use_ratio)}）。` : '。') : '') +
      '淺色為配額，深色為漁獲；紅色代表漁獲超過配額。' + (inYr[0] ? `類型：${inYr[0].ltype}。` : '');
    useBars($('qt-bars'), inYr);

    // table
    const tb = $('qt-table').querySelector('tbody');
    const rows = S.filter((d) => !who || d.party === who || d.cc === 'TAC').sort((a, b) => b.year - a.year || b.limit_t - a.limit_t);
    tb.replaceChildren(...rows.map((d) => {
      const tr = T.el('tr', { 'data-key': d.key });
      const c = (v, cls) => T.el('td', { class: cls || null }, v);
      const src = T.el('td');
      const a = T.el('a', { href: d.raw.url, target: '_blank', rel: 'noopener' }, d.raw.source);
      src.appendChild(a);
      const u = c(d.raw.use_ratio === '' ? '' : d.raw.use_ratio, 'tu-num');
      if (d.use_ratio > 1) u.style.color = 'var(--color-bad)';
      tr.append(c(d.raw.year, 'tu-num'), c(d.raw.party), c(d.raw.limit_t, 'tu-num'), c(d.raw.ltype), c(d.raw.catch_t, 'tu-num'), u,
        c(d.raw.basis), c(d.raw.note), src);
      return tr;
    }));
  });
})();
