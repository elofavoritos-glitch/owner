"""
gerar_proposta — Agente interno de Word para o comercial de logística.

Gera uma PROPOSTA COMERCIAL em formato .docx a partir de dados estruturados.
Pensado para empresa boutique de logística (soluções personalizadas).

Como usar:
    python3 gerar_proposta.py              # gera uma proposta de exemplo
    # ou, no código, montar o dict `dados` e chamar gerar_proposta(dados)
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List

from docx_writer import Document


# ---------------------------------------------------------------------------
# Dados da sua empresa (ajuste aqui uma vez)
# ---------------------------------------------------------------------------
EMPRESA = {
    "nome": "ELO Soluções Logísticas Integradas",
    "slogan": "Soluções logísticas integradas e personalizadas para cada cliente",
    "cidade": "Itajaí / SC",
    "site": "https://eloarmazenagem.com.br",
    # Informe e-mail e telefone somente depois de confirmá-los.
    "contato": "https://eloarmazenagem.com.br",
    # Cor corporativa provisória até o envio do manual de marca ou logotipo.
    "cor": "1F3864",
}


def _moeda(valor: float) -> str:
    s = f"{valor:,.2f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def gerar_proposta(dados: Dict, saida: str = "proposta.docx") -> str:
    doc = Document(brand_color=EMPRESA["cor"])

    # ---- Cabeçalho / marca --------------------------------------------
    doc.add_paragraph(
        EMPRESA["nome"], bold=True, size=22,
        color=EMPRESA["cor"], space_after=0,
    )
    doc.add_paragraph(
        EMPRESA["slogan"], italic=True, size=10,
        color="595959", space_after=40,
    )
    doc.add_paragraph(
        f'{EMPRESA["cidade"]}  •  {EMPRESA["contato"]}',
        size=9, color="595959",
    )
    doc.add_hrule()

    # ---- Título --------------------------------------------------------
    doc.add_paragraph(
        "PROPOSTA COMERCIAL", bold=True, size=16,
        color=EMPRESA["cor"], align="center", space_after=40,
    )
    doc.add_paragraph(
        f'Nº {dados.get("numero", "0001")}/{datetime.now().year}',
        align="center", size=10, color="595959", space_after=200,
    )

    # ---- Dados do cliente ---------------------------------------------
    doc.add_heading("1. Dados do Cliente", level=2)
    cli = dados["cliente"]
    doc.add_table(
        headers=["Campo", "Informação"],
        rows=[
            ["Empresa", cli.get("empresa", "")],
            ["CNPJ", cli.get("cnpj", "")],
            ["Contato", cli.get("contato", "")],
            ["E-mail", cli.get("email", "")],
            ["Data da proposta", datetime.now().strftime("%d/%m/%Y")],
            ["Validade", dados.get("validade", "15 dias")],
        ],
        col_widths=[2800, 6200],
    )

    # ---- Apresentação --------------------------------------------------
    doc.add_heading("2. Apresentação", level=2)
    doc.add_paragraph(
        dados.get(
            "apresentacao",
            f'Prezados, agradecemos a oportunidade. Como boutique de logística '
            f'sediada em {EMPRESA["cidade"]}, desenhamos soluções sob medida para '
            f'as necessidades de {cli.get("empresa", "sua empresa")}, combinando '
            f'proximidade, flexibilidade e expertise operacional.',
        ),
        align="both",
    )

    # ---- Escopo de serviços -------------------------------------------
    doc.add_heading("3. Escopo dos Serviços", level=2)
    for item in dados.get("servicos", []):
        doc.add_paragraph(f'•  {item}', space_after=80)

    # ---- Investimento (tabela de valores) -----------------------------
    doc.add_heading("4. Investimento", level=2)
    itens: List[Dict] = dados.get("itens", [])
    linhas = []
    total = 0.0
    for it in itens:
        subtotal = it["qtd"] * it["valor_unit"]
        total += subtotal
        linhas.append([
            it["descricao"],
            str(it["qtd"]),
            _moeda(it["valor_unit"]),
            _moeda(subtotal),
        ])
    linhas.append(["", "", "TOTAL", _moeda(total)])
    doc.add_table(
        headers=["Descrição", "Qtd.", "Valor Unit.", "Subtotal"],
        rows=linhas,
        col_widths=[4500, 1000, 1750, 1750],
    )

    # ---- Condições -----------------------------------------------------
    doc.add_heading("5. Condições Comerciais", level=2)
    for cond in dados.get("condicoes", [
        "Pagamento: a combinar (faturamento mensal ou por operação).",
        "Prazos operacionais conforme SLA acordado em contrato.",
        "Valores sujeitos a reajuste conforme variação de custos (combustível/pedágio).",
    ]):
        doc.add_paragraph(f'•  {cond}', space_after=80)

    # ---- Encerramento --------------------------------------------------
    doc.add_heading("6. Próximos Passos", level=2)
    doc.add_paragraph(
        "Permanecemos à disposição para apresentar esta proposta pessoalmente e "
        "ajustar qualquer ponto conforme a sua realidade operacional.",
        align="both",
    )
    doc.add_paragraph("", space_after=240)
    doc.add_paragraph("Atenciosamente,", space_after=60)
    doc.add_paragraph(dados.get("vendedor", "Equipe Comercial"), bold=True, space_after=0)
    doc.add_paragraph(EMPRESA["nome"], size=10, color="595959", space_after=0)
    doc.add_paragraph(EMPRESA["contato"], size=9, color="595959")

    return doc.save(saida)


# ---------------------------------------------------------------------------
# Exemplo de uso
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    exemplo = {
        "numero": "0042",
        "validade": "15 dias",
        "vendedor": "Equipe Comercial ELO",
        "cliente": {
            "empresa": "Importadora Maré Alta Ltda.",
            "cnpj": "00.000.000/0001-00",
            "contato": "Maria Souza",
            "email": "maria@marealta.com.br",
        },
        "servicos": [
            "Logística de importação com desembaraço no Porto de Itajaí/Navegantes",
            "Armazenagem alfandegada e geral",
            "Transporte rodoviário dedicado (last mile) para a região Sul",
            "Gestão documental e acompanhamento em tempo real",
        ],
        "itens": [
            {"descricao": "Desembaraço + liberação portuária (por contêiner)", "qtd": 4, "valor_unit": 1850.00},
            {"descricao": "Armazenagem (por pallet/mês)", "qtd": 30, "valor_unit": 42.50},
            {"descricao": "Transporte rodoviário dedicado (por viagem)", "qtd": 6, "valor_unit": 980.00},
        ],
        "condicoes": [
            "Pagamento: faturamento mensal, vencimento em 15 dias.",
            "SLA de liberação: até 48h após chegada da documentação.",
            "Valores sujeitos a reajuste conforme variação de combustível/pedágio.",
            "Proposta personalizada — ajustável conforme volume e recorrência.",
        ],
    }
    caminho = gerar_proposta(exemplo, saida="proposta_elo_exemplo.docx")
    print(f"Proposta gerada: {caminho}")
