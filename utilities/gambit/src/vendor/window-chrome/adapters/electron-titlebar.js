// electron-titlebar.js — renderer helper: ubaci traku i veže dugmad.
// Framework-neutralno (vanilla DOM). Za React app postoji .tsx varijanta
// (vidi README / KALIMA TitleBar).
//
// Upotreba:
//   import { mountTitleBar } from '.../electron-titlebar.js';
//   mountTitleBar(document.getElementById('wc-root'), window.winChrome);
// gde `api` ima winMinimize / winMaxToggle / winClose (Promise-e).

/**
 * @param {HTMLElement} rootEl  kontejner (postaje .wc-titlebar)
 * @param {{winMinimize:Function, winMaxToggle:Function, winClose:Function}} api
 */
function mountTitleBar(rootEl, api) {
  if (!rootEl) throw new Error('mountTitleBar: rootEl nije prosleđen');
  rootEl.classList.add('wc-titlebar');
  rootEl.innerHTML = `
    <div class="wc-controls">
      <button type="button" class="wc-btn wc-btn--min" aria-label="Minimizuj"><span class="wc-glyph" aria-hidden="true"></span></button>
      <button type="button" class="wc-btn wc-btn--max" aria-label="Maksimizuj"><span class="wc-glyph" aria-hidden="true"></span></button>
      <button type="button" class="wc-btn wc-btn--close" aria-label="Zatvori"><span class="wc-glyph" aria-hidden="true"></span></button>
    </div>`;

  rootEl.querySelector('.wc-btn--min').addEventListener('click', () => api.winMinimize());
  rootEl.querySelector('.wc-btn--max').addEventListener('click', () => api.winMaxToggle());
  rootEl.querySelector('.wc-btn--close').addEventListener('click', () => api.winClose());

  // Dvoklik na traku (ne na dugme) → toggle maximize, kao OS ponašanje.
  rootEl.addEventListener('dblclick', (e) => {
    if (e.target.closest('.wc-btn')) return;
    api.winMaxToggle();
  });
}

// ESM (Gambit koristi <script type="module">, Workplace bundluje).
export { mountTitleBar };
