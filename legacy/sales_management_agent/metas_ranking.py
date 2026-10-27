"""Metas e ranking do time comercial da ELO.

Compara o realizado (ganhos no período) com metas por vendedor, calcula atingimento,
projeção simples pelo ritmo do mês e monta o ranking. Sinaliza quem precisa de apoio.
Não inventa meta nem resultado: sem meta informada, fica pendente.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional


def _dec(valor: Any) -> Decimal:
    if valor in (None, ""):
        return Decimal("0")
    try:
        t = str(valor).strip().replace("R$", "").replace(" ", "")
        if "," in t and "." in t:
            t = t.replace(".", "").replace(",", ".")
        elif "," in t:
            t = t.replace(",", ".")
        return Decimal(t)
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _f(d: Decimal) -> float:
    return float(d)


def _classificar(atingimento: Optional[float], projecao_pct: Optional[float]) -> str:
    if atingimento is None:
        return "sem meta definida"
    if atingimento >= 100:
        return "meta atingida"
    if projecao_pct is not None and projecao_pct >= 100:
        return "no ritmo (tende a bater)"
    if projecao_pct is not None and projecao_pct >= 70:
        return "atenção (abaixo do ritmo)"
    return "precisa de apoio"


def ranking(
    realizados: List[Dict[str, Any]],
    metas: Dict[str, Any],
    *,
    dia_do_mes: Optional[int] = None,
    dias_no_mes: int = 30,
) -> Dict[str, Any]:
    """realizados: [{responsavel, valor_ganho}] (ou lista de ganhos agregável).
    metas: {responsavel: valor_meta}. dia_do_mes: para projeção pelo ritmo."""
    dia_do_mes = dia_do_mes or date.today().day
    fracao = max(1, dia_do_mes) / max(1, dias_no_mes)

    realizado_por: Dict[str, Decimal] = {}
    for r in realizados:
        nome = str(r.get("responsavel") or "(sem responsável)").strip()
        realizado_por[nome] = realizado_por.get(nome, Decimal("0")) + _dec(r.get("valor_ganho"))

    nomes = set(realizado_por) | {str(k).strip() for k in metas}
    linhas: List[Dict[str, Any]] = []
    pendencias: List[str] = []

    for nome in nomes:
        realizado = realizado_por.get(nome, Decimal("0"))
        meta = _dec(metas.get(nome))
        if meta == 0:
            atingimento = None
            projecao_pct = None
            pendencias.append(f"meta de {nome}")
        else:
            atingimento = round(_f(realizado) / _f(meta) * 100, 1)
            projetado = _f(realizado) / fracao if fracao else _f(realizado)
            projecao_pct = round(projetado / _f(meta) * 100, 1)
        linhas.append({
            "responsavel": nome,
            "realizado": _f(realizado),
            "meta": _f(meta) if meta else None,
            "atingimento_percent": atingimento,
            "projecao_fim_mes_percent": projecao_pct,
            "situacao": _classificar(atingimento, projecao_pct),
        })

    linhas.sort(key=lambda x: (x["atingimento_percent"] is not None, x["atingimento_percent"] or 0, x["realizado"]), reverse=True)
    for i, linha in enumerate(linhas, start=1):
        linha["posicao"] = i

    precisam_apoio = [l["responsavel"] for l in linhas if l["situacao"] in ("precisa de apoio", "atenção (abaixo do ritmo)")]

    return {
        "dia_do_mes": dia_do_mes,
        "dias_no_mes": dias_no_mes,
        "ranking": linhas,
        "precisam_de_apoio": precisam_apoio,
        "pendencias": pendencias,
        "observacao": "Projeção simples pelo ritmo do mês; não considera sazonalidade nem pipeline futuro.",
    }


if __name__ == "__main__":
    import json
    realizados = [
        {"responsavel": "André", "valor_ganho": 60000},
        {"responsavel": "Bruna", "valor_ganho": 30000},
        {"responsavel": "Caio", "valor_ganho": 10000},
    ]
    metas = {"André": 100000, "Bruna": 80000, "Caio": 90000}
    print(json.dumps(ranking(realizados, metas, dia_do_mes=15, dias_no_mes=30), ensure_ascii=False, indent=2))
