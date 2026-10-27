"""Gera o dataset do dashboard (data.json) a partir dos agentes da ELO.

Reaproveita painel do gestor, metas/ranking e funil. Produz um JSON único que o
front-end consome. Não inventa dados: usa o que for passado (ou um conjunto de
demonstração explicitamente marcado) e preserva pendências.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

# Importa os agentes já existentes.
_BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BASE / "sales_management_agent"))

from painel_gestor import gerar_painel  # type: ignore
from metas_ranking import ranking  # type: ignore


def construir(oportunidades: List[Dict[str, Any]], realizados, metas, *, demo: bool = False, evolucao=None, produtividade=None) -> Dict[str, Any]:
    hoje = date.today()
    painel = gerar_painel(oportunidades, hoje=hoje)
    metas_resumo = ranking(realizados, metas, dia_do_mes=hoje.day, dias_no_mes=30)

    return {
        "gerado_em": hoje.isoformat(),
        "demo": demo,
        "empresa": "ELO Soluções Logísticas Integradas",
        "painel": painel,
        "metas": metas_resumo,
        "oportunidades": oportunidades,
        # Série mensal (ganho fechado x proposta enviada) e produtividade por vendedor.
        "evolucao_mensal": evolucao or [],
        "produtividade": produtividade or [],
    }


def _demo() -> Dict[str, Any]:
    oportunidades = [
        {"id": "OPP-001", "cliente": "Transportadora Vale Sul", "responsavel": "André", "etapa": "Negociação", "status": "Ativa", "valor_potencial": 48000, "probabilidade": 0.6, "proxima_acao": "Apresentar proposta", "data_proxima_acao": "2026-10-14"},
        {"id": "OPP-002", "cliente": "Importadora Maré Alta", "responsavel": "André", "etapa": "Cotação", "status": "Ativa", "valor_potencial": 32000, "probabilidade": 0.4, "proxima_acao": "", "data_proxima_acao": "2026-10-08"},
        {"id": "OPP-003", "cliente": "Indústria Catarinense", "responsavel": "Bruna", "etapa": "Diagnóstico", "status": "Ativa", "valor_potencial": 60000, "probabilidade": 0.3, "proxima_acao": "Visita técnica", "data_proxima_acao": "2026-10-16"},
        {"id": "OPP-004", "cliente": "Distribuidora Sul", "responsavel": "Bruna", "etapa": "Prospecção", "status": "Ativa", "valor_potencial": 25000, "probabilidade": 0.15, "proxima_acao": "Qualificar", "data_proxima_acao": "2026-10-13"},
        {"id": "OPP-005", "cliente": "Alfa Logística", "responsavel": "Caio", "etapa": "Ganho", "status": "Ganha", "valor_potencial": 55000, "probabilidade": 1},
        {"id": "OPP-006", "cliente": "Beta Comércio", "responsavel": "Caio", "etapa": "Perdido", "status": "Perdida", "valor_potencial": 18000, "probabilidade": 0, "motivo_perda": "preço"},
        {"id": "OPP-007", "cliente": "Gama Importação", "responsavel": "André", "etapa": "Qualificação", "status": "Ativa", "valor_potencial": 40000, "probabilidade": 0.25, "proxima_acao": "Enviar material", "data_proxima_acao": "2026-10-15"},
        {"id": "OPP-008", "cliente": "Delta Varejo", "responsavel": "Bruna", "etapa": "Negociação", "status": "Ativa", "valor_potencial": 72000, "probabilidade": 0.55, "proxima_acao": "Revisar condições", "data_proxima_acao": "2026-10-12"},
    ]
    realizados = [
        {"responsavel": "André", "valor_ganho": 60000},
        {"responsavel": "Bruna", "valor_ganho": 42000},
        {"responsavel": "Caio", "valor_ganho": 55000},
    ]
    metas = {"André": 100000, "Bruna": 80000, "Caio": 90000}
    evolucao = [
        {"mes": "Mai", "ganho": 85000, "proposto": 180000},
        {"mes": "Jun", "ganho": 92000, "proposto": 210000},
        {"mes": "Jul", "ganho": 78000, "proposto": 165000},
        {"mes": "Ago", "ganho": 110000, "proposto": 240000},
        {"mes": "Set", "ganho": 134000, "proposto": 260000},
        {"mes": "Out", "ganho": 157000, "proposto": 290000},
    ]
    produtividade = [
        {"responsavel": "André", "ligacoes": 48, "reunioes": 9, "propostas": 6, "ganhos": 2},
        {"responsavel": "Bruna", "ligacoes": 41, "reunioes": 7, "propostas": 5, "ganhos": 1},
        {"responsavel": "Caio", "ligacoes": 35, "reunioes": 6, "propostas": 4, "ganhos": 2},
    ]
    return construir(oportunidades, realizados, metas, demo=True, evolucao=evolucao, produtividade=produtividade)


if __name__ == "__main__":
    saida = Path(__file__).resolve().parent / "data.json"
    dados = _demo()
    saida.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Dataset do dashboard gerado: {saida}")
    print(f"Oportunidades: {len(dados['oportunidades'])} | Pipeline potencial: R$ {dados['painel']['totais']['valor_potencial']:,.0f}")
