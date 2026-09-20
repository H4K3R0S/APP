#!/usr/bin/env python3
"""IPC rute /pick/wait i /pick/result nad fake kontrolerom."""
import json
import urllib.request

import pytest

from daemon.ipc import IPCServer


class FakeCtl:
    def __init__(self):
        self.result_payload = None

    def health(self):
        return {"ok": True}

    def last(self):
        return {}

    def settings_get(self):
        return {}

    def settings_set(self, c):
        return {}

    def capture_sync(self, **k):
        return {}

    def pick_wait(self, pid):
        return {"action": "pick", "request_id": f"rid-{pid}"}

    def pick_result(self, request_id, payload):
        self.result_payload = (request_id, payload)
        return {"ok": True}


@pytest.fixture
def server():
    ctl = FakeCtl()
    srv = IPCServer(ctl, 0)
    srv.start()
    yield ctl, srv.port
    srv.stop()


def test_pick_wait(server):
    _ctl, port = server
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/pick/wait?pid=42", timeout=5) as r:
        d = json.loads(r.read())
    assert d == {"action": "pick", "request_id": "rid-42"}


def test_pick_result(server):
    ctl, port = server
    body = json.dumps({"request_id": "rid-42", "rect": {"x": 1, "y": 2, "w": 3, "h": 4}}).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{port}/pick/result", data=body,
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as r:
        assert json.loads(r.read()) == {"ok": True}
    assert ctl.result_payload[0] == "rid-42"
    assert ctl.result_payload[1]["rect"] == {"x": 1, "y": 2, "w": 3, "h": 4}
