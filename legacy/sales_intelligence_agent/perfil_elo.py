"""Perfil comercial da ELO: serviços vendidos e cliente ideal (ICP).

Fonte única de verdade para scoring, diagnóstico e recomendações.
Ajuste os pesos e critérios conforme a realidade comercial for sendo validada.
Valores atuais são padrões iniciais, não dados confirmados pela ELO.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


EMPRESA = {
    "nome": "ELO Soluções Logísticas Integradas",
    "cidade": "Itajaí/SC",
    "site": "https://eloarmazenagem.com.br",
    "posicionamento": "soluções logísticas integradas e personalizadas",
}

# Serviços confirmados pela ELO.
SERVICOS = {
    "armazenagem": {
        "nome": "Armazenagem",
        "sinais": [
            "necessidade de estoque regional",
            "falta de espaço próprio",
            "sazonalidade de volume",
            "distribuição a partir de SC",
            "importação com guarda de carga",
        ],
        "perguntas_chave": [
            "Quantos pallets ou posições em média e no pico?",
            "Qual o giro mensal do estoque?",
            "Precisa de área climatizada ou controlada?",
            "A carga é importada, nacional ou mista?",
        ],
    },
    "transporte_rodoviario": {
        "nome": "Transporte rodoviário",
        "sinais": [
            "distribuição recorrente",
            "entregas na região Sul",
            "fluxo porto-indústria",
            "necessidade de frota dedicada",
            "last mile regional",
        ],
        "perguntas_chave": [
            "Qual a origem e o destino predominantes?",
            "Qual a frequência de embarques por semana?",
            "Carga fechada (FTL) ou fracionada (LTL)?",
            "Há janela de entrega ou SLA exigido?",
        ],
    },
}

# Perfil de cliente ideal (ICP) — padrões iniciais, ajustáveis.
ICP = {
    "segmentos_prioritarios": [
        "importação e exportação",
        "indústria",
        "varejo e e-commerce",
        "distribuição e atacado",
        "bens de consumo",
    ],
    "regioes_prioritarias": [
        "Itajaí/SC", "Navegantes/SC", "Vale do Itajaí", "Grande Florianópolis",
        "Santa Catarina", "Paraná", "Rio Grande do Sul",
    ],
    "proximidade_portos": ["Porto de Itajaí", "Porto de Navegantes"],
    "indicadores_de_fit": [
        "opera importação ou exportação",
        "possui volume recorrente",
        "precisa de armazenagem e transporte juntos",
        "atua na região Sul",
        "tem sazonalidade que exige espaço extra",
    ],
}

# Pesos do score (somam 100).
# Comércio exterior deixou de ser decisivo: o peso de atividade logística foi
# reduzido e redistribuído para potencial de serviços, aderência ao ICP e região.
PESOS_SCORE: Dict[str, int] = {
    "aderencia_icp": 30,
    "potencial_servicos_elo": 30,
    "regiao_rotas": 15,
    "relacionamento_anterior": 10,
    "atividade_logistica": 5,
    "sinal_recente": 10,
}


@dataclass
class CriterioScore:
    chave: str
    rotulo: str
    peso: int
    nota: float = 0.0           # 0.0 a 1.0
    justificativa: str = ""
    fonte: str = "não informado"


def criterios_padrao() -> List[CriterioScore]:
    rotulos = {
        "aderencia_icp": "Aderência ao cliente ideal",
        "atividade_logistica": "Atividade logística/comércio exterior",
        "potencial_servicos_elo": "Potencial para armazenagem e transporte",
        "regiao_rotas": "Região e rotas atendidas",
        "relacionamento_anterior": "Relacionamento anterior",
        "sinal_recente": "Sinal recente de oportunidade",
    }
    return [CriterioScore(chave, rotulos[chave], peso) for chave, peso in PESOS_SCORE.items()]
