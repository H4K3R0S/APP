#!/usr/bin/env python3
"""PickRegistry: long-poll čekači po PID-u (register/wait/request/result), thread-safe."""
import threading
import time

from daemon.pick_registry import PickRegistry


def test_pick_roundtrip():
    reg = PickRegistry()
    got = {}

    def app():  # simulira cell-shell long-poll
        got["poll"] = reg.wait_for_pick(1234, timeout=2.0)
        if got["poll"].get("action") == "pick":
            reg.submit_result(got["poll"]["request_id"], {"rect": {"x": 1, "y": 2, "w": 3, "h": 4}})

    t = threading.Thread(target=app)
    t.start()
    time.sleep(0.1)  # pusti čekača da uđe u wait
    rid = reg.request_pick(1234)
    assert rid is not None
    res = reg.get_result(rid, timeout=2.0)
    t.join()
    assert res == {"rect": {"x": 1, "y": 2, "w": 3, "h": 4}}


def test_no_waiter_returns_none():
    reg = PickRegistry()
    assert reg.request_pick(9999) is None


def test_two_waiters_by_pid():
    reg = PickRegistry()
    out = {}

    def app(pid):
        r = reg.wait_for_pick(pid, timeout=2.0)
        out[pid] = r.get("action")
        if r.get("action") == "pick":
            reg.submit_result(r["request_id"], {"cancel": True})

    for pid in (11, 22):
        threading.Thread(target=app, args=(pid,)).start()
    time.sleep(0.1)
    rid = reg.request_pick(22)          # gađaj samo PID 22
    assert reg.get_result(rid, 2.0) == {"cancel": True}
    time.sleep(2.1)
    assert out.get(22) == "pick" and out.get(11) is None  # 11 istekao bez pick-a


def test_get_result_timeout():
    reg = PickRegistry()
    assert reg.get_result("nepostojeci", timeout=0.2) is None


def test_get_result_pops_on_timeout():
    reg = PickRegistry()

    def app():
        reg.wait_for_pick(3, 1.0)  # ne šalje rezultat

    threading.Thread(target=app).start()
    time.sleep(0.1)
    rid = reg.request_pick(3)
    assert reg.get_result(rid, timeout=0.2) is None      # timeout
    assert reg.submit_result(rid, {"rect": {}}) is False  # rid uklonjen posle timeout-a


def test_no_stale_replay():
    reg = PickRegistry()

    def app1():
        r = reg.wait_for_pick(4, 1.0)
        if r.get("action") == "pick":
            reg.submit_result(r["request_id"], {"cancel": True})

    threading.Thread(target=app1).start()
    time.sleep(0.1)
    reg.request_pick(4)
    time.sleep(0.15)  # roundtrip 1 gotov
    assert reg.wait_for_pick(4, 0.15) == {}  # nov poll bez request_pick → ne replay
