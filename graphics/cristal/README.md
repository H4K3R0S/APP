# Cristal

Samostalni, **kompaktan i moćan** foto editor u duhu **PhotoDemon-a**
(photodemon.org) — brz, bez teškog instalera — ali sa **modernim tamnim UI-jem**
kao na referencama, i sa **integracijom** za razmenu sa drugim app-ovima
(Screenshot → otvori snimak; Nabavka → uredi sliku proizvoda…).

## Dokumentacija (pročitaj redom)
- **`DIZAJN.md`** — vizija, funkcije po nivoima (MVP → PhotoDemon-lite → prošireno),
  UI raspored mapiran na reference, arhitektura, formati, faze izrade, moji predlozi.
- **`IZGRADNJA.md`** — korak-po-korak *kako* se pravi: komande, redosled F1→F6,
  Tauri omotač za `.exe`. (`DIZAJN.md` je *šta/zašto*, ovo je *kako*.)
- **`INTEGRACIJA.md`** — app-bus + handoff protokol (kako Cristal prima sliku
  iz Screenshot-a i kako povezati SVE app-ove jednim protokolom).

## Skelet (F1 — postoji u `gui/`)
Radna referenca, ne finalna aplikacija: glass ljuska + `<canvas>` engine
(brush/pen/eraser, pan, zoom, osvetljenje/kontrast/zasićenost, izvoz PNG). Izgled
poklapa reference. Pokretanje: `cd gui && npm install && npm run dev` (localhost:5175).
Nastavak izgradnje: `IZGRADNJA.md`.

## Reference (u `reference/`)
- `photo editor.png` — PhotoDemon (funkcionalni uzor: obim alata + kompaktnost).
- `Photo editor 2.jpg` — Queble (uzor za izgled: tamni UI, paneli, properties).
- `Photo editor 3.jpg` — PXDX photo.workshop (uzor: Assets/Layers, AI editor, krive).

## Tehnologija
Tauri 2 (Rust jezgro za nativni I/O + web GUI sa `<canvas>`/WebGL za render).
`.exe` se dobija `cargo build --release`. Postojeći MVP editor u CORE-u
(`apps/gui/src/features/photoEditor/*` + `pages/PhotoEditorPage.tsx`) je polazna
tačka (Nivo 0) — prepakovati u standalone i proširiti po `DIZAJN.md`.

## Cilj u jednoj rečenici
Brz, jednostavan a moćan editor (slojevi, nedestruktivna podešavanja, filteri,
tekst, paint, macro/batch) sa modernim glass UI-jem i lokalnom integracijom
između app-ova.
