// „Učitaj u ekran igre“ (korak 29): solo strategija → ekran igre + igra + Auto tab + polja/mreža/tabla;
// hibrid → Simulacije / Multi sa popunjenim sekvencerom. Ne pokreće igru — korisnik klikće start.
import { toast } from '../ui/toast.js';
import { validateStrategy } from '../../../shared/strategy_schema.js';

export async function injectStrategy(strategy, { host, simPage, switchScreen, setGame }) {
  const v = validateStrategy(strategy);
  if (!v.ok) {
    toast(`Strategija nije validna: ${v.errors[0]}`, 'error');
    return { ok: false, error: v.errors.join('; ') };
  }
  const name = strategy.strategyName;

  if (strategy.type === 'multi') {
    switchScreen('screen-simulations');
    setGame(strategy.game);
    await host.ready(); // zaustavlja auto petlju prethodne igre (unmount) pre punjenja
    await simPage.refresh();
    simPage.setMode('multi');
    const seq = simPage.sequencer;
    seq.clear();
    seq.setBase(strategy.baseStrategy);
    for (const t of strategy.triggers || []) seq.addRow(t);
    seq.el.nameInput.value = name;
    toast(`Hibrid „${name}“ učitan u sekvencer — klikni pokretanje kad pregledaš uslove.`, 'ok');
    return { ok: true, target: 'sequencer' };
  }

  switchScreen('screen-game');
  // ista igra već aktivna → setGame je no-op i unmount se ne dešava: zaustavi živu auto petlju pre punjenja polja
  const before = host.current();
  if (before?.name === strategy.game && before.api?.auto?.isRunning()) await before.api.auto.loop.stopAndWait();
  setGame(strategy.game);
  await host.ready();
  const current = host.current();
  if (!current || current.name !== strategy.game || !current.api?.strategy) {
    toast('Ekran igre nije spreman', 'error');
    return { ok: false, error: 'igra nije montirana' };
  }
  const api = current.api;
  const loaded = await api.strategy.apply(strategy); // primeni prosleđeni objekat strategije (parametri + uslovi) i izaberi u listi
  if (!loaded) { toast('Učitavanje strategije nije uspelo', 'error'); return { ok: false, error: 'apply' }; }
  toast(`Strategija „${name}“ uspešno učitana u auto-pilot!`, 'ok');
  return { ok: true, target: 'game' };
}
