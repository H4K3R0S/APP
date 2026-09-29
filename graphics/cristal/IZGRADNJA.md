# Izgradnja — korak po korak

Praktično uputstvo kako da se Cristal napravi do kraja. `DIZAJN.md` govori
*šta* i *zašto*; ovaj fajl govori *kako* — komande, redosled, tačke gde se svaki
komad kači na sledeći. Skelet (F1) već postoji u `gui/` kao živa referenca — čita
se, ne prepisuje.

> Konvencija: sav pikselni rad je u `gui/src/editor/`. React je samo ljuska
> (topbar/paneli), pikseli su `<canvas>` (2D sad, WebGL kad slike pređu ~2MP).

---

## 0. Preduslovi

- **Node 18+** i **npm** (za GUI). Provera: `node -v`, `npm -v`.
- **Rust + cargo** (za `.exe` preko Tauri-ja). Provera: `cargo --version`.
- **Tauri 2 CLI**: `cargo install tauri-cli --version "^2"` (ili `npm i -D @tauri-apps/cli@^2`).
- Windows build alati (MSVC) — dolaze uz Visual Studio Build Tools.

---

## 1. GUI kostur (F1 — POSTOJI)

Već napravljeno u `gui/`, koristi kao osnovu:

```
gui/
  index.html
  package.json          # react 19, lucide-react, vite 6
  vite.config.ts        # base "./", port 5175, VITE_CORE_API_URL=""
  tsconfig.json
  src/
    main.tsx            # mount <App/> + styles.css
    App.tsx             # glass ljuska: topbar, levi rail (9 alata), paneli, desni properties
    styles.css          # dark glass tema (uzor Queble/PXDX)
    editor/
      types.ts          # Tool, Stroke, Layer, Adjustments, NEUTRAL_ADJ
      Canvas.tsx        # render engine: brush/pen/eraser, move/pan, wheel zoom, izvoz PNG
```

Pokretanje i build:

```bash
cd gui
npm install
npm run dev        # http://localhost:5175 (razvoj)
npm run build      # dist/ (produkcija, za Tauri)
```

**Šta F1 već radi:** otvori sliku, crtaj (brush/pen/eraser), pan (move alat), zoom
(točkić + donji dok), podešavanja osvetljenje/kontrast/zasićenost kao live CSS-filter
preview, izvoz PNG sa primenjenim filterom.

**Interfejs koji ostatak koristi** (`Canvas.tsx`):
```ts
CanvasHandle = {
  ucitajSliku: (file: File) => void;
  izveziPng: () => void;
  novoPlatno: (w: number, h: number) => void;
}
// props: { tool, color, brushSize, adjustments, zoom, onZoom }
```

---

## 2. Prelazak na nedestruktivni model (uraditi PRE F2)

Skelet crta direktno u jedan `<canvas>` (`strokesRef`). Pre slojeva prebaci render na
model *„slika = stek slojeva + stek podešavanja"*, jer je kasnije dodavanje bolno
(vidi `DIZAJN.md` §8).

1. Novi fajl `editor/model.ts`: tip `Projekat = { slojevi: Layer[], adjustments: Adjustments, crop? }`.
   Sloj dobija svoje piksele: `Layer` proširi sa `canvas: HTMLCanvasElement` (offscreen)
   ili `ImageBitmap`.
2. Novi `editor/compose.ts`: `compose(projekat, ctx)` — iscrtaj slojeve po redu
   (opacity + `globalCompositeOperation` za blend), pa primeni podešavanja na kraju.
3. `Canvas.tsx` više ne drži `strokesRef`; poziva `compose()` na svaku promenu.
   Crtanje ide u *aktivni* sloj (njegov offscreen canvas), ne u glavni.
4. Novi `editor/history.ts`: stek komandi (`{ do, undo }` patch). Undo/redo = pomeraj
   pokazivača po steku. Topbar undo/redo dugmad zakači ovde.

Test posle koraka: otvori sliku (postane sloj „Osnova"), crtaj (novi sloj „Crtež"),
undo vrati potez, redo ga vrati nazad.

---

## 3. F2 — slojevi + selekcije

- **Panel slojeva** (već stoji staticki u `App.tsx` tab „Slojevi"): poveži na
  `projekat.slojevi` — dodaj/obriši/redosled (drag), opacity slajder, vidljivost (oko),
  blend mode dropdown (Normal/Multiply/Screen/Overlay).
- **Selekcije**: novi `editor/selection.ts` — pravougaonik/elipsa/laso + „magic wand"
  (flood po boji, tolerancija). Selekcija je maska (`Uint8` ili 1-bit canvas).
- Alati poštuju selekciju: crop/fill/filter deluju samo unutar maske. `feather` = blur maske.

Test: nacrtaj pravougaonu selekciju, popuni bojom → samo unutar selekcije se boji.

---

## 4. F3 — podešavanja + filteri (real-time)

- `editor/adjustments/` — svako podešavanje = čista funkcija nad pikselima + UI panel:
  Brightness/Contrast (imaš u skeletu kao CSS), Levels, **Curves** (krive kao PXDX),
  Hue/Sat/Lightness, Exposure, Shadows/Highlights, B&W, Invert, Threshold.
- `editor/filters/` — Gaussian/Box/Motion blur, Sharpen/Unsharp, Noise, Vignette,
  Pixelate, Emboss, Edge detect.
- **WebGL** (`editor/gl.ts`): kad slika > ~2MP, filteri idu na shader (regl/twgl ili sirovo)
  radi live preview-a. 2D fallback za male slike.
- **Preview bez commit-a**: dok vučeš slajder → render na preview; na „Primeni" → jedan
  history korak (§2.4).

Test: povuci Curves → slika se menja u realnom vremenu; „Primeni" → jedan undo korak.

---

## 5. F4 — paint + tekst + transform

- Paint: brush (tvrdoća/opacity), pencil (imaš), eraser (imaš), **bucket fill** (flood),
  **gradient**, **clone stamp**, color picker (pipeta).
- Tekst: sloj teksta (font/veličina/boja/poravnanje/bold-italic/senka — kao Queble
  „Projection/Inner shadow"). Renderuj kroz `fillText` u sloj.
- Transform: resize (interpolacija), canvas size, rotate/flip, free transform sloja,
  perspektiva/skew.

---

## 6. F5 — integracija (vidi `INTEGRACIJA.md`)

Redosled iz `INTEGRACIJA.md`:
1. **A) `--open <put>` + single-instance** — najbrže za Screenshot→Photo. U Rust
   `lib.rs` pročitaj `std::env::args()`, nađi `--open`, prosledi web sloju
   (`app.emit("open-file", put)`), web učita sliku kao novi projekat.
2. **B) inbox watch** — kad app treba da radi i dok je otvoren (`_shared/inbox/photo-editor/`).
3. **C) app-bus (mali HTTP port)** — kad treba odgovor nazad (Nabavka round-trip).
   Registar portova `Desktop\APP\_shared\registry.json`.

---

## 7. F6 — prošireno (izdvaja ga)

Adjustment layers (nedestruktivni), maske sloja, **macro/batch** (snimi korake → primeni
na folder), preset galerija („looks"), content-aware fill (Rust komanda), AI kuka iza
feature-flag-a (lokalni model, npr. IMPERIUM Flux/ComfyUI).

---

## 8. Tauri omotač (kad treba `.exe`)

GUI radi i sam u browseru; za nativni prozor + fajl I/O + clipboard treba Tauri.

1. U korenu app-a: `npm create tauri-app@latest` ILI ručno napravi `src-tauri/`
   (`Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`).
2. `tauri.conf.json`:
   - `build.frontendDist` = `../gui/dist`
   - `build.devUrl` = `http://localhost:5175`
   - `build.beforeBuildCommand` = `cd ../gui && npm run build`
   - prozor: naslov „Cristal", `width` 1280 `height` 800, `resizable: true`.
3. Rust komande (nativni I/O koji browser sandbox ne sme):
   - `shot_read(put) -> base64` / `shot_write(put, base64)` — čitanje/pisanje slike.
   - `clipboard_read/write` — clipboard slike (`arboard`).
   - opciono `content_aware(...)`, `batch(...)` — teški poslovi van UI niti.
   - `--open` handler (§6.1) + `tauri-plugin-single-instance`.
4. Razvoj: `cargo tauri dev`. Build `.exe`: `cargo tauri build` → izlaz u
   `src-tauri/target/release/`.

> Uzor za Rust I/O već postoji u CORE-u: `apps/gui/src-tauri/src/screenshot.rs`
> (xcap/arboard/image/base64) — isti kraci se koriste ovde.

---

## 9. Redosled rada (sažeto)

```
F1 (postoji) → §2 nedestruktivni model → F2 slojevi/selekcije → F3 podešavanja/filteri
→ F4 paint/tekst/transform → F5 integracija → F6 prošireno → §8 Tauri .exe
```

Svaka faza je upotrebljiva sama za sebe. F1–F4 = „PhotoDemon-lite" cilj; F5 =
integracija; F6 = ono što ga izdvaja. Komande za GUI su uvek `npm run dev` / `npm run
build` u `gui/`; za `.exe` `cargo tauri build`.
