"""Gera apresentação comercial da ELO em PowerPoint."""
from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

from pptx_writer import Presentation, validate_pptx


def _moeda(value: Any) -> str:
    amount = Decimal(str(value))
    text = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {text}"


def _slug(value: str) -> str:
    return (re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_") or "cliente").lower()[:60]


def gerar_apresentacao(dados: Dict[str, Any], saida: Optional[str] = None) -> str:
    cliente = dados.get("cliente") or {}
    empresa = str(cliente.get("empresa", "")).strip()
    if not empresa:
        raise ValueError("Informe cliente.empresa.")
    servicos = [str(item).strip() for item in dados.get("servicos", []) if str(item).strip()]
    if not servicos:
        raise ValueError("Informe ao menos um serviço.")
    itens = dados.get("itens", [])
    total = sum((Decimal(str(item["qtd"])) * Decimal(str(item["valor_unit"])) for item in itens), Decimal("0"))
    numero = str(dados.get("numero") or "[PREENCHER Nº DA APRESENTAÇÃO]")

    deck = Presentation()
    deck.add_slide(
        "Solução Logística Personalizada",
        subtitle=f"{empresa} • {numero}",
        cover=True,
    )
    deck.add_slide(
        "Entendimento da necessidade",
        [
            str(dados.get("contexto") or "[PREENCHER CONTEXTO E DESAFIO DO CLIENTE]"),
            f"Origem: {dados.get('origem') or '[PREENCHER ORIGEM]'}",
            f"Destino: {dados.get('destino') or '[PREENCHER DESTINO]'}",
            f"Volume: {dados.get('volume') or '[PREENCHER VOLUME]'}",
        ],
        subtitle="Diagnóstico comercial",
    )
    deck.add_slide(
        "Solução proposta",
        servicos,
        subtitle="Escopo desenhado para a operação",
    )
    premissas = [str(item) for item in dados.get("premissas", [])] or ["[PREENCHER PREMISSAS OPERACIONAIS]"]
    deck.add_slide("Premissas e responsabilidades", premissas, subtitle="Pontos para validação conjunta")
    investimento = [
        f"{item['descricao']}: {item['qtd']} × {_moeda(item['valor_unit'])}"
        for item in itens
    ] or ["[PREENCHER COMPOSIÇÃO DE PREÇO]"]
    investimento.append(f"Investimento total: {_moeda(total)}")
    deck.add_slide("Investimento", investimento, subtitle="Valores e condições comerciais")
    deck.add_slide(
        "Próximos passos",
        [
            "Validar escopo e premissas com o cliente",
            "Confirmar condições comerciais e SLA",
            "Formalizar aceite e plano de implantação",
            f"Responsável: {dados.get('responsavel') or '[PREENCHER RESPONSÁVEL]'}",
        ],
        subtitle="ELO Soluções Logísticas Integradas",
    )

    if saida is None:
        saida = str(Path(__file__).parent / "output" / f"apresentacao_elo_{_slug(empresa)}_{date.today().isoformat()}.pptx")
    caminho = deck.save(saida)
    validate_pptx(caminho)
    return caminho


if __name__ == "__main__":
    exemplo = {
        "numero": "PPT-EXEMPLO-001",
        "cliente": {"empresa": "[CLIENTE EXEMPLO]"},
        "contexto": "Otimizar armazenagem e distribuição regional.",
        "origem": "Itajaí/SC",
        "destino": "[PREENCHER DESTINO]",
        "volume": "[PREENCHER VOLUME]",
        "servicos": ["Armazenagem", "Gestão de estoque", "Distribuição rodoviária"],
        "premissas": ["Volumes sujeitos à validação", "Prazos conforme SLA aprovado"],
        "itens": [
            {"descricao": "Armazenagem", "qtd": 30, "valor_unit": 42.50},
            {"descricao": "Distribuição", "qtd": 6, "valor_unit": 980},
        ],
        "responsavel": "Equipe Comercial ELO",
    }
    arquivo = gerar_apresentacao(exemplo)
    print(f"Apresentação gerada: {arquivo}")
    print(validate_pptx(arquivo))
