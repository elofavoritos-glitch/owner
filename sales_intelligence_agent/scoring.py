"""Score de oportunidade comercial, explicável e baseado em evidências.

Nunca inventa dados. Cada critério só pontua a partir de evidências informadas;
critérios sem evidência permanecem com nota zero e viram pendência explícita.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from perfil_elo import CriterioScore, criterios_padrao


@dataclass
class ResultadoScore:
    empresa: str
    score: int
    prioridade: str
    criterios: List[CriterioScore]
    pendencias: List[str] = field(default_factory=list)
    servicos_recomendados: List[str] = field(default_factory=list)

    def resumo(self) -> Dict[str, Any]:
        return {
            "empresa": self.empresa,
            "score": self.score,
            "prioridade": self.prioridade,
            "servicos_recomendados": self.servicos_recomendados,
            "criterios": [
                {
                    "criterio": c.rotulo,
                    "peso": c.peso,
                    "nota": round(c.nota, 2),
                    "pontos": round(c.peso * c.nota, 1),
                    "justificativa": c.justificativa or "sem evidência informada",
                    "fonte": c.fonte,
                }
                for c in self.criterios
            ],
            "pendencias": self.pendencias,
        }


def _nota(valor: Any) -> float:
    try:
        nota = float(valor)
    except (TypeError, ValueError):
        raise ValueError("A nota de cada critério deve ser numérica entre 0 e 1.")
    if not 0.0 <= nota <= 1.0:
        raise ValueError("A nota de cada critério deve ficar entre 0 e 1.")
    return nota


def _prioridade(score: int) -> str:
    if score >= 70:
        return "Alta"
    if score >= 45:
        return "Média"
    return "Baixa"


def calcular_score(empresa: str, evidencias: Dict[str, Dict[str, Any]]) -> ResultadoScore:
    """evidencias: {chave_criterio: {"nota": 0..1, "justificativa": str, "fonte": str}}."""
    if not str(empresa).strip():
        raise ValueError("Informe o nome da empresa avaliada.")

    criterios = criterios_padrao()
    pendencias: List[str] = []
    total = 0.0

    for criterio in criterios:
        dado = evidencias.get(criterio.chave)
        if not dado or dado.get("nota") is None:
            pendencias.append(criterio.rotulo)
            continue
        criterio.nota = _nota(dado.get("nota"))
        criterio.justificativa = str(dado.get("justificativa", "")).strip()
        criterio.fonte = str(dado.get("fonte", "não informado")).strip() or "não informado"
        total += criterio.peso * criterio.nota

    score = round(total)
    servicos = _servicos_recomendados(evidencias)
    return ResultadoScore(
        empresa=str(empresa).strip(),
        score=score,
        prioridade=_prioridade(score),
        criterios=criterios,
        pendencias=pendencias,
        servicos_recomendados=servicos,
    )


def _servicos_recomendados(evidencias: Dict[str, Dict[str, Any]]) -> List[str]:
    recomendados: List[str] = []
    potencial = evidencias.get("potencial_servicos_elo", {})
    marcadores = {str(item).lower() for item in potencial.get("servicos", [])}
    if "armazenagem" in marcadores:
        recomendados.append("Armazenagem")
    if "transporte" in marcadores or "transporte_rodoviario" in marcadores:
        recomendados.append("Transporte rodoviário")
    if {"armazenagem"} <= marcadores and ("transporte" in marcadores or "transporte_rodoviario" in marcadores):
        recomendados.append("Solução integrada (armazenagem + transporte)")
    return recomendados
