"""Dossiê comercial e pré-reunião da ELO.

Consolida relacionamento interno, diagnóstico e score em um único briefing
acionável, com rastreabilidade de fonte e próxima melhor ação.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from diagnostico import analisar
from relacionamento import Relacionamento
from scoring import calcular_score


def montar_dossie(
    empresa: str,
    *,
    respostas_diagnostico: Optional[Dict[str, Any]] = None,
    relacionamento: Optional[Relacionamento] = None,
    evidencias_extras: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    if not str(empresa).strip():
        raise ValueError("Informe o nome da empresa.")

    evidencias: Dict[str, Dict[str, Any]] = {}
    diagnostico_resumo: Dict[str, Any] = {}
    servicos: List[str] = []

    if respostas_diagnostico:
        diag = analisar(respostas_diagnostico)
        diagnostico_resumo = diag.resumo()
        servicos = diag.servicos_recomendados
        evidencias.update(diag.evidencias)

    relacionamento_resumo: Dict[str, Any] = {}
    if relacionamento:
        relacionamento_resumo = relacionamento.resumo()
        if relacionamento.total_mensagens:
            nota = 0.9 if relacionamento.houve_resposta_cliente else 0.6
            evidencias["relacionamento_anterior"] = {
                "nota": nota,
                "justificativa": f"Estágio: {relacionamento.estagio}.",
                "fonte": "Outlook (conta do usuário)",
            }

    if evidencias_extras:
        evidencias.update(evidencias_extras)

    resultado = calcular_score(empresa, evidencias)
    if servicos and not resultado.servicos_recomendados:
        resultado.servicos_recomendados = servicos

    proxima_acao = _proxima_melhor_acao(relacionamento, resultado.prioridade, servicos)

    return {
        "empresa": empresa.strip(),
        "data": date.today().isoformat(),
        "score": resultado.resumo(),
        "relacionamento": relacionamento_resumo,
        "diagnostico": diagnostico_resumo,
        "servicos_recomendados": resultado.servicos_recomendados or servicos,
        "proxima_melhor_acao": proxima_acao,
        "observacao": "Dados sem fonte confirmada devem ser validados antes do uso comercial.",
    }


def _proxima_melhor_acao(relacionamento: Optional[Relacionamento], prioridade: str, servicos: List[str]) -> str:
    if relacionamento is None or relacionamento.total_mensagens == 0:
        return "Primeira abordagem: enviar apresentação institucional e qualificar necessidade."
    if relacionamento.estagio == "Prospect contatado sem resposta":
        return "Enviar follow-up contextual retomando o último assunto."
    if relacionamento.estagio == "Relacionamento esfriado (reativar)":
        return "Reativar: contato de reaproximação e oferta de diagnóstico gratuito."
    if prioridade == "Alta" and servicos:
        return "Agendar reunião de diagnóstico e preparar cotação."
    return "Registrar próxima ação e manter cadência de follow-up."
