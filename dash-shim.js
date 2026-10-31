/* Minimal stand-in for the claude.ai Dashboard runtime, so the same page code runs on a static host.
   Provides window.dash: data(), onData(), calc(), params()/setParams()/resetParams(), setLink(), colors, refresh(). */
(function () {
  const DATASETS = {
    catches: 'data/catch.csv',
    cmsy_results: 'data/cmsy_results.csv',
    cmsy_ts: 'data/cmsy_ts.csv',
    kobe_cloud: 'data/kobe_cloud.csv',
    issf_compare: 'data/issf_compare.csv',
    species: 'data/species.csv',
    countries: 'data/countries.csv',
    gears: 'data/gears.csv',
    quota: 'data/quota.csv',
  };
  const DEFAULT_PARAMS = {
    tab: 'overview', rf: null, grp: null, sp: null, cc: null, gear: null, dim: 'cc', yr: 2024, top: 20,
    crf: null, cgrp: null, czone: null, cq: null, csort: null, unit: 'WCPFC_YFT_WCPO', qstock: null, qcc: null, qyr: null,
  };

  const store = {};      // id -> {status, data, columns, message}
  const calcs = {};      // id -> {inputs, fn, cache:{srcs, out}}
  const listeners = [];
  let params = { ...DEFAULT_PARAMS };
  let pending = false;

  const run = () => {
    pending = false;
    listeners.forEach((fn) => {
      try { fn(); } catch (e) { console.error(e); }
    });
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(run);
  };

  const load = (id) => {
    if (store[id]) return;
    store[id] = { status: 'loading', data: [], columns: [] };
    fetch(DATASETS[id])
      .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.text(); })
      .then((txt) => {
        const rows = d3.csvParse(txt);
        store[id] = { status: 'ok', data: rows, columns: rows.columns || [] };
        schedule();
      })
      .catch((e) => {
        store[id] = { status: 'error', data: [], columns: [], message: String(e) };
        schedule();
      });
  };

  const calcData = (id) => {
    const c = calcs[id];
    const ins = c.inputs.map((i) => dash.data(i));
    if (ins.some((d) => d.status === 'error')) return { status: 'error', data: [], columns: [] };
    if (ins.some((d) => d.status !== 'ok')) return { status: 'loading', data: [], columns: [] };
    const srcs = ins.map((d) => d.data);
    if (!c.cache || c.cache.srcs.some((s, i) => s !== srcs[i])) {
      let out;
      try { out = c.fn(...srcs); } catch (e) { console.error(e); return { status: 'error', data: [], columns: [] }; }
      c.cache = { srcs, out: { status: 'ok', data: out, columns: Array.isArray(out) && out[0] ? Object.keys(out[0]) : [] } };
    }
    return c.cache.out;
  };

  const dash = {
    data(id) {
      if (calcs[id]) return { ...calcData(id), refreshing: false, meta: [] };
      if (!DATASETS[id]) return { status: 'missing', data: [], columns: [], refreshing: false, meta: [] };
      load(id);
      const s = store[id];
      return { status: s.status, data: s.data, columns: s.columns, message: s.message, refreshing: false, meta: [], rows: s.data };
    },
    onData(fn) {
      listeners.push(fn);
      try { fn(); } catch (e) { console.error(e); }
    },
    calc(id, spec) { calcs[id] = { inputs: spec.inputs, fn: spec.fn }; },
    loader() {},
    params() { return { ...params }; },
    setParams(p) { params = { ...params, ...p }; schedule(); },
    resetParams() { params = { ...DEFAULT_PARAMS }; schedule(); },
    setLink(name) {
      try { history.replaceState(null, '', name ? '#' + name : location.pathname + location.search); } catch (e) { /* ignore */ }
    },
    refresh() { schedule(); },
    colors: ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'],
  };
  window.dash = dash;

  let w = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - w) > 4) { w = window.innerWidth; schedule(); }
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (window.TU && window.TU.TABS.includes(h)) window.TU.showTab(h, false);
  });
  // theme change redraws charts (colors are read from CSS at draw time)
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', schedule);
  }
})();
