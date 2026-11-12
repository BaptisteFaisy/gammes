#!/usr/bin/env python3
"""
Gammes — proxy LLM pour le site public.

Pourquoi ce proxy existe : le site est statique (GitHub Pages), donc il tourne dans un
navigateur. Or un navigateur ne peut pas appeler n'importe quel fournisseur de modèle :

- **OpenCode Zen** (`https://opencode.ai/zen/v1`) ne renvoie AUCUN en-tête
  `Access-Control-Allow-*` sur POST (vérifié : 401/400/429 sans ACAO, et le preflight
  OPTIONS répond 404). Le navigateur bloque donc la réponse. Ses modèles `-free` renvoient
  en plus 429 `FreeUsageLimitError` (« Free models work in OpenCode »).
- Une clé embarquée dans un site public est une clé perdue.

Ce proxy résout les deux : il tient la clé **côté serveur**, ajoute les en-têtes CORS,
borne les jetons, limite le débit, et relaie vers un endpoint OpenAI-compatible.

Usage
    export GAMMES_LLM_KEY=...                      # jamais commité, jamais journalisé
    export GAMMES_LLM_UPSTREAM=https://opencode.ai/zen/v1   # ou https://api.inferhub.dev/v1
    export GAMMES_LLM_MODEL=claude-haiku-4-5
    python3 scripts/llm-proxy.py                   # écoute sur 127.0.0.1:8899

Exposition publique (au choix, et seulement avec accord explicite) :
    tailscale funnel 8899 on            # déjà actif sur r630 → https://r630-debian.tail3a8bdf.ts.net
    python3 scripts/llm-proxy.py --host 0.0.0.0

Aucune dépendance : stdlib Python 3 uniquement.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = os.environ.get("GAMMES_LLM_UPSTREAM", "https://opencode.ai/zen/v1").rstrip("/")
API_KEY = os.environ.get("GAMMES_LLM_KEY", "")
MODEL = os.environ.get("GAMMES_LLM_MODEL", "")
MAX_TOKENS_CAP = int(os.environ.get("GAMMES_LLM_MAX_TOKENS", "2048"))
RATE_LIMIT = int(os.environ.get("GAMMES_LLM_RATE_PER_MIN", "20"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "GAMMES_ALLOWED_ORIGINS",
        "https://baptistefaisy.github.io,http://127.0.0.1,http://localhost",
    ).split(",")
    if o.strip()
]

_hits: dict[str, deque] = {}
_lock = threading.Lock()


def origin_allowed(origin: str) -> bool:
    """Origine inconnue ⇒ refus. Un proxy public sans contrôle d'origine est une pompe à crédits."""
    if not origin:
        return False
    return any(origin == allowed or origin.startswith(allowed + ":") or origin.startswith(allowed + "/") for allowed in ALLOWED_ORIGINS)


def rate_limited(client: str) -> bool:
    now = time.time()
    with _lock:
        window = _hits.setdefault(client, deque())
        while window and now - window[0] > 60.0:
            window.popleft()
        if len(window) >= RATE_LIMIT:
            return True
        window.append(now)
        return False


def forward(payload: dict) -> tuple[int, bytes, str]:
    """Relaie vers l'amont. La clé reste ici : elle n'est jamais renvoyée ni journalisée."""
    body = dict(payload)
    if MODEL and not body.get("model"):
        body["model"] = MODEL
    requested = body.get("max_tokens") or body.get("max_completion_tokens") or MAX_TOKENS_CAP
    capped = min(int(requested), MAX_TOKENS_CAP)
    body["max_tokens"] = capped
    body.pop("max_completion_tokens", None)
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{UPSTREAM}/chat/completions",
        data=data,
        headers={
            "content-type": "application/json",
            **({"authorization": f"Bearer {API_KEY}"} if API_KEY else {}),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.status, res.read(), body.get("model", "?")
    except urllib.error.HTTPError as err:
        return err.code, err.read()[:800], body.get("model", "?")
    except Exception as err:  # noqa: BLE001 - un proxy ne doit jamais remonter une pile brute
        return 502, json.dumps({"error": {"message": f"amont injoignable : {err}"}}).encode(), "?"


class Handler(BaseHTTPRequestHandler):
    server_version = "GammesLlmProxy/1.0"

    def log_message(self, fmt: str, *args) -> None:  # noqa: D102 - journal maison
        sys.stderr.write("[proxy] " + (fmt % args) + "\n")

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Max-Age", "600")

    def _send(self, status: int, payload: bytes, ctype: str = "application/json") -> None:
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:  # noqa: N802 - prévol CORS
        self._send(204, b"")

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") in ("/healthz", "/sante", ""):
            info = {
                "ok": True,
                "upstream": UPSTREAM,
                "model": MODEL or "(celui de la requête)",
                "cle_configurée": bool(API_KEY),
                "plafond_jetons": MAX_TOKENS_CAP,
                "limite_par_minute": RATE_LIMIT,
                "origines_autorisées": ALLOWED_ORIGINS,
            }
            self._send(200, json.dumps(info, ensure_ascii=False).encode("utf-8"))
            return
        self._send(404, b'{"error":"chemin inconnu"}')

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") not in ("/v1/chat/completions", "/chat/completions"):
            self._send(404, b'{"error":"chemin inconnu"}')
            return
        origin = self.headers.get("Origin", "")
        if not origin_allowed(origin):
            self._send(403, b'{"error":{"message":"origine non autoris\xc3\xa9e"}}')
            return
        client = self.client_address[0] if self.client_address else "?"
        if rate_limited(client):
            self._send(429, b'{"error":{"message":"limite de d\xc3\xa9bit atteinte"}}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send(400, b'{"error":{"message":"JSON invalide"}}')
            return
        status, body, model = forward(payload)
        self.log_message("POST %s → %s (%s)", self.path, status, model)
        self._send(status, body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Proxy LLM du site Gammes")
    parser.add_argument("--host", default="127.0.0.1", help="adresse d'écoute (défaut : 127.0.0.1)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("GAMMES_PROXY_PORT", "8899")))
    args = parser.parse_args()
    if not API_KEY:
        print("⚠ aucune clé dans GAMMES_LLM_KEY — l'amont refusera les modèles payants.", file=sys.stderr)
    print(f"proxy Gammes → {UPSTREAM} · modèle {MODEL or '(libre)'} · {args.host}:{args.port}", file=sys.stderr)
    print(f"origines autorisées : {', '.join(ALLOWED_ORIGINS)} · {RATE_LIMIT} req/min · plafond {MAX_TOKENS_CAP} jetons", file=sys.stderr)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
