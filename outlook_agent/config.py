"""Configuração segura do conector Microsoft 365.

Nenhum segredo é armazenado neste projeto. O fluxo usa cliente público e Device
Code OAuth, portanto precisa apenas do tenant e client IDs do aplicativo Entra.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


DELEGATED_SCOPES = (
    "openid",
    "profile",
    "offline_access",
    "User.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.ReadWrite",
)


@dataclass(frozen=True)
class M365Config:
    tenant_id: str
    client_id: str
    graph_base_url: str = "https://graph.microsoft.com/v1.0"
    timezone: str = "E. South America Standard Time"
    confirmation_ttl_seconds: int = 900
    request_timeout_seconds: int = 30
    max_retries: int = 4

    @property
    def authority(self) -> str:
        return f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0"

    @property
    def scopes(self) -> str:
        return " ".join(DELEGATED_SCOPES)

    @classmethod
    def from_env(cls) -> "M365Config":
        tenant_id = os.environ.get("ELO_M365_TENANT_ID", "").strip()
        client_id = os.environ.get("ELO_M365_CLIENT_ID", "").strip()
        missing = [name for name, value in (
            ("ELO_M365_TENANT_ID", tenant_id),
            ("ELO_M365_CLIENT_ID", client_id),
        ) if not value]
        if missing:
            raise RuntimeError(f"Configure as variáveis: {', '.join(missing)}")
        return cls(
            tenant_id=tenant_id,
            client_id=client_id,
            timezone=os.environ.get("ELO_M365_TIMEZONE", "E. South America Standard Time"),
        )
