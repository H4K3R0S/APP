// Stranica Simulacije: Solo (izbor strategije, masovni test, Tier-ovi, grafikon budžeta, AI rizik)
// i Multi-Strategy (sekvencer → hibridna simulacija → marker-grafikon).
import { h, qs, fmt } from '../ui/dom.js';
import { state, subscribe, notifyStrategiesChanged } from '../state.js';
import { toast } from '../ui/toast.js';
import { createTiers } from './tiers.js';
import { createBudgetChart } from './budget_chart.js';
import { createRiskPanel } from './risk_panel.js';
import { mountSequencer } from './sequencer.js';
import { createHybridChart } from './hybrid_chart.js';
import { mountThreadControl } from './threads.js';
import { createBenchmarkCard } from './benchmark.js';

export function mountSimPage(root) {
  const tabSolo = h('button', { id: 'sim-mode-solo', type: 'button', class: 'tab active' }, 'Solo strategija');
  const tabMulti = h('button', { id: 'sim-mode-multi', type: 'button', class: 'tab' }, 'Multi-Strategy sekvencer');
  const select = h('select', { id: 'sim-strategy-select' }, h('option', { value: '' }, '— Izaberi strategiju za test —'));
  const runBtn = h('button', { id: 'sim-run-btn', type: 'button', class: 'btn-primary' }, 'POKRENI MASOVNI TEST (1.000.000 krugova)');
  const cancelBtn = h('button', { id: 'sim-cancel-btn', type: 'button', class: 'btn-secondary danger', hidden: true }, 'Prekini');
  const bar = h('div', { class: 'bar' });
  const progressText = h('span', { id: 'sim-progress-text' }, 'Spremno');
  const threadsEl = h('div', { id: 'sim-thread-control', class: 'sim-card thread-control' });
  const tiersEl = h('div', { id: 'sim-tiers', class: 'sim-card' });
  const chartEl = h('div', { id: 'sim-budget-chart', class: 'sim-card chart-host' });
  const hybridEl = h('div', { id: 'hybrid-chart', class: 'sim-card chart-host', hidden: true });
  const riskEl = h('div', { id: 'sim-risk', class: 'sim-card' });
  const multiRoot = h('div', { id: 'sim-multi', hidden: true });
  const soloControls = h('div', { id: 'sim-solo', class: 'sim-controls' },
    h('label', { class: 'field grow' }, h('span', {}, 'Strategija'), select),
    h('div', { class: 'sim-actions' }, runBtn, cancelBtn));

  root.replaceChildren(
    h('div', { class: 'sim-top' }, h('div', { class: 'sim-mode-tabs' }, tabSolo, tabMulti), threadsEl),
    soloControls,
    multiRoot,
    h('div', { id: 'sim-progress', class: 'sim-progress' }, h('div', { class: 'track' }, bar), progressText),
    h('div', { class: 'sim-middle' }, tiersEl, chartEl, hybridEl),
    riskEl,
  );

  const tiers = createTiers(tiersEl);
  const chart = createBudgetChart(chartEl);
  const hybridChart = createHybridChart(hybridEl);
  const risk = createRiskPanel(riskEl);
  const bench = createBenchmarkCard(riskEl);
  const sequencer = mountSequencer(multiRoot, { onRun: () => api.run() });
  const threadCtl = mountThreadControl(threadsEl);

  let mode = 'solo';
  let hardware = { threads: 1, maxAllowed: 1, recommended: 1 };
  window.gambitAPI.getHardware().then((hw) => {
    hardware = hw;
    threadCtl.setHardware(hw);
    threadCtl.set(hw.recommended || hw.maxAllowed);
  });
  window.gambitAPI.benchmarkHistory(8).then((rows) => bench.renderHistory(Array.isArray(rows) ? rows : [])).catch(() => {});

  let job = null; // { jobId, resolve }
  let lastReport = null;

  function setRunning(on) {
    runBtn.hidden = on;
    cancelBtn.hidden = !on;
    select.disabled = on;
    sequencer.el.runBtn.disabled = on;
    threadCtl.setLocked(on);
    document.body.classList.toggle('sim-running', on); // topbar: ⚡ pored CPU dok simulacija radi
  }

  function showProgress(p) {
    bar.style.width = `${p.pct}%`;
    const eta = p.etaSec == null ? '' : ` · preostalo ~${p.etaSec}s`;
    progressText.textContent = `${fmt(p.pct, 1)}% · ${p.sessionsDone}/${p.sessionsTotal} sesija · ${p.rounds.toLocaleString('sr-RS')} krugova${eta}`;
    tiers.update(p.tiers);
  }

  function showReport(report) {
    lastReport = report;
    root.classList.add('has-report');
    bar.style.width = '100%';
    progressText.textContent = `Gotovo: ${report.sessionsTotal} sesija, ${report.totalRounds.toLocaleString('sr-RS')} krugova za ${fmt(report.benchmark.durationMs / 1000, 2)} s`;
    tiers.update(report.overall.tierAvg);
    risk.render(report);
    bench.render(report);
    window.gambitAPI.benchmarkHistory(8).then((rows) => bench.renderHistory(Array.isArray(rows) ? rows : [])).catch(() => {});
    const multi = report.type === 'multi';
    chartEl.hidden = multi;
    hybridEl.hidden = !multi;
    if (multi) hybridChart.render(report.representativeSession, report.baseStrategy || report.strategyName);
    else chart.render(report);
  }

  window.gambitAPI.onSimProgress((p) => { if (job && p.jobId === job.jobId) showProgress(p); });
  window.gambitAPI.onSimDone((d) => {
    if (!job || d.jobId !== job.jobId) return;
    const { resolve } = job;
    job = null;
    setRunning(false);
    if (d.error) { progressText.textContent = `Greška: ${d.error}`; toast(d.error, 'error'); resolve({ error: d.error }); return; }
    if (d.cancelled) { progressText.textContent = 'Prekinuto'; toast('Simulacija prekinuta', 'info'); resolve({ cancelled: true }); return; }
    showReport(d.report);
    toast(`Analiza sačuvana: ${d.report.strategyName}`, 'ok');
    notifyStrategiesChanged();
    resolve({ report: d.report, analysisFile: d.analysisFile });
  });

  async function startJob(payload) {
    tiers.reset(); chart.reset(); risk.reset();
    bar.style.width = '0%';
    progressText.textContent = 'Pokrećem radnike…';
    setRunning(true);
    const res = await window.gambitAPI.runSimulation(payload);
    if (!res || res.error) { setRunning(false); progressText.textContent = `Greška: ${res?.error}`; toast(res?.error || 'Pokretanje nije uspelo', 'error'); return { error: res?.error }; }
    return new Promise((resolve) => { job = { jobId: res.jobId, resolve }; });
  }

  const api = {
    list: [],
    sequencer,
    hybridChart,
    getMode: () => mode,
    setMode(m) {
      mode = m === 'multi' ? 'multi' : 'solo';
      tabSolo.classList.toggle('active', mode === 'solo');
      tabMulti.classList.toggle('active', mode === 'multi');
      soloControls.hidden = mode !== 'solo';
      multiRoot.hidden = mode !== 'multi';
      root.classList.toggle('multi-mode', mode === 'multi');
      chartEl.hidden = mode === 'multi' && lastReport?.type === 'multi';
      hybridEl.hidden = !(mode === 'multi' && lastReport?.type === 'multi');
      if (mode === 'multi') sequencer.setStrategies(api.list);
    },
    async refresh(selectName) {
      const list = await window.gambitAPI.listStrategies(state.game);
      api.list = Array.isArray(list) ? list : [];
      select.replaceChildren(h('option', { value: '' }, '— Izaberi strategiju za test —'),
        ...api.list.map((s) => h('option', { value: s.name }, `${s.type === 'multi' ? '⛓ ' : ''}${s.name}${s.hasAnalysis ? ' ✓' : ''}`)));
      select.value = selectName && api.list.some((s) => s.name === selectName) ? selectName : '';
      sequencer.setStrategies(api.list);
      return api.list;
    },
    select(name) { select.value = name; },
    // Vraća Promise koji se razrešava kad simulacija završi ({report} | {error} | {cancelled}).
    async run(overrides = {}) {
      if (job) return { error: 'Simulacija već radi' };
      const t = overrides.threads || threadCtl.get() || hardware.maxAllowed;
      const workerMode = overrides.workerMode || threadCtl.getMode();
      overrides = { workerMode, ...overrides };
      if (mode === 'multi') {
        const config = overrides.hybridConfig || sequencer.compile();
        if (!config.baseStrategy) { toast('Odaberi polaznu strategiju', 'error'); return { error: 'nema polazne strategije' }; }
        if (!config.strategyName) config.strategyName = `Hibrid_${config.baseStrategy}`;
        const saved = await window.gambitAPI.saveStrategy(state.game, config);
        if (!saved || saved.error) { toast(saved?.error || 'Hibrid nije sačuvan', 'error'); return { error: saved?.error }; }
        config.strategyName = saved.name;
        sequencer.el.nameInput.value = saved.name;
        await api.refresh(select.value);
        return startJob({ game: state.game, hybridConfig: config, threads: t, ...overrides });
      }
      const strategyName = overrides.strategyName || select.value;
      if (!strategyName) { toast('Izaberi strategiju', 'error'); return { error: 'nema strategije' }; }
      const entry = api.list.find((s) => s.name === strategyName);
      if (entry?.type === 'multi') {
        const cfg = await window.gambitAPI.loadStrategy(state.game, strategyName);
        if (!cfg || cfg.error) { toast('Hibrid nije nađen', 'error'); return { error: 'hibrid' }; }
        return startJob({ game: state.game, hybridConfig: cfg, threads: t, ...overrides });
      }
      return startJob({ game: state.game, strategyName, threads: t, ...overrides });
    },
    cancel() { if (job) window.gambitAPI.cancelSimulation(job.jobId); },
    getLastReport: () => lastReport,
    showReport,
    el: { select, runBtn, cancelBtn, threads: threadCtl.el.range, tiersEl, chartEl, hybridEl, riskEl, tabSolo, tabMulti },
    tiers, chart, risk, bench, threadCtl,
  };

  tabSolo.addEventListener('click', () => api.setMode('solo'));
  tabMulti.addEventListener('click', () => api.setMode('multi'));
  runBtn.addEventListener('click', () => api.run());
  cancelBtn.addEventListener('click', () => api.cancel());
  subscribe((key) => {
    if (key === 'game') api.refresh();
    if (key === 'strategies-changed') api.refresh(select.value); // save/delete/analiza bilo gde → lista i sekvencer sveži
  });
  api.refresh();
  return api;
}

export { qs };
