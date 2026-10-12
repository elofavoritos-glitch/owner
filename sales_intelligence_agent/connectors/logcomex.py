"""Conector Logcomex (preparado, desativado até a ELO ter credenciais).

Quando a API Logcomex estiver contratada, implemente aqui a consulta de perfil
de comércio exterior (importação/exportação, frequência, portos, mercados) e a
conversão em evidências de score. Use apenas dados licenciados; nunca scraping.
Credenciais devem vir de variáveis de ambiente/Secrets.
"""
from __future__ import annotations

import os
from typing import Any, Dict


class LogcomexConnector:
    disponivel = False  # vira True quando a integração for implementada e configurada.

    def __init__(self) -> None:
        self.api_key = os.environ.get("ELO_LOGCOMEX_API_KEY", "").strip()

    def perfil_comex(self, cnpj: str) -> Dict[str, Any]:
        raise NotImplementedError(
            "Logcomex ainda não configurada. Será ativada quando a ELO fornecer "
            "o módulo e as credenciais da API (ELO_LOGCOMEX_API_KEY)."
        )
