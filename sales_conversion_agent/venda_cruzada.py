"""Venda cruzada para a carteira da ELO (armazenagem x transporte).

Analisa o que o cliente já contrata e sugere o serviço complementar com uma
justificativa objetiva. Trabalha só com os serviços da ELO; não presume volume
nem valor. Entrada mínima: serviços atuais do cliente.
"""
from __future__ import annotations

import unicodedata
from typing import Any, Dict, List


def _norm(texto: Any) -> str:
    return unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode().lower()


def _tem(servicos_norm: List[str], termo: str) -> bool:
    return any(termo in s for s in servicos_norm)


def sugerir(cliente: Dict[str, Any]) -> Dict[str, Any]:
    """cliente: {empresa, servicos_atuais:[...], contexto:{...} opcional}."""
    empresa = str(cliente.get("empresa", "")).strip()
    if not empresa:
        raise ValueError("Informe a empresa do cliente.")
    atuais = [s for s in cliente.get("servicos_atuais", []) if str(s).strip()]
    if not atuais:
        raise ValueError("Informe os serviços atualmente contratados pelo cliente.")

    norm = [_norm(s) for s in atuais]
    tem_arm = _tem(norm, "armazenag")
    tem_tran = _tem(norm, "transporte") or _tem(norm, "frete") or _tem(norm, "distribu")

    oportunidades: List[Dict[str, str]] = []

    if tem_tran and not tem_arm:
        oportunidades.append({
            "servico": "Armazenagem",
            "racional": "Cliente já usa transporte; armazenagem regional reduz rupturas e acelera a distribuição.",
            "gatilho": "Perguntar sobre nível de estoque, rupturas e necessidade de posição avançada no Sul.",
        })
    if tem_arm and not tem_tran:
        oportunidades.append({
            "servico": "Transporte rodoviário",
            "racional": "Cliente já armazena com a ELO; assumir o transporte simplifica a operação e dá controle ponta a ponta.",
            "gatilho": "Perguntar quem faz a distribuição hoje e quais são as dores de prazo/avaria.",
        })
    if tem_arm and tem_tran:
        oportunidades.append({
            "servico": "Solução integrada (expansão)",
            "racional": "Já contrata os dois serviços; explorar novas rotas, filiais ou aumento de volume.",
            "gatilho": "Mapear outras unidades, novos destinos e sazonalidades ainda não atendidas.",
        })

    return {
        "empresa": empresa,
        "servicos_atuais": atuais,
        "oportunidades_cross_sell": oportunidades,
        "observacao": "Sugestões de abordagem; confirmar necessidade real antes de cotar ou propor.",
    }


if __name__ == "__main__":
    import json
    for c in [
        {"empresa": "Cliente A", "servicos_atuais": ["Transporte rodoviário"]},
        {"empresa": "Cliente B", "servicos_atuais": ["Armazenagem"]},
        {"empresa": "Cliente C", "servicos_atuais": ["Armazenagem", "Transporte rodoviário"]},
    ]:
        print(json.dumps(sugerir(c), ensure_ascii=False, indent=2))
        print("-" * 40)
