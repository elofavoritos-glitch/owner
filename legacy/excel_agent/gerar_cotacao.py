"""Gera cotações logísticas da ELO em Excel.

As planilhas mantêm preços como números reais, preservam premissas e distinguem
valores confirmados de estimativas. Nenhum custo operacional é presumido.
"""
from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from xlsx_writer import Workbook, column_name, validate_xlsx


EMPRESA = {
    "nome": "ELO Soluções Logísticas Integradas",
    "cidade": "Itajaí/SC",
    "site": "https://eloarmazenagem.com.br",
}

MARCADOR = "[PREENCHER]"
CLASSIFICACOES = {"Confirmado", "Estimativa"}


def _texto(value: Any, marcador: str = MARCADOR) -> str:
    text = str(value).strip() if value is not None else ""
    return text or marcador


def _decimal(value: Any, campo: str, *, positivo: bool = False) -> Decimal:
    if isinstance(value, bool):
        raise ValueError(f"{campo} precisa ser numérico.")
    try:
        if isinstance(value, str):
            normalized = value.strip().replace("R$", "").replace(" ", "")
            if "," in normalized and "." in normalized:
                normalized = normalized.replace(".", "").replace(",", ".")
            elif "," in normalized:
                normalized = normalized.replace(",", ".")
            number = Decimal(normalized)
        else:
            number = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{campo} precisa ser numérico.") from exc
    if positivo and number <= 0:
        raise ValueError(f"{campo} precisa ser maior que zero.")
    if not positivo and number < 0:
        raise ValueError(f"{campo} não pode ser negativo.")
    return number


def _slug(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip()).strip("_")
    return (safe or "cliente").lower()[:60]


def _validar(dados: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    if not isinstance(dados, dict):
        raise ValueError("Os dados da cotação precisam ser um dicionário.")
    cliente = dados.get("cliente")
    if not isinstance(cliente, dict) or not str(cliente.get("empresa", "")).strip():
        raise ValueError("Informe cliente.empresa.")
    operacao = dados.get("operacao")
    if not isinstance(operacao, dict) or not str(operacao.get("servico", "")).strip():
        raise ValueError("Informe operacao.servico.")
    itens = dados.get("itens")
    if not isinstance(itens, list) or not itens:
        raise ValueError("Informe pelo menos um item de cotação.")

    pendencias: List[str] = []
    normalizados = []
    campos_item = ("descricao", "unidade", "qtd", "valor_unit", "adicionais", "impostos", "classificacao")
    for index, item in enumerate(itens, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Item {index} precisa ser um dicionário.")
        faltantes = [campo for campo in campos_item if campo not in item]
        if faltantes:
            raise ValueError(f"Item {index}: informe {', '.join(faltantes)}. Use 0 quando um custo foi confirmado como não aplicável.")
        descricao = str(item["descricao"]).strip()
        unidade = str(item["unidade"]).strip()
        classificacao = str(item["classificacao"]).strip().title()
        if not descricao or not unidade:
            raise ValueError(f"Item {index}: descrição e unidade são obrigatórias.")
        if classificacao not in CLASSIFICACOES:
            raise ValueError(f"Item {index}: classificacao deve ser Confirmado ou Estimativa.")
        quantidade = _decimal(item["qtd"], f"Item {index}.qtd", positivo=True)
        valor_unit = _decimal(item["valor_unit"], f"Item {index}.valor_unit")
        adicionais = _decimal(item["adicionais"], f"Item {index}.adicionais")
        impostos = _decimal(item["impostos"], f"Item {index}.impostos")
        subtotal = quantidade * valor_unit + adicionais + impostos
        normalizados.append({
            "descricao": descricao,
            "unidade": unidade,
            "qtd": quantidade,
            "valor_unit": valor_unit,
            "adicionais": adicionais,
            "impostos": impostos,
            "subtotal": subtotal,
            "classificacao": classificacao,
        })

    for field, label in (
        (cliente.get("cnpj"), "CNPJ do cliente"),
        (cliente.get("contato"), "contato do cliente"),
        (cliente.get("email"), "e-mail do cliente"),
        (operacao.get("origem"), "origem da operação"),
        (operacao.get("destino"), "destino da operação"),
        (dados.get("responsavel"), "responsável comercial"),
        (dados.get("validade"), "validade da cotação"),
    ):
        if not str(field or "").strip():
            pendencias.append(label)

    copia = dict(dados)
    copia["cliente"] = dict(cliente)
    copia["operacao"] = dict(operacao)
    copia["itens"] = normalizados
    return copia, pendencias


def _cabecalho(sheet, titulo: str, subtitulo: str, ultima_coluna: int) -> None:
    end = column_name(ultima_coluna)
    sheet.set_cell(1, 1, titulo, style="title")
    sheet.merge_cells(f"A1:{end}1")
    sheet.set_cell(2, 1, subtitulo, style="subtitle")
    sheet.merge_cells(f"A2:{end}2")


def gerar_cotacao(dados: Dict[str, Any], saida: Optional[str] = None) -> str:
    dados, pendencias = _validar(dados)
    cliente = dados["cliente"]
    operacao = dados["operacao"]
    hoje = date.today()
    numero = _texto(dados.get("numero"), "[PREENCHER Nº COTAÇÃO]")
    responsavel = _texto(dados.get("responsavel"), "[PREENCHER RESPONSÁVEL]")
    validade = _texto(dados.get("validade"), "[PREENCHER VALIDADE]")
    total = sum((item["subtotal"] for item in dados["itens"]), Decimal("0"))

    workbook = Workbook()

    resumo = workbook.add_sheet("Resumo")
    _cabecalho(resumo, "COTAÇÃO LOGÍSTICA", f'{EMPRESA["nome"]} • {EMPRESA["site"]}', 4)
    resumo.set_column_width(1, 24)
    resumo.set_column_width(2, 42)
    resumo.set_column_width(3, 24)
    resumo.set_column_width(4, 34)
    resumo.freeze_panes(rows=4)
    resumo.append_row([])
    resumo.append_row(["Campo", "Informação", "Campo", "Informação"], styles=["header"] * 4)
    linhas_resumo = [
        ("Nº da cotação", numero, "Data", hoje),
        ("Cliente", cliente["empresa"], "CNPJ", _texto(cliente.get("cnpj"), "[PREENCHER CNPJ]")),
        ("Contato", _texto(cliente.get("contato"), "[PREENCHER CONTATO]"), "E-mail", _texto(cliente.get("email"), "[PREENCHER E-MAIL]")),
        ("Serviço", operacao["servico"], "Modal", _texto(operacao.get("modal"), "[PREENCHER MODAL]")),
        ("Origem", _texto(operacao.get("origem"), "[PREENCHER ORIGEM]"), "Destino", _texto(operacao.get("destino"), "[PREENCHER DESTINO]")),
        ("Equipamento", _texto(operacao.get("equipamento"), "[PREENCHER EQUIPAMENTO]"), "Volume", _texto(operacao.get("volume"), "[PREENCHER VOLUME]")),
        ("Responsável", responsavel, "Validade", validade),
    ]
    for left_label, left_value, right_label, right_value in linhas_resumo:
        row = resumo.append_row(
            [left_label, left_value, right_label, right_value],
            styles=["section", "text", "section", "date" if isinstance(right_value, date) else "text"],
        )
    resumo.append_row(["", "", "VALOR TOTAL", total], styles=["default", "default", "total_label", "total_currency"])
    if pendencias:
        resumo.append_row([])
        resumo.append_row(["PENDÊNCIAS", "; ".join(pendencias)], styles=["warning", "warning"])
        resumo.merge_cells(f"B{resumo.max_row}:D{resumo.max_row}")

    itens_sheet = workbook.add_sheet("Itens")
    _cabecalho(itens_sheet, "COMPOSIÇÃO DE PREÇO", "Valores numéricos e rastreáveis por item", 9)
    widths = [8, 38, 16, 13, 18, 16, 16, 18, 15]
    for column, width in enumerate(widths, start=1):
        itens_sheet.set_column_width(column, width)
    headers = ["Item", "Serviço", "Unidade", "Quantidade", "Valor unitário", "Adicionais", "Impostos", "Subtotal", "Classificação"]
    header_row = itens_sheet.append_row([])
    header_row = itens_sheet.append_row(headers, styles=["header"] * len(headers))
    first_data_row = header_row + 1
    for index, item in enumerate(dados["itens"], start=1):
        row = itens_sheet.append_row([
            index,
            item["descricao"],
            item["unidade"],
            item["qtd"],
            item["valor_unit"],
            item["adicionais"],
            item["impostos"],
            None,
            item["classificacao"],
        ], styles=["integer", "text", "text", "decimal", "currency", "currency", "currency", "currency", "text"])
        itens_sheet.set_cell(
            row,
            8,
            style="currency",
            formula=f"D{row}*E{row}+F{row}+G{row}",
            cached_value=item["subtotal"],
        )
    last_data_row = itens_sheet.max_row
    total_row = itens_sheet.append_row(["", "", "", "", "", "", "TOTAL", total, ""], styles=[
        "default", "default", "default", "default", "default", "default", "total_label", "total_currency", "default"
    ])
    itens_sheet.set_auto_filter(f"A{header_row}:I{last_data_row}")
    itens_sheet.freeze_panes(rows=header_row)
    itens_sheet.add_list_validation(f"I{first_data_row}:I1000", '"Confirmado,Estimativa"', allow_blank=False)

    premissas_sheet = workbook.add_sheet("Premissas")
    _cabecalho(premissas_sheet, "PREMISSAS, INCLUSÕES E EXCLUSÕES", "Registre a origem e o status de cada condição comercial", 5)
    for column, width in enumerate([20, 55, 16, 28, 40], start=1):
        premissas_sheet.set_column_width(column, width)
    headers_premissas = ["Categoria", "Descrição", "Status", "Fonte", "Observação"]
    premissas_sheet.append_row([])
    premissa_header = premissas_sheet.append_row(headers_premissas, styles=["header"] * 5)
    premissas = dados.get("premissas") or [{
        "categoria": "Pendente",
        "descricao": "[PREENCHER PREMISSAS, INCLUSÕES E EXCLUSÕES]",
        "status": "Pendente",
        "fonte": "Comercial",
        "observacao": "Não enviar ao cliente sem revisão.",
    }]
    for premissa in premissas:
        premissas_sheet.append_row([
            _texto(premissa.get("categoria")),
            _texto(premissa.get("descricao")),
            _texto(premissa.get("status")),
            _texto(premissa.get("fonte")),
            _texto(premissa.get("observacao"), ""),
        ], styles=["text"] * 5)
    premissas_sheet.set_auto_filter(f"A{premissa_header}:E{premissas_sheet.max_row}")
    premissas_sheet.freeze_panes(rows=premissa_header)
    premissas_sheet.add_list_validation(f"C{premissa_header + 1}:C1000", '"Confirmado,Estimativa,Pendente"')

    if saida is None:
        saida = str(Path(__file__).parent / "output" / f"cotacao_elo_{_slug(cliente['empresa'])}_{hoje.isoformat()}.xlsx")
    caminho = workbook.save(saida)
    validate_xlsx(caminho)
    return caminho


if __name__ == "__main__":
    exemplo = {
        "numero": "COT-EXEMPLO-001",
        "responsavel": "Equipe Comercial ELO",
        "validade": "15 dias",
        "cliente": {
            "empresa": "[CLIENTE EXEMPLO]",
            "cnpj": "[PREENCHER CNPJ]",
            "contato": "[PREENCHER CONTATO]",
            "email": "[PREENCHER E-MAIL]",
        },
        "operacao": {
            "servico": "Armazenagem e distribuição",
            "modal": "Rodoviário",
            "origem": "Itajaí/SC",
            "destino": "[PREENCHER DESTINO]",
            "equipamento": "[PREENCHER EQUIPAMENTO]",
            "volume": "[PREENCHER VOLUME]",
        },
        "itens": [
            {
                "descricao": "Armazenagem mensal",
                "unidade": "pallet/mês",
                "qtd": 30,
                "valor_unit": 42.50,
                "adicionais": 0,
                "impostos": 0,
                "classificacao": "Estimativa",
            },
            {
                "descricao": "Distribuição dedicada",
                "unidade": "viagem",
                "qtd": 6,
                "valor_unit": 980,
                "adicionais": 0,
                "impostos": 0,
                "classificacao": "Estimativa",
            },
        ],
        "premissas": [
            {
                "categoria": "Volume",
                "descricao": "30 pallets por mês",
                "status": "Estimativa",
                "fonte": "Briefing comercial",
                "observacao": "Validar média e pico antes do envio.",
            },
            {
                "categoria": "Exclusão",
                "descricao": "Seguro, tributos e serviços não descritos não estão inclusos.",
                "status": "Pendente",
                "fonte": "Comercial",
                "observacao": "Submeter à revisão responsável.",
            },
        ],
    }
    arquivo = gerar_cotacao(exemplo)
    relatorio = validate_xlsx(arquivo)
    print(f"Cotação gerada: {arquivo}")
    print(f"Validação: {relatorio}")
