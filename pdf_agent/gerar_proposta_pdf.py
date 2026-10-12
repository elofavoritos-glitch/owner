"""Gera proposta comercial nativa da ELO em PDF."""
from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

from pdf_writer import PDFDocument, validate_pdf


def _moeda(value: Any) -> str:
    amount = Decimal(str(value))
    text = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {text}"


def _slug(value: str) -> str:
    return (re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_") or "cliente").lower()[:60]


def gerar_proposta_pdf(dados: Dict[str, Any], saida: Optional[str] = None) -> str:
    cliente = dados.get("cliente") or {}
    empresa = str(cliente.get("empresa", "")).strip()
    if not empresa:
        raise ValueError("Informe cliente.empresa.")
    itens = dados.get("itens") or []
    if not itens:
        raise ValueError("Informe ao menos um item comercial.")
    total = sum((Decimal(str(item["qtd"])) * Decimal(str(item["valor_unit"])) for item in itens), Decimal("0"))

    pdf = PDFDocument("Proposta Comercial")
    pdf.add_title("PROPOSTA COMERCIAL")
    pdf.add_key_value("Número", str(dados.get("numero") or "[PREENCHER Nº DA PROPOSTA]"))
    pdf.add_key_value("Data", date.today().strftime("%d/%m/%Y"))
    pdf.add_key_value("Validade", str(dados.get("validade") or "[PREENCHER VALIDADE]"))

    pdf.add_heading("1. Cliente")
    pdf.add_key_value("Empresa", empresa)
    pdf.add_key_value("CNPJ", str(cliente.get("cnpj") or "[PREENCHER CNPJ]"))
    pdf.add_key_value("Contato", str(cliente.get("contato") or "[PREENCHER CONTATO]"))
    pdf.add_key_value("E-mail", str(cliente.get("email") or "[PREENCHER E-MAIL]"))

    pdf.add_heading("2. Apresentação")
    pdf.add_paragraph(str(dados.get("apresentacao") or (
        "A ELO Soluções Logísticas Integradas apresenta uma solução personalizada, "
        "desenvolvida a partir das necessidades operacionais do cliente."
    )))

    pdf.add_heading("3. Escopo dos serviços")
    pdf.add_bullets([str(item) for item in dados.get("servicos", [])] or ["[PREENCHER ESCOPO]"])

    pdf.add_heading("4. Investimento")
    rows = []
    for item in itens:
        subtotal = Decimal(str(item["qtd"])) * Decimal(str(item["valor_unit"]))
        rows.append([
            str(item["descricao"]),
            str(item["qtd"]),
            _moeda(item["valor_unit"]),
            _moeda(subtotal),
        ])
    rows.append(["", "", "TOTAL", _moeda(total)])
    pdf.add_table(["Descrição", "Qtd.", "Valor unit.", "Subtotal"], rows, [34, 8, 18, 18])

    pdf.add_heading("5. Premissas e condições")
    pdf.add_bullets([str(item) for item in dados.get("condicoes", [])] or ["[PREENCHER CONDIÇÕES COMERCIAIS]"])

    pdf.add_heading("6. Próximos passos")
    pdf.add_paragraph("Permanecemos à disposição para validar o escopo e ajustar a solução à realidade operacional do cliente.")
    pdf.add_paragraph(str(dados.get("responsavel") or "[PREENCHER RESPONSÁVEL COMERCIAL]"), bold=True)

    if saida is None:
        saida = str(Path(__file__).parent / "output" / f"proposta_elo_{_slug(empresa)}_{date.today().isoformat()}.pdf")
    caminho = pdf.save(saida)
    validate_pdf(caminho)
    return caminho


if __name__ == "__main__":
    exemplo = {
        "numero": "PDF-EXEMPLO-001",
        "validade": "15 dias",
        "responsavel": "Equipe Comercial ELO",
        "cliente": {
            "empresa": "[CLIENTE EXEMPLO]",
            "cnpj": "[PREENCHER CNPJ]",
            "contato": "[PREENCHER CONTATO]",
            "email": "[PREENCHER E-MAIL]",
        },
        "servicos": ["Armazenagem", "Gestão de estoque", "Distribuição rodoviária"],
        "itens": [
            {"descricao": "Armazenagem mensal", "qtd": 30, "valor_unit": 42.50},
            {"descricao": "Distribuição dedicada", "qtd": 6, "valor_unit": 980},
        ],
        "condicoes": ["Valores sujeitos à validação das premissas", "Condições conforme aceite comercial"],
    }
    arquivo = gerar_proposta_pdf(exemplo)
    print(f"PDF gerado: {arquivo}")
    print(validate_pdf(arquivo))
