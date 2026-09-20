#!/usr/bin/env python3
"""IPC transport nad fake kontrolerom (bez GUI/daemon-a)."""
import json
import urllib.request

import pytest

from daemon.ipc import IPCServer


class FakeController:
    def __init__(self):
        self.captured = None

    def health(self):
        return {"ok": True, "hotkey": "Insert", "mode": "region", "port": 0}

    def last(self):
        return {"dest": "file", "path": "/tmp/x.png"}

    def settings_get(self):
        return {"mode": "region", "hotkey": "Insert"}

    def settings_set(self, changes):
        return {"mode": changes.get("mode", "region"), "hotkey": "Insert"}

    def capture_sync(self, *, mode, dest, path, interactive):
        self.captured = (mode, dest, path, interactive)
        return {"dest": dest or "file", "path": "/tmp/shot.png", "mode": mode}


@pytest.fixture
def server():
    ctl = FakeController()
    srv = IPCServer(ctl, 0)
    srv.start()
    yield ctl, srv, srv.port
    srv.stop()


def _get(port, path):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=5) as r:
        return json.loads(r.read())


def _post(port, path, payload):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def test_health(server):
    _, _, port = server
    assert _get(port, "/health")["ok"] is True


def test_last(server):
    _, _, port = server
    assert _get(port, "/last")["path"] == "/tmp/x.png"


def test_settings_get_post(server):
    _, _, port = server
    assert _get(port, "/settings")["mode"] == "region"
    assert _post(port, "/settings", {"mode": "window"})["mode"] == "window"


def test_capture_routes_params(server):
    ctl, _, port = server
    res = _post(port, "/capture", {"mode": "screen", "dest": "clipboard"})
    assert res["mode"] == "screen"
    assert ctl.captured == ("screen", "clipboard", None, True)


def test_static_settings_page(server):
    _, _, port = server
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as r:
        body = r.read().decode()
    assert "OKO" in body and "<form" in body
