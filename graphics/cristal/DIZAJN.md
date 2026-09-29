# Cristal — dizajn i plan izrade

Cilj: **kompaktan i moćan** editor u duhu **PhotoDemon-a** (photodemon.org) —
brz, bez teškog instalera, mnogo alata — ali sa **modernim tamnim UI-jem** kao na
referencama, i sa **integracijom** za razmenu sa drugim app-ovima (npr.
Screenshot → otvori snimak u editoru).

Reference (u `reference/`):
- `photo editor.png` — **PhotoDemon** (funkcionalni uzor: obim alata, kompaktnost).
- `Photo editor 2.jpg` — **Queble** (uzor za IZGLED: tamni UI, levi rail + paneli,
  centar platno sa lenjirima, desni „properties" panel sa karakter/align/senka).
- `Photo editor 3.jpg` — **PXDX photo.workshop** (uzor: Assets/Layers levo,
  „AI Editor / Custom edit", krive, Auto/B&W/HDR, kolekcije, moderni dark glass).

> Filozofija: **jednostavno a moćno**. Mali broj vidljivih kontrola, ali svaka
> vodi u dubinu (presети, real-time preview). Nedestruktivno gde god ima smisla.

---

## 1. Tehnologija (i zašto)

- **Tauri 2** (Rust jezgro + web GUI). Web daje najbrži put do bogatog UI-ja i
  moćnog **`<canvas>`/WebGL** rendera; Rust daje nativni I/O (čitanje/pisanje
  slike, clipboard) koje browser sandbox ne sme. Konzistentno sa ostatkom sistema.
- **Render:** 2D `<canvas>` za MVP; **WebGL2** (regl/twgl ili sirovo) za filtere u
  realnom vremenu (blur/kolor krive/HDR) na velikim slikama. Teški pikselni
  poslovi (npr. content-aware) mogu u **Rust** komandu (brzo, van UI niti).
- **Stanje:** nedestruktivni model — slika = **stek slojeva + stek podešavanja**;
  render je „compose(slojevi, podešavanja)". Undo/redo je stek komandi (patch).
- **Bez teškog frameworka za crtanje** — sopstveni tanak sloj (kao PhotoDemon:
  lagano). React samo za UI ljusku, ne za pikselni render.

---

## 2. Funkcije — po nivoima

### Nivo 0 — MVP (već postoji u CORE `features/photoEditor`, prošititi)
Alati: `select`, `crop`, `pen`, `rect`, `line`, `arrow`, `text`, `blur (region)`.
Undo/redo, projekti (JSON), izvoz PNG/JPG/WEBP, otvaranje slike, clipboard.

### Nivo 1 — „PhotoDemon-lite" (ciljni minimum)
- **Slojevi:** dodaj/obriši/redosled, opacity, blend mode (Normal/Multiply/Screen/
  Overlay…), vidljivost, rasterizacija. (panel „layers" kao Queble/PXDX desno)
- **Selekcije:** pravougaonik, elipsa, laso, „magic wand" (po boji), feather,
  invertuj, add/subtract. Radi sa svim alatima (crop/fill/filter unutar selekcije).
- **Podešavanja (nedestruktivno, real-time preview):** Brightness/Contrast,
  Levels, Curves (krive kao PXDX), Hue/Sat/Lightness, Color Balance, Exposure,
  Shadows/Highlights, Vibrance, Grayscale/B&W, Invert, Threshold.
- **Efekti/filteri:** Gaussian/Box/Motion blur, Sharpen/Unsharp, Noise add/reduce,
  Vignette, Pixelate, Emboss, Edge detect.
- **Transform:** resize (sa interpolacijom), canvas size, rotate/flip, free
  transform sloja, perspektiva/skew (uzor: PhotoDemon perspective/lens correction).
- **Tekst:** font, veličina, boja, poravnanje, stil (bold/italic/underline),
  senka/projekcija (kao Queble „Projection/Inner shadow").
- **Crtanje/paint:** brush (veličina/tvrdoća/opacity), pencil, eraser, bucket
  fill, gradient, clone stamp, color picker.
- **Fajlovi:** izvoz PNG/JPG/WEBP (+ kvalitet), uvoz PNG/JPG/WEBP/GIF; **project
  format** (`.pdproj` JSON = slojevi+podešavanja+istorija). *Stretch:* PSD uvoz.
- **UX kao PhotoDemon:** real-time preview svuda, **preseti** po alatu/efektu,
  potpuni undo/redo, prečice (podesive), tamna/svetla tema + akcent.

### Nivo 2 — prošireno (moji predlozi)
- **Nedestruktivni „adjustment layers"** (kao Photoshop) — svako podešavanje kao
  sloj koji se pali/gasi/reordering.
- **Maske sloja** (crna/bela maska, crtaš vidljivost).
- **Macro/Batch** (kao PhotoDemon): snimi niz koraka → primeni na folder slika.
- **Preset galerija / „looks"** (jedan klik = više podešavanja; kao PXDX „Colors/
  HDR/Auto").
- **Smart Select / content-aware fill** (uzor PhotoDemon) — Rust komanda; MVP:
  jednostavan „inpaint" oko selekcije.
- **AI kuka (opciono, lokalno):** dugme „AI Editor" (kao PXDX) koje šalje sliku
  lokalnom modelu (npr. IMPERIUM Flux/ComfyUI ako postoji) preko lokalnog API-ja
  — upscale, remove-bg, generative fill. Čisto opciono, iza feature-flag-a.
- **Plugin tačke:** filteri kao mali moduli (registry), da se lako dodaju.
- **Istorija kao stek sa thumbnail-ima** (klik na korak = vrati se).

---

## 3. UI raspored (mapiran na reference)

```
┌───────────────────────────────────────────────────────────────────────┐
│  TOPBAR: logo · ime projekta · undo/redo · zoom · Preview · Save (glass)│  ← Queble/PXDX
├──────────┬──────────────────────────────────────────┬───────────────────┤
│ LEVI RAIL│                 PLATNO                    │  DESNI PANELI     │
│  alati   │  (lenjiri gore/levo, checkerboard za     │  properties/      │
│  (ikone) │   alpha, zoom %, ruler, handle-ovi za     │  adjustments,     │
│  +       │   selekciju/transform)                    │  layers, colors   │
│ paneli:  │                                          │  (krive, Auto/B&W/│
│ Assets/  │                                          │   HDR, senka,     │
│ Layers/  │                                          │   character/align)│
│ Presets  │                                          │                   │
├──────────┴──────────────────────────────────────────┴───────────────────┤
│  DONJI DOK: zoom kontrole, dimenzije, poruke                             │
└───────────────────────────────────────────────────────────────────────┘
```
- **Tamni glass** (kao PXDX): poluprovidni paneli, mek blur, suptilne senke,
  jedan akcent (npr. ljubičasti/crveni kao reference). Ikone monohromatske
  (kao PhotoDemon opcija).
- **Levi rail** = alati (select/crop/pen/brush/text/…); ispod prebacivač panela
  (Assets · Layers · Presets), kao „system/Layer" u Queble i „Assets/Layers" u PXDX.
- **Desno** = kontekstualni panel po alatu (Text → character/align/senka;
  Adjustment → krive/slajderi; Layer → opacity/blend/maska).
- **Centar** = platno sa lenjirima + checkerboard + zoom, kao sve tri reference.
- **Responsivno/kompaktno:** paneli se skupljaju; minimalan „hrom", maksimalno platno.

---

## 4. Arhitektura (slojevi koda)

```
gui/src/
  app/            # ljuska: topbar, raspored panela, tema
  canvas/         # render engine (compose slojeva+podešavanja), zoom/pan, overlay
  tools/          # svaki alat = modul (aktivacija, pointer handleri, opcije)
  adjustments/    # nedestruktivna podešavanja (svako = funkcija + UI panel + preset)
  filters/        # efekti (može WebGL shader ili Rust komanda)
  layers/         # model slojeva (dodaj/obriši/reorder/blend/maska)
  history/        # undo/redo stek komandi (patch)
  io/             # otvori/sačuvaj/izvezi (preko Rust `shot_read/write` + fs)
  integracija/    # app-bus klijent (vidi INTEGRACIJA.md) — prijem slike iz Screenshot-a
src-tauri/        # Rust: shot_read/write/clipboard (+ opciono content-aware/AI kao komanda)
```
Ključne odluke:
- **Nedestruktivno:** platno se uvek re-kompajlira iz modela (slojevi+podešavanja),
  pa su undo/redo i „ugasi efekat" trivijalni.
- **Preview bez commit-a:** dok vučeš slajder, render ide na GPU/preview; commit tek
  na „primeni" → jedan history korak.
- **Veliki poslovi u Rust:** enkodiranje, content-aware, batch — van UI niti.

---

## 5. Formati
- **Izvoz:** PNG, JPG, WEBP (+ kvalitet). *Stretch:* GIF, HEIF (Rust `image`/plugin).
- **Uvoz:** PNG/JPG/WEBP/GIF. *Stretch:* PSD uvoz (Rust `psd` crate) — kao PhotoDemon.
- **Projekat:** `.pdproj` = JSON (schema_version, slojevi, podešavanja, crop,
  istorija-sažetak) + reference na original. Lokalni JSON store (bez baze), kao CORE
  `core/system/editor_projects.py`.

---

## 6. Integracija sa drugim app-ovima
Vidi **INTEGRACIJA.md** (app-bus + handoff). Ukratko: Cristal je „prijemna"
strana — Screenshot ga pozove `PhotoEditor.exe --open "<put>"` (ili preko
zajedničkog inbox foldera), editor učita sliku preko `shot_read`. Isti mehanizam
može da radi sa bilo kojim app-om (Nabavka „uredi sliku proizvoda" → Cristal
→ vrati rezultat).

---

## 7. Plan izrade (faze)
1. **F1 — ljuska + platno:** Tauri prozor, topbar/raspored (mockup izgled), platno
   sa zoom/pan/lenjiri, otvori/izvezi PNG. (Nivo 0 postoji — prepakovati u standalone.)
2. **F2 — slojevi + selekcije:** layers panel, blend/opacity, selekcije + crop/fill
   unutar selekcije.
3. **F3 — podešavanja + filteri:** krive/levels/HSL + blur/sharpen/vignette (real-time).
4. **F4 — paint + tekst + transform:** brush/eraser/bucket/gradient, tekst sa senkom,
   free transform/perspektiva.
5. **F5 — integracija:** app-bus prijem (`--open`/inbox), „pošalji nazad" pozivaocu.
6. **F6 — prošireno:** adjustment layers, maske, macro/batch, preset galerija, (opc.) AI.

Svaka faza je upotrebljiva sama za sebe. F1–F4 = „PhotoDemon-lite" cilj; F5 =
integracija; F6 = ono što ga izdvaja.

---

## 8. Moji predlozi (sažeto)
- Kreni **nedestruktivno od starta** (slojevi+podešavanja) — kasnije dodavanje je
  bolno.
- **WebGL za filtere** čim slike pređu ~2MP (2D canvas postaje spor).
- **Preset galerija** (looks) je najveći „wow" uz najmanje koda — spakuj podešavanja.
- **Macro/Batch** te odmah stavlja u PhotoDemon ligu, a jeftino je (snimi komande).
- **App-bus** neka bude opšti (JSON preko lokalnog porta ili inbox foldera), ne
  samo za Screenshot — tako sve tvoje app-ove povezuješ jednim protokolom.
- **AI iza flag-a** (lokalni model), da app ostane brz i radi bez mreže.
