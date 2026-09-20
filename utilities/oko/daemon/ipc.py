#!/usr/bin/env python3
"""IPC most: lokalni HTTP (stdlib) na 127.0.0.1. Kako ai_workplace/CLI koristi OKO.

Rute:
  GET  /health              -> status
  GET  /last                -> poslednji snimak
  POST /capture {mode,dest?,path?,interactive?} -> okine capture, vrati rezultat
  GET  /settings            -> config (JSON)
  POST /settings {...}      -> upiši config, vrati novi
  GET  /                     -> Settings web strana (web/settings.html)
Kontroler (duck-typed): capture_sync(mode,dest,path,interactive)->dict, settings_get()->dict,
settings_set(dict)->dict. Server je vlasnik samo transporta.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

_WEB = Path(__file__).resolve().parent.parent / "web"
_STATIC = {
    "/": ("settings.html", "text/html; charset=utf-8"),
    "/settings.html": ("settings.html", "text/html; charset=utf-8"),
    "/settings.js": ("settings.js", "application/javascript; charset=utf-8"),
    "/settings.css": ("settings.css", "text/css; charset=utf-8"),
}


def make_handler(controller):
    class Handler(BaseHTTPRequestHandler):
        server_version = "OKO/1.0"

        def log_message(self, *_a):  # tišina
            pass

        def _json(self, obj: Any, code: int = 200):
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> dict:
            n = int(self.headers.get("Content-Length", 0) or 0)
            if not n:
                return {}
            try:
                return json.loads(self.rfile.read(n).decode("utf-8")) or {}
            except (ValueError, UnicodeDecodeError):
                return {}

        def do_GET(self):
            if self.path == "/health":
                return self._json(controller.health())
            if self.path == "/last":
                return self._json(controller.last() or {})
            if self.path == "/settings":
                return self._json(controller.settings_get())
            if self.path.startswith("/pick/wait"):
                from urllib.parse import parse_qs, urlparse
                q = parse_qs(urlparse(self.path).query)
                pid = int(q.get("pid", ["0"])[0])
                return self._json(controller.pick_wait(pid))
            if self.path in _STATIC:
                return self._serve_static(*_STATIC[self.path])
            self._json({"error": "not found"}, 404)

        def do_POST(self):
            if self.path == "/capture":
                p = self._read_json()
                res = controller.capture_sync(
                    mode=p.get("mode") or controller.settings_get().get("mode", "region"),
                    dest=p.get("dest"),
                    path=p.get("path"),
                    interactive=bool(p.get("interactive", True)),
                )
                return self._json(res if res is not None else {"cancelled": True})
            if self.path == "/settings":
                return self._json(controller.settings_set(self._read_json()))
            if self.path == "/pick/result":
                p = self._read_json()
                rid = p.pop("request_id", "")
                return self._json(controller.pick_result(rid, p))
            self._json({"error": "not found"}, 404)

        def _serve_static(self, fname: str, ctype: str):
            f = _WEB / fname
            try:
                data = f.read_bytes()
            except OSError:
                return self._json({"error": "missing asset"}, 404)
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    return Handler


class IPCServer:
    def __init__(self, controller, port: int):
        self._srv = ThreadingHTTPServer(("127.0.0.1", port), make_handler(controller))
        self.port = self._srv.server_address[1]  # podržava port=0 (efemeran, za testove)

    def start(self) -> None:
        threading.Thread(target=self._srv.serve_forever, daemon=True).start()

    def stop(self) -> None:
        self._srv.shutdown()
