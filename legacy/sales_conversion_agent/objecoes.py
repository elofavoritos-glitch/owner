"""Tratamento de objeções comerciais para armazenagem e transporte da ELO.

Dado o texto de uma objeção do cliente, identifica o tipo e sugere linhas de
resposta consultivas, ancoradas nos diferenciais reais da ELO. Não promete
preço, prazo ou condição: entrega argumentos e perguntas, nunca compromisso.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List


def _normalizar(texto: str) -> str:
    t = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().lower()
    return t


# Catálogo de objeções: gatilhos -> argumentos e perguntas de reenquadramento.
CATALOGO = {
    "preco": {
        "rotulo": "Preço / está caro",
        "gatilhos": ["caro", "preco", "price", "valor alto", "acima", "custo alto", "muito valor", "desconto"],
        "argumentos": [
            "Reposicionar de preço para custo total: avarias, retrabalho, multas e capital parado em estoque.",
            "Mostrar o valor da solução integrada (armazenagem + transporte) e a redução de intermediários.",
            "Destacar previsibilidade e SLA como proteção contra custos ocultos.",
        ],
        "perguntas": [
            "Quando avalia o custo, está considerando só o frete ou a operação completa?",
            "Quanto custa hoje um atraso ou uma avaria na sua operação?",
        ],
    },
    "operador_atual": {
        "rotulo": "Já tenho operador logístico",
        "gatilhos": ["ja tenho", "ja trabalho", "operador atual", "fornecedor atual", "contrato com"],
        "argumentos": [
            "Posicionar a ELO como alternativa de contingência/benchmark, sem exigir troca imediata.",
            "Oferecer piloto em uma rota ou volume específico para comparar na prática.",
            "Explorar o atendimento boutique e a proximidade dos portos de Itajaí/Navegantes.",
        ],
        "perguntas": [
            "O que funciona bem e o que poderia melhorar no operador atual?",
            "Faria sentido testarmos uma operação pontual para você comparar?",
        ],
    },
    "sem_volume": {
        "rotulo": "Não tenho volume suficiente",
        "gatilhos": ["volume", "pouca carga", "nao tenho carga", "pequeno", "baixa demanda"],
        "argumentos": [
            "Apresentar modelos flexíveis (fracionado/compartilhado) adequados a volumes menores.",
            "Mostrar que a solução cresce com o cliente, sem compromisso de grande escala no início.",
        ],
        "perguntas": [
            "Qual é o volume médio e o de pico ao longo do ano?",
            "Há sazonalidade em que o espaço extra faria diferença?",
        ],
    },
    "sem_tempo": {
        "rotulo": "Agora não é o momento / sem tempo",
        "gatilhos": ["sem tempo", "nao e o momento", "depois", "mais pra frente", "ocupado"],
        "argumentos": [
            "Respeitar o momento e propor um contato futuro agendado, mantendo relacionamento.",
            "Deixar um material objetivo para quando a necessidade aparecer.",
        ],
        "perguntas": [
            "Quando seria um bom momento para retomarmos?",
            "Posso te enviar um resumo de 1 página para ter à mão quando precisar?",
        ],
    },
    "so_material": {
        "rotulo": "Só me envie uma apresentação",
        "gatilhos": ["apresentacao", "material", "manda por email", "so o material", "envia por email"],
        "argumentos": [
            "Enviar material enxuto e condicionar a um retorno rápido para dúvidas.",
            "Usar o envio para marcar uma conversa curta de 15 minutos.",
        ],
        "perguntas": [
            "Para eu personalizar o material, qual é o seu principal desafio logístico hoje?",
            "Podemos marcar 15 minutos depois que você der uma olhada?",
        ],
    },
    "analise_interna": {
        "rotulo": "Vou analisar internamente",
        "gatilhos": ["analisar", "ver internamente", "levar pra diretoria", "pensar", "avaliar com a equipe"],
        "argumentos": [
            "Oferecer apoio na análise (dados, comparativo, estudo de caso) para facilitar a decisão interna.",
            "Alinhar critérios de decisão e próximos passos com data definida.",
        ],
        "perguntas": [
            "Quais critérios serão mais importantes nessa análise?",
            "Quem mais participa da decisão e qual o prazo que vocês têm em mente?",
        ],
    },
}


@dataclass
class RespostaObjecao:
    objecao_original: str
    tipo: str
    rotulo: str
    argumentos: List[str] = field(default_factory=list)
    perguntas: List[str] = field(default_factory=list)
    observacao: str = ""

    def resumo(self) -> Dict[str, Any]:
        return {
            "objecao": self.objecao_original,
            "tipo_identificado": self.tipo,
            "rotulo": self.rotulo,
            "linhas_de_resposta": self.argumentos,
            "perguntas_de_reenquadramento": self.perguntas,
            "observacao": self.observacao,
        }


def tratar(objecao: str) -> RespostaObjecao:
    texto = str(objecao).strip()
    if not texto:
        raise ValueError("Informe o texto da objeção do cliente.")
    norm = _normalizar(texto)

    melhor = None
    melhor_hits = 0
    for tipo, dados in CATALOGO.items():
        hits = sum(1 for g in dados["gatilhos"] if g in norm)
        if hits > melhor_hits:
            melhor, melhor_hits = tipo, hits

    if melhor is None:
        return RespostaObjecao(
            texto, "nao_identificada", "Objeção não reconhecida",
            argumentos=[
                "Fazer uma pergunta aberta para entender a real preocupação por trás da objeção.",
                "Reformular com o cliente para confirmar o entendimento antes de responder.",
            ],
            perguntas=["Pode me explicar um pouco mais o que te preocupa nesse ponto?"],
            observacao="Objeção fora do catálogo. Trate de forma consultiva e registre para evoluir o catálogo.",
        )

    dados = CATALOGO[melhor]
    return RespostaObjecao(
        texto, melhor, dados["rotulo"],
        argumentos=list(dados["argumentos"]),
        perguntas=list(dados["perguntas"]),
        observacao="Use como roteiro consultivo. Não prometa preço, prazo ou condição sem validação.",
    )


if __name__ == "__main__":
    import json
    for o in ["Achei o preço muito alto", "Já tenho operador logístico", "Me manda só uma apresentação", "xpto"]:
        print(json.dumps(tratar(o).resumo(), ensure_ascii=False, indent=2))
        print("-" * 40)
