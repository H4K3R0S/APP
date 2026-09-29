// Strategy Hub (koraci 26–27): mreža kartica (sve igre + hibridi), pretraga, filter po igri, brojač, rangiranje.
// ZAKON virtuelizacije: preko 60 kartica renderuje se vidljivo + ~10% i dopunjava na skrol.
import { h, fmt } from '../ui/dom.js';
import { subscribe } from '../state.js';
import { rankStrategies, scoreOf, RECOMMEND_THRESHOLD } from '../../../shared/ranking.js';

const GAME_LABEL = { dice: '🎲 Dice', mines: '💣 Mines', keno: '🔢 Keno' };
const VIRTUAL_FROM = 60;
const CHUNK = 24;

export function mountHub(root, { onOpen, onRefreshed } = {}) {
  const search = h('input', { id: 'hub-search', type: 'search', placeholder: '🔍 Pretraži strategije...' });
  const count = h('span', { id: 'hub-count' }, 'Ukupno u biblioteci: 0');
  const filter = h('select', { id: 'hub-filter' },
    h('option', { value: 'all' }, 'SVE'), h('option', { value: 'dice' }, 'DICE'), h('option', { value: 'mines' }, 'MINES'), h('option', { value: 'keno' }, 'KENO'));
  const grid = h('div', { id: 'strategy-cards-grid', class: 'strategy-cards-grid' });
  const gridWrap = h('div', { class: 'hub-grid-wrap' }, grid);
  const side = h('div', { id: 'hub-side' });
  root.replaceChildren(
    h('div', { class: 'hub-bar' }, search, count, h('label', { class: 'hub-filter-lbl' }, 'Izaberi igru', filter)),
    h('div', { class: 'hub-body' }, gridWrap, side),
  );

  let all = [];
  let visible = [];
  let renderCount = 0;

  function card(e) {
    const score = scoreOf(e);
    const rec = !!e.summary && score > RECOMMEND_THRESHOLD;
    const cls = e.summary ? (score >= 70 ? 'good' : score >= 30 ? 'mid' : 'bad') : 'none';
    const el = h('div', { class: `strategy-card ${rec ? 'recommended' : ''} ${e.summary ? 'tested' : 'untested'}`, dataset: { name: e.name, game: e.game, type: e.type, filePath: `data/${e.game}/${e.name}.json` } },
      rec ? h('span', { class: 'badge-rec' }, '🌟 PREPORUČENO') : null,
      h('div', { class: 'sc-name', title: e.name }, e.name),
      h('div', { class: 'sc-meta' }, h('span', { class: `sc-type ${e.type}` }, e.type === 'multi' ? '⛓ Multi-Strategy' : 'Solo'), h('span', { class: 'sc-game' }, GAME_LABEL[e.game] || e.game)),
      h('div', { class: `sc-score ${cls}` }, e.summary ? `${fmt(score, 1)}%` : '0%'),
      h('div', { class: 'sc-sub' }, e.summary ? `Tier 3 (5×) · najgori niz ${e.summary.maxLossStreak}` : 'Netestirano'),
    );
    el.addEventListener('click', () => {
      for (const c of grid.querySelectorAll('.strategy-card.selected')) c.classList.remove('selected');
      el.classList.add('selected');
      if (onOpen) onOpen(e);
    });
    return el;
  }

  function fill() {
    const target = Math.min(visible.length, renderCount);
    const have = grid.children.length;
    for (let i = have; i < target; i++) grid.append(card(visible[i]));
  }
  function renderGrid() {
    grid.replaceChildren();
    renderCount = visible.length > VIRTUAL_FROM ? CHUNK : visible.length;
    fill();
    count.textContent = `Ukupno u biblioteci: ${visible.length}`;
    grid.classList.toggle('empty', visible.length === 0);
    if (!visible.length) grid.append(h('p', { class: 'hub-empty' }, 'Nema strategija — sačuvaj strategiju na ekranu igre ili promeni filter.'));
  }
  gridWrap.addEventListener('scroll', () => {
    if (renderCount >= visible.length) return;
    if (gridWrap.scrollTop + gridWrap.clientHeight >= gridWrap.scrollHeight - 200) { renderCount += CHUNK; fill(); }
  });

  function applyFilters() {
    const q = search.value.trim().toLowerCase(); // podstring, ne regex — specijalni karakteri su bezbedni
    const g = filter.value;
    const ordered = rankStrategies(all).ordered;
    visible = ordered.filter((e) => (g === 'all' || e.game === g) && (!q || e.name.toLowerCase().includes(q)));
    renderGrid();
  }

  let refreshGen = 0;
  const api = {
    el: { search, count, filter, grid, side, gridWrap },
    async refresh() {
      const gen = ++refreshGen; // preklopljeni refresh-evi (delete + kraj simulacije): važi samo najnoviji
      const list = await window.gambitAPI.listAllStrategies();
      if (gen !== refreshGen) return all;
      all = Array.isArray(list) ? list : [];
      applyFilters();
      if (onRefreshed) onRefreshed(all);
      return all;
    },
    setFilter(g) { filter.value = g; applyFilters(); },
    setQuery(q) { search.value = q; applyFilters(); },
    getCards: () => visible.map((e) => ({ name: e.name, game: e.game, type: e.type, score: scoreOf(e), tested: !!e.summary, recommended: !!e.summary && scoreOf(e) > RECOMMEND_THRESHOLD })),
    getAll: () => all,
    find: (name, game) => all.find((e) => e.name === name && (!game || e.game === game)) || null,
  };

  search.addEventListener('input', applyFilters);
  filter.addEventListener('change', applyFilters);
  subscribe((key) => { if (key === 'strategies-changed') api.refresh(); });
  api.refresh();
  return api;
}
