// Gambit — renderer bootstrap: IPC ping, sidebar, topbar, ruter, game host, smoke self-test.
import { mountSidebar } from './ui/sidebar.js';
import { mountTopbar } from './ui/topbar.js';
import { mountTitleBar } from '../vendor/window-chrome/adapters/electron-titlebar.js';
import { initRouter, switchScreen, currentScreen } from './router.js';
import { registerGame, mountGameHost } from './games/game_host.js';
import { diceGame } from './games/dice/index.js';
import { minesGame } from './games/mines/index.js';
import { kenoGame } from './games/keno/index.js';
import { multiplier as minesMult } from '../../shared/mines_math.js';
import { topAnchors as kenoTopAnchors } from '../../shared/keno_freq.js';
import { setGame } from './state.js';
import { qs, fire } from './ui/dom.js';
import { mountLiveStats } from './stats/live_stats.js';
import { mountProfitChart, getProfitChart } from './chart/profit_chart.js';
import { state, applyRound, subscribe } from './state.js';
import { mountWinFlash } from './ui/win_flash.js';
import { playWin, playLose } from './ui/sound.js';
import { mountSimPage } from './sim/sim_page.js';
import { mountHub } from './hub/hub.js';
import { createPanel } from './hub/panel.js';
import { injectStrategy } from './hub/injector.js';
import { hybridStrategy } from '../../shared/hybrid_schema.js';
import { minesStrategy } from '../../shared/strategy_schema.js';

let host = null;
let simPage = null;
let hub = null;
let hubPanel = null;
const SMOKE_NAME = `smoke_${Math.random().toString(36).slice(2, 8)}`;

const injectCtx = () => ({ host, simPage, switchScreen, setGame });

function gamePanels() {
  return {
    left: { tabs: qs('#panel-mode-tabs'), inputs: qs('#panel-input-fields'), actions: qs('#panel-action-buttons') },
    center: { render: qs('#panel-game-render'), chart: qs('#panel-live-chart') },
    right: { balance: qs('#panel-live-balance'), notes: qs('#panel-profit-notes'), streaks: qs('#panel-streak-counters') },
  };
}

// --- Smoke self-test: dokazuje ruter/layout/igru bez ljudskog oka; rezultat ide Main-u ---
async function check(checks, errors, key, fn) {
  try {
    checks[key] = !!(await fn());
    if (!checks[key]) errors.push(`${key}: provera vratila false`);
  } catch (e) {
    checks[key] = false;
    errors.push(`${key}: ${e.message}`);
  }
}

async function runSelfTest() {
  const errors = [];
  const checks = {};

  await check(checks, errors, 'router', () => {
    const all = ['screen-game', 'screen-simulations', 'screen-strategy-hub'].every((id) => {
      const ok = switchScreen(id);
      const active = document.querySelectorAll('.screen.active');
      return ok && active.length === 1 && active[0].id === id && currentScreen() === id;
    });
    const unknownRejected = switchScreen('nema') === false && document.querySelectorAll('.screen.active').length === 1;
    const sidebarActive = document.querySelectorAll('#sidebar .nav-btn.active').length === 1;
    // loš podrazumevani ekran → fallback na prvi, nikad 0 aktivnih
    for (const el of document.querySelectorAll('.screen.active')) el.classList.remove('active');
    initRouter({ defaultScreen: 'nema-ekrana' });
    const fallback = document.querySelectorAll('.screen.active').length === 1 && currentScreen() === 'screen-game';
    return all && unknownRejected && sidebarActive && fallback;
  });

  await check(checks, errors, 'layout', () => {
    switchScreen('screen-game');
    const ids = ['game-left-panel', 'panel-mode-tabs', 'panel-input-fields', 'panel-action-buttons',
      'game-center-panel', 'panel-game-render', 'panel-live-chart',
      'game-right-panel', 'panel-live-balance', 'panel-profit-notes', 'panel-streak-counters'];
    const missing = ids.filter((id) => !document.getElementById(id));
    if (missing.length) throw new Error(`nedostaju ${missing.join(',')}`);
    const tops = ['game-left-panel', 'game-center-panel', 'game-right-panel']
      .map((id) => Math.round(document.getElementById(id).getBoundingClientRect().top));
    if (!tops.every((t) => t === tops[0])) throw new Error(`kolone nisu u istom redu ${tops.join(',')}`);
    const noScroll = document.documentElement.scrollWidth <= window.innerWidth
      && document.documentElement.scrollHeight <= window.innerHeight;
    if (!noScroll) throw new Error('stranica ima skrol');
    return true;
  });

  await check(checks, errors, 'dice_ui', () => {
    const api = host.current()?.api;
    if (!api) throw new Error('dice nije montiran');
    const chance = qs('#dice-chance'); chance.value = '49.5'; fire(chance, 'input'); fire(chance, 'change');
    if (qs('#dice-multiplier').value !== '2.0000') throw new Error(`multiplier ${qs('#dice-multiplier').value}`);
    if (qs('#dice-target').value !== '50.50') throw new Error(`target ${qs('#dice-target').value}`);
    const bet = qs('#dice-bet'); bet.value = '1'; fire(bet, 'change');
    qs('#dice-half').click();
    if (bet.value !== '0.5') throw new Error(`half ${bet.value}`);
    qs('#dice-double').click(); qs('#dice-double').click();
    if (bet.value !== '2') throw new Error(`double ${bet.value}`);
    qs('#dice-condition').click();
    if (qs('#dice-target').value !== '49.50') throw new Error(`under target ${qs('#dice-target').value}`);
    const mult = qs('#dice-multiplier'); mult.value = '4'; fire(mult, 'input'); fire(mult, 'change');
    if (qs('#dice-chance').value !== '24.75') throw new Error(`chance from mult ${qs('#dice-chance').value}`);
    api.setMode('auto');
    if (qs('#dice-auto-panel').hidden) throw new Error('auto panel skriven');
    api.setMode('manual');
    api.setParams({ betAmount: 1, chance: 49.5, condition: 'over' });
    return api.getParams().targetValue === 50.5 && api.getParams().multiplier === 2;
  });

  await check(checks, errors, 'stats', () => {
    applyRound({ isWin: false, betAmount: 1, profit: -1 });
    applyRound({ isWin: false, betAmount: 1, profit: -1 });
    applyRound({ isWin: true, betAmount: 1, profit: 1 });
    if (qs('#stat-bets').textContent !== '3') throw new Error(`bets ${qs('#stat-bets').textContent}`);
    if (qs('#roll-history').children.length !== 3) throw new Error('badge-ovi');
    if (qs('#stat-streak').textContent !== '0' || qs('#stat-max-streak').textContent !== '2') throw new Error('nizovi');
    if (qs('#stat-balance').textContent !== '999.00') throw new Error(`balans ${qs('#stat-balance').textContent}`);
    applyRound({ isWin: true, betAmount: 100, profit: 600 });
    if (!qs('.milestone[data-pct="50"]').classList.contains('hit')) throw new Error('milestone 50 nije pogođen');
    if (qs('.milestone[data-pct="100"]').classList.contains('hit')) throw new Error('milestone 100 lažno pogođen');
    qs('#stats-reset').click();
    if (qs('#stat-bets').textContent !== '0' || document.querySelectorAll('.milestone.hit').length) throw new Error('reset');
    return state.stats.initialBalance === 1599 && state.stats.balance === 1599;
  });

  await check(checks, errors, 'rng', async () => {
    const bet = { betAmount: 1, targetValue: 50.5, condition: 'over', balance: 1000 };
    const a = await window.gambitAPI.rollDice(bet);
    if (a.error || typeof a.roll !== 'number' || a.nonce !== 1 || String(a.serverSeedHash).length !== 64) throw new Error(JSON.stringify(a));
    if (typeof a.isWin !== 'boolean' || typeof a.profit !== 'number') throw new Error('oblik odgovora');
    const b = await window.gambitAPI.rollDice(bet);
    if (b.nonce !== 2) throw new Error(`nonce ${b.nonce}`);
    const c = await window.gambitAPI.rollDice({ ...bet, betAmount: 5000 });
    return !!c.error;
  });

  await check(checks, errors, 'dice_manual', async () => {
    const api = host.current()?.api;
    const chart = getProfitChart();
    api.setParams({ betAmount: 1, chance: 49.5, condition: 'over' });
    const bets0 = state.stats.bets;
    const size0 = chart.size();
    for (let i = 0; i < 3; i++) {
      const res = await api.playManualRound();
      if (!res) throw new Error(`krug ${i + 1} nije odigran`);
    }
    if (state.stats.bets !== bets0 + 3) throw new Error(`bets ${state.stats.bets}`);
    if (chart.size() !== size0 + 3) throw new Error(`chart ${chart.size()} != ${size0 + 3}`);
    if (qs('#roll-history').children.length < 3) throw new Error('bedževi');
    if (!qs('#dice-roll-flash').classList.contains('show')) throw new Error('bljesak');
    api.setParams({ betAmount: 5000 });
    const bad = await api.playManualRound();
    api.setParams({ betAmount: 1 });
    return bad === null && !!qs('#toast-root .toast.error');
  });

  await check(checks, errors, 'dice_auto', async () => {
    const api = host.current()?.api;
    const MART = [
      { kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: 100 },
      { kind: 'bet', on: 'every', count: 1, outcome: 'wins', do: 'reset', value: 0 },
    ];
    api.setMode('auto');
    api.setParams({ betAmount: 0.01, chance: 49.5, condition: 'over' });
    api.auto.setConditions(MART);
    api.auto.setAutoRules({ maxBets: 20 });
    if (qs('#dice-play-one').hidden) throw new Error('dugme „Odigraj 1 krug" skriveno u Auto');
    if (qs('#dice-conditions').children.length !== 2) throw new Error('čipovi uslova');
    // Tri brzine igranja
    if (qs('#dice-speed').children.length !== 3) throw new Error('nema 3 brzine');
    api.auto.fields.setSpeed('instant');
    if (api.auto.fields.getSpeed().delayMs !== 0 || !qs('#dice-speed [data-speed="instant"]').classList.contains('on')) throw new Error('brzina instant');
    api.auto.fields.setSpeed('normal');
    if (api.auto.fields.getSpeed().stepMs <= 0) throw new Error('brzina normal (animacije)');
    const bets0 = state.stats.bets;
    const summary = await api.auto.start({ delayMs: 0 });
    if (!summary || summary.reason !== 'maxBets') throw new Error(`razlog ${summary?.reason}`);
    if (state.stats.bets !== bets0 + 20) throw new Error(`bets ${state.stats.bets - bets0}`);
    if (qs('#dice-bet-btn').textContent !== 'POKRENI AUTO IGRU' || qs('#dice-bet').disabled) throw new Error('UI nije vraćen');
    if (qs('#dice-bet').value !== '0.01') throw new Error(`ulog nije vraćen na bazu: ${qs('#dice-bet').value}`);
    // „Odigraj 1 krug" odigra tačno jedan krug
    const b1 = state.stats.bets;
    await api.auto.playOne();
    if (state.stats.bets !== b1 + 1) throw new Error('playOne nije odigrao 1 krug');
    api.auto.setConditions([]);
    api.auto.setAutoRules({ maxBets: 0 });
    const done = api.auto.start({ delayMs: 5 });
    if (!api.auto.isRunning() || qs('#dice-bet-btn').textContent !== 'ZAUSTAVI AUTO IGRU') throw new Error('petlja nije krenula');
    await new Promise((r) => setTimeout(r, 40));
    api.auto.stop();
    const s2 = await done;
    if (api.auto.isRunning() || s2.reason !== 'stopped') throw new Error(`stop ${s2.reason}`);
    api.setMode('manual');
    return true;
  });

  await check(checks, errors, 'strategy_io', async () => {
    const api = host.current()?.api;
    // jedinstveno ime po instanci: launcher i smoke testovi pokreću više Electron-a paralelno nad istim data/
    const NAME = SMOKE_NAME;
    const CONDS = [
      { kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: 100 },
      { kind: 'bet', on: 'every', count: 1, outcome: 'wins', do: 'reset', value: 0 },
      { kind: 'profit', on: 'profitBelow', count: 20, do: 'stop', value: 0 },
    ];
    api.setMode('auto');
    api.setParams({ betAmount: 0.05, chance: 49.5, condition: 'over' });
    api.auto.setConditions(CONDS);
    api.auto.setAutoRules({ maxBets: 100 });
    const saved = await api.strategy.save(NAME, api.auto.getConditions());
    if (!saved || saved.name !== NAME) throw new Error(`save ${JSON.stringify(saved)}`);
    if (!api.strategy.list.some((s) => s.name === NAME)) throw new Error('nije u listi');
    if (![...qs('#dice-strategy-select').options].some((o) => o.value === NAME)) throw new Error('nije u selectu');
    api.setParams({ betAmount: 1, chance: 30 });
    api.auto.setConditions([]);
    api.auto.setAutoRules({ maxBets: 0 });
    const s = await api.strategy.load(NAME);
    const p = api.getParams();
    const r = api.auto.getAutoRules();
    if (!s || p.betAmount !== 0.05 || p.targetValue !== 50.5 || r.maxBets !== 100 || r.conditions.length !== 3 || r.onLoss.action !== 'increase' || r.stopConditions.stopLoss !== 20) {
      throw new Error(`load ${JSON.stringify({ p, r })}`);
    }
    if (s.startBalance !== state.stats.initialBalance) throw new Error(`startBalance ${s.startBalance}`);
    const removed = await api.strategy.remove();
    if (!removed || api.strategy.list.some((x) => x.name === NAME)) throw new Error('delete');
    api.setMode('manual');
    return true;
  });

  await check(checks, errors, 'sim_page', async () => {
    const api = host.current()?.api;
    const NAME = `${SMOKE_NAME}_sim`;
    api.setMode('auto');
    api.setParams({ betAmount: 1, chance: 49.5, condition: 'over' });
    api.auto.setAutoRules({ maxBets: 0, onLoss: { action: 'increase', value: 100 }, onWin: { action: 'reset', value: 0 } });
    qs('#dice-strategy-name').value = NAME;
    if (!(await api.strategy.save())) throw new Error('save');
    switchScreen('screen-simulations');
    await simPage.refresh(NAME);
    if (qs('#sim-strategy-select').value !== NAME) throw new Error('select');
    const t0 = performance.now();
    const res = await simPage.run({ sessionsPerBudget: 3, threads: 2, maxRoundsPerSession: 20000 });
    if (!res.report) throw new Error(`run ${JSON.stringify(res)}`);
    const rows = [...document.querySelectorAll('#sim-tiers .tier-row .pct')];
    if (rows.length !== 5 || !rows.every((r) => /%$/.test(r.textContent))) throw new Error('tier redovi');
    if (!/\$/.test(qs('#sim-recommendation').textContent)) throw new Error('preporuka');
    if (!/^\d+$/.test(qs('#sim-worst-streak').textContent)) throw new Error('loss streak');
    const analysis = await window.gambitAPI.loadAnalysis('dice', NAME);
    if (!analysis || analysis.sessionsTotal !== 36) throw new Error(`analiza ${analysis?.sessionsTotal}`);
    console.log(`sim smoke: ${res.report.totalRounds} krugova za ${Math.round(performance.now() - t0)} ms`);
    await api.strategy.remove(NAME);
    if (await window.gambitAPI.loadAnalysis('dice', NAME)) throw new Error('analiza nije obrisana');
    api.setMode('manual');
    switchScreen('screen-game');
    return true;
  });

  await check(checks, errors, 'mines_ui', async () => {
    setGame('mines'); await host.ready();
    qs('#game-select').value = 'mines';
    const api = host.current()?.api;
    if (host.current()?.name !== 'mines' || !api) throw new Error('mines nije montiran');
    if (document.querySelectorAll('#mines-grid .mine-field').length !== 25) throw new Error('nema 25 polja');
    if (qs('#mines-count').value !== '3') throw new Error(`mine ${qs('#mines-count').value}`);
    const bet = qs('#mines-bet'); bet.value = '1'; fire(bet, 'change');
    qs('#mines-half').click();
    if (bet.value !== '0.5') throw new Error(`half ${bet.value}`);
    qs('#mines-double').click(); qs('#mines-double').click();
    if (bet.value !== '2') throw new Error(`double ${bet.value}`);
    qs('#mines-count').value = '5'; fire(qs('#mines-count'), 'change');
    const expected = (2 * minesMult(5, 1) - 2).toFixed(8);
    if (qs('#mines-profit').value !== expected) throw new Error(`profit ${qs('#mines-profit').value} != ${expected}`);
    api.setMode('auto');
    if (qs('#mines-auto-panel').hidden) throw new Error('auto panel');
    api.setMode('manual');
    setGame('dice'); await host.ready();
    qs('#game-select').value = 'dice';
    return host.current()?.name === 'dice';
  });

  await check(checks, errors, 'mines_manual', async () => {
    setGame('mines'); await host.ready();
    const api = host.current()?.api;
    const chart = getProfitChart();
    api.setParams({ betAmount: 1, minesCount: 3 });
    const noRound = await window.gambitAPI.revealMinesField(0);
    if (!noRound.error) throw new Error('reveal bez runde je prošao');
    const bets0 = state.stats.bets;
    const size0 = chart.size();
    if (!(await api.manual.start())) throw new Error('start');
    if (!qs('#mines-bet').disabled || !qs('#mines-bet-btn').classList.contains('cashout')) throw new Error('UI runde');
    let ended = false;
    for (let i = 0; i < 25 && !ended; i++) {
      const r = await api.manual.reveal(i);
      if (!r) throw new Error(`reveal ${i} null`);
      if (r.status !== 'diamond') ended = true;
    }
    if (!ended || api.isRoundActive() || state.stats.bets !== bets0 + 1 || chart.size() !== size0 + 1) throw new Error('kraj runde');
    if (document.querySelectorAll('#mines-grid .field-revealed, #mines-grid .field-exploded').length !== 3) throw new Error('mine nisu otkrivene');
    // druga runda: dijamant pa cash out
    if (!(await api.manual.start())) throw new Error('start 2');
    let got = false;
    for (let i = 0; i < 25; i++) {
      const r = await api.manual.reveal(i);
      if (r.status === 'diamond') { got = true; break; }
      if (r.status !== 'diamond') break;
    }
    if (got) {
      const c = await api.manual.cashout();
      if (!c || c.status !== 'win' || c.profit <= 0) throw new Error(`cashout ${JSON.stringify(c)}`);
    }
    if (api.isRoundActive() || state.stats.bets !== bets0 + 2) throw new Error('posle cashout-a');
    // C1 (pregled F3): aktivna runda + promena igre → runda se oslobađa/kešira; Mines posle povratka radi
    if (!(await api.manual.start())) throw new Error('start 3');
    setGame('dice'); await host.ready();
    setGame('mines'); await host.ready();
    const api2 = host.current()?.api;
    const st = await window.gambitAPI.minesState();
    if (st.active) throw new Error('runda preživela promenu igre');
    if (!(await api2.manual.start())) throw new Error('start posle povratka');
    await window.gambitAPI.abortMines();
    api2.setRound(false); api2.setGridEnabled(false); api2.setInputsLocked(false);
    setGame('dice'); await host.ready();
    return true;
  });

  await check(checks, errors, 'mines_auto', async () => {
    setGame('mines'); await host.ready();
    const api = host.current()?.api;
    api.setMode('auto');
    api.setParams({ betAmount: 0.01, minesCount: 3 });
    const none = await api.auto.start({ delayMs: 0 });
    if (none !== null) throw new Error('start bez polja je prošao');
    api.auto.setSelectedFields([0, 4, 20, 24]);
    if (document.querySelectorAll('#mines-grid .field-selected').length !== 4) throw new Error('okviri');
    // A7: obeležavanje polja prikazuje mogući multiplikator za izabran broj polja
    if (!/Za 4 polja →/.test(qs('#mines-profit').previousElementSibling.textContent)) throw new Error('nema prikaza multiplikatora za izabrana polja');
    api.auto.setConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: 100 }]);
    api.auto.setAutoRules({ maxBets: 10 });
    const bets0 = state.stats.bets;
    const s = await api.auto.start({ delayMs: 0 });
    if (!s || s.reason !== 'maxBets' || state.stats.bets !== bets0 + 10) throw new Error(`petlja ${s?.reason} ${state.stats.bets - bets0}`);
    if (qs('#mines-bet').disabled || qs('#mines-bet-btn').textContent !== 'POKRENI AUTO IGRU') throw new Error('UI nije vraćen');
    const NAME = `${SMOKE_NAME}_mines`;
    const saved = await api.strategy.save(NAME, api.auto.getConditions());
    if (!saved || saved.name !== NAME) throw new Error('save');
    api.auto.setSelectedFields([12]);
    api.setParams({ minesCount: 5 });
    const loaded = await api.strategy.load(NAME);
    if (!loaded || JSON.stringify(api.auto.getSelectedFields()) !== '[0,4,20,24]' || api.getParams().minesCount !== 3) throw new Error('load');
    if (!(await api.strategy.remove())) throw new Error('delete');
    setGame('dice'); await host.ready();
    return true;
  });

  await check(checks, errors, 'mines_shift', async () => {
    setGame('mines'); await host.ready();
    const api = host.current()?.api;
    api.setMode('auto');
    api.setParams({ betAmount: 0.01, minesCount: 3 });
    api.auto.setSelectedFields([0, 1, 2]);
    api.auto.setShift({ onWin: { mode: 'stay' }, onLoss: { mode: 'now' }, algo: 'mirror' });
    if (!qs('#mines-shift-onloss-now').checked || qs('#mines-shift-algo').value !== 'mirror') throw new Error('shift UI');
    api.auto.setConditions([]);
    api.auto.setAutoRules({ maxBets: 30 });
    const losses0 = state.stats.losses;
    const s = await api.auto.start({ delayMs: 0 });
    if (!s || s.reason !== 'maxBets') throw new Error(`petlja ${s?.reason}`);
    const losses = state.stats.losses - losses0;
    const shifts = api.auto.getShiftCount();
    if (shifts !== losses) throw new Error(`rotacija ${shifts} != gubitaka ${losses}`);
    const f = api.auto.getSelectedFields();
    const expected = losses % 2 === 0 ? [0, 1, 2] : [2, 3, 4];
    if (JSON.stringify(f) !== JSON.stringify(expected)) throw new Error(`polja ${JSON.stringify(f)} očekivano ${JSON.stringify(expected)}`);
    const NAME = `${SMOKE_NAME}_shift`;
    if (!(await api.strategy.save(NAME, api.auto.getConditions()))) throw new Error('save');
    api.auto.setShift({ onLoss: { mode: 'stay' }, algo: 'random' });
    const loaded = await api.strategy.load(NAME);
    if (!loaded || loaded.shift?.onLoss?.mode !== 'now' || api.auto.getShift().algo !== 'mirror') throw new Error('shift nije sačuvan/učitan');
    await api.strategy.remove();
    setGame('dice'); await host.ready();
    return true;
  });

  await check(checks, errors, 'sim_mines', async () => {
    setGame('mines'); await host.ready();
    const api = host.current()?.api;
    const NAME = `${SMOKE_NAME}_msim`;
    api.setMode('auto');
    api.setParams({ betAmount: 1, minesCount: 3 });
    api.auto.setSelectedFields([0, 4, 20, 24]);
    api.auto.setAutoRules({ maxBets: 0, onLoss: { action: 'increase', value: 100 }, onWin: { action: 'reset', value: 0 } });
    qs('#mines-strategy-name').value = NAME;
    if (!(await api.strategy.save())) throw new Error('save');
    switchScreen('screen-simulations');
    await simPage.refresh(NAME);
    if (qs('#sim-strategy-select').value !== NAME) throw new Error('select');
    const res = await simPage.run({ sessionsPerBudget: 3, threads: 2, maxRoundsPerSession: 20000 });
    if (!res.report || res.report.game !== 'mines' || res.report.sessionsTotal !== 36) throw new Error(`run ${JSON.stringify(res).slice(0, 200)}`);
    const rows = [...document.querySelectorAll('#sim-tiers .tier-row .pct')];
    if (!rows.every((r) => /%$/.test(r.textContent))) throw new Error('tier redovi');
    if (!(await window.gambitAPI.loadAnalysis('mines', NAME))) throw new Error('analiza');
    await api.strategy.remove(NAME);
    switchScreen('screen-game');
    setGame('dice'); await host.ready();
    return true;
  });

  await check(checks, errors, 'keno_ui', async () => {
    setGame('keno'); await host.ready();
    qs('#game-select').value = 'keno';
    const api = host.current()?.api;
    if (host.current()?.name !== 'keno' || !api) throw new Error('keno nije montiran');
    if (document.querySelectorAll('#keno-board .keno-number').length !== 40) throw new Error('nema 40 polja');
    for (let n = 1; n <= 10; n++) if (!api.toggleNumber(n)) throw new Error(`toggle ${n}`);
    if (document.querySelectorAll('.keno-selected').length !== 10) throw new Error('10 izabranih');
    if (api.toggleNumber(11) !== false || !qs('.keno-number[data-number="11"]').disabled) throw new Error('11. nije odbijen');
    api.clear();
    if (document.querySelectorAll('.keno-selected').length !== 0) throw new Error('clear');
    const picked = api.autoPick();
    if (picked.length !== 10 || new Set(picked).size !== 10 || api.getParams().selectedNumbers.length !== 10) throw new Error('autoPick');
    qs('#keno-risk').value = 'high'; fire(qs('#keno-risk'), 'change');
    if (!/1000\.00×/.test(qs('#keno-paytable').textContent)) throw new Error('tablica high');
    const bet = qs('#keno-bet'); bet.value = '1'; fire(bet, 'change'); qs('#keno-half').click();
    if (bet.value !== '0.5') throw new Error('half');
    api.setMode('auto');
    if (qs('#keno-auto-panel').hidden) throw new Error('auto panel');
    api.setMode('manual');
    setGame('dice'); await host.ready();
    qs('#game-select').value = 'dice';
    return true;
  });

  await check(checks, errors, 'keno_manual', async () => {
    setGame('keno'); await host.ready();
    const api = host.current()?.api;
    const chart = getProfitChart();
    api.setParams({ betAmount: 1, riskLevel: 'classic', selectedNumbers: [7, 14, 21] });
    const bets0 = state.stats.bets;
    const size0 = chart.size();
    const res = await api.playManualRound({ stepMs: 0 });
    if (!res || res.error) throw new Error(`play ${JSON.stringify(res)}`);
    if (state.stats.bets !== bets0 + 1 || chart.size() !== size0 + 1) throw new Error('stats/grafikon');
    const marked = document.querySelectorAll('#keno-board .keno-hit, #keno-board .keno-miss').length;
    if (marked !== 10) throw new Error(`obeleženo ${marked}`);
    if (document.querySelectorAll('#keno-board .keno-hit').length !== res.hits) throw new Error('hit broj');
    if (qs('#keno-bet').disabled) throw new Error('UI zaključan posle kruga');
    api.clear();
    const none = await api.playManualRound({ stepMs: 0 });
    if (none !== null || !qs('#toast-root .toast.error')) throw new Error('0 brojeva prošlo');
    setGame('dice'); await host.ready();
    return true;
  });

  await check(checks, errors, 'keno_freq', async () => {
    setGame('keno'); await host.ready();
    const api = host.current()?.api;
    api.setParams({ betAmount: 0.01, riskLevel: 'classic' });
    for (let i = 0; i < 5; i++) {
      api.autoPick();
      if (!(await api.playManualRound({ stepMs: 0 }))) throw new Error(`krug ${i + 1}`);
    }
    if (api.freq.freq.history.length !== 5) throw new Error('istorija');
    const shown = [...document.querySelectorAll('#keno-anchors .anchor .num')].map((e) => Number(e.textContent));
    const expected = kenoTopAnchors(api.freq.freq, 3);
    if (JSON.stringify(shown) !== JSON.stringify(expected)) throw new Error(`sidra ${shown} != ${expected}`);
    if (api.freq.freq.map[expected[0]] < 1) throw new Error('sidro bez učestalosti');
    qs('#keno-heat-toggle').click();
    const hot = [...document.querySelectorAll('#keno-board .keno-number')].filter((c) => Number(c.style.getPropertyValue('--heat')) > 0).length;
    if (!qs('#keno-board').classList.contains('heat-on') || hot < 10) throw new Error(`heat ${hot}`);
    qs('#keno-heat-toggle').click();
    setGame('dice'); await host.ready();
    return true;
  });

  await check(checks, errors, 'keno_auto', async () => {
    setGame('keno'); await host.ready();
    const api = host.current()?.api;
    api.setMode('auto');
    api.setParams({ betAmount: 0.01, riskLevel: 'classic', selectedNumbers: [] });
    const none = await api.auto.start({ delayMs: 0, stepMs: 0 });
    if (none !== null) throw new Error('start bez brojeva i bez sidra je prošao');
    api.auto.setAnchor({ enabled: true, fillMode: 'cold' });
    api.auto.setAutoRules({ maxBets: 10, onLoss: { action: 'reset', value: 0 }, onWin: { action: 'reset', value: 0 }, stopConditions: {} });
    const bets0 = state.stats.bets;
    const s = await api.auto.start({ delayMs: 0, stepMs: 0 });
    if (!s || s.reason !== 'maxBets' || state.stats.bets !== bets0 + 10) throw new Error(`petlja ${s?.reason} ${state.stats.bets - bets0}`);
    if (document.querySelectorAll('#keno-board .keno-anchor').length !== 3) throw new Error('sidra na tabli');
    if (document.querySelectorAll('#keno-board .keno-selected').length !== 10) throw new Error('tiket 10');
    const NAME = `${SMOKE_NAME}_keno`;
    qs('#keno-strategy-name').value = NAME;
    const saved = await api.strategy.save();
    if (!saved || saved.name !== NAME) throw new Error('save');
    api.auto.setAnchor({ enabled: false, fillMode: 'random' });
    const loaded = await api.strategy.load(NAME);
    if (!loaded || loaded.anchor?.enabled !== true || api.auto.getAnchor().fillMode !== 'cold') throw new Error('load anchor');
    if (!(await api.strategy.remove(NAME))) throw new Error('delete');
    setGame('dice'); await host.ready();
    return true;
  });

  await check(checks, errors, 'sim_keno', async () => {
    setGame('keno'); await host.ready();
    const api = host.current()?.api;
    const NAME = `${SMOKE_NAME}_ksim`;
    api.setMode('auto');
    api.setParams({ betAmount: 1, riskLevel: 'classic', selectedNumbers: [] });
    api.auto.setAnchor({ enabled: true, fillMode: 'cold' });
    api.auto.setAutoRules({ maxBets: 0, onLoss: { action: 'increase', value: 50 }, onWin: { action: 'reset', value: 0 } });
    qs('#keno-strategy-name').value = NAME;
    if (!(await api.strategy.save())) throw new Error('save');
    switchScreen('screen-simulations');
    await simPage.refresh(NAME);
    if (qs('#sim-strategy-select').value !== NAME) throw new Error('select');
    const res = await simPage.run({ sessionsPerBudget: 3, threads: 2, maxRoundsPerSession: 20000 });
    if (!res.report || res.report.game !== 'keno' || res.report.sessionsTotal !== 36) throw new Error(`run ${JSON.stringify(res).slice(0, 200)}`);
    if (!(await window.gambitAPI.loadAnalysis('keno', NAME))) throw new Error('analiza');
    await api.strategy.remove(NAME);
    switchScreen('screen-game');
    setGame('dice'); await host.ready();
    return true;
  });

  await check(checks, errors, 'sequencer', async () => {
    switchScreen('screen-simulations');
    simPage.setMode('multi');
    if (qs('#sim-multi').hidden || !qs('#sim-solo').hidden) throw new Error('pod-tab');
    const seq = simPage.sequencer;
    seq.clear();
    seq.setStrategies([{ name: 'A', game: 'dice', type: 'solo', baseBet: 1 }, { name: 'B', game: 'dice', type: 'solo', baseBet: 1 }, { name: 'C', game: 'dice', type: 'solo', baseBet: 1 }]);
    seq.setBase('A');
    seq.addRow({ when: 'lossStreak', value: 5, switchTo: 'B' });
    seq.addRow({ when: 'balanceDrop', value: 70, switchTo: 'C', actions: { diceRaiseMultiplier: true } });
    if (document.querySelectorAll('#sequencer-conditions-container .seq-row').length !== 2) throw new Error('redovi');
    let c = seq.compile();
    if (c.type !== 'multi' || c.baseStrategy !== 'A' || c.triggers.length !== 2) throw new Error(`compile ${JSON.stringify(c)}`);
    if (c.triggers[0].when !== 'lossStreak' || c.triggers[0].value !== 5 || c.triggers[0].switchTo !== 'B') throw new Error('okidač 1');
    if (c.triggers[1].when !== 'balanceDrop' || c.triggers[1].value !== 70 || c.triggers[1].actions.diceRaiseMultiplier !== true) throw new Error('okidač 2');
    qs('#sequencer-conditions-container .seq-row .seq-remove').click();
    c = seq.compile();
    if (c.triggers.length !== 1 || c.triggers[0].switchTo !== 'C') throw new Error('uklanjanje');
    seq.clear();
    if (seq.compile().triggers.length !== 0) throw new Error('clear');
    simPage.setMode('solo');
    switchScreen('screen-game');
    return true;
  });

  await check(checks, errors, 'sim_hybrid', async () => {
    const api = host.current()?.api;
    const A = `${SMOKE_NAME}_A`;
    const B = `${SMOKE_NAME}_B`;
    const H = `${SMOKE_NAME}_H`;
    api.setMode('auto');
    api.setParams({ betAmount: 1, chance: 49.5, condition: 'over' });
    api.auto.setAutoRules({ maxBets: 0, onLoss: { action: 'increase', value: 100 }, onWin: { action: 'reset', value: 0 } });
    qs('#dice-strategy-name').value = A;
    if (!(await api.strategy.save())) throw new Error('save A');
    api.setParams({ betAmount: 0.5, chance: 75, condition: 'under' });
    api.auto.setAutoRules({ onLoss: { action: 'reset', value: 0 } });
    qs('#dice-strategy-name').value = B;
    if (!(await api.strategy.save())) throw new Error('save B');
    switchScreen('screen-simulations');
    await simPage.refresh();
    simPage.setMode('multi');
    const seq = simPage.sequencer;
    seq.clear();
    seq.setBase(A);
    seq.addRow({ when: 'lossStreak', value: 3, switchTo: B });
    seq.el.nameInput.value = H;
    const res = await simPage.run({ sessionsPerBudget: 3, threads: 2, maxRoundsPerSession: 20000 });
    if (!res.report || res.report.type !== 'multi' || res.report.strategyName !== H) throw new Error(`run ${JSON.stringify(res).slice(0, 200)}`);
    if (res.report.baseStrategy !== A) throw new Error('baseStrategy');
    const hs = res.report.representativeSession?.handovers || [];
    if (qs('#hybrid-chart').hidden || !qs('#sim-budget-chart').hidden) throw new Error('grafikoni');
    if (document.querySelectorAll('#hybrid-chart .hybrid-marker').length !== hs.length) throw new Error(`markeri ${hs.length}`);
    if (!/prebacivanja/.test(qs('#hybrid-legend').textContent)) throw new Error('legenda');
    if (!(await window.gambitAPI.loadAnalysis('dice', H))) throw new Error('analiza hibrida');
    const list = await window.gambitAPI.listStrategies('dice');
    if (!list.some((s) => s.name === H && s.type === 'multi')) throw new Error('hibrid nije u listi kao multi');
    for (const n of [A, B, H]) await window.gambitAPI.deleteStrategy('dice', n);
    simPage.setMode('solo');
    switchScreen('screen-game');
    api.setMode('manual');
    await api.strategy.refresh();
    return true;
  });

  await check(checks, errors, 'hub', async () => {
    const api = host.current()?.api;
    const D1 = `${SMOKE_NAME}_hd1`;
    const D2 = `${SMOKE_NAME}_hd2`;
    const M = `${SMOKE_NAME}_hm`;
    api.setMode('auto');
    api.setParams({ betAmount: 1, chance: 49.5, condition: 'over' });
    api.auto.setAutoRules({ maxBets: 0, onLoss: { action: 'increase', value: 100 }, onWin: { action: 'reset', value: 0 } });
    qs('#dice-strategy-name').value = D1;
    if (!(await api.strategy.save())) throw new Error('save D1');
    qs('#dice-strategy-name').value = D2;
    if (!(await api.strategy.save())) throw new Error('save D2');
    const ms = await window.gambitAPI.saveStrategy('mines', minesStrategy({ strategyName: M, baseBet: 1, minesCount: 3, selectedFields: [0, 4, 20, 24] }));
    if (!ms || ms.error) throw new Error('save M');
    switchScreen('screen-strategy-hub');
    await hub.refresh();
    hub.setFilter('all'); hub.setQuery('');
    const names = hub.getCards().map((c) => c.name);
    for (const n of [D1, D2, M]) if (!names.includes(n)) throw new Error(`kartica ${n}`);
    if (!qs('#hub-count').textContent.includes(String(document.querySelectorAll('#strategy-cards-grid .strategy-card').length))) throw new Error('brojač');
    hub.setFilter('mines');
    const mc = hub.getCards();
    if (!mc.every((c) => c.game === 'mines') || !mc.some((c) => c.name === M)) throw new Error('filter mines');
    hub.setFilter('all');
    hub.setQuery('[a(');
    hub.setQuery(`${SMOKE_NAME}_hd`);
    if (hub.getCards().length !== 2 || document.querySelectorAll('#strategy-cards-grid .strategy-card').length !== 2) throw new Error('pretraga');
    if (!qs(`.strategy-card[data-name="${D1}"]`).dataset.filePath.endsWith(`data/dice/${D1}.json`)) throw new Error('data-file-path');
    hub.setQuery('');
    switchScreen('screen-game');
    return true;
  });

  await check(checks, errors, 'hub_rank', async () => {
    const D1 = `${SMOKE_NAME}_hd1`;
    const D2 = `${SMOKE_NAME}_hd2`;
    const M = `${SMOKE_NAME}_hm`;
    switchScreen('screen-simulations');
    simPage.setMode('solo');
    const res = await simPage.run({ strategyName: D1, sessionsPerBudget: 2, threads: 2, maxRoundsPerSession: 20000 });
    if (!res.report) throw new Error('sim');
    switchScreen('screen-strategy-hub');
    await hub.refresh();
    hub.setQuery(`${SMOKE_NAME}_h`);
    const cards = hub.getCards();
    if (cards.length !== 3) throw new Error(`kartice ${cards.length}`);
    if (cards[0].name !== D1 || !cards[0].tested) throw new Error(`testirana nije prva: ${cards.map((c) => c.name)}`);
    if (cards.slice(1).some((c) => c.tested)) throw new Error('netestirane posle');
    const el = qs(`.strategy-card[data-name="${D1}"]`);
    if (!el.classList.contains('tested')) throw new Error('klasa tested');
    if (el.classList.contains('recommended') !== (cards[0].score > 70)) throw new Error('recommended bedž');
    if (!/%$/.test(el.querySelector('.sc-score').textContent)) throw new Error('procenat');
    hub.setQuery('');
    for (const [g, n] of [['dice', D1], ['dice', D2], ['mines', M]]) await window.gambitAPI.deleteStrategy(g, n);
    await hub.refresh();
    switchScreen('screen-game');
    host.current()?.api?.setMode('manual');
    await host.current()?.api?.strategy?.refresh();
    return true;
  });

  await check(checks, errors, 'hub_panel', async () => {
    const api = host.current()?.api;
    const D = `${SMOKE_NAME}_hp`;
    api.setMode('auto');
    api.setParams({ betAmount: 0.05, chance: 49.5, condition: 'over' });
    api.auto.setAutoRules({ maxBets: 1000, onLoss: { action: 'increase', value: 100 }, onWin: { action: 'reset', value: 0 }, stopConditions: { takeProfit: 50, stopLoss: 20 } });
    qs('#dice-strategy-name').value = D;
    if (!(await api.strategy.save())) throw new Error('save');
    switchScreen('screen-strategy-hub');
    await hub.refresh();
    hub.setQuery(D);
    qs(`.strategy-card[data-name="${D}"]`).click();
    await new Promise((r) => setTimeout(r, 150));
    const panel = qs('#hub-panel');
    if (!panel.classList.contains('open')) throw new Error('panel nije otvoren');
    if (!qs('#hub-panel-title').textContent.includes(D)) throw new Error('naslov');
    const rulesText = qs('#hub-panel-rules').textContent;
    if (!/Početni ulog\s*0\.05/.test(rulesText) || !/Povećaj za 100%/.test(rulesText) || !/Take Profit 50/.test(rulesText)) throw new Error(`pravila: ${rulesText}`);
    if (!/Podaci nedostupni/.test(qs('#hub-panel-risk').textContent)) throw new Error('rizik netestirane');
    hubPanel.close();
    if (panel.classList.contains('open')) throw new Error('close');
    if (!(await hubPanel.open(hub.find(D, 'dice')))) throw new Error('open()');
    if (!(await hubPanel.delete({ confirm: false }))) throw new Error('delete');
    await new Promise((r) => setTimeout(r, 150));
    if (panel.classList.contains('open') || qs(`.strategy-card[data-name="${D}"]`)) throw new Error('posle brisanja');
    hub.setQuery('');
    switchScreen('screen-game');
    api.setMode('manual');
    await api.strategy.refresh();
    return true;
  });

  await check(checks, errors, 'hub_inject', async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const dice = host.current()?.api;
    dice.setMode('auto');
    dice.setParams({ betAmount: 0.01, chance: 49.5, condition: 'over' });
    dice.auto.setAutoRules({ maxBets: 0, onLoss: { action: 'reset', value: 0 }, onWin: { action: 'reset', value: 0 }, stopConditions: {} });
    dice.auto.start({ delayMs: 5 });
    await sleep(40);
    if (!dice.auto.isRunning()) throw new Error('dice petlja nije krenula');
    const MN = `${SMOKE_NAME}_inj`;
    const M = minesStrategy({ strategyName: MN, baseBet: 0.25, minesCount: 3, selectedFields: [0, 4, 20, 24], onLoss: { action: 'increase', value: 100 } });
    const ms = await window.gambitAPI.saveStrategy('mines', M);
    if (!ms || ms.error) throw new Error('save M');
    const r = await injectStrategy({ ...M, strategyName: ms.name }, injectCtx());
    if (!r.ok) throw new Error(`inject ${r.error}`);
    if (dice.auto.isRunning()) throw new Error('dice petlja nije zaustavljena pre učitavanja');
    if (state.game !== 'mines' || host.current()?.name !== 'mines' || currentScreen() !== 'screen-game') throw new Error('nije prebačeno na mines');
    if (qs('#game-select').value !== 'mines') throw new Error('topbar select');
    const api = host.current().api;
    if (api.getMode() !== 'auto' || !qs('#mines-tab-auto').classList.contains('active')) throw new Error('Auto tab');
    if (JSON.stringify(api.auto.getSelectedFields()) !== '[0,4,20,24]' || document.querySelectorAll('#mines-grid .field-selected').length !== 4) throw new Error('polja');
    if (qs('#mines-bet').value !== '0.25' || api.auto.getAutoRules().onLoss.action !== 'increase') throw new Error('ulog/pravila');
    if (qs('#mines-strategy-select').value !== ms.name) throw new Error('select strategije');
    // ista igra: mines auto radi → inject druge mines strategije mora zaustaviti petlju pre punjenja
    api.auto.setAutoRules({ maxBets: 0 });
    api.auto.start({ delayMs: 5 });
    await sleep(40);
    if (!api.auto.isRunning()) throw new Error('mines petlja nije krenula');
    const r1b = await injectStrategy({ ...M, strategyName: ms.name, baseBet: 0.5 }, injectCtx());
    if (!r1b.ok || api.auto.isRunning() || qs('#mines-bet').value !== '0.5') throw new Error('inject iste igre nije zaustavio petlju');
    // Simulacije: lista se osvežava na strategies-changed bez ručnog refresh-a
    if (![...qs('#sim-strategy-select').options].some((o) => o.value === ms.name)) throw new Error('sim select nije osvežen');
    // hibrid → Simulacije / Multi
    const A = `${SMOKE_NAME}_ia`; const B = `${SMOKE_NAME}_ib`; const H = `${SMOKE_NAME}_ih`;
    const { diceStrategy: mk } = await import('../../shared/strategy_schema.js');
    for (const n of [A, B]) { const s = await window.gambitAPI.saveStrategy('dice', mk({ strategyName: n, baseBet: 1 })); if (!s || s.error) throw new Error(`save ${n}`); }
    const hyb = hybridStrategy({ game: 'dice', strategyName: H, baseStrategy: A, triggers: [{ when: 'lossStreak', value: 4, switchTo: B }] });
    const hs = await window.gambitAPI.saveStrategy('dice', hyb);
    if (!hs || hs.error) throw new Error(`save H ${hs?.error}`);
    const r2 = await injectStrategy(hyb, injectCtx());
    if (!r2.ok || currentScreen() !== 'screen-simulations' || simPage.getMode() !== 'multi') throw new Error('hibrid inject');
    const c = simPage.sequencer.compile();
    if (c.baseStrategy !== A || c.triggers.length !== 1 || c.triggers[0].switchTo !== B || qs('#seq-name').value !== H) throw new Error(`sekvencer ${JSON.stringify(c)}`);
    // nevalidna (23 polja za 3 mine) → greška, igra ostaje dice
    switchScreen('screen-game'); setGame('dice'); await host.ready();
    const bad = await injectStrategy(minesStrategy({ strategyName: 'x', baseBet: 1, minesCount: 3, selectedFields: Array.from({ length: 23 }, (_, i) => i) }), injectCtx());
    if (bad.ok || state.game !== 'dice') throw new Error('nevalidna prošla');
    for (const [g, n] of [['mines', ms.name], ['dice', A], ['dice', B], ['dice', H]]) await window.gambitAPI.deleteStrategy(g, n);
    simPage.setMode('solo');
    host.current()?.api?.setMode('manual');
    await host.current()?.api?.strategy?.refresh();
    return true;
  });

  await check(checks, errors, 'bench', async () => {
    setGame('dice'); await host.ready();
    const api = host.current()?.api;
    const NAME = `${SMOKE_NAME}_bench`;
    api.setMode('auto');
    api.setParams({ betAmount: 1, chance: 49.5, condition: 'over' });
    qs('#dice-strategy-name').value = NAME;
    if (!(await api.strategy.save())) throw new Error('save');
    switchScreen('screen-simulations');
    simPage.setMode('solo');
    await simPage.refresh(NAME);
    const hw = await window.gambitAPI.getHardware();
    const range = qs('#sim-threads');
    if (Number(range.max) !== hw.maxAllowed || hw.maxAllowed > 14) throw new Error(`max ${range.max}/${hw.maxAllowed}`);
    if (!/Preporučeno/.test(qs('#sim-threads-text').textContent)) throw new Error('tekst');
    simPage.threadCtl.set(2);
    let lockedDuring = null; // stanje slajdera u trenutku prve progres poruke (simulacija još radi)
    const off = window.gambitAPI.onSimProgress(() => { if (lockedDuring === null) lockedDuring = range.disabled; });
    const res = await simPage.run({ sessionsPerBudget: 2, maxRoundsPerSession: 20000 });
    off();
    if (lockedDuring !== true) throw new Error(`slajder nije zaključan tokom rada (${lockedDuring})`);
    if (!res.report || res.report.benchmark.threads !== 2 || res.report.benchmark.workerMode !== 'processes') throw new Error(`bench ${JSON.stringify(res.report?.benchmark)}`);
    if (range.disabled) throw new Error('slajder ostao zaključan');
    const card = qs('#sim-benchmark').textContent;
    if (!/krugova\/sek/.test(card) || !/Status stabilnosti/.test(card) || !/Procesi × 2/.test(card)) throw new Error(`kartica: ${card}`);
    const rows = await window.gambitAPI.benchmarkHistory(5);
    if (!Array.isArray(rows) || !rows.some((r) => r.strategy === NAME && r.threads === 2)) throw new Error('istorija');
    range.value = '99';
    const res2 = await simPage.run({ sessionsPerBudget: 1, maxRoundsPerSession: 5000, workerMode: 'threads' });
    if (!res2.report || res2.report.benchmark.threads > hw.maxAllowed || res2.report.benchmark.workerMode !== 'threads') throw new Error('klamp/threads');
    await api.strategy.remove(NAME);
    switchScreen('screen-game');
    api.setMode('manual');
    return true;
  });

  return { checks, errors };
}

async function boot() {
  mountTitleBar(document.getElementById('wc-root'), window.gambitAPI);

  const res = await window.gambitAPI.ping();
  console.log('IPC ping:', JSON.stringify(res));

  const sidebar = mountSidebar(document.getElementById('sidebar'), (screenId) => switchScreen(screenId));
  mountTopbar(document.getElementById('topbar'));
  initRouter({
    defaultScreen: res.screen || 'screen-game',
    onChange: (id) => sidebar.setActive(id),
  });

  const panels = gamePanels();
  mountLiveStats(panels.right);
  mountProfitChart(panels.center.chart);
  mountWinFlash(panels.center.render);
  // Zvuk na ishod kruga za sve igre (Dice, Mines, Keno)
  subscribe((key, s, result) => {
    if (key !== 'round' || !result) return;
    if (result.isWin) playWin(); else playLose();
  });
  registerGame('dice', diceGame);
  registerGame('mines', minesGame);
  registerGame('keno', kenoGame);
  host = mountGameHost(panels);
  await host.ready();
  simPage = mountSimPage(qs('#sim-root'));
  hub = mountHub(qs('#hub-root'), {
    onOpen: (entry) => hubPanel.open(entry),
    // biblioteka osvežena (analiza završena, brisanje…) → otvoren panel se ponovo puni ili zatvara ako je kartica nestala
    onRefreshed: (all) => {
      const cur = hubPanel?.current();
      if (!cur || !hubPanel.isOpen()) return;
      const fresh = all.find((e) => e.name === cur.entry.name && e.game === cur.entry.game);
      if (fresh) hubPanel.open(fresh); else hubPanel.close();
    },
  });
  hubPanel = createPanel(hub.el.side, {
    indexOf: (entry) => hub.getAll().findIndex((e) => e.name === entry.name && e.game === entry.game),
    onLoad: (_entry, strategy) => { hubPanel.close(); injectStrategy(strategy, injectCtx()); },
  });

  if (res.smoke) {
    const report = await runSelfTest();
    switchScreen(res.screen || 'screen-game');
    window.gambitAPI.smokeReport(report);
  }
}

window.addEventListener('error', (e) => console.error('window.onerror:', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('unhandledrejection:', e.reason?.message || e.reason));

boot().catch((e) => {
  console.error('boot:', e.message);
  if (window.gambitAPI?.smokeReport) window.gambitAPI.smokeReport({ checks: {}, errors: [`boot: ${e.message}`] });
});
