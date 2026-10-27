"""Confirmações humanas vinculadas ao conteúdo, usuário e efeito externo."""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class Confirmation:
    token: str
    user_id: str
    action: str
    resource_id: str
    payload_hash: str
    created_at: float
    expires_at: float
    consumed: bool = False


class ConfirmationStore:
    """Armazena confirmações de uso único. Use cache distribuído em produção."""

    def __init__(self, ttl_seconds: int = 900) -> None:
        self.ttl_seconds = ttl_seconds
        self._items: Dict[str, Confirmation] = {}

    @staticmethod
    def fingerprint(payload: Any) -> str:
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def create(self, user_id: str, action: str, resource_id: str, payload: Any) -> Confirmation:
        now = time.time()
        item = Confirmation(
            token=secrets.token_urlsafe(32),
            user_id=user_id,
            action=action,
            resource_id=resource_id,
            payload_hash=self.fingerprint(payload),
            created_at=now,
            expires_at=now + self.ttl_seconds,
        )
        self._items[item.token] = item
        return item

    def consume(self, token: str, user_id: str, action: str, resource_id: str, payload: Any) -> Confirmation:
        item = self._items.get(token)
        if item is None:
            raise RuntimeError("CONFIRMATION_REQUIRED: confirmação inexistente.")
        if item.consumed:
            raise RuntimeError("CONFIRMATION_ALREADY_USED: confirmação já utilizada.")
        if item.expires_at < time.time():
            raise RuntimeError("CONFIRMATION_EXPIRED: gere uma nova prévia.")
        if item.user_id != user_id or item.action != action or item.resource_id != resource_id:
            raise RuntimeError("CONFIRMATION_MISMATCH: confirmação não pertence a esta operação.")
        current_hash = self.fingerprint(payload)
        if not hmac.compare_digest(item.payload_hash, current_hash):
            raise RuntimeError("STALE_CONFIRMATION: o conteúdo mudou depois da confirmação.")
        item.consumed = True
        return item
