"""Autenticação delegada individual Microsoft 365 via Device Code OAuth 2.0.

O armazenamento padrão é apenas em memória. Para produção com 40 usuários,
implemente TokenStore com Azure Key Vault ou armazenamento criptografado.
"""
from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Dict, Optional, Protocol

from config import M365Config


@dataclass
class DeviceLogin:
    device_code: str
    user_code: str
    verification_uri: str
    message: str
    expires_in: int
    interval: int
    started_at: float


@dataclass
class UserToken:
    user_id: str
    tenant_id: str
    access_token: str
    refresh_token: str
    expires_at: float
    scope: str


class TokenStore(Protocol):
    def get(self, user_id: str) -> Optional[UserToken]: ...
    def put(self, token: UserToken) -> None: ...
    def delete(self, user_id: str) -> None: ...


class MemoryTokenStore:
    """Cache não persistente e segregado por usuário."""

    def __init__(self) -> None:
        self._tokens: Dict[str, UserToken] = {}

    def get(self, user_id: str) -> Optional[UserToken]:
        return self._tokens.get(user_id)

    def put(self, token: UserToken) -> None:
        self._tokens[token.user_id] = token

    def delete(self, user_id: str) -> None:
        self._tokens.pop(user_id, None)


class DelegatedAuth:
    def __init__(self, config: M365Config, store: Optional[TokenStore] = None) -> None:
        self.config = config
        self.store = store or MemoryTokenStore()

    def _post_form(self, url: str, data: dict) -> dict:
        request = urllib.request.Request(
            url,
            data=urllib.parse.urlencode(data).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.config.request_timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {"error": "http_error", "error_description": body}
            error = RuntimeError(payload.get("error_description") or payload.get("error") or str(exc))
            setattr(error, "oauth_error", payload.get("error"))
            raise error from exc

    def begin_login(self) -> DeviceLogin:
        payload = self._post_form(
            f"{self.config.authority}/devicecode",
            {"client_id": self.config.client_id, "scope": self.config.scopes},
        )
        return DeviceLogin(
            device_code=payload["device_code"],
            user_code=payload["user_code"],
            verification_uri=payload["verification_uri"],
            message=payload["message"],
            expires_in=int(payload["expires_in"]),
            interval=int(payload.get("interval", 5)),
            started_at=time.time(),
        )

    def complete_login(self, login: DeviceLogin) -> UserToken:
        interval = login.interval
        deadline = login.started_at + login.expires_in
        while time.time() < deadline:
            try:
                payload = self._post_form(
                    f"{self.config.authority}/token",
                    {
                        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                        "client_id": self.config.client_id,
                        "device_code": login.device_code,
                    },
                )
                token = self._token_from_payload(payload)
                self.store.put(token)
                return token
            except RuntimeError as exc:
                code = getattr(exc, "oauth_error", None)
                if code == "authorization_pending":
                    time.sleep(interval)
                    continue
                if code == "slow_down":
                    interval += 5
                    time.sleep(interval)
                    continue
                raise
        raise TimeoutError("O código de autenticação expirou. Inicie uma nova conexão.")

    def access_token(self, user_id: str) -> str:
        token = self.store.get(user_id)
        if token is None:
            raise RuntimeError("AUTH_REQUIRED: usuário ainda não conectou sua conta Microsoft 365.")
        if token.expires_at <= time.time() + 120:
            token = self._refresh(token)
        if token.user_id != user_id:
            raise RuntimeError("AUTH_USER_MISMATCH: o token não pertence ao usuário solicitado.")
        return token.access_token

    def disconnect(self, user_id: str) -> None:
        self.store.delete(user_id)

    def _refresh(self, token: UserToken) -> UserToken:
        if not token.refresh_token:
            self.store.delete(token.user_id)
            raise RuntimeError("AUTH_REQUIRED: faça login novamente.")
        payload = self._post_form(
            f"{self.config.authority}/token",
            {
                "grant_type": "refresh_token",
                "client_id": self.config.client_id,
                "refresh_token": token.refresh_token,
                "scope": self.config.scopes,
            },
        )
        refreshed = self._token_from_payload(payload, fallback_user=token.user_id)
        self.store.put(refreshed)
        return refreshed

    def _token_from_payload(self, payload: dict, fallback_user: str = "") -> UserToken:
        claims = _jwt_claims(payload.get("id_token") or payload["access_token"])
        user_id = claims.get("oid") or claims.get("sub") or fallback_user
        tenant_id = claims.get("tid") or self.config.tenant_id
        if not user_id:
            raise RuntimeError("Não foi possível identificar o usuário autenticado.")
        if tenant_id != self.config.tenant_id:
            raise RuntimeError("TENANT_MISMATCH: a conta não pertence ao tenant configurado.")
        return UserToken(
            user_id=user_id,
            tenant_id=tenant_id,
            access_token=payload["access_token"],
            refresh_token=payload.get("refresh_token", ""),
            expires_at=time.time() + int(payload.get("expires_in", 3600)),
            scope=payload.get("scope", ""),
        )


def _jwt_claims(token: str) -> dict:
    """Lê claims para isolamento de sessão; não substitui validação feita pela Microsoft."""
    try:
        encoded = token.split(".")[1]
        encoded += "=" * (-len(encoded) % 4)
        return json.loads(base64.urlsafe_b64decode(encoded).decode("utf-8"))
    except (IndexError, ValueError, json.JSONDecodeError):
        return {}
