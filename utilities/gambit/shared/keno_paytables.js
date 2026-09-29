// Keno isplatne tablice: PAYTABLES[risk][picks] = [mult za 0 pogodaka, 1, …, picks].
// 10 izabranih za classic/high su TAČNO po spec-u (korak 19). Ostale su Stake-slične vrednosti (1% kućne
// prednosti nije garantovano za svaku) — JEDINI izvor istine; slobodno menjati ovde, UI i simulator ih čitaju.
// Tabla je 40 brojeva, izvlači se 10 (Stake standard; korisnikova ispravka 2026-09-27 — spec fajlovi su pisali 80/20).
export const RISKS = ['classic', 'low', 'medium', 'high'];
export const FILL_MODES = ['random', 'cold'];
export const MAX_PICKS = 10;
export const DRAW_COUNT = 10;
export const BOARD = 40;

export const PAYTABLES = {
  classic: {
    1: [0, 3.96],
    2: [0, 1.9, 4.5],
    3: [0, 1, 3.1, 10.4],
    4: [0, 0.8, 1.8, 5, 22.6],
    5: [0, 0.25, 1.4, 4.1, 16.5, 36],
    6: [0, 0, 1, 3.68, 7, 16.5, 40],
    7: [0, 0, 0.47, 3, 4.5, 14, 31, 60],
    8: [0, 0, 0, 2.2, 4, 13, 22, 55, 70],
    9: [0, 0, 0, 1.55, 3, 8, 15, 44, 60, 85],
    // Spec (korak 19) daje [0,0,0,0,0.5,1,2,5,15,100,1000] uz tvrdnju „1% kućne prednosti“, ali na tabli 40/10 taj red
    // vraća samo 13% (P(≥4 pogotka od 10) ≈ 20%). Ovo je Stake-ov red za 40/10 (RTP ≈ 99%); oblik iz spec-a je zadržan
    // (isplata od 4 pogotka, 10/10 = 1000×). Pregled Faze 4, ruling 2026-09-27.
    10: [0, 0, 0, 0, 3.5, 8, 13, 63, 500, 800, 1000],
  },
  low: {
    1: [0.7, 1.85],
    2: [0, 2, 3.8],
    3: [0, 1.1, 1.38, 26],
    4: [0, 0, 2.2, 7.9, 90],
    5: [0, 0, 1.5, 4.2, 13, 300],
    6: [0, 0, 1.1, 2, 6.2, 100, 700],
    7: [0, 0, 1.1, 1.6, 3.5, 15, 225, 700],
    8: [0, 0, 1.1, 1.5, 2, 5.5, 39, 100, 800],
    9: [0, 0, 1.1, 1.3, 1.7, 2.5, 7.5, 50, 250, 1000],
    10: [0, 0, 1.1, 1.2, 1.3, 1.8, 3.5, 13, 50, 250, 1000],
  },
  medium: {
    1: [0.4, 2.75],
    2: [0, 1.8, 5.1],
    3: [0, 0, 2.8, 50],
    4: [0, 0, 1.7, 10, 100],
    5: [0, 0, 1.4, 4, 14, 390],
    6: [0, 0, 0, 3, 9, 180, 710],
    7: [0, 0, 0, 2, 7, 30, 400, 800],
    8: [0, 0, 0, 2, 4, 11, 67, 400, 900],
    9: [0, 0, 0, 2, 2.5, 5, 15, 100, 500, 1000],
    10: [0, 0, 0, 1.6, 2, 4, 7, 26, 100, 500, 1000],
  },
  high: {
    1: [0, 3.96],
    2: [0, 0, 17.1],
    3: [0, 0, 0, 81.5],
    4: [0, 0, 0, 10, 259],
    5: [0, 0, 0, 4.5, 48, 450],
    6: [0, 0, 0, 0, 11, 350, 710],
    7: [0, 0, 0, 0, 7, 90, 400, 800],
    8: [0, 0, 0, 0, 5, 20, 270, 600, 900],
    9: [0, 0, 0, 0, 4, 11, 56, 500, 800, 1000],
    // Spec daje [0,0,0,0,0,4,9,35,180,600,1000] (RTP 25% na 40/10); isti oblik (isplata od 5 pogodaka, 10/10 = 1000×)
    // skaliran ×3.88 na RTP ≈ 99%, gornji redovi ograničeni na 1000×. Pregled Faze 4, ruling 2026-09-27.
    10: [0, 0, 0, 0, 0, 15.5, 35, 136, 700, 1000, 1000],
  },
};

export function paytableFor(risk, picks) {
  const t = PAYTABLES[risk]?.[picks];
  return t ? [...t] : [];
}

export function payout(risk, picks, hits) {
  const t = PAYTABLES[risk]?.[picks];
  if (!t) return 0;
  const m = t[Number(hits)];
  return Number.isFinite(m) ? m : 0;
}
