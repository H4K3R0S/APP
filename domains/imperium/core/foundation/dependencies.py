"""Registar zavisnosti IMPERIUM ćelije.

Svaka ćelija (domen) sama opisuje šta joj treba da radi — ovo je IMPERIUM-ov
sopstveni registar, a ne zajednički "CORE iznad domena". Nabraja Python pakete,
Node okruženje i spoljne alate koje IMPERIUM zaista koristi: FastAPI backend,
Vite/React GUI, lokalnu Ollama za asistenta i hibridnu FTS + Postgres/pgvector
pretragu (RAG memorija). Registar čitaju API koji GUI-ju daje zdravstveni status
(`apps/api/routers/system.py`) i pozadinski instalater (`core/foundation/installer.py`).
"""

import importlib.util
import shutil
import sys
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

# Platforma: na Linux/Kali install hintovi idu preko apt/pip, ne winget-a.
_IS_WINDOWS = sys.platform.startswith("win")


def _hint(windows: str, linux: str) -> str:
    """Vrati install hint prikladan trenutnom OS-u (Windows vs Linux)."""

    return windows if _IS_WINDOWS else linux


# ==========          VRSTE I NIVOI          ==========

class DependencyKind(StrEnum):
    """Odakle dolazi zavisnost i kako se proverava."""

    PYTHON = "python"
    NODE = "node"
    NPM = "npm"
    SYSTEM = "system"


class DependencySeverity(StrEnum):
    """Koliko je zavisnost bitna za rad sistema."""

    CRITICAL = "critical"    # bez ovoga backend/GUI ne rade
    IMPORTANT = "important"  # sistem radi, ali neka funkcija nedostaje
    OPTIONAL = "optional"    # lepo je imati, nije nužno


class DependencyInstaller(StrEnum):
    """Kako se zavisnost automatski instalira preko INSTALL dugmeta."""

    PIP = "pip"                    # Python paket preko pip-a
    NPM = "npm"                    # GUI paket preko `npm install` u apps/gui
    WINGET = "winget"              # Windows paket preko winget-a
    PORTABLE_ZIP = "portable_zip"  # download release zip + raspakuj u bin/
    NONE = "none"                  # nema automatske instalacije


# ==========          MODEL ZAVISNOSTI          ==========

@dataclass(frozen=True)
class Dependency:
    """Jedna zavisnost i način na koji se proverava/instalira."""

    key: str
    label: str
    kind: DependencyKind
    severity: DependencySeverity
    # Python: ime za import; NPM: ime paketa iz package.json;
    # Node/System: ime izvršnog fajla na PATH-u.
    probe: str
    purpose: str
    install_hint: str
    installer: DependencyInstaller = DependencyInstaller.NONE
    # Ako je zadato, koristi se umesto provere po `kind` (custom provera).
    probe_fn: Callable[[], bool] | None = None


@dataclass(frozen=True)
class DependencyStatus:
    """Rezultat provere jedne zavisnosti."""

    dependency: Dependency
    installed: bool


# ==========          POSEBNE PROVERE          ==========

def npm_package_installed(
    package: str,
    gui_root: Path | None = None,
) -> bool:
    """Proverava da li je npm paket raspakovan u `apps/gui/node_modules`.

    npm paket nije izvršni fajl na PATH-u, nego folder sa svojim
    `package.json`. Zato se ne sme proveravati preko `shutil.which`.

    Args:
        package: Ime paketa iz `package.json`, uključujući scope
            (npr. `lucide-react` ili `@tauri-apps/api`).
        gui_root: Opcioni koren GUI aplikacije. Koristi se u testovima.
    """

    if gui_root is None:
        from core.foundation.paths import core_paths

        gui_root = core_paths.apps / "gui"

    # Scoped ime (`@tauri-apps/api`) se prirodno razrešava u ugnežđen folder.
    manifest = gui_root / "node_modules" / Path(package) / "package.json"

    return manifest.is_file()


# ==========          REGISTAR ZAVISNOSTI          ==========

DOMAIN_DEPENDENCIES: tuple[Dependency, ...] = (
    Dependency(
        key="fastapi",
        label="FastAPI",
        kind=DependencyKind.PYTHON,
        severity=DependencySeverity.CRITICAL,
        probe="fastapi",
        purpose="Backend API sloj IMPERIUM ćelije.",
        install_hint="python -m pip install -r requirements.txt",
    ),
    Dependency(
        key="uvicorn",
        label="Uvicorn",
        kind=DependencyKind.PYTHON,
        severity=DependencySeverity.CRITICAL,
        probe="uvicorn",
        purpose="ASGI server koji pokreće backend.",
        install_hint="python -m pip install -r requirements.txt",
    ),
    Dependency(
        key="python-multipart",
        label="python-multipart",
        kind=DependencyKind.PYTHON,
        severity=DependencySeverity.CRITICAL,
        probe="multipart",
        purpose="Upload fajlova i form podaci u FastAPI rutama.",
        install_hint="python -m pip install python-multipart",
    ),
    Dependency(
        key="node",
        label="Node.js",
        kind=DependencyKind.NODE,
        severity=DependencySeverity.IMPORTANT,
        probe="node",
        purpose="Pokretanje i build GUI-ja (Vite/React + Tauri API).",
        install_hint=_hint("Instaliraj Node.js LTS sa https://nodejs.org", "sudo apt install -y nodejs npm"),
    ),
    Dependency(
        key="psycopg",
        label="psycopg",
        kind=DependencyKind.PYTHON,
        severity=DependencySeverity.IMPORTANT,
        probe="psycopg",
        purpose="PostgreSQL klijent za RAG memoriju i vektor sloj (core/rag/*).",
        install_hint="python -m pip install -r requirements.txt",
    ),
    Dependency(
        key="pgvector",
        label="pgvector",
        kind=DependencyKind.PYTHON,
        severity=DependencySeverity.IMPORTANT,
        probe="pgvector",
        purpose="Registracija `vector` tipova u PostgreSQL-u za semantičku pretragu.",
        install_hint="python -m pip install -r requirements.txt",
    ),
    Dependency(
        key="watchdog",
        label="watchdog",
        kind=DependencyKind.PYTHON,
        severity=DependencySeverity.IMPORTANT,
        probe="watchdog",
        purpose="Automatsko praćenje foldera (System Layer nadzor diska).",
        install_hint="python -m pip install watchdog",
    ),
    Dependency(
        key="psutil",
        label="psutil",
        kind=DependencyKind.PYTHON,
        severity=DependencySeverity.IMPORTANT,
        probe="psutil",
        purpose="Detekcija priključenih diskova (USB) u System Layer-u.",
        install_hint="python -m pip install psutil",
    ),
    Dependency(
        key="keyring",
        label="keyring",
        kind=DependencyKind.PYTHON,
        severity=DependencySeverity.IMPORTANT,
        probe="keyring",
        purpose="Bezbedno čuvanje API ključeva u OS keychain-u (Credential Manager).",
        install_hint="python -m pip install keyring",
        installer=DependencyInstaller.PIP,
    ),
)


# Back-compat alias: `core/foundation/installer.py` i stariji pozivaoci i dalje
# uvoze `CORE_DEPENDENCIES`. Ne uklanjati bez izmene tih uvoza.
CORE_DEPENDENCIES: tuple[Dependency, ...] = DOMAIN_DEPENDENCIES


# ==========          PROVERA          ==========

def check_dependency(dependency: Dependency) -> bool:
    """Vraća True ako je zavisnost dostupna u trenutnom okruženju."""

    if dependency.probe_fn is not None:
        try:
            return dependency.probe_fn()
        except Exception:  # noqa: BLE001
            return False

    if dependency.kind is DependencyKind.PYTHON:
        try:
            return importlib.util.find_spec(dependency.probe) is not None
        except (ImportError, ValueError):
            return False

    if dependency.kind is DependencyKind.NPM:
        return npm_package_installed(dependency.probe)

    # Node i sistemski alati se traže kao izvršni fajl na PATH-u.
    return shutil.which(dependency.probe) is not None


def evaluate_dependencies(
    dependencies: tuple[Dependency, ...] = DOMAIN_DEPENDENCIES,
) -> tuple[DependencyStatus, ...]:
    """Proverava sve zavisnosti i vraća njihov status."""

    return tuple(
        DependencyStatus(
            dependency=dependency,
            installed=check_dependency(dependency),
        )
        for dependency in dependencies
    )


def overall_status(
    statuses: tuple[DependencyStatus, ...],
) -> str:
    """Sažima najveći nivo problema: "critical", "warning" ili "ok"."""

    missing = [status for status in statuses if not status.installed]

    if any(
        status.dependency.severity is DependencySeverity.CRITICAL
        for status in missing
    ):
        return "critical"

    if missing:
        return "warning"

    return "ok"
