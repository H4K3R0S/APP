# CORE Photo Editor — dizajn

Datum: 2026-09-06
Status: predlog (za implementaciju)

## Cilj

Jednostavan foto/anotacioni editor kao zaseban CORE alat. Primarni tok:
korisnik snimi ekran → u prozoru „Snimak ekrana" klikne dugme **Editor** →
otvara se zasebna strana editora sa uhvaćenim snimkom → obeleži/iseče/zamuti
→ sačuva. Editor je dostupan i sa CORE Dashboard-a (ikona) i može ponovo da
otvori ranije sačuvane projekte radi nastavka editovanja.

Osnova već postoji: native snimanje (`apps/gui/src-tauri/src/screenshot.rs`),
GUI feature (`apps/gui/src/features/screenshot/`), prozor pregleda
(`ScreenshotPreview.tsx`) sa akcijama „Otvori folder" / „Kopiraj putanju".

## Ne-ciljevi (YAGNI za v1)

- Nema selekcije/pomeranja/izmene pojedinačnog već nacrtanog objekta (greške
  se poništavaju preko Undo/Redo).
- Nema zumiranja/pan-a platna (slika se uklapa u prikaz — fit-to-view).
- Nema slojeva, filtera boja, rotacije, promene veličine slike.
- Nema editovanja proizvoljnih slika sa diska u v1 (izvor je snimak ekrana ili
  ranije sačuvan projekat). Otvaranje proizvoljnog fajla može kasnije.

## Arhitektura

Tri sloja, svaki sa jasnom granicom:

1. **Rust (pikseli)** — čita pun originalni snimak i upisuje spljoštenu sliku;
   clipboard. Dve nove Tauri komande uz postojeće `shot_*`.
2. **Python (projekti)** — trajno skladište `.project` fajlova: snimi, učitaj,
   izlistaj, obriši, i automatsko brisanje projekata netaknutih > 7 dana.
   `PathService` daje folder; `EditorProjectService` radi IO; system router
   izlaže endpointe. (Iste konvencije kao postojeći screenshots dir.)
3. **Frontend (editor)** — zasebna ruta `/photo-editor` sa stranicom editora:
   platno (`<canvas>`), alatnik, i akcije čuvanja. Čist model stanja
   (reducer) je odvojen i testabilan.

### Tok podataka

- Otvaranje iz snimka: `ScreenshotPreview` → `navigate("/photo-editor",
  { state: { sourcePath } })`. Stranica pozove Rust `shot_read(sourcePath)` →
  data URL pune slike → nov prazan projekat u memoriji (bazna slika = taj snimak).
- Otvaranje projekta: `navigate("/photo-editor", { state: { projectId } })` →
  Python `GET /editor/projects/{id}` → JSON sa ugrađenom baznom slikom + objektima
  → obnova stanja editora.
- Dashboard ikona: `navigate("/photo-editor")` bez state-a → stranica prikaže
  listu skorašnjih projekata (i praznu radnu površinu / poruku).

## Model editovanja (non-destruktivan)

Bazna slika (originalni snimak, nepromenjena) + uređena lista **objekata** koji
se iscrtavaju iznad nje pri svakom renderu. Koordinate su u pikselima BAZNE
slike (nezavisno od fit-to-view skaliranja u prikazu).

Tipovi objekata:

- `pen` — `{ color, width, points: [[x,y], ...] }` (slobodna linija).
- `rect` — `{ color, width, x, y, w, h }` (samo okvir, bez ispune).
- `line` — `{ color, width, x1, y1, x2, y2 }`.
- `arrow` — `{ color, width, x1, y1, x2, y2 }` (linija + vrh strelice).
- `text` — `{ color, size, x, y, text }`.
- `blur` — `{ x, y, w, h, strength }` (mozaik/zamućenje regiona; računa se iz
  bazne slike pri svakom renderu → ostaje editabilno i posle reopen-a).

Plus jedan opcioni `crop`: `{ x, y, w, h } | null` — primenjuje se pri izvozu
(i vizuelno zatamnjuje van-oblast u editoru).

Undo/Redo su dva stacka snimaka liste objekata (+ crop). Alati u alatniku:
`select` (nishani, u v1 samo prazni izbor), `crop`, `pen`, `rect`, `line`,
`arrow`, `text`, `blur`. Stil: birač boje, debljina linije, veličina teksta.

### Render i izvoz

- Prikaz: `<canvas>` uklopljen u prikaz; render funkcija crta baznu sliku, pa
  svaki objekat; `blur` region se crta iz bazne slike uz `ctx.filter =
  "blur(Npx)"` (ili box-mozaik). `crop` van-oblast se zatamni.
- Izvoz: offscreen canvas u punoj rezoluciji bazne slike, primeni `crop`
  (isečeni okvir), iscrtaj objekte → `toDataURL("image/png")`.

## Save model

- **SAVE** → izvezi (spljošti) → **prepiši originalni fajl** preko
  `shot_write(original_path, dataUrl, clipboard=true)`. Original se menja.
- **SAVE AS** →
  1. upiši novu sliku kopiju `<ime>-edit.png` u isti folder (`shot_write`),
  2. upiši `.project` JSON (Python `POST /editor/projects`) sa **ugrađenom
     originalnom baznom slikom (base64)** + svim objektima + crop + putanjom
     originala i putanjom izvezene kopije. Samostalan i ponovo-otvorljiv.
- **Kopiraj** → izvezena slika u clipboard preko posvećene komande
  `shot_clipboard(dataUrl)` (bez upisa fajla).
- **Zatvori** → nazad na prethodnu rutu (upozori ako ima nesačuvanih izmena).

## Format projekta (`.project`, JSON)

```json
{
  "schema_version": 1,
  "id": "20260906-153000-ab12",
  "title": "Snimak 2026-09-06 15:30",
  "original_path": "C:/.../data/screenshots/2026-09-06/153000-region.png",
  "export_path": "C:/.../data/screenshots/2026-09-06/153000-region-edit.png",
  "base_image": "data:image/png;base64,...",
  "crop": { "x": 0, "y": 0, "w": 1280, "h": 720 },
  "objects": [ { "type": "rect", "color": "#ff3b30", "width": 4, "x": 10, "y": 12, "w": 200, "h": 80 } ],
  "created_at": "2026-09-06T15:30:00",
  "touched_at": "2026-09-06T15:35:00"
}
```

`base_image` je ugrađen originalni snimak (odluka korisnika) → projekat radi i
ako original nestane. `touched_at` se osvežava pri svakom snimanju I pri
učitavanju („aktivaciji").

## Skladište projekata + auto-brisanje (7 dana)

- `PathService` (`core/foundation/paths.py`): novi `editor_projects_dir`
  (poddirektorijum foldera snimaka, npr. `data/screenshots/projects/`).
- `core/system/editor_projects.py` → `EditorProjectService`:
  - `save(project: dict) -> str` (id; kreira ako nema, osvežava `touched_at`),
  - `load(id) -> dict` (osvežava `touched_at`),
  - `list() -> list[summary]` (id, title, touched_at; bez `base_image`),
  - `delete(id) -> bool`,
  - `prune(max_age_days=7) -> int` (obriši projekte sa `touched_at` starijim od
    praga; fallback na mtime fajla). Poziva se pri `list()` i na startu.
- System router (`apps/api/routers/system.py`) — endpointi:
  - `GET  /api/v1/system/editor/projects` → lista (uz prune),
  - `GET  /api/v1/system/editor/projects/{id}` → pun projekat,
  - `POST /api/v1/system/editor/projects` → snimi (telo = projekat JSON),
  - `DELETE /api/v1/system/editor/projects/{id}` → obriši.
  Šeme u `apps/api/schemas/system.py`.

## Rust komande (nove)

U `apps/gui/src-tauri/src/screenshot.rs` (+ registracija u `lib.rs`,
dozvole u `capabilities/default.json`):

- `shot_read(path: String) -> Result<String, String>` — pročita fajl, odredi
  mime po ekstenziji, base64 → `data:<mime>;base64,...`.
- `shot_write(path: String, data_url: String, clipboard: bool) -> Result<(),
  String>` — parsira data URL, dekodira, upiše fajl; ako `clipboard`, dekodira
  sliku i kopira (postojeći `copy_image_to_clipboard`).
- `shot_clipboard(data_url: String) -> Result<(), String>` — dekodira sliku iz
  data URL-a i kopira u clipboard bez upisa fajla (za akciju „Kopiraj").

Čiste, testabilne pomoćne funkcije: `parse_data_url(&str) -> Result<(mime,
Vec<u8>)>`, `mime_for_ext(&str) -> &str`.

## Frontend

- Ruta: `/photo-editor` → `apps/gui/src/pages/PhotoEditorPage.tsx` (u `App.tsx`).
- `apps/gui/src/features/photoEditor/`:
  - `photoEditorApi.ts` — `shotRead`, `shotWrite` (Tauri) + `listProjects`,
    `loadProject`, `saveProject`, `deleteProject` (HTTP na system endpointe).
  - `photoEditorModel.ts` — čist model/reducer (objekti, undo/redo, alat, stil,
    crop) + `serializeProject` / `deserializeProject`. Testabilno.
  - `EditorCanvas.tsx` — render bazne slike + objekata + blur + crop; obrada
    pokazivača po alatu.
  - `EditorToolbar.tsx` — alati, boja, debljina, veličina teksta; akcije SAVE /
    SAVE AS / Kopiraj / Zatvori.
  - `ProjectsList.tsx` — skorašnji projekti (kad nema izvora).
  - `screenshot.css` proširenje ili `photo-editor.css`.
- Ulazi:
  - `ScreenshotPreview.tsx` — novo dugme **Editor** (tekst „Editor") →
    `navigate("/photo-editor", { state: { sourcePath: result.path } })`.
  - Dashboard: ikona (dugme) u „Snimak ekrana" gadget-u →
    `navigate("/photo-editor")`.

## Testovi

- Rust: `parse_data_url`, `mime_for_ext` (unit, uz postojeće u `screenshot.rs`).
- Python: `EditorProjectService` (save/load/list/delete + `prune` na 7 dana) i
  `PathService.editor_projects_dir` — obrazac kao `tests/test_core_paths_screenshots.py`.
- Frontend: `photoEditorModel` (dodavanje objekta, undo/redo, serialize↔deserialize
  round-trip).

## Faze implementacije

1. Backend: `PathService.editor_projects_dir` + `EditorProjectService` + system
   endpointi + testovi.
2. Rust: `shot_read` / `shot_write` (+ pomoćne + testovi) + registracija + dozvole.
3. Frontend osnove: `photoEditorApi` + `photoEditorModel` (+ testovi) + ruta i
   prazna `PhotoEditorPage`.
4. Platno + alatnik: render bazne slike, crtanje objekata (pen/rect/line/arrow/
   text), crop, blur.
5. Čuvanje: SAVE (prepiši) / SAVE AS (kopija + `.project`) / Kopiraj / Zatvori;
   lista projekata; ulazi (Editor dugme u pregledu, Dashboard ikona).
6. Prune (7 dana) povezan na start/list; poliranje (nesačuvane izmene, greške).
