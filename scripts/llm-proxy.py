#!/usr/bin/env python3
"""
Gammes — proxy LLM du site public.

Pourquoi ce proxy existe : le site est statique (GitHub Pages), donc il tourne dans un
navigateur. Or un navigateur ne peut pas appeler n'importe quel fournisseur :

- **OpenCode Zen** (`https://opencode.ai/zen/v1`) ne renvoie AUCUN en-tête
  `Access-Control-Allow-*` sur POST (mesuré sur 401/400/429, preflight OPTIONS = 404), et ses
  modèles `-free` renvoient 429 `FreeUsageLimitError`.
- Une clé embarquée dans un bundle public est une clé perdue.

Ce proxy tient donc la clé **côté serveur**, ajoute les en-têtes CORS, et borne strictement ce
qu'un inconnu peut lui demander : modèle imposé, jetons plafonnés, débit limité, budget quotidien
global, corps de requête borné, origines sur liste blanche. Rien de tout cela n'est optionnel :
un proxy LLM public sans plafond est une pompe à crédits.

Usage
    export GAMMES_LLM_KEY=…                       # jamais commité, jamais journalisé
    export GAMMES_LLM_UPSTREAM=https://api.inferhub.dev/v1
    export GAMMES_LLM_MODEL=combo/cheap
    python3 scripts/llm-proxy.py --port 8901      # écoute sur 127.0.0.1

En pratique sur r630 : `gammes-llm-proxy-ctl start` (clé dans ~/.config/gammes/llm-proxy.env,
mode 600), puis exposition HTTPS par `tailscale funnel --bg --set-path=/gammes-llm 8901`.

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
import subprocess
import urllib.request
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = os.environ.get("GAMMES_LLM_UPSTREAM", "https://api.inferhub.dev/v1").rstrip("/")
API_KEY = os.environ.get("GAMMES_LLM_KEY", "")
# Le modèle est IMPOSÉ : un appelant public ne choisit pas ce qu'il fait tourner.
FORCED_MODEL = os.environ.get("GAMMES_LLM_MODEL", "combo/cheap")
# « inferhub » : l'API OpenAI-compatible, clé côté serveur.
# « zeroclaw » : un agent ZeroClaw local, dont le modèle EST InferHub
#                (l'agent `b` est configuré sur custom.inferhub). La clé ne
#                passe alors jamais par le proxy : c'est le binaire qui la lit.
BACKEND = os.environ.get("GAMMES_LLM_BACKEND", "inferhub").strip().lower()
ZEROCLAW_BIN = os.environ.get("GAMMES_LLM_ZEROCLAW_BIN", "zeroclaw")
ZEROCLAW_AGENT = os.environ.get("GAMMES_LLM_ZEROCLAW_AGENT", "b")
MAX_TOKENS_CAP = int(os.environ.get("GAMMES_LLM_MAX_TOKENS", "2048"))
RATE_LIMIT = int(os.environ.get("GAMMES_LLM_RATE_PER_MIN", "12"))
DAILY_REQUEST_CAP = int(os.environ.get("GAMMES_LLM_DAILY_REQUESTS", "400"))
DAILY_TOKEN_CAP = int(os.environ.get("GAMMES_LLM_DAILY_TOKENS", "400000"))
MAX_BODY_BYTES = int(os.environ.get("GAMMES_LLM_MAX_BODY", "65536"))
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
_day = {"date": time.strftime("%Y-%m-%d"), "requests": 0, "tokens": 0}


def origin_allowed(origin: str) -> bool:
    if not origin:
        return False
    return any(origin == a or origin.startswith(a + ":") or origin.startswith(a + "/") for a in ALLOWED_ORIGINS)


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


def budget_exhausted() -> bool:
    """Budget quotidien global : les compteurs repartent à zéro à minuit (et au redémarrage)."""
    today = time.strftime("%Y-%m-%d")
    with _lock:
        if _day["date"] != today:
            _day.update(date=today, requests=0, tokens=0)
        return _day["requests"] >= DAILY_REQUEST_CAP or _day["tokens"] >= DAILY_TOKEN_CAP


def account(tokens: int) -> None:
    with _lock:
        _day["requests"] += 1
        _day["tokens"] += max(0, tokens)


def budget_left() -> dict[str, int]:
    with _lock:
        return {"requests": DAILY_REQUEST_CAP - _day["requests"], "tokens": DAILY_TOKEN_CAP - _day["tokens"]}


def zeroclaw_message(payload: dict) -> str:
    """Le message de l'agent : la consigne système repliée, puis la demande."""
    messages = payload.get("messages") or []
    morceaux = []
    for message in messages:
        if isinstance(message, dict) and message.get("content"):
            morceaux.append(str(message["content"]))
    if not morceaux:
        morceaux.append(str(payload.get("prompt") or ""))
    return "\n\n".join(morceaux)


def forward_zeroclaw(payload: dict) -> tuple[int, bytes, int]:
    """Délègue à un agent ZeroClaw local (son modèle est InferHub)."""
    message = zeroclaw_message(payload)
    commande = [ZEROCLAW_BIN, "agent", "--agent", ZEROCLAW_AGENT, "-m", message]
    try:
        fini = subprocess.run(
            commande, capture_output=True, text=True, timeout=240, check=False
        )
    except FileNotFoundError:
        return 503, json.dumps({
            "error": {"message": f"binaire ZeroClaw introuvable : {ZEROCLAW_BIN}"}
        }).encode(), 0
    except subprocess.TimeoutExpired:
        return 504, json.dumps({"error": {"message": "agent ZeroClaw trop lent"}}).encode(), 0
    if fini.returncode != 0:
        detail = (fini.stderr or fini.stdout or "").strip()[:200]
        if "owns the config state" in detail:
            detail = ("un daemon ZeroClaw détient l'état : arrêtez-le ou "
                      "repassez sur le backend inferhub")
        return 502, json.dumps({"error": {"message": f"agent ZeroClaw en échec : {detail}"}}).encode(), 0
    texte = (fini.stdout or "").strip()
    if not texte:
        return 502, json.dumps({"error": {"message": "agent ZeroClaw : réponse vide"}}).encode(), 0
    corps = {
        "choices": [{"index": 0, "message": {"role": "assistant", "content": texte}}],
        "model": f"zeroclaw:@{ZEROCLAW_AGENT}",
        "usage": {"total_tokens": max(1, len(message + texte) // 4)},
    }
    raw = json.dumps(corps, ensure_ascii=False).encode("utf-8")
    return 200, raw, corps["usage"]["total_tokens"]


def forward(payload: dict) -> tuple[int, bytes, int]:
    """Relaie vers l'amont. La clé reste ici : jamais renvoyée, jamais journalisée."""
    body = dict(payload)
    body["model"] = FORCED_MODEL
    body["stream"] = False
    requested = body.get("max_tokens") or body.get("max_completion_tokens") or MAX_TOKENS_CAP
    try:
        body["max_tokens"] = min(int(requested), MAX_TOKENS_CAP)
    except (TypeError, ValueError):
        body["max_tokens"] = MAX_TOKENS_CAP
    body.pop("max_completion_tokens", None)
    req = urllib.request.Request(
        f"{UPSTREAM}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"content-type": "application/json", **({"authorization": f"Bearer {API_KEY}"} if API_KEY else {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            raw = res.read()
            return res.status, raw, used_tokens(raw)
    except urllib.error.HTTPError as err:
        return err.code, err.read()[:800], 0
    except Exception as err:  # noqa: BLE001 - un proxy public ne remonte jamais une pile brute
        return 502, json.dumps({"error": {"message": f"amont injoignable : {err}"}}).encode(), 0


def used_tokens(raw: bytes) -> int:
    try:
        usage = json.loads(raw).get("usage") or {}
        return int(usage.get("total_tokens") or 0)
    except (ValueError, AttributeError, TypeError):
        return 0


class Handler(BaseHTTPRequestHandler):
    server_version = "GammesLlmProxy/2.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:  # noqa: D102 - journal maison sur stderr
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] " + (fmt % args) + "\n")

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

    def do_OPTIONS(self) -> None:  # noqa: N802 - preflight CORS
        self._send(204, b"")

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?")[0].rstrip("/")
        if path.endswith("/healthz") or path in ("", "/gammes-llm"):
            left = budget_left()
            info = {
                "ok": True,
                "service": "gammes-llm-proxy",
                "upstream": UPSTREAM,
                "modele_impose": FORCED_MODEL,
                "backend": BACKEND,
                "agent_zeroclaw": ZEROCLAW_AGENT if BACKEND == "zeroclaw" else None,
                "cle_configurée": bool(API_KEY),
                "plafond_jetons_par_appel": MAX_TOKENS_CAP,
                "requete_par_minute_par_client": RATE_LIMIT,
                "budget_restant": left,
                "origines_autorisées": ALLOWED_ORIGINS,
            }
            self._send(200, json.dumps(info, ensure_ascii=False).encode("utf-8"))
            return
        self._send(404, b'{"error":"chemin inconnu"}')

    def do_POST(self) -> None:  # noqa: N802
        if not self.path.split("?")[0].rstrip("/").endswith("/chat/completions"):
            self._send(404, b'{"error":"chemin inconnu"}')
            return
        origin = self.headers.get("Origin", "")
        if not origin_allowed(origin):
            self._send(403, b'{"error":{"message":"origine non autoris\xc3\xa9e"}}')
            return
        if budget_exhausted():
            self._send(429, b'{"error":{"message":"budget quotidien du proxy \xc3\xa9puis\xc3\xa9"}}')
            return
        client = self.headers.get("X-Forwarded-For", "").split(",")[0].strip() or (
            self.client_address[0] if self.client_address else "?"
        )
        if rate_limited(client):
            self._send(429, b'{"error":{"message":"limite de d\xc3\xa9bit atteinte"}}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > MAX_BODY_BYTES:
                self._send(413, b'{"error":{"message":"corps de requ\xc3\xaate trop volumineux"}}')
                return
            payload = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(payload, dict) or not isinstance(payload.get("messages"), list):
                raise ValueError("messages manquants")
        except (ValueError, json.JSONDecodeError):
            self._send(400, b'{"error":{"message":"JSON invalide ou messages manquants"}}')
            return
        status, body, tokens = forward_zeroclaw(payload) if BACKEND == "zeroclaw" else forward(payload)
        account(tokens)
        left = budget_left()
        self.log_message("POST %s → %s · %s · %d jetons · reste %d req / %d jetons", self.path, status, FORCED_MODEL, tokens, left["requests"], left["tokens"])
        self._send(status, body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Proxy LLM du site Gammes")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("GAMMES_PROXY_PORT", "8901")))
    args = parser.parse_args()
    if not API_KEY:
        print("⚠ aucune clé dans GAMMES_LLM_KEY — l'amont refusera les modèles payants.", file=sys.stderr)
    cible = f"agent ZeroClaw @{ZEROCLAW_AGENT} (modèle {FORCED_MODEL})" if BACKEND == "zeroclaw" else f"{UPSTREAM} · modèle imposé {FORCED_MODEL}"
    print(f"proxy Gammes → {cible} · {args.host}:{args.port}", file=sys.stderr)
    print(
        f"origines : {', '.join(ALLOWED_ORIGINS)} · {RATE_LIMIT} req/min/client · "
        f"{DAILY_REQUEST_CAP} req/jour · {DAILY_TOKEN_CAP} jetons/jour · {MAX_TOKENS_CAP} jetons/appel",
        file=sys.stderr,
    )
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
