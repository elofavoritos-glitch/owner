"""Conector Econodata (preparado, desativado até a ELO ter credenciais).

Quando a API/enriquecimento Econodata estiver contratada, implemente aqui a
consulta por CNPJ e a conversão em evidências de score. Credenciais devem vir
de variáveis de ambiente/Secrets, nunca do código.
"""
from __future__ import annotations

import os
from typing import Any, Dict


class EconodataConnector:
    disponivel = False  # vira True quando a integração for implementada e configurada.

    def __init__(self) -> None:
        self.api_key = os.environ.get("ELO_ECONODATA_API_KEY", "").strip()

    def consultar_cnpj(self, cnpj: str) -> Dict[str, Any]:
        raise NotImplementedError(
            "Econodata ainda não configurada. Será ativada quando a ELO fornecer "
            "credenciais da API/enriquecimento (ELO_ECONODATA_API_KEY)."
        )
