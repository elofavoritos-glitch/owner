"""Qualificação de leads (BANT + SPIN) para o comercial da ELO.

Avalia se o lead está pronto para proposta, precisa amadurecer ou deve ser
despriorizado. Não inventa dados: o que não foi respondido vira pendência e
reduz a confiança da recomendação.

BANT: Budget, Authority, Need, Timing.
SPIN: Situação, Problema, Implicação, Necessidade de solução.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


SIM = {"sim", "s", "true", "verdadeiro", "yes", "y", "1"}

# Perguntas BANT (peso) + como interpretar.
BANT = [
    {"chave": "orcamento", "peso": 25, "pergunta": "O cliente tem orçamento/verba para logística? (sim/não/parcial)"},
    {"chave": "autoridade", "peso": 25, "pergunta": "Você fala com quem decide a contratação? (sim/não/influenciador)"},
    {"chave": "necessidade", "peso": 30, "pergunta": "Há necessidade clara de armazenagem/transporte? (sim/não)"},
    {"chave": "prazo", "peso": 20, "pergunta": "Existe prazo definido para começar? (sim/não)"},
]

# Perguntas SPIN (qualitativas; ajudam o diagnóstico e a abordagem).
SPIN = [
    {"chave": "situacao", "pergunta": "Situação: como é a operação logística hoje?"},
    {"chave": "problema", "pergunta": "Problema: qual a principal dor (custo, prazo, espaço, avarias)?"},
    {"chave": "implicacao", "pergunta": "Implicação: o que esse problema causa (perda, atraso, multa)?"},
    {"chave": "necessidade_solucao", "pergunta": "Necessidade: que resultado o cliente espera de uma solução?"},
]


def roteiro() -> Dict[str, List[Dict[str, str]]]:
    return {
        "bant": [{"chave": q["chave"], "pergunta": q["pergunta"]} for q in BANT],
        "spin": list(SPIN),
    }


def _nota_bant(chave: str, valor: Any) -> Optional[float]:
    if valor is None:
        return None
    v = str(valor).strip().lower()
    if not v:
        return None
    if chave == "orcamento":
        if v in SIM:
            return 1.0
        if "parcial" in v:
            return 0.5
        return 0.0
    if chave == "autoridade":
        if v in SIM:
            return 1.0
        if "influenc" in v:
            return 0.6
        return 0.2
    # necessidade e prazo: binários
    return 1.0 if v in SIM else 0.0


@dataclass
class Qualificacao:
    score: int
    estagio: str
    recomendacao: str
    bant_detalhe: List[Dict[str, Any]] = field(default_factory=list)
    spin_resumo: Dict[str, str] = field(default_factory=dict)
    pendencias: List[str] = field(default_factory=list)

    def resumo(self) -> Dict[str, Any]:
        return {
            "score_qualificacao": self.score,
            "estagio": self.estagio,
            "recomendacao": self.recomendacao,
            "bant": self.bant_detalhe,
            "spin": self.spin_resumo,
            "pendencias": self.pendencias,
        }


def qualificar(respostas: Dict[str, Any]) -> Qualificacao:
    if not isinstance(respostas, dict):
        raise ValueError("As respostas de qualificação devem ser um dicionário.")

    total = 0.0
    detalhe: List[Dict[str, Any]] = []
    pendencias: List[str] = []

    for q in BANT:
        valor = respostas.get(q["chave"])
        nota = _nota_bant(q["chave"], valor)
        if nota is None:
            pendencias.append(q["pergunta"])
            detalhe.append({"criterio": q["chave"], "peso": q["peso"], "nota": None, "pontos": 0})
            continue
        total += q["peso"] * nota
        detalhe.append({"criterio": q["chave"], "peso": q["peso"], "nota": nota, "pontos": round(q["peso"] * nota, 1)})

    spin = {q["chave"]: str(respostas.get(q["chave"], "")).strip() for q in SPIN}
    pendencias += [q["pergunta"] for q in SPIN if not spin[q["chave"]]]

    score = round(total)
    estagio, recomendacao = _classificar(score, respostas, spin)
    return Qualificacao(score, estagio, recomendacao, detalhe, spin, pendencias)


def _classificar(score: int, respostas: Dict[str, Any], spin: Dict[str, str]):
    necessidade = str(respostas.get("necessidade", "")).strip().lower() in SIM
    if score >= 70 and necessidade:
        return "Qualificado (pronto para proposta)", "Avançar para diagnóstico detalhado e preparar proposta."
    if score >= 45:
        return "Em maturação", "Nutrir e qualificar: aprofundar implicação do problema e confirmar decisor/prazo."
    if not necessidade and score > 0:
        return "Baixa aderência", "Sem necessidade clara: manter em cadência leve e reavaliar no futuro."
    return "Insuficiente para qualificar", "Coletar mais informações antes de investir esforço comercial."


if __name__ == "__main__":
    import json
    exemplo = {
        "orcamento": "sim", "autoridade": "influenciador", "necessidade": "sim", "prazo": "sim",
        "situacao": "Opera com armazém próprio lotado",
        "problema": "Falta espaço no pico de dezembro",
        "implicacao": "Perde vendas por não conseguir estocar",
        "necessidade_solucao": "Espaço flexível e distribuição rápida no Sul",
    }
    print(json.dumps(qualificar(exemplo).resumo(), ensure_ascii=False, indent=2))
