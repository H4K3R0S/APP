// Sidebar: tri dugmeta (Igra / Simulacije / Strategy Hub). Klik → onSelect(screenId).
export function mountSidebar(el, onSelect) {
  const buttons = [...el.querySelectorAll('.nav-btn')];
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      console.log('sidebar:', btn.dataset.screen);
      onSelect(btn.dataset.screen);
    });
  }
  return {
    setActive(screenId) {
      for (const btn of buttons) btn.classList.toggle('active', btn.dataset.screen === screenId);
    },
  };
}
