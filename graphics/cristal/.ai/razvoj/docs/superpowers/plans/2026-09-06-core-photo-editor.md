# CORE Photo Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Non-destruktivni foto/anotacioni editor kao zaseban CORE alat (ruta `/photo-editor`), pozvan iz prozora „Snimak ekrana" i sa Dashboard-a, sa čuvanjem originala/kopije/`.project` fajla i auto-brisanjem projekata starijih od 7 dana.

**Architecture:** Tri sloja sa jasnim granicama. Rust radi pikselski IO (čita pun snimak, upisuje spljoštenu sliku, clipboard). Python čuva `.project` JSON fajlove (snimi/učitaj/lista/obriši/prune 7 dana). Frontend je zasebna React strana sa `<canvas>` platnom, čistim reducer modelom stanja i alatnikom.

**Tech Stack:** Python 3 (FastAPI, pytest), Rust (Tauri v2, `image`, `arboard`, `base64`), TypeScript/React (react-router, vitest), HTML5 Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-09-06-core-photo-editor-design.md`

## Global Constraints

- Testovi (Python) se pokreću preko venv-a: `./.venv/Scripts/python.exe -m pytest ...` (ne sistemski python).
- Frontend testovi: iz `apps/gui/`, `npx vitest run <putanja>`.
- Rust testovi: iz `apps/gui/src-tauri/`, `cargo test`.
- Custom Tauri komande NE zahtevaju unos u `capabilities/default.json` (postojeći `shot_capture`/`shot_reveal` nisu tamo) — samo registracija u `lib.rs` `generate_handler!`.
- Koordinate svih objekata i crop-a su u pikselima BAZNE slike (nezavisno od prikaza).
- Projekat UGRAĐUJE originalnu baznu sliku kao data URL (`base_image`) — samostalan fajl.
- `.project` fajlovi: naziv `<id>.project`, JSON; `id` oblika `YYYYMMDD-HHMMSS-<hex4>`, dozvoljeni znaci `^[A-Za-z0-9-]+$` (bez tačke/kose crte — zaštita od path traversal-a).
- Prag auto-brisanja: 7 dana od `touched_at` (fallback na mtime fajla). `touched_at` se osvežava na `save` I na `load`.
- Commit poruke: normalna proza (ne caveman), i završiti sa `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## FAZA 1 — Backend: putanje + servis projekata + endpointi

### Task 1: PathService folder za projekte editora

**Files:**
- Modify: `core/foundation/paths.py:39` (dodati `editor_projects`), `core/foundation/paths.py:61` (kreiranje)
- Test: `tests/test_core_paths_screenshots.py`

**Interfaces:**
- Produces: `CorePaths.editor_projects: Path` (== `screenshots / "projects"`), kreiran u `ensure_required_dirs()`.

- [ ] **Step 1: Write the failing test**

Dodati u `tests/test_core_paths_screenshots.py`:

```python
def test_editor_projects_dir_is_under_screenshots() -> None:
    """Folder projekata editora stoji pod screenshots/ i zove se 'projects'."""

    paths = CorePaths(root_path=Path("/tmp/core-test"))

    assert paths.editor_projects == paths.screenshots / "projects"


def test_ensure_required_dirs_creates_editor_projects(tmp_path: Path) -> None:
    """ensure_required_dirs kreira folder projekata editora."""

    paths = CorePaths(root_path=tmp_path)

    assert not paths.editor_projects.exists()

    paths.ensure_required_dirs()

    assert paths.editor_projects.is_dir()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_core_paths_screenshots.py -q`
Expected: FAIL (`AttributeError: 'CorePaths' object has no attribute 'editor_projects'`).

- [ ] **Step 3: Write minimal implementation**

U `core/foundation/paths.py`, posle linije `self.screenshots = self.data / "screenshots"`:

```python
        self.screenshots = self.data / "screenshots"
        self.editor_projects = self.screenshots / "projects"
```

U `ensure_required_dirs`, posle `self.screenshots.mkdir(...)`:

```python
        self.screenshots.mkdir(parents=True, exist_ok=True)
        self.editor_projects.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_core_paths_screenshots.py -q`
Expected: PASS (4 testa).

- [ ] **Step 5: Commit**

```bash
git add core/foundation/paths.py tests/test_core_paths_screenshots.py
git commit -m "feat(paths): editor_projects folder pod screenshots/"
```

---

### Task 2: EditorProjectService — save + load

**Files:**
- Create: `core/system/editor_projects.py`
- Test: `tests/test_editor_project_service.py`

**Interfaces:**
- Consumes: `CorePaths.editor_projects` (Task 1).
- Produces:
  - `EditorProjectService(directory: Path)`
  - `.save(project: dict) -> str` — vraća `id`; ako `project` nema `id`, generiše ga; postavlja `created_at` (ako fali) i uvek `touched_at` na sada (ISO, sekunde). Upisuje `<id>.project` JSON. Vraća `id`.
  - `.load(project_id: str) -> dict` — čita `<id>.project`, osvežava `touched_at` i prepisuje fajl, vraća pun dict. Diže `FileNotFoundError` ako ne postoji, `ValueError` za nevažeći id.

- [ ] **Step 1: Write the failing test**

`tests/test_editor_project_service.py`:

```python
from pathlib import Path

import pytest

from core.system.editor_projects import EditorProjectService


def _project() -> dict:
    return {
        "schema_version": 1,
        "title": "Test",
        "original_path": "C:/x/a.png",
        "base_image": "data:image/png;base64,AAAA",
        "crop": None,
        "objects": [],
    }


def test_save_assigns_id_and_timestamps(tmp_path: Path) -> None:
    service = EditorProjectService(tmp_path)

    project_id = service.save(_project())

    assert project_id
    saved = (tmp_path / f"{project_id}.project")
    assert saved.is_file()

    loaded = service.load(project_id)
    assert loaded["id"] == project_id
    assert loaded["created_at"]
    assert loaded["touched_at"]


def test_save_keeps_existing_id(tmp_path: Path) -> None:
    service = EditorProjectService(tmp_path)
    project = _project()

    first = service.save(project)
    project["id"] = first
    second = service.save(project)

    assert first == second


def test_load_rejects_bad_id(tmp_path: Path) -> None:
    service = EditorProjectService(tmp_path)

    with pytest.raises(ValueError):
        service.load("../evil")


def test_load_missing_raises(tmp_path: Path) -> None:
    service = EditorProjectService(tmp_path)

    with pytest.raises(FileNotFoundError):
        service.load("20260101-000000-abcd")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_editor_project_service.py -q`
Expected: FAIL (`ModuleNotFoundError: core.system.editor_projects`).

- [ ] **Step 3: Write minimal implementation**

`core/system/editor_projects.py`:

```python
"""Trajno skladište projekata Photo Editor-a (`.project` JSON fajlovi).

Projekat je samostalan: sadrži ugrađenu baznu sliku (data URL) i listu
objekata/anotacija. Fajlovi žive u ``CorePaths.editor_projects``.
"""

import json
import re
import secrets
from datetime import datetime
from pathlib import Path

_ID_RE = re.compile(r"^[A-Za-z0-9-]+$")
_SUFFIX = ".project"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _new_id() -> str:
    return f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(2)}"


class EditorProjectService:
    """Snima, učitava, lista, briše i prunuje projekte editora."""

    def __init__(self, directory: Path) -> None:
        self._dir = Path(directory)

    def _path(self, project_id: str) -> Path:
        if not _ID_RE.match(project_id):
            raise ValueError(f"Nevažeći id projekta: {project_id!r}")
        return self._dir / f"{project_id}{_SUFFIX}"

    def save(self, project: dict) -> str:
        self._dir.mkdir(parents=True, exist_ok=True)

        project = dict(project)
        project_id = project.get("id") or _new_id()
        project["id"] = project_id
        project.setdefault("created_at", _now())
        project["touched_at"] = _now()

        path = self._path(project_id)
        temporary = path.with_name(f".{path.name}.tmp")
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(project, handle, ensure_ascii=False)
        temporary.replace(path)

        return project_id

    def load(self, project_id: str) -> dict:
        path = self._path(project_id)
        with path.open("r", encoding="utf-8") as handle:
            project = json.load(handle)

        project["touched_at"] = _now()
        with path.open("w", encoding="utf-8") as handle:
            json.dump(project, handle, ensure_ascii=False)

        return project
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_editor_project_service.py -q`
Expected: PASS (4 testa).

- [ ] **Step 5: Commit**

```bash
git add core/system/editor_projects.py tests/test_editor_project_service.py
git commit -m "feat(editor): EditorProjectService save/load"
```

---

### Task 3: EditorProjectService — list, delete, prune (7 dana)

**Files:**
- Modify: `core/system/editor_projects.py`
- Test: `tests/test_editor_project_service.py`

**Interfaces:**
- Produces:
  - `.list() -> list[dict]` — sažeci `{id, title, touched_at}` (bez `base_image`/`objects`), sortirano po `touched_at` opadajuće; poziva `prune()` pre listanja.
  - `.delete(project_id: str) -> bool` — briše fajl; `True` ako je postojao.
  - `.prune(max_age_days: int = 7) -> int` — briše projekte čiji je `touched_at` (fallback mtime) stariji od praga; vraća broj obrisanih.

- [ ] **Step 1: Write the failing test**

Dodati u `tests/test_editor_project_service.py`:

```python
import os
import time


def test_list_returns_summaries_newest_first(tmp_path: Path) -> None:
    service = EditorProjectService(tmp_path)
    first = service.save({**_project(), "title": "Prvi"})
    time.sleep(1)
    second = service.save({**_project(), "title": "Drugi"})

    summaries = service.list()

    assert [s["id"] for s in summaries] == [second, first]
    assert "base_image" not in summaries[0]
    assert summaries[0]["title"] == "Drugi"


def test_delete_removes_project(tmp_path: Path) -> None:
    service = EditorProjectService(tmp_path)
    project_id = service.save(_project())

    assert service.delete(project_id) is True
    assert service.delete(project_id) is False


def test_prune_deletes_old_projects(tmp_path: Path) -> None:
    service = EditorProjectService(tmp_path)
    fresh = service.save(_project())
    stale = service.save(_project())

    # Ostari „stale" fajl 8 dana unazad (mtime + touched_at u JSON-u).
    stale_path = tmp_path / f"{stale}.project"
    old = time.time() - 8 * 24 * 3600
    os.utime(stale_path, (old, old))

    removed = service.prune(max_age_days=7)

    assert removed == 1
    assert (tmp_path / f"{fresh}.project").is_file()
    assert not stale_path.exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_editor_project_service.py -q`
Expected: FAIL (`AttributeError: ... has no attribute 'list'`).

- [ ] **Step 3: Write minimal implementation**

Dodati importe na vrh `core/system/editor_projects.py`:

```python
import os
from datetime import timedelta
```

Dodati metode u klasu:

```python
    def list(self) -> list[dict]:
        self.prune()
        summaries: list[dict] = []
        for path in self._dir.glob(f"*{_SUFFIX}"):
            try:
                with path.open("r", encoding="utf-8") as handle:
                    project = json.load(handle)
            except (OSError, json.JSONDecodeError):
                continue
            summaries.append(
                {
                    "id": project.get("id", path.stem),
                    "title": project.get("title", path.stem),
                    "touched_at": project.get("touched_at", ""),
                }
            )
        summaries.sort(key=lambda s: s["touched_at"], reverse=True)
        return summaries

    def delete(self, project_id: str) -> bool:
        path = self._path(project_id)
        if not path.exists():
            return False
        path.unlink()
        return True

    def prune(self, max_age_days: int = 7) -> int:
        if not self._dir.is_dir():
            return 0
        threshold = datetime.now() - timedelta(days=max_age_days)
        removed = 0
        for path in self._dir.glob(f"*{_SUFFIX}"):
            touched = self._touched_at(path)
            if touched < threshold:
                try:
                    path.unlink()
                    removed += 1
                except OSError:
                    pass
        return removed

    def _touched_at(self, path: Path) -> datetime:
        try:
            with path.open("r", encoding="utf-8") as handle:
                raw = json.load(handle).get("touched_at")
            if raw:
                return datetime.fromisoformat(raw)
        except (OSError, json.JSONDecodeError, ValueError):
            pass
        return datetime.fromtimestamp(path.stat().st_mtime)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_editor_project_service.py -q`
Expected: PASS (7 testova).

- [ ] **Step 5: Commit**

```bash
git add core/system/editor_projects.py tests/test_editor_project_service.py
git commit -m "feat(editor): EditorProjectService list/delete/prune (7 dana)"
```

---

### Task 4: System endpointi za projekte

**Files:**
- Modify: `apps/api/schemas/system.py` (posle `ScreenshotsDirResponse`)
- Modify: `apps/api/routers/system.py`
- Test: `tests/test_api_system.py`

**Interfaces:**
- Consumes: `EditorProjectService` (Task 2–3), `core_paths.editor_projects` (Task 1).
- Produces HTTP:
  - `GET  /api/v1/system/editor/projects` → `{ "projects": [ {id,title,touched_at} ] }`
  - `GET  /api/v1/system/editor/projects/{project_id}` → pun projekat (dict) ili 404
  - `POST /api/v1/system/editor/projects` (telo: pun projekat dict) → `{ "id": "..." }`
  - `DELETE /api/v1/system/editor/projects/{project_id}` → 204 (ili 404)

- [ ] **Step 1: Write the failing test**

Dodati u `tests/test_api_system.py` (koristi postojeći TestClient obrazac tog fajla; ako fajl već pravi `client`, iskoristi ga):

```python
def test_editor_projects_roundtrip(client) -> None:
    payload = {
        "schema_version": 1,
        "title": "API test",
        "original_path": "C:/x/a.png",
        "base_image": "data:image/png;base64,AAAA",
        "crop": None,
        "objects": [],
    }

    created = client.post("/api/v1/system/editor/projects", json=payload)
    assert created.status_code == 200
    project_id = created.json()["id"]

    listed = client.get("/api/v1/system/editor/projects")
    assert listed.status_code == 200
    assert any(p["id"] == project_id for p in listed.json()["projects"])

    loaded = client.get(f"/api/v1/system/editor/projects/{project_id}")
    assert loaded.status_code == 200
    assert loaded.json()["title"] == "API test"

    deleted = client.delete(f"/api/v1/system/editor/projects/{project_id}")
    assert deleted.status_code == 204

    missing = client.get(f"/api/v1/system/editor/projects/{project_id}")
    assert missing.status_code == 404
```

Napomena: ako `tests/test_api_system.py` nema `client` fixture, dodati na vrh fajla:

```python
import pytest
from fastapi.testclient import TestClient

from apps.api.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    from core.foundation.paths import core_paths
    monkeypatch.setattr(core_paths, "editor_projects", tmp_path)
    return TestClient(app)
```

(Ako fixture već postoji u fajlu, samo dodati `monkeypatch` linije za `editor_projects` u njega ili u test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_api_system.py::test_editor_projects_roundtrip -q`
Expected: FAIL (404 — rute ne postoje).

- [ ] **Step 3: Write minimal implementation**

U `apps/api/schemas/system.py`, posle `ScreenshotsDirResponse`:

```python
class EditorProjectSummary(BaseModel):
    """Sažetak projekta editora (bez bazne slike i objekata)."""

    id: str
    title: str
    touched_at: str


class EditorProjectListResponse(BaseModel):
    projects: list[EditorProjectSummary]


class EditorProjectSavedResponse(BaseModel):
    id: str
```

U `apps/api/routers/system.py` — dodati import:

```python
from apps.api.schemas.system import (
    DependencyStatusResponse,
    EditorProjectListResponse,
    EditorProjectSavedResponse,
    InstallJobResponse,
    ScreenshotsDirResponse,
    SystemDependenciesResponse,
    SystemMetricsResponse,
    SystemStatusResponse,
)
from fastapi import Body, HTTPException, Response, status
from core.system.editor_projects import EditorProjectService
```

Dodati na kraj rutera:

```python
# ==========          PROJEKTI PHOTO EDITOR-a          ==========

def _project_service() -> EditorProjectService:
    core_paths.editor_projects.mkdir(parents=True, exist_ok=True)
    return EditorProjectService(core_paths.editor_projects)


@router.get("/editor/projects", response_model=EditorProjectListResponse)
def list_editor_projects() -> EditorProjectListResponse:
    return EditorProjectListResponse(projects=_project_service().list())


@router.get("/editor/projects/{project_id}")
def get_editor_project(project_id: str) -> dict:
    try:
        return _project_service().load(project_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Projekat ne postoji.") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/editor/projects", response_model=EditorProjectSavedResponse)
def save_editor_project(project: dict = Body(...)) -> EditorProjectSavedResponse:
    return EditorProjectSavedResponse(id=_project_service().save(project))


@router.delete("/editor/projects/{project_id}", status_code=204)
def delete_editor_project(project_id: str) -> Response:
    try:
        found = _project_service().delete(project_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not found:
        raise HTTPException(status_code=404, detail="Projekat ne postoji.")
    return Response(status_code=204)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_api_system.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/schemas/system.py apps/api/routers/system.py tests/test_api_system.py
git commit -m "feat(api): endpointi za projekte Photo Editor-a"
```

---

## FAZA 2 — Rust: čitanje/upis pune slike + clipboard

### Task 5: Rust pomoćne funkcije `mime_for_ext` i `parse_data_url`

**Files:**
- Modify: `apps/gui/src-tauri/src/screenshot.rs` (dodati funkcije + testove u `mod tests`)

**Interfaces:**
- Produces:
  - `fn mime_for_ext(ext: &str) -> &'static str` — po ekstenziji (`png|jpg|jpeg|webp`), default `application/octet-stream`.
  - `fn parse_data_url(data_url: &str) -> Result<(String, Vec<u8>), String>` — vraća `(mime, bajtovi)` iz `data:<mime>;base64,<...>`.

- [ ] **Step 1: Write the failing test**

Dodati u `#[cfg(test)] mod tests` u `screenshot.rs`:

```rust
    #[test]
    fn mime_po_ekstenziji() {
        assert_eq!(mime_for_ext("png"), "image/png");
        assert_eq!(mime_for_ext("JPG"), "image/jpeg");
        assert_eq!(mime_for_ext("webp"), "image/webp");
        assert_eq!(mime_for_ext("xyz"), "application/octet-stream");
    }

    #[test]
    fn parse_data_url_dekoduje_base64() {
        // "AAAA" base64 = 3 nulta bajta.
        let (mime, bytes) = parse_data_url("data:image/png;base64,AAAA").expect("ok");
        assert_eq!(mime, "image/png");
        assert_eq!(bytes, vec![0u8, 0u8, 0u8]);
    }

    #[test]
    fn parse_data_url_odbija_los_ulaz() {
        assert!(parse_data_url("not-a-data-url").is_err());
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run (iz `apps/gui/src-tauri/`): `cargo test screenshot::tests::mime_po_ekstenziji screenshot::tests::parse_data_url_dekoduje_base64`
Expected: FAIL (funkcije ne postoje).

- [ ] **Step 3: Write minimal implementation**

Dodati u `screenshot.rs` (van `mod tests`, npr. u sekciji ENKODOVANJE):

```rust
fn mime_for_ext(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
}

/// Parsira `data:<mime>;base64,<payload>` u (mime, bajtovi).
fn parse_data_url(data_url: &str) -> Result<(String, Vec<u8>), String> {
    let rest = data_url
        .strip_prefix("data:")
        .ok_or_else(|| "Nije data URL.".to_string())?;
    let (meta, payload) = rest
        .split_once(',')
        .ok_or_else(|| "Neispravan data URL (nema zareza).".to_string())?;
    let mime = meta.split(';').next().unwrap_or("").to_string();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.trim())
        .map_err(|e| e.to_string())?;
    Ok((mime, bytes))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (iz `apps/gui/src-tauri/`): `cargo test screenshot::tests::`
Expected: PASS (svi screenshot testovi).

- [ ] **Step 5: Commit**

```bash
git add apps/gui/src-tauri/src/screenshot.rs
git commit -m "feat(rust): mime_for_ext + parse_data_url za editor IO"
```

---

### Task 6: Rust komande `shot_read`, `shot_write`, `shot_clipboard` + registracija

**Files:**
- Modify: `apps/gui/src-tauri/src/screenshot.rs` (komande)
- Modify: `apps/gui/src-tauri/src/lib.rs:40-51` (registracija)

**Interfaces:**
- Consumes: `mime_for_ext`, `parse_data_url` (Task 5), postojeći `copy_image_to_clipboard`.
- Produces (Tauri komande):
  - `shot_read(path: String) -> Result<String, String>` — vraća `data:<mime>;base64,<...>` pune slike.
  - `shot_write(path: String, data_url: String, clipboard: bool) -> Result<(), String>` — upiše bajtove iz data URL-a u fajl; ako `clipboard`, dekodira sliku (`image::load_from_memory`) i kopira.
  - `shot_clipboard(data_url: String) -> Result<(), String>` — kopira sliku iz data URL-a bez upisa fajla.

Napomena: ove komande koriste fajl-sistem i clipboard (nije unit-testabilno bez okruženja) — verifikacija je build (`cargo build`) + kasnija ručna provera u aplikaciji. Čista logika je već pokrivena u Task 5.

- [ ] **Step 1: Dodati komande**

U `screenshot.rs`, u sekciji KOMANDE:

```rust
#[tauri::command]
pub fn shot_read(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let mime = mime_for_ext(ext);
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

#[tauri::command]
pub fn shot_write(path: String, data_url: String, clipboard: bool) -> Result<(), String> {
    let (_mime, bytes) = parse_data_url(&data_url)?;
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    if clipboard {
        if let Ok(img) = image::load_from_memory(&bytes) {
            let _ = copy_image_to_clipboard(&img.to_rgba8());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn shot_clipboard(data_url: String) -> Result<(), String> {
    let (_mime, bytes) = parse_data_url(&data_url)?;
    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    if copy_image_to_clipboard(&img.to_rgba8()) {
        Ok(())
    } else {
        Err("Kopiranje u clipboard nije uspelo.".to_string())
    }
}
```

- [ ] **Step 2: Registrovati komande**

U `apps/gui/src-tauri/src/lib.rs`, u `generate_handler!`, posle `screenshot::shot_reveal,`:

```rust
            screenshot::shot_reveal,
            screenshot::shot_read,
            screenshot::shot_write,
            screenshot::shot_clipboard,
```

- [ ] **Step 3: Verify build**

Run (iz `apps/gui/src-tauri/`): `cargo build`
Expected: build prolazi bez grešaka.

- [ ] **Step 4: Commit**

```bash
git add apps/gui/src-tauri/src/screenshot.rs apps/gui/src-tauri/src/lib.rs
git commit -m "feat(rust): shot_read/shot_write/shot_clipboard komande"
```

---

## FAZA 3 — Frontend: model + API + ruta

### Task 7: Čist model editora (tipovi + reducer + serijalizacija)

**Files:**
- Create: `apps/gui/src/features/photoEditor/photoEditorModel.ts`
- Test: `apps/gui/src/features/photoEditor/photoEditorModel.test.ts`

**Interfaces:**
- Produces:
  - Tipovi: `Point`, `Tool`, `EditorObject`, `Crop`, `EditorState`, `ProjectFile`, `EditorMeta`.
  - `initialState(): EditorState`
  - `reducer(state: EditorState, action: EditorAction): EditorState` sa akcijama:
    `{type:"add", object}`, `{type:"setCrop", crop}`, `{type:"undo"}`, `{type:"redo"}`, `{type:"load", objects, crop}`.
  - `serializeProject(meta: EditorMeta, baseImage: string, state: EditorState): ProjectFile`
  - `deserializeProject(project: ProjectFile): { baseImage: string; state: EditorState; meta: EditorMeta }`

- [ ] **Step 1: Write the failing test**

`apps/gui/src/features/photoEditor/photoEditorModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  deserializeProject,
  initialState,
  reducer,
  serializeProject,
  type EditorObject,
  type ProjectFile,
} from "./photoEditorModel";

const rect: EditorObject = {
  type: "rect",
  color: "#ff0000",
  width: 4,
  x: 1,
  y: 2,
  w: 3,
  h: 4,
};

describe("photoEditorModel", () => {
  it("adds objects", () => {
    const state = reducer(initialState(), { type: "add", object: rect });
    expect(state.objects).toEqual([rect]);
  });

  it("undo and redo an add", () => {
    const added = reducer(initialState(), { type: "add", object: rect });
    const undone = reducer(added, { type: "undo" });
    expect(undone.objects).toEqual([]);
    const redone = reducer(undone, { type: "redo" });
    expect(redone.objects).toEqual([rect]);
  });

  it("round-trips through serialize/deserialize", () => {
    const state = reducer(initialState(), { type: "add", object: rect });
    const meta = { title: "T", originalPath: "C:/a.png", exportPath: null };
    const project = serializeProject(meta, "data:image/png;base64,AAAA", state);

    const back = deserializeProject(project);
    expect(back.baseImage).toBe("data:image/png;base64,AAAA");
    expect(back.state.objects).toEqual([rect]);
    expect(back.meta.originalPath).toBe("C:/a.png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (iz `apps/gui/`): `npx vitest run src/features/photoEditor/photoEditorModel.test.ts`
Expected: FAIL (modul ne postoji).

- [ ] **Step 3: Write minimal implementation**

`apps/gui/src/features/photoEditor/photoEditorModel.ts`:

```ts
// ==========          MODEL PHOTO EDITOR-a (čist)          ==========

export type Point = [number, number];

export type Tool =
  | "select"
  | "crop"
  | "pen"
  | "rect"
  | "line"
  | "arrow"
  | "text"
  | "blur";

export type EditorObject =
  | { type: "pen"; color: string; width: number; points: Point[] }
  | { type: "rect"; color: string; width: number; x: number; y: number; w: number; h: number }
  | { type: "line"; color: string; width: number; x1: number; y1: number; x2: number; y2: number }
  | { type: "arrow"; color: string; width: number; x1: number; y1: number; x2: number; y2: number }
  | { type: "text"; color: string; size: number; x: number; y: number; text: string }
  | { type: "blur"; x: number; y: number; w: number; h: number; strength: number };

export type Crop = { x: number; y: number; w: number; h: number } | null;

type Snapshot = { objects: EditorObject[]; crop: Crop };

export type EditorState = Snapshot & {
  past: Snapshot[];
  future: Snapshot[];
};

export type EditorMeta = {
  title: string;
  originalPath: string;
  exportPath: string | null;
  id?: string;
};

export type ProjectFile = {
  schema_version: 1;
  id?: string;
  title: string;
  original_path: string;
  export_path?: string | null;
  base_image: string;
  crop: Crop;
  objects: EditorObject[];
  created_at?: string;
  touched_at?: string;
};

export type EditorAction =
  | { type: "add"; object: EditorObject }
  | { type: "setCrop"; crop: Crop }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; objects: EditorObject[]; crop: Crop };

export function initialState(): EditorState {
  return { objects: [], crop: null, past: [], future: [] };
}

function snapshot(state: EditorState): Snapshot {
  return { objects: state.objects, crop: state.crop };
}

export function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "add":
      return {
        objects: [...state.objects, action.object],
        crop: state.crop,
        past: [...state.past, snapshot(state)],
        future: [],
      };
    case "setCrop":
      return {
        objects: state.objects,
        crop: action.crop,
        past: [...state.past, snapshot(state)],
        future: [],
      };
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) {
        return state;
      }
      return {
        objects: previous.objects,
        crop: previous.crop,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) {
        return state;
      }
      return {
        objects: next.objects,
        crop: next.crop,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(1),
      };
    }
    case "load":
      return {
        objects: action.objects,
        crop: action.crop,
        past: [],
        future: [],
      };
    default:
      return state;
  }
}

export function serializeProject(
  meta: EditorMeta,
  baseImage: string,
  state: EditorState,
): ProjectFile {
  return {
    schema_version: 1,
    id: meta.id,
    title: meta.title,
    original_path: meta.originalPath,
    export_path: meta.exportPath,
    base_image: baseImage,
    crop: state.crop,
    objects: state.objects,
  };
}

export function deserializeProject(project: ProjectFile): {
  baseImage: string;
  state: EditorState;
  meta: EditorMeta;
} {
  return {
    baseImage: project.base_image,
    state: {
      objects: project.objects ?? [],
      crop: project.crop ?? null,
      past: [],
      future: [],
    },
    meta: {
      title: project.title,
      originalPath: project.original_path,
      exportPath: project.export_path ?? null,
      id: project.id,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (iz `apps/gui/`): `npx vitest run src/features/photoEditor/photoEditorModel.test.ts`
Expected: PASS (3 testa).

- [ ] **Step 5: Commit**

```bash
git add apps/gui/src/features/photoEditor/photoEditorModel.ts apps/gui/src/features/photoEditor/photoEditorModel.test.ts
git commit -m "feat(editor): čist model (reducer + serijalizacija projekta)"
```

---

### Task 8: Frontend API sloj (`photoEditorApi.ts`)

**Files:**
- Create: `apps/gui/src/features/photoEditor/photoEditorApi.ts`

**Interfaces:**
- Consumes: `ProjectFile` (Task 7), `getApiUrl` (`../../services/httpClient`), `isTauri` (`../window/windowManager`), `invoke` (`@tauri-apps/api/core`).
- Produces:
  - `readImage(path: string): Promise<string>` — Tauri `shot_read`.
  - `writeImage(path: string, dataUrl: string, clipboard: boolean): Promise<void>` — Tauri `shot_write`.
  - `copyImage(dataUrl: string): Promise<void>` — Tauri `shot_clipboard`.
  - `listProjects(): Promise<{ id: string; title: string; touched_at: string }[]>`
  - `loadProject(id: string): Promise<ProjectFile>`
  - `saveProject(project: ProjectFile): Promise<string>` (vraća id)
  - `deleteProject(id: string): Promise<void>`

Napomena: bez zasebnog unit-testa (tanak omotač oko `invoke`/`fetch`, kao `screenshotApi.ts`). Verifikacija: `npm run build` (typecheck) u Task 15 i ručno u aplikaciji.

- [ ] **Step 1: Create file**

`apps/gui/src/features/photoEditor/photoEditorApi.ts`:

```ts
// ==========          PHOTO EDITOR API          ==========
/*
 * Tanak omotač: Rust komande (pikseli) + system endpointi (projekti).
 */

import { invoke } from "@tauri-apps/api/core";

import { getApiUrl } from "../../services/httpClient";
import { isTauri } from "../window/windowManager";
import type { ProjectFile } from "./photoEditorModel";

export async function readImage(path: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Photo Editor radi samo u CORE desktop aplikaciji.");
  }
  return await invoke<string>("shot_read", { path });
}

export async function writeImage(
  path: string,
  dataUrl: string,
  clipboard: boolean,
): Promise<void> {
  await invoke("shot_write", { path, dataUrl, clipboard });
}

export async function copyImage(dataUrl: string): Promise<void> {
  await invoke("shot_clipboard", { dataUrl });
}

type Summary = { id: string; title: string; touched_at: string };

export async function listProjects(): Promise<Summary[]> {
  const response = await fetch(getApiUrl("/api/v1/system/editor/projects"));
  if (!response.ok) {
    throw new Error("Lista projekata nije dostupna.");
  }
  return ((await response.json()) as { projects: Summary[] }).projects;
}

export async function loadProject(id: string): Promise<ProjectFile> {
  const response = await fetch(
    getApiUrl(`/api/v1/system/editor/projects/${id}`),
  );
  if (!response.ok) {
    throw new Error("Projekat nije pronađen.");
  }
  return (await response.json()) as ProjectFile;
}

export async function saveProject(project: ProjectFile): Promise<string> {
  const response = await fetch(getApiUrl("/api/v1/system/editor/projects"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!response.ok) {
    throw new Error("Čuvanje projekta nije uspelo.");
  }
  return ((await response.json()) as { id: string }).id;
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(getApiUrl(`/api/v1/system/editor/projects/${id}`), {
    method: "DELETE",
  });
}
```

- [ ] **Step 2: Verify import resolves**

Proveriti da `getApiUrl` i `isTauri` postoje na navedenim putanjama (koristi ih `screenshotApi.ts`). Ako se imena razlikuju, uskladi importe.

- [ ] **Step 3: Commit**

```bash
git add apps/gui/src/features/photoEditor/photoEditorApi.ts
git commit -m "feat(editor): frontend API sloj (Rust + system endpointi)"
```

---

### Task 9: Ruta i prazna strana editora

**Files:**
- Create: `apps/gui/src/pages/PhotoEditorPage.tsx`
- Create: `apps/gui/src/styles/photo-editor.css`
- Modify: `apps/gui/src/App.tsx` (import + `<Route>`)

**Interfaces:**
- Consumes: `useLocation`/`useNavigate` (react-router), `readImage`/`loadProject` (Task 8), `deserializeProject`/`initialState` (Task 7).
- Produces: ruta `/photo-editor`; strana čita `location.state` (`{ sourcePath?: string; projectId?: string }`).

- [ ] **Step 1: Create page skeleton**

`apps/gui/src/pages/PhotoEditorPage.tsx`:

```tsx
import { useEffect, useReducer, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  initialState,
  reducer,
  deserializeProject,
  type EditorMeta,
} from "../features/photoEditor/photoEditorModel";
import {
  readImage,
  loadProject,
} from "../features/photoEditor/photoEditorApi";

import "../styles/photo-editor.css";

type EditorLocationState = {
  sourcePath?: string;
  projectId?: string;
};

function PhotoEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as EditorLocationState;

  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [meta, setMeta] = useState<EditorMeta | null>(null);
  const [editor, dispatch] = useReducer(reducer, undefined, initialState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        if (state.projectId) {
          const project = await loadProject(state.projectId);
          const restored = deserializeProject(project);
          if (!active) return;
          setBaseImage(restored.baseImage);
          setMeta(restored.meta);
          dispatch({
            type: "load",
            objects: restored.state.objects,
            crop: restored.state.crop,
          });
        } else if (state.sourcePath) {
          const dataUrl = await readImage(state.sourcePath);
          if (!active) return;
          setBaseImage(dataUrl);
          setMeta({
            title: state.sourcePath.split(/[\\/]/).pop() ?? "Snimak",
            originalPath: state.sourcePath,
            exportPath: null,
          });
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    void boot();
    return () => {
      active = false;
    };
  }, [state.projectId, state.sourcePath]);

  return (
    <div className="photo-editor">
      <header className="photo-editor-head">
        <h1>Photo Editor</h1>
        <button type="button" onClick={() => navigate(-1)}>
          Zatvori
        </button>
      </header>
      {error && <p className="photo-editor-error">{error}</p>}
      {!baseImage && !error && (
        <p className="photo-editor-empty">
          Otvori snimak iz „Snimak ekrana" ili izaberi projekat.
        </p>
      )}
      {/* Platno i alatnik dolaze u Task 10–13. */}
      {baseImage && meta && (
        <div className="photo-editor-body" data-title={meta.title}>
          <img src={baseImage} alt="baza" style={{ maxWidth: "100%" }} />
        </div>
      )}
    </div>
  );
}

export default PhotoEditorPage;
```

- [ ] **Step 2: Add stylesheet (minimalno)**

`apps/gui/src/styles/photo-editor.css`:

```css
.photo-editor { display: flex; flex-direction: column; height: 100%; }
.photo-editor-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; }
.photo-editor-body { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; }
.photo-editor-error { color: #ff6b6b; padding: 8px 12px; }
.photo-editor-empty { padding: 24px; opacity: 0.7; }
```

- [ ] **Step 3: Register route**

U `apps/gui/src/App.tsx`, import posle ostalih strana:

```tsx
import PhotoEditorPage from "./pages/PhotoEditorPage";
```

Dodati rutu (npr. posle `/settings`):

```tsx
        <Route
          path="/photo-editor"
          element={<PhotoEditorPage />}
        />
```

- [ ] **Step 4: Verify build/typecheck**

Run (iz `apps/gui/`): `npm run build`
Expected: prolazi (tsc + vite). Ako `useReducer(reducer, undefined, initialState)` tipizacija zapne, koristi `useReducer(reducer, initialState())`.

- [ ] **Step 5: Commit**

```bash
git add apps/gui/src/pages/PhotoEditorPage.tsx apps/gui/src/styles/photo-editor.css apps/gui/src/App.tsx
git commit -m "feat(editor): ruta /photo-editor + prazna strana (učitava snimak/projekat)"
```

---

## FAZA 4 — Platno i alati

### Task 10: `EditorCanvas` — render bazne slike + objekata (bez blur/crop)

**Files:**
- Create: `apps/gui/src/features/photoEditor/EditorCanvas.tsx`
- Modify: `apps/gui/src/pages/PhotoEditorPage.tsx` (zameni `<img>` sa `<EditorCanvas>`)

**Interfaces:**
- Consumes: `EditorObject[]`, `Crop` (Task 7).
- Produces:
  - `renderScene(ctx, base, objects, crop, options)` — čista* render funkcija (crta bazu + objekte; blur/crop u Task 12–13). *Prima `CanvasRenderingContext2D` i `HTMLImageElement`.
  - `<EditorCanvas base={HTMLImageElement} objects={EditorObject[]} crop={Crop} tool onCommit={(o)=>void} onCrop={(c)=>void} color width textSize />`

- [ ] **Step 1: Draw helper + object rendering**

`apps/gui/src/features/photoEditor/EditorCanvas.tsx` (render sekcija; puni fajl uključuje i pokazivač-logiku iz Task 11):

```tsx
import { useEffect, useRef } from "react";

import type { Crop, EditorObject, Tool } from "./photoEditorModel";

export function drawObject(
  ctx: CanvasRenderingContext2D,
  object: EditorObject,
): void {
  ctx.save();
  if (object.type === "pen") {
    ctx.strokeStyle = object.color;
    ctx.lineWidth = object.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    object.points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  } else if (object.type === "rect") {
    ctx.strokeStyle = object.color;
    ctx.lineWidth = object.width;
    ctx.strokeRect(object.x, object.y, object.w, object.h);
  } else if (object.type === "line" || object.type === "arrow") {
    ctx.strokeStyle = object.color;
    ctx.lineWidth = object.width;
    ctx.beginPath();
    ctx.moveTo(object.x1, object.y1);
    ctx.lineTo(object.x2, object.y2);
    ctx.stroke();
    if (object.type === "arrow") {
      const angle = Math.atan2(object.y2 - object.y1, object.x2 - object.x1);
      const head = 8 + object.width * 2;
      ctx.beginPath();
      ctx.moveTo(object.x2, object.y2);
      ctx.lineTo(
        object.x2 - head * Math.cos(angle - Math.PI / 6),
        object.y2 - head * Math.sin(angle - Math.PI / 6),
      );
      ctx.moveTo(object.x2, object.y2);
      ctx.lineTo(
        object.x2 - head * Math.cos(angle + Math.PI / 6),
        object.y2 - head * Math.sin(angle + Math.PI / 6),
      );
      ctx.stroke();
    }
  } else if (object.type === "text") {
    ctx.fillStyle = object.color;
    ctx.font = `${object.size}px sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(object.text, object.x, object.y);
  }
  ctx.restore();
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  objects: EditorObject[],
): void {
  ctx.clearRect(0, 0, base.naturalWidth, base.naturalHeight);
  ctx.drawImage(base, 0, 0);
  for (const object of objects) {
    if (object.type === "blur") continue; // Task 12
    drawObject(ctx, object);
  }
}
```

- [ ] **Step 2: Canvas component (osnovni render, bez interakcije)**

Dodati u isti fajl:

```tsx
type EditorCanvasProps = {
  base: HTMLImageElement;
  objects: EditorObject[];
  crop: Crop;
  tool: Tool;
  color: string;
  width: number;
  textSize: number;
  onCommit: (object: EditorObject) => void;
  onCrop: (crop: Crop) => void;
};

function EditorCanvas(props: EditorCanvasProps) {
  const { base, objects } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = base.naturalWidth;
    canvas.height = base.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) renderScene(ctx, base, objects);
  }, [base, objects]);

  return (
    <canvas
      ref={canvasRef}
      className="photo-editor-canvas"
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
}

export default EditorCanvas;
```

- [ ] **Step 3: Load base image as HTMLImageElement in the page**

U `PhotoEditorPage.tsx` zameniti čuvanje `baseImage: string` dopunom: napravi `HTMLImageElement`. Dodati stanje `const [baseEl, setBaseEl] = useState<HTMLImageElement | null>(null);` i posle `setBaseImage(dataUrl)`:

```tsx
          const image = new Image();
          image.onload = () => active && setBaseEl(image);
          image.src = dataUrl; // dataUrl iz readImage / restored.baseImage
```

Zatim u JSX zameniti `<img ...>` blok sa:

```tsx
      {baseEl && meta && (
        <div className="photo-editor-body">
          <EditorCanvas
            base={baseEl}
            objects={editor.objects}
            crop={editor.crop}
            tool={"select"}
            color={"#ff3b30"}
            width={4}
            textSize={28}
            onCommit={(object) => dispatch({ type: "add", object })}
            onCrop={(crop) => dispatch({ type: "setCrop", crop })}
          />
        </div>
      )}
```

I dodati import `import EditorCanvas from "../features/photoEditor/EditorCanvas";`.

- [ ] **Step 4: Verify build + browser**

Run (iz `apps/gui/`): `npm run build` → prolazi.
Ručno (Task 15 flow ili odmah): pokreni dev, snimi ekran, klik „Editor" (dodaje se u Task 14) — do tada testiraj otvaranjem `/photo-editor` sa test snimkom kroz preview kad Task 14 doda dugme. Za sada dovoljno: build prolazi.

- [ ] **Step 5: Commit**

```bash
git add apps/gui/src/features/photoEditor/EditorCanvas.tsx apps/gui/src/pages/PhotoEditorPage.tsx
git commit -m "feat(editor): EditorCanvas render bazne slike + objekata"
```

---

### Task 11: Alati crtanja (pen, rect, line, arrow, text) — interakcija pokazivačem

**Files:**
- Modify: `apps/gui/src/features/photoEditor/EditorCanvas.tsx`

**Interfaces:**
- Produces: pokazivač-logika koja gradi objekat po `tool` i zove `onCommit`. Koordinate se skaliraju iz CSS piksela u piksele bazne slike (`base.naturalWidth / rect.width`).

- [ ] **Step 1: Add pointer handlers**

U `EditorCanvas`, dodati praćenje prevlačenja i „draft" objekat koji se crta preko scene dok se vuče. Ključni delovi:

```tsx
import { useRef, useState, useEffect } from "react";
// ...
  const [draft, setDraft] = useState<EditorObject | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function toImageXY(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = base.naturalWidth / rect.width;
    const scaleY = base.naturalHeight / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const { x, y } = toImageXY(event);
    startRef.current = { x, y };
    const { tool, color, width, textSize } = props;
    if (tool === "text") {
      const text = window.prompt("Tekst:") ?? "";
      if (text) props.onCommit({ type: "text", color, size: textSize, x, y, text });
      startRef.current = null;
      return;
    }
    if (tool === "pen") setDraft({ type: "pen", color, width, points: [[x, y]] });
    else if (tool === "rect") setDraft({ type: "rect", color, width, x, y, w: 0, h: 0 });
    else if (tool === "line") setDraft({ type: "line", color, width, x1: x, y1: y, x2: x, y2: y });
    else if (tool === "arrow") setDraft({ type: "arrow", color, width, x1: x, y1: y, x2: x, y2: y });
    else if (tool === "blur") setDraft({ type: "blur", x, y, w: 0, h: 0, strength: 12 });
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!startRef.current || !draft) return;
    const { x, y } = toImageXY(event);
    const s = startRef.current;
    if (draft.type === "pen") setDraft({ ...draft, points: [...draft.points, [x, y]] });
    else if (draft.type === "rect" || draft.type === "blur")
      setDraft({ ...draft, x: Math.min(s.x, x), y: Math.min(s.y, y), w: Math.abs(x - s.x), h: Math.abs(y - s.y) });
    else if (draft.type === "line" || draft.type === "arrow")
      setDraft({ ...draft, x2: x, y2: y });
  }

  function onPointerUp() {
    if (draft) {
      const meaningful =
        draft.type === "pen"
          ? draft.points.length > 1
          : draft.type === "rect" || draft.type === "blur"
            ? draft.w > 2 && draft.h > 2
            : Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 2;
      if (meaningful) props.onCommit(draft);
    }
    setDraft(null);
    startRef.current = null;
  }
```

Vezati na `<canvas>`: `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerLeave={onPointerUp}`, `style={{ touchAction: "none", ... }}`.

- [ ] **Step 2: Render draft over the scene**

U `useEffect` render, posle `renderScene(...)`, dodati crtanje draft-a:

```tsx
    if (ctx && draft && draft.type !== "blur") drawObject(ctx, draft);
```

I dodati `draft` u zavisnosti `useEffect`-a: `[base, objects, draft]`.

- [ ] **Step 3: Verify build + manual**

Run (iz `apps/gui/`): `npm run build` → prolazi.
Ručna provera (posle Task 14): crtanje pravougaonika/strelice/olovke/teksta radi i ostaje na platnu.

- [ ] **Step 4: Commit**

```bash
git add apps/gui/src/features/photoEditor/EditorCanvas.tsx
git commit -m "feat(editor): alati pen/rect/line/arrow/text (pointer interakcija)"
```

---

### Task 12: Blur alat (render iz bazne slike)

**Files:**
- Modify: `apps/gui/src/features/photoEditor/EditorCanvas.tsx`

**Interfaces:**
- Produces: render `blur` objekata — zamuti region bazne slike i iscrta ga u taj okvir (recomputed svaki put).

- [ ] **Step 1: Draw blur regions**

Dodati funkciju i pozvati je u render (posle bazne slike, PRE ostalih objekata da anotacije ostanu oštre):

```tsx
export function drawBlur(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  region: { x: number; y: number; w: number; h: number; strength: number },
): void {
  if (region.w < 1 || region.h < 1) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.w, region.h);
  ctx.clip();
  (ctx as CanvasRenderingContext2D).filter = `blur(${region.strength}px)`;
  ctx.drawImage(base, 0, 0);
  ctx.filter = "none";
  ctx.restore();
}
```

U `renderScene`, promeni potpis da prima `base` i crta blur regije:

```tsx
export function renderScene(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  objects: EditorObject[],
): void {
  ctx.clearRect(0, 0, base.naturalWidth, base.naturalHeight);
  ctx.drawImage(base, 0, 0);
  for (const object of objects) {
    if (object.type === "blur") drawBlur(ctx, base, object);
  }
  for (const object of objects) {
    if (object.type !== "blur") drawObject(ctx, object);
  }
}
```

Dodati crtanje draft-blur-a u `useEffect`:

```tsx
    if (ctx && draft && draft.type === "blur") drawBlur(ctx, base, draft);
```

- [ ] **Step 2: Verify build + manual**

Run (iz `apps/gui/`): `npm run build` → prolazi. Ručno: povlačenje blur okvira zamuti deo slike.

- [ ] **Step 3: Commit**

```bash
git add apps/gui/src/features/photoEditor/EditorCanvas.tsx
git commit -m "feat(editor): blur alat (zamućenje regiona iz bazne slike)"
```

---

### Task 13: Crop (prikaz zatamnjenja + izvoz sa isecanjem)

**Files:**
- Modify: `apps/gui/src/features/photoEditor/EditorCanvas.tsx` (prikaz crop okvira)
- Create: `apps/gui/src/features/photoEditor/exportImage.ts` (+ test)
- Test: `apps/gui/src/features/photoEditor/exportImage.test.ts`

**Interfaces:**
- Produces:
  - Prikaz: dok je `tool === "crop"`, povlačenje postavlja `onCrop(rect)`; van-oblast se zatamni.
  - `exportCanvas(base, objects, crop): HTMLCanvasElement` — offscreen canvas pune rezolucije, primeni crop, iscrta scenu; koristi se za `toDataURL`.
  - `computeExportSize(base, crop): { width, height; ox; oy }` — čista funkcija (testabilna).

- [ ] **Step 1: Write the failing test (čista funkcija veličine)**

`apps/gui/src/features/photoEditor/exportImage.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { computeExportSize } from "./exportImage";

describe("computeExportSize", () => {
  it("uses full image when no crop", () => {
    expect(computeExportSize(1920, 1080, null)).toEqual({ width: 1920, height: 1080, ox: 0, oy: 0 });
  });

  it("uses crop bounds clamped to image", () => {
    expect(computeExportSize(100, 100, { x: 10, y: 20, w: 200, h: 50 })).toEqual({
      width: 90,
      height: 50,
      ox: 10,
      oy: 20,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (iz `apps/gui/`): `npx vitest run src/features/photoEditor/exportImage.test.ts`
Expected: FAIL (modul ne postoji).

- [ ] **Step 3: Implement export helpers**

`apps/gui/src/features/photoEditor/exportImage.ts`:

```ts
import type { Crop, EditorObject } from "./photoEditorModel";
import { renderScene } from "./EditorCanvas";

export function computeExportSize(
  imageWidth: number,
  imageHeight: number,
  crop: Crop,
): { width: number; height: number; ox: number; oy: number } {
  if (!crop) {
    return { width: imageWidth, height: imageHeight, ox: 0, oy: 0 };
  }
  const ox = Math.max(0, Math.min(crop.x, imageWidth));
  const oy = Math.max(0, Math.min(crop.y, imageHeight));
  const width = Math.max(1, Math.min(crop.w, imageWidth - ox));
  const height = Math.max(1, Math.min(crop.h, imageHeight - oy));
  return { width, height, ox, oy };
}

export function exportDataUrl(
  base: HTMLImageElement,
  objects: EditorObject[],
  crop: Crop,
): string {
  const full = document.createElement("canvas");
  full.width = base.naturalWidth;
  full.height = base.naturalHeight;
  const fullCtx = full.getContext("2d");
  if (!fullCtx) return "";
  renderScene(fullCtx, base, objects);

  const { width, height, ox, oy } = computeExportSize(
    base.naturalWidth,
    base.naturalHeight,
    crop,
  );
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const outCtx = out.getContext("2d");
  if (!outCtx) return "";
  outCtx.drawImage(full, ox, oy, width, height, 0, 0, width, height);
  return out.toDataURL("image/png");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (iz `apps/gui/`): `npx vitest run src/features/photoEditor/exportImage.test.ts`
Expected: PASS (2 testa).

- [ ] **Step 5: Crop prikaz u EditorCanvas**

U render `useEffect`, posle scene, ako postoji `crop` ILI je `tool==="crop"` sa draft-om, zatamni van-oblast:

```tsx
    const view = props.crop;
    if (ctx && view) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, base.naturalWidth, base.naturalHeight);
      ctx.clearRect(view.x, view.y, view.w, view.h);
      ctx.drawImage(base, view.x, view.y, view.w, view.h, view.x, view.y, view.w, view.h);
      // Ponovo iscrtaj objekte unutar crop-a nije nužno za prikaz okvira.
      ctx.strokeStyle = "#00d0ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(view.x, view.y, view.w, view.h);
      ctx.restore();
    }
```

I u `onPointerUp`, kad je `tool === "crop"` i draft je bio rect-oblik, pozovi `props.onCrop({ x, y, w, h })` umesto `onCommit`. (Dodaj granu: za `tool==="crop"` koristi `rect` draft ali komituj kao crop.)

- [ ] **Step 6: Verify build + commit**

Run (iz `apps/gui/`): `npm run build` → prolazi.

```bash
git add apps/gui/src/features/photoEditor/exportImage.ts apps/gui/src/features/photoEditor/exportImage.test.ts apps/gui/src/features/photoEditor/EditorCanvas.tsx
git commit -m "feat(editor): crop prikaz + izvoz slike (sa isecanjem)"
```

---

## FAZA 5 — Alatnik, čuvanje, ulazi

### Task 14: Alatnik + akcije (SAVE / SAVE AS / Kopiraj) + „Editor" dugme u pregledu

**Files:**
- Create: `apps/gui/src/features/photoEditor/EditorToolbar.tsx`
- Modify: `apps/gui/src/pages/PhotoEditorPage.tsx` (alatnik, izbor alata/boje, akcije čuvanja)
- Modify: `apps/gui/src/features/screenshot/ScreenshotPreview.tsx` (dugme „Editor")

**Interfaces:**
- Consumes: `exportDataUrl` (Task 13), `writeImage`/`copyImage`/`saveProject` (Task 8), `serializeProject` (Task 7).
- Produces:
  - `<EditorToolbar tool setTool color setColor width setWidth textSize setTextSize onUndo onRedo onSave onSaveAs onCopy onClose />`
  - Ponašanje: SAVE → `writeImage(originalPath, dataUrl, true)`; SAVE AS → `writeImage(<ime>-edit.png, dataUrl, false)` + `saveProject(serializeProject(...))`; Kopiraj → `copyImage(dataUrl)`.

- [ ] **Step 1: Toolbar component**

`apps/gui/src/features/photoEditor/EditorToolbar.tsx`:

```tsx
import type { Tool } from "./photoEditorModel";

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: "select", label: "Kursor" },
  { tool: "crop", label: "Iseci" },
  { tool: "pen", label: "Olovka" },
  { tool: "rect", label: "Okvir" },
  { tool: "line", label: "Linija" },
  { tool: "arrow", label: "Strelica" },
  { tool: "text", label: "Tekst" },
  { tool: "blur", label: "Blur" },
];

type Props = {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  width: number;
  setWidth: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCopy: () => void;
  onClose: () => void;
};

function EditorToolbar(props: Props) {
  return (
    <div className="photo-editor-toolbar">
      <div className="pe-tools">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            type="button"
            className={props.tool === t.tool ? "active" : ""}
            onClick={() => props.setTool(t.tool)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input type="color" value={props.color} onChange={(e) => props.setColor(e.target.value)} />
      <input
        type="range"
        min={1}
        max={20}
        value={props.width}
        onChange={(e) => props.setWidth(Number(e.target.value))}
      />
      <div className="pe-actions">
        <button type="button" onClick={props.onUndo}>Undo</button>
        <button type="button" onClick={props.onRedo}>Redo</button>
        <button type="button" onClick={props.onSave}>Save</button>
        <button type="button" onClick={props.onSaveAs}>Save As</button>
        <button type="button" onClick={props.onCopy}>Kopiraj</button>
        <button type="button" onClick={props.onClose}>Zatvori</button>
      </div>
    </div>
  );
}

export default EditorToolbar;
```

- [ ] **Step 2: Wire toolbar + save handlers in the page**

U `PhotoEditorPage.tsx` dodati stanje `tool/color/width/textSize`, uvesti `EditorToolbar`, `exportDataUrl`, `writeImage`, `copyImage`, `saveProject`, `serializeProject`. Implementirati:

```tsx
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#ff3b30");
  const [width, setWidth] = useState(4);
  const [textSize] = useState(28);

  function currentDataUrl(): string | null {
    if (!baseEl) return null;
    return exportDataUrl(baseEl, editor.objects, editor.crop);
  }

  async function handleSave() {
    const dataUrl = currentDataUrl();
    if (!dataUrl || !meta) return;
    await writeImage(meta.originalPath, dataUrl, true);
  }

  function editPath(original: string): string {
    const dot = original.lastIndexOf(".");
    return dot > 0 ? `${original.slice(0, dot)}-edit.png` : `${original}-edit.png`;
  }

  async function handleSaveAs() {
    const dataUrl = currentDataUrl();
    if (!dataUrl || !meta || !baseImage) return;
    const exportPath = editPath(meta.originalPath);
    await writeImage(exportPath, dataUrl, false);
    const project = serializeProject(
      { ...meta, exportPath },
      baseImage,
      editor,
    );
    const id = await saveProject(project);
    setMeta({ ...meta, exportPath, id });
  }

  async function handleCopy() {
    const dataUrl = currentDataUrl();
    if (dataUrl) await copyImage(dataUrl);
  }
```

Dodati `<EditorToolbar ... />` iznad platna i proslediti `tool/color/width` u `<EditorCanvas>` (umesto hardkodovanih vrednosti iz Task 10). Undo/Redo dugmad: `dispatch({type:"undo"})` / `{type:"redo"}`.

- [ ] **Step 3: „Editor" dugme u ScreenshotPreview**

U `apps/gui/src/features/screenshot/ScreenshotPreview.tsx`:
- import `useNavigate` iz `react-router` i ikonu `Pencil` iz `lucide-react`.
- U `shot-preview-actions`, dodati dugme:

```tsx
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate("/photo-editor", { state: { sourcePath: result.path } });
                  }}
                >
                  <Pencil size={15} /> Editor
                </button>
```

- Na vrhu komponente: `const navigate = useNavigate();`

- [ ] **Step 4: Verify build + manual smoke**

Run (iz `apps/gui/`): `npm run build` → prolazi.
Ručno (dev + Tauri): snimi ekran → „Editor" → nacrtaj okvir → Save As → proveri da postoji `<ime>-edit.png` i da `GET /api/v1/system/editor/projects` vraća projekat.

- [ ] **Step 5: Commit**

```bash
git add apps/gui/src/features/photoEditor/EditorToolbar.tsx apps/gui/src/pages/PhotoEditorPage.tsx apps/gui/src/features/screenshot/ScreenshotPreview.tsx
git commit -m "feat(editor): alatnik + SAVE/SAVE AS/Kopiraj + Editor dugme u pregledu"
```

---

### Task 15: Lista projekata + Dashboard ikona

**Files:**
- Create: `apps/gui/src/features/photoEditor/ProjectsList.tsx`
- Modify: `apps/gui/src/pages/PhotoEditorPage.tsx` (prikaži listu kad nema izvora)
- Modify: `apps/gui/src/features/screenshot/ScreenshotDashboardPanel.tsx` (ikona „Foto editor")

**Interfaces:**
- Consumes: `listProjects`/`deleteProject` (Task 8), `useNavigate`.
- Produces:
  - `<ProjectsList onOpen={(id)=>void} />` — učita `listProjects()`, prikaže naslov + `touched_at`, dugme „Otvori" i „Obriši".
  - Dashboard: ikona koja radi `navigate("/photo-editor")`.

- [ ] **Step 1: ProjectsList component**

`apps/gui/src/features/photoEditor/ProjectsList.tsx`:

```tsx
import { useEffect, useState } from "react";

import { deleteProject, listProjects } from "./photoEditorApi";

type Summary = { id: string; title: string; touched_at: string };

function ProjectsList({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<Summary[]>([]);

  async function refresh() {
    try {
      setItems(await listProjects());
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (items.length === 0) {
    return <p className="photo-editor-empty">Nema sačuvanih projekata.</p>;
  }

  return (
    <ul className="pe-projects">
      {items.map((item) => (
        <li key={item.id}>
          <span>{item.title}</span>
          <small>{item.touched_at}</small>
          <button type="button" onClick={() => onOpen(item.id)}>Otvori</button>
          <button
            type="button"
            onClick={async () => {
              await deleteProject(item.id);
              await refresh();
            }}
          >
            Obriši
          </button>
        </li>
      ))}
    </ul>
  );
}

export default ProjectsList;
```

- [ ] **Step 2: Show list when no source in page**

U `PhotoEditorPage.tsx`, kada nema `state.sourcePath` ni `state.projectId` (tj. `!baseEl && !error`), prikazati:

```tsx
      {!baseEl && !error && (
        <div className="photo-editor-body">
          <ProjectsList
            onOpen={(id) =>
              navigate("/photo-editor", { state: { projectId: id } })
            }
          />
        </div>
      )}
```

Import `ProjectsList`. (Kad se `state.projectId` promeni, `useEffect` iz Task 9 ponovo učita — dodati `location.key` ili `state.projectId` u zavisnosti već pokriva.)

- [ ] **Step 3: Dashboard ikona**

U `apps/gui/src/features/screenshot/ScreenshotDashboardPanel.tsx`:
- import `useNavigate` (react-router) i ikonu `ImageUp`/`Pencil` (lucide-react).
- Dodati dugme-ikonu ispod grida (ili u `shot-dash-hint` red):

```tsx
      <button
        type="button"
        className="shot-dash-editor"
        onClick={() => navigate("/photo-editor")}
        title="Otvori Photo Editor"
      >
        <Pencil size={18} strokeWidth={1.7} /> Foto editor
      </button>
```

- Na vrhu: `const navigate = useNavigate();`

- [ ] **Step 4: Verify build + manual**

Run (iz `apps/gui/`): `npm run build` → prolazi.
Ručno: Dashboard → „Foto editor" ikona → lista projekata → „Otvori" vraća projekat u editovanje; „Obriši" ga uklanja.

- [ ] **Step 5: Commit**

```bash
git add apps/gui/src/features/photoEditor/ProjectsList.tsx apps/gui/src/pages/PhotoEditorPage.tsx apps/gui/src/features/screenshot/ScreenshotDashboardPanel.tsx
git commit -m "feat(editor): lista projekata + Dashboard ikona za Photo Editor"
```

---

## FAZA 6 — Poliranje

### Task 16: Upozorenje na nesačuvane izmene + finalna provera

**Files:**
- Modify: `apps/gui/src/pages/PhotoEditorPage.tsx`

**Interfaces:**
- Produces: „Zatvori" i `navigate(-1)` pitaju potvrdu ako ima objekata/crop-a koji nisu sačuvani od poslednjeg SAVE/SAVE AS.

- [ ] **Step 1: Track dirty state**

Dodati `const [savedAt, setSavedAt] = useState(0);` i brojač izmena; ili prostije: `dirty` = `editor.objects.length > 0 || editor.crop !== null` i `savedOnce`. Pri `handleSave`/`handleSaveAs` postaviti `setDirtySaved(true)`; na promenu `editor` postaviti `false`. „Zatvori":

```tsx
  function handleClose() {
    const dirty = editor.objects.length > 0 || editor.crop !== null;
    if (dirty && !window.confirm("Ima nesačuvanih izmena. Zatvoriti?")) return;
    navigate(-1);
  }
```

Vezati `handleClose` na dugme „Zatvori" u headeru i toolbaru.

- [ ] **Step 2: Full regression**

Run:
- `./.venv/Scripts/python.exe -m pytest tests/test_core_paths_screenshots.py tests/test_editor_project_service.py tests/test_api_system.py -q` → PASS
- iz `apps/gui/`: `npx vitest run src/features/photoEditor/` → PASS
- iz `apps/gui/`: `npm run build` → PASS
- iz `apps/gui/src-tauri/`: `cargo test` → PASS

- [ ] **Step 3: Commit**

```bash
git add apps/gui/src/pages/PhotoEditorPage.tsx
git commit -m "feat(editor): potvrda pri zatvaranju sa nesačuvanim izmenama"
```

---

## Self-review (pokriveno)

- Spec „Editor dugme u pregledu" → Task 14. „Dashboard ikona" → Task 15. „Zasebna strana/ruta" → Task 9. Alati (crop/pen/rect/line/arrow/text/blur) → Task 10–13. SAVE/SAVE AS/`.project`/Kopiraj → Task 14. Ugrađena bazna slika → Task 7 (`serializeProject`) + Task 14. Prune 7 dana → Task 3, povezan preko `list()` (Task 3/4). Rust `shot_read/shot_write/shot_clipboard` → Task 5–6. Python servis/endpointi → Task 2–4. Testovi → Task 1–3, 5, 7, 13.
- Tipovi dosledni: `EditorObject`, `Crop`, `ProjectFile`, `serializeProject/deserializeProject`, `renderScene/drawObject/drawBlur/exportDataUrl` koriste ista imena kroz Task 7, 10, 12, 13, 14.
- YAGNI: bez selekcije/pomeranja objekata, bez zooma — namerno izostavljeno (v1).
```
