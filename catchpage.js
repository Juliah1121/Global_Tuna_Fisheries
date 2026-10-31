(function () {
  const T = window.TU;
  const $ = (id) => document.getElementById(id);
  const sel = { rf: $('ct-rf'), grp: $('ct-grp'), sp: $('ct-sp'), cc: $('ct-cc'), gear: $('ct-gear'), dim: $('ct-dim'), yr: $('ct-yr') };
  const top = $('ct-top');
  const PKEY = { rf: 'rf', grp: 'grp', sp: 'sp', cc: 'cc', gear: 'gear', dim: 'dim', yr: 'yr' };
  Object.entries(sel).forEach(([k, el]) =>
    el.addEventListener('change', () => {
      const v = el.value === '' ? null : k === 'yr' ? Number(el.value) : el.value;
      const p = { [PKEY[k]]: v };
      if (k === 'grp') p.sp = null;
      if (k === 'rf') { p.sp = null; p.cc = null; p.gear = null; }
      dash.setParams(p);
    }));
  top.addEventListener('change', () => dash.setParams({ top: Number(top.value) }));
  $('ct-reset').addEventListener('click', () => dash.setParams({ rf: null, grp: null, sp: null, cc: null, gear: null, dim: 'cc', yr: 2024, top: 20 }));

  const fill = (el, opts, value, allLabel) => {
    el.replaceChildren(new Option(allLabel, ''), ...opts.map(([v, l]) => new Option(l, v)));
    el.value = value ?? '';
    if (el.value !== (value ?? '')) el.value = '';
  };

  dash.onData(() => {
    if ($('catch').hidden) return;
    const ids = ['catches', 'species', 'countries', 'gears'];
    const st = T.status(ids);
    const boxes = [$('ct-trend'), $('ct-rank')];
    if (st !== 'ok') { boxes.forEach((b) => T.state(b, st)); return; }
    boxes.forEach((b) => b.classList.remove('dash-skeleton'));
    const P = dash.params();
    const rows = T.catchRows();
    const spRows = T.rows('species');
    const spName = T.lookup('species', 'sp', 'name');
    const spGroup = T.lookup('species', 'sp', 'group');
    const ccName = T.lookup('countries', 'cc', 'name');
    const gearName = T.lookup('gears', 'gear', 'name');
    const label = {
      cc: (k) => (ccName[k] ? `${ccName[k]}（${k}）` : k),
      gear: (k) => gearName[k] || k,
      sp: (k) => (spName[k] ? `${spName[k].split('（')[0]}（${k}）` : k),
      rfmo: (k) => `${k} ${T.RF[k] || ''}`,
    };

    // option lists depend on the current organisation (and species group)
    const inRf = P.rf ? rows.filter((r) => r.rfmo === P.rf) : rows;
    const spPresent = new Set(inRf.map((r) => r.sp));
    const groups = Array.from(new Set(spRows.map((r) => r.group)));
    fill(sel.rf, T.RF_ORDER.filter((x) => rows.some((r) => r.rfmo === x)).map((x) => [x, `${x} ${T.RF[x]}`]), P.rf, '全部組織');
    fill(sel.grp, groups.map((g) => [g, g]), P.grp, '全部類別');
    const spOpts = spRows.filter((r) => spPresent.has(r.sp) && (!P.grp || r.group === P.grp))
      .map((r) => [r.sp, `${r.name.split('（')[0]}（${r.sp}）`]).sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'));
    fill(sel.sp, spOpts, P.sp, '全部物種');
    const ccPresent = Array.from(new Set(inRf.map((r) => r.cc)));
    fill(sel.cc, ccPresent.map((c) => [c, label.cc(c)]).sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant')), P.cc, '全部國家');
    const gearPresent = Array.from(new Set(inRf.map((r) => r.gear)));
    fill(sel.gear, gearPresent.map((g) => [g, label.gear(g)]), P.gear, '全部漁法');
    sel.dim.value = P.dim || 'cc';
    top.value = String(P.top || 20);

    // filter
    const f = rows.filter((r) => (!P.rf || r.rfmo === P.rf) && (!P.sp || r.sp === P.sp) && (!P.grp || spGroup[r.sp] === P.grp) && (!P.cc || r.cc === P.cc) && (!P.gear || r.gear === P.gear));
    const dim = P.dim || 'cc';
    const years = Array.from(new Set(f.map((r) => r.year))).sort((a, b) => a - b);
    fill(sel.yr, years.slice().reverse().map((y) => [String(y), String(y)]), P.yr != null ? String(P.yr) : '2024', '—');
    if (!sel.yr.value && years.length) sel.yr.value = String(years.includes(2024) ? 2024 : years[years.length - 1]);
    const yr = Number(sel.yr.value);

    // summary
    const byYear = d3.rollup(f, (v) => d3.sum(v, (d) => d.t), (d) => d.year);
    const peak = d3.greatest(byYear, (d) => d[1]);
    const parts = [P.rf ? `${P.rf} ${T.RF[P.rf]}` : '五個組織', P.grp || null, P.sp ? label.sp(P.sp) : null, P.cc ? label.cc(P.cc) : null, P.gear ? label.gear(P.gear) : null].filter(Boolean);
    $('ct-summary').textContent = f.length
      ? `${parts.join('・')}：${years[0]}–${years[years.length - 1]} 年共 ${T.fmt0(d3.sum(f, (d) => d.t))} 公噸；最高為 ${peak[0]} 年 ${T.fmt0(peak[1])} 公噸；${yr} 年 ${T.fmt0(byYear.get(yr) || 0)} 公噸。`
      : '這個組合沒有漁獲紀錄，請放寬篩選條件。';
    $('ct-trend-title').textContent = `逐年漁獲，依${{ cc: '國家', gear: '漁法', sp: '物種', rfmo: '組織' }[dim]}分組`;

    // stacked trend
    const tot = d3.rollup(f, (v) => d3.sum(v, (d) => d.t), (d) => d[dim]);
    const ranked = Array.from(tot).sort((a, b) => b[1] - a[1]);
    const keys = ranked.slice(0, 8).map((d) => d[0]);
    const hasOther = ranked.length > 8;
    const allKeys = hasOther ? keys.concat(['__other']) : keys;
    const byY = new Map();
    f.forEach((r) => {
      if (!byY.has(r.year)) byY.set(r.year, { year: r.year });
      const o = byY.get(r.year);
      const k = keys.includes(r[dim]) ? r[dim] : '__other';
      o[k] = (o[k] || 0) + r.t;
    });
    const span = years.length ? d3.range(years[0], years[years.length - 1] + 1) : [];
    const data = span.map((y) => byY.get(y) || { year: y });
    const names = Object.fromEntries(allKeys.map((k) => [k, k === '__other' ? '其他' : label[dim](k)]));
    const colors = allKeys.map((k, i) => (k === '__other' ? 'var(--cds-chart-muted)' : dash.colors[i % dash.colors.length]));
    if (data.length) {
      T.stackChart($('ct-trend'), { keys: allKeys, names, colors, data, height: 300 });
      T.legend($('ct-legend'), allKeys, names, colors);
    } else {
      $('ct-trend').replaceChildren();
      $('ct-legend').replaceChildren();
    }

    // ranking for the year
    const inYear = f.filter((r) => r.year === yr);
    const yTot = d3.sum(inYear, (d) => d.t) || 1;
    const rk = Array.from(d3.rollup(inYear, (v) => d3.sum(v, (d) => d.t), (d) => d[dim])).sort((a, b) => b[1] - a[1]);
    const n = P.top || 20;
    $('ct-rank-title').textContent = `${yr || ''} 年${{ cc: '國家', gear: '漁法', sp: '物種', rfmo: '組織' }[dim]}排行（共 ${rk.length} 項）`;
    T.barList($('ct-rank'), rk.slice(0, n).map(([k, v], i) => ({
      key: k, label: label[dim](k), value: v, text: `${T.fmt0(v)} t・${d3.format('.1%')(v / yTot)}`,
      color: keys.includes(k) ? colors[keys.indexOf(k)] : 'var(--cds-chart-muted)',
    })), { onClick: (d) => dash.setParams({ [dim === 'rfmo' ? 'rf' : dim]: d.key }) });
  });
})();
