"""Distribuição de leads para o time comercial da ELO.

Dado um lead novo e a lista de vendedores (com região, especialidade e carga
atual), sugere o responsável mais adequado, de forma explicável. Não decide
sozinho: entrega um ranking com justificativa para o gestor confirmar.
"""
from __future__ import annotations

import unicodedata
from typing import Any, Dict, List, Optional


def _norm(texto: Any) -> str:
    return unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode().lower().strip()


# Pesos do match (somam 100).
PESOS = {"regiao": 40, "especialidade": 30, "carga_de_trabalho": 20, "disponibilidade": 10}


def sugerir_responsavel(lead: Dict[str, Any], vendedores: List[Dict[str, Any]]) -> Dict[str, Any]:
    """lead: {empresa, regiao, servico_interesse}.
    vendedores: [{nome, regioes:[...], especialidades:[...], oportunidades_abertas:int, disponivel:bool}]."""
    if not str(lead.get("empresa", "")).strip():
        raise ValueError("Informe a empresa do lead.")
    if not vendedores:
        raise ValueError("Informe a lista de vendedores.")

    regiao_lead = _norm(lead.get("regiao"))
    servico_lead = _norm(lead.get("servico_interesse"))
    cargas = [int(v.get("oportunidades_abertas", 0) or 0) for v in vendedores]
    carga_max = max(cargas) if cargas else 0

    candidatos: List[Dict[str, Any]] = []
    for v in vendedores:
        nome = str(v.get("nome", "")).strip() or "(sem nome)"
        regioes = [_norm(r) for r in v.get("regioes", [])]
        espec = [_norm(e) for e in v.get("especialidades", [])]
        carga = int(v.get("oportunidades_abertas", 0) or 0)
        disponivel = bool(v.get("disponivel", True))

        pontos = 0.0
        justificativas: List[str] = []

        if regiao_lead and any(regiao_lead in r or r in regiao_lead for r in regioes):
            pontos += PESOS["regiao"]; justificativas.append("atende a região do lead")
        if servico_lead and any(servico_lead in e or e in servico_lead for e in espec):
            pontos += PESOS["especialidade"]; justificativas.append("especialista no serviço de interesse")
        # Carga: quanto menor a carga relativa, mais pontos.
        if carga_max > 0:
            pontos += PESOS["carga_de_trabalho"] * (1 - carga / carga_max)
        else:
            pontos += PESOS["carga_de_trabalho"]
        if disponivel:
            pontos += PESOS["disponibilidade"]
        else:
            justificativas.append("indisponível no momento")

        candidatos.append({
            "vendedor": nome,
            "pontos": round(pontos, 1),
            "oportunidades_abertas": carga,
            "disponivel": disponivel,
            "justificativa": ", ".join(justificativas) or "sem match específico; fator carga/disponibilidade",
        })

    candidatos.sort(key=lambda c: (c["disponivel"], c["pontos"]), reverse=True)
    for i, c in enumerate(candidatos, start=1):
        c["posicao"] = i

    recomendado = candidatos[0] if candidatos and candidatos[0]["disponivel"] else None
    return {
        "lead": {"empresa": lead.get("empresa"), "regiao": lead.get("regiao"), "servico_interesse": lead.get("servico_interesse")},
        "recomendado": recomendado["vendedor"] if recomendado else None,
        "ranking": candidatos,
        "observacao": "Sugestão explicável; a atribuição final deve ser confirmada pelo gestor.",
    }


if __name__ == "__main__":
    import json
    lead = {"empresa": "Importadora Maré Alta", "regiao": "Vale do Itajaí", "servico_interesse": "Armazenagem"}
    vendedores = [
        {"nome": "André", "regioes": ["Vale do Itajaí", "Litoral SC"], "especialidades": ["Armazenagem", "Transporte"], "oportunidades_abertas": 8, "disponivel": True},
        {"nome": "Bruna", "regioes": ["Grande Florianópolis"], "especialidades": ["Transporte"], "oportunidades_abertas": 3, "disponivel": True},
        {"nome": "Caio", "regioes": ["Vale do Itajaí"], "especialidades": ["Armazenagem"], "oportunidades_abertas": 2, "disponivel": False},
    ]
    print(json.dumps(sugerir_responsavel(lead, vendedores), ensure_ascii=False, indent=2))
