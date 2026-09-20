#!/usr/bin/env python3
"""Pytest setup: dodaj oko/ na sys.path (paket `daemon`) + izoluj config u tmp."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def _isolate_config(tmp_path, monkeypatch):
    monkeypatch.setenv("OKO_CONFIG_DIR", str(tmp_path / "cfg"))
    # config modul čita env pri importu → reload da uhvati tmp putanju
    import importlib
    from daemon import config as cfg
    importlib.reload(cfg)
    yield
