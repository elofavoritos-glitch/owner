"""Diagnóstico logístico guiado para armazenagem e transporte rodoviário.

Conduz o comercial por perguntas, converte respostas em evidências para o score
e recomenda serviços da ELO. Não presume dados ausentes.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from perfil_elo import SERVICOS


ROTEIRO = [
    {"chave": "produto", "pergunta": "O que a empresa movimenta (tipo de produto/carga)?"},
    {"chave": "volume_medio", "pergunta": "Qual o volume médio mensal (pallets, toneladas ou contêineres)?"},
    {"chave": "volume_pico", "pergunta": "Qual o volume de pico e quando ocorre?"},
    {"chave": "origem", "pergunta": "Qual a origem predominante da carga?"},
    {"chave": "destino", "pergunta": "Qual o destino predominante?"},
    {"chave": "frequencia", "pergunta": "Qual a frequência de embarques por semana?"},
    {"chave": "precisa_armazenagem", "pergunta": "Há necessidade de armazenagem? (sim/não)"},
    {"chave": "precisa_transporte", "pergunta": "Há necessidade de transporte rodoviário? (sim/não)"},
    {"chave": "importacao", "pergunta": "A operação envolve importação ou exportação? (sim/não)"},
    {"chave": "sla", "pergunta": "Existe janela de entrega ou SLA exigido?"},
    {"chave": "fornecedor_atual", "pergunta": "Já possui operador logístico? Qual a principal dor com ele?"},
    {"chave": "decisor", "pergunta": "Quem decide a contratação?"},
    {"chave": "prazo_inicio", "pergunta": "Quando a solução precisa começar?"},
]

_SIM = {"sim", "s", "true", "verdadeiro", "yes", "y", "1"}


def roteiro() -> List[Dict[str, str]]:
    return list(ROTEIRO)


def _sim(valor: Any) -> bool:
    return str(valor).strip().lower() in _SIM


@dataclass
class Diagnostico:
    respostas: Dict[str, Any]
    servicos_recomendados: List[str] = field(default_factory=list)
    pendencias: List[str] = field(default_factory=list)
    evidencias: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def resumo(self) -> Dict[str, Any]:
        return {
            "servicos_recomendados": self.servicos_recomendados,
            "respostas": self.respostas,
            "pendencias": self.pendencias,
            "evidencias_para_score": self.evidencias,
        }


def analisar(respostas: Dict[str, Any]) -> Diagnostico:
    if not isinstance(respostas, dict):
        raise ValueError("As respostas do diagnóstico devem ser um dicionário.")

    pendencias = [item["pergunta"] for item in ROTEIRO if not str(respostas.get(item["chave"], "")).strip()]

    servicos: List[str] = []
    marcadores_potencial: List[str] = []
    if _sim(respostas.get("precisa_armazenagem")):
        servicos.append(SERVICOS["armazenagem"]["nome"])
        marcadores_potencial.append("armazenagem")
    if _sim(respostas.get("precisa_transporte")):
        servicos.append(SERVICOS["transporte_rodoviario"]["nome"])
        marcadores_potencial.append("transporte")
    if len(marcadores_potencial) == 2:
        servicos.append("Solução integrada (armazenagem + transporte)")

    evidencias: Dict[str, Dict[str, Any]] = {}

    if marcadores_potencial:
        nota = 1.0 if len(marcadores_potencial) == 2 else 0.6
        evidencias["potencial_servicos_elo"] = {
            "nota": nota,
            "justificativa": "Necessidade declarada: " + ", ".join(marcadores_potencial),
            "fonte": "diagnóstico guiado",
            "servicos": marcadores_potencial,
        }

    # Atividade logística considera recorrência/volume (nacional ou comex),
    # já que comércio exterior deixou de ser decisivo para a ELO.
    tem_frequencia = bool(str(respostas.get("frequencia", "")).strip())
    tem_volume = bool(str(respostas.get("volume_medio", "")).strip())
    if _sim(respostas.get("importacao")):
        evidencias["atividade_logistica"] = {
            "nota": 1.0,
            "justificativa": "Opera importação/exportação, com atividade logística recorrente.",
            "fonte": "diagnóstico guiado",
        }
    elif tem_frequencia or tem_volume:
        evidencias["atividade_logistica"] = {
            "nota": 0.8,
            "justificativa": "Atividade logística recorrente (volume/frequência declarados).",
            "fonte": "diagnóstico guiado",
        }

    origem = str(respostas.get("origem", "")).lower()
    destino = str(respostas.get("destino", "")).lower()
    regioes = ("sc", "santa catarina", "itaja", "navegantes", "parana", "paraná", "sul", "rio grande")
    if any(r in origem or r in destino for r in regioes):
        evidencias["regiao_rotas"] = {
            "nota": 0.8,
            "justificativa": "Origem/destino na área de atuação da ELO.",
            "fonte": "diagnóstico guiado",
        }

    return Diagnostico(
        respostas=dict(respostas),
        servicos_recomendados=servicos,
        pendencias=pendencias,
        evidencias=evidencias,
    )
