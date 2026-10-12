"""Painel do gestor comercial da ELO.

Consolida o funil (mesmo formato usado pelo gerar_funil) em uma visão de gestão:
por vendedor, por etapa, previsão ponderada e oportunidades em risco. Não inventa
dados: campos ausentes viram pendência e não distorcem os totais.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional


ETAPAS = ["Prospecção", "Qualificação", "Diagnóstico", "Cotação", "Negociação", "Ganho", "Perdido"]
ABERTAS = {"Prospecção", "Qualificação", "Diagnóstico", "Cotação", "Negociação"}


def _dec(valor: Any) -> Decimal:
    if valor in (None, ""):
        return Decimal("0")
    try:
        texto = str(valor).strip().replace("R$", "").replace(" ", "")
        if "," in texto and "." in texto:
            texto = texto.replace(".", "").replace(",", ".")
        elif "," in texto:
            texto = texto.replace(",", ".")
        return Decimal(texto)
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _data(valor: Any) -> Optional[date]:
    if valor in (None, ""):
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(valor).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _f(d: Decimal) -> float:
    return float(d)


def gerar_painel(oportunidades: List[Dict[str, Any]], *, hoje: Optional[date] = None) -> Dict[str, Any]:
    if not isinstance(oportunidades, list):
        raise ValueError("Informe a lista de oportunidades do funil.")
    hoje = hoje or date.today()

    por_vendedor: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "oportunidades": 0, "abertas": 0, "ganhas": 0, "perdidas": 0,
        "valor_potencial": Decimal("0"), "valor_ponderado": Decimal("0"),
        "em_risco": 0,
    })
    por_etapa: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"quantidade": 0, "valor_potencial": Decimal("0"), "valor_ponderado": Decimal("0")})
    em_risco: List[Dict[str, Any]] = []
    pendencias_cadastro = 0

    total_pot = total_pond = Decimal("0")
    ganhas = perdidas = abertas = 0

    for op in oportunidades:
        vendedor = str(op.get("responsavel") or "(sem responsável)").strip()
        etapa = str(op.get("etapa", "")).strip()
        status = str(op.get("status", "")).strip().lower()
        potencial = _dec(op.get("valor_potencial"))
        prob = _dec(op.get("probabilidade"))
        ponderado = potencial * prob

        v = por_vendedor[vendedor]
        v["oportunidades"] += 1
        v["valor_potencial"] += potencial
        v["valor_ponderado"] += ponderado
        total_pot += potencial
        total_pond += ponderado

        if etapa in por_etapa or etapa in ETAPAS:
            por_etapa[etapa]["quantidade"] += 1
            por_etapa[etapa]["valor_potencial"] += potencial
            por_etapa[etapa]["valor_ponderado"] += ponderado

        if etapa == "Ganho" or status == "ganha":
            v["ganhas"] += 1; ganhas += 1
        elif etapa == "Perdido" or status == "perdida":
            v["perdidas"] += 1; perdidas += 1
        else:
            v["abertas"] += 1; abertas += 1

        # Risco: aberta, ativa e com próxima ação atrasada ou ausente.
        if etapa in ABERTAS and status in ("ativa", ""):
            data_acao = _data(op.get("data_proxima_acao"))
            sem_acao = not str(op.get("proxima_acao", "")).strip()
            atrasada = data_acao is not None and data_acao < hoje
            if sem_acao or atrasada:
                v["em_risco"] += 1
                em_risco.append({
                    "id": op.get("id"), "cliente": op.get("cliente"),
                    "responsavel": vendedor, "etapa": etapa,
                    "motivo": "sem próxima ação" if sem_acao else f"ação atrasada ({(hoje - data_acao).days} dias)",
                    "valor_potencial": _f(potencial),
                })

        if not str(op.get("probabilidade", "")).strip() or not str(op.get("valor_potencial", "")).strip():
            pendencias_cadastro += 1

    vendedores = []
    for nome, d in sorted(por_vendedor.items(), key=lambda kv: kv[1]["valor_ponderado"], reverse=True):
        vendedores.append({
            "responsavel": nome,
            "oportunidades": d["oportunidades"],
            "abertas": d["abertas"],
            "ganhas": d["ganhas"],
            "perdidas": d["perdidas"],
            "em_risco": d["em_risco"],
            "valor_potencial": _f(d["valor_potencial"]),
            "valor_ponderado": _f(d["valor_ponderado"]),
        })

    etapas_resumo = []
    for etapa in ETAPAS:
        d = por_etapa.get(etapa)
        if d:
            etapas_resumo.append({
                "etapa": etapa, "quantidade": d["quantidade"],
                "valor_potencial": _f(d["valor_potencial"]),
                "valor_ponderado": _f(d["valor_ponderado"]),
            })

    taxa_conv = round(ganhas / (ganhas + perdidas) * 100, 1) if (ganhas + perdidas) else None
    em_risco.sort(key=lambda x: x["valor_potencial"], reverse=True)

    return {
        "data_base": hoje.isoformat(),
        "totais": {
            "oportunidades": len(oportunidades),
            "abertas": abertas, "ganhas": ganhas, "perdidas": perdidas,
            "valor_potencial": _f(total_pot),
            "previsao_ponderada": _f(total_pond),
            "taxa_conversao_percent": taxa_conv,
            "pendencias_cadastro": pendencias_cadastro,
        },
        "por_vendedor": vendedores,
        "por_etapa": etapas_resumo,
        "oportunidades_em_risco": em_risco,
        "observacao": "Previsão ponderada = soma de (valor potencial x probabilidade). Validar cadastro das oportunidades com pendências.",
    }


if __name__ == "__main__":
    import json
    hoje = date(2026, 10, 12)
    ops = [
        {"id": "O1", "cliente": "Vale Sul", "responsavel": "André", "etapa": "Negociação", "status": "Ativa",
         "valor_potencial": 48000, "probabilidade": 0.6, "proxima_acao": "ligar", "data_proxima_acao": "2026-10-12"},
        {"id": "O2", "cliente": "Indústria XZ", "responsavel": "André", "etapa": "Cotação", "status": "Ativa",
         "valor_potencial": 32000, "probabilidade": 0.4, "proxima_acao": "", "data_proxima_acao": "2026-10-05"},
        {"id": "O3", "cliente": "Alfa", "responsavel": "Bruna", "etapa": "Ganho", "status": "Ganha",
         "valor_potencial": 25000, "probabilidade": 1},
        {"id": "O4", "cliente": "Beta", "responsavel": "Bruna", "etapa": "Perdido", "status": "Perdida",
         "valor_potencial": 15000, "probabilidade": 0, "motivo_perda": "preço"},
    ]
    print(json.dumps(gerar_painel(ops, hoje=hoje), ensure_ascii=False, indent=2))
