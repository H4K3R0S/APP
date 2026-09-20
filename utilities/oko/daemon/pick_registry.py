#!/usr/bin/env python3
"""Registar „pick" čekača (cell-shell long-poll) — poklapanje po PID-u, thread-safe."""
from __future__ import annotations

import threading
import uuid


class _Waiter:
    def __init__(self) -> None:
        self.pick = threading.Event()      # OKO traži pick
        self.request_id: str | None = None
        self.waiting = False               # da li je long-poll trenutno u wait-u
        self.result: dict | None = None
        self.result_ready = threading.Event()


class PickRegistry:
    def __init__(self) -> None:
        self._by_pid: dict[int, _Waiter] = {}
        self._by_request: dict[str, _Waiter] = {}
        self._lock = threading.Lock()

    def wait_for_pick(self, pid: int, timeout: float = 25.0) -> dict:
        with self._lock:
            w = self._by_pid.setdefault(pid, _Waiter())
            w.pick.clear()
            w.request_id = None      # reset → nema stale-replay na sledećem poll-u
            w.waiting = True
        w.pick.wait(timeout)
        with self._lock:
            w.waiting = False
            rid = w.request_id       # odluka po request_id POD LOCK-om (ne po `got`)
            return {"action": "pick", "request_id": rid} if rid is not None else {}

    def request_pick(self, pid: int) -> str | None:
        with self._lock:
            w = self._by_pid.get(pid)
            if w is None or not w.waiting:
                return None
            rid = uuid.uuid4().hex
            w.request_id = rid
            w.result = None
            w.result_ready.clear()
            self._by_request[rid] = w
            w.pick.set()
            return rid

    def submit_result(self, request_id: str, result: dict) -> bool:
        with self._lock:
            w = self._by_request.get(request_id)
            if w is None:
                return False
            w.result = result
            w.result_ready.set()
            return True

    def get_result(self, request_id: str, timeout: float = 120.0) -> dict | None:
        with self._lock:
            w = self._by_request.get(request_id)
        if w is None:
            return None
        ok = w.result_ready.wait(timeout)
        with self._lock:
            self._by_request.pop(request_id, None)   # uvek očisti (i na timeout)
            return w.result if ok else None
