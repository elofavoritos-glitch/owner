"""Gera funil, forecast e carteira comercial da ELO em Excel."""
from __future__ import annotations

import re
from collections import OrderedDict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from xlsx_writer import Workbook, column_name, validate_xlsx


ETAPAS = ["Prospecção", "Qualificação", "Diagnóstico", "Cotação", "Negociação", "Ganho", "Perdido"]
STATUS = ["Ativa", "Em espera", "Ganha", "Perdida"]


def _texto(value: Any, marcador: str = "[PREENCHER]") -> str:
    text = str(value).strip() if value is not None else ""
    return text or marcador


def _decimal(value: Any, campo: str) -> Decimal:
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
    if number < 0:
        raise ValueError(f"{campo} não pode ser negativo.")
    return number


def _data(value: Any, campo: str, *, obrigatoria: bool = False) -> Optional[date]:
    if value in (None, ""):
        if obrigatoria:
            raise ValueError(f"{campo} é obrigatória.")
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"{campo} deve usar dd/mm/aaaa ou aaaa-mm-dd.")


def _validar(oportunidades: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    if not isinstance(oportunidades, list) or not oportunidades:
        raise ValueError("Informe uma lista com pelo menos uma oportunidade.")
    ids = set()
    resultado = []
    pendencias: List[str] = []
    obrigatorios = ("id", "cliente", "servico", "etapa", "status", "responsavel", "valor_potencial", "probabilidade")

    for index, oportunidade in enumerate(oportunidades, start=1):
        if not isinstance(oportunidade, dict):
            raise ValueError(f"Oportunidade {index} precisa ser um dicionário.")
        faltantes = [campo for campo in obrigatorios if not str(oportunidade.get(campo, "")).strip()]
        if faltantes:
            raise ValueError(f"Oportunidade {index}: informe {', '.join(faltantes)}.")
        oid = str(oportunidade["id"]).strip()
        if oid.casefold() in ids:
            raise ValueError(f"ID duplicado no funil: {oid}")
        ids.add(oid.casefold())
        etapa = str(oportunidade["etapa"]).strip()
        status = str(oportunidade["status"]).strip()
        if etapa not in ETAPAS:
            raise ValueError(f"Oportunidade {oid}: etapa inválida. Use uma destas: {', '.join(ETAPAS)}.")
        if status not in STATUS:
            raise ValueError(f"Oportunidade {oid}: status inválido. Use um destes: {', '.join(STATUS)}.")
        if etapa == "Perdido" and not str(oportunidade.get("motivo_perda", "")).strip():
            raise ValueError(f"Oportunidade {oid}: informe motivo_perda para uma oportunidade perdida.")

        potencial = _decimal(oportunidade["valor_potencial"], f"Oportunidade {oid}.valor_potencial")
        probabilidade = _decimal(oportunidade["probabilidade"], f"Oportunidade {oid}.probabilidade")
        if probabilidade > 1:
            raise ValueError(f"Oportunidade {oid}.probabilidade deve ficar entre 0 e 1 (ex.: 0,50).")
        ultima = _data(oportunidade.get("ultimo_contato"), f"Oportunidade {oid}.ultimo_contato")
        proxima_data = _data(oportunidade.get("data_proxima_acao"), f"Oportunidade {oid}.data_proxima_acao")
        fechamento = _data(oportunidade.get("previsao_fechamento"), f"Oportunidade {oid}.previsao_fechamento")

        if status == "Ativa" and not str(oportunidade.get("proxima_acao", "")).strip():
            pendencias.append(f"{oid}: próxima ação")
        if status == "Ativa" and proxima_data is None:
            pendencias.append(f"{oid}: data da próxima ação")
        if ultima is None:
            pendencias.append(f"{oid}: último contato")

        item = dict(oportunidade)
        item.update({
            "id": oid,
            "etapa": etapa,
            "status": status,
            "valor_potencial": potencial,
            "probabilidade": probabilidade,
            "valor_ponderado": potencial * probabilidade,
            "ultimo_contato": ultima,
            "data_proxima_acao": proxima_data,
            "previsao_fechamento": fechamento,
        })
        resultado.append(item)
    return resultado, pendencias


def _cabecalho(sheet, titulo: str, subtitulo: str, ultima_coluna: int) -> None:
    end = column_name(ultima_coluna)
    sheet.set_cell(1, 1, titulo, style="title")
    sheet.merge_cells(f"A1:{end}1")
    sheet.set_cell(2, 1, subtitulo, style="subtitle")
    sheet.merge_cells(f"A2:{end}2")


def gerar_funil(oportunidades: List[Dict[str, Any]], saida: Optional[str] = None) -> str:
    oportunidades, pendencias = _validar(oportunidades)
    hoje = date.today()
    total_potencial = sum((o["valor_potencial"] for o in oportunidades), Decimal("0"))
    total_ponderado = sum((o["valor_ponderado"] for o in oportunidades), Decimal("0"))
    ativas = sum(1 for o in oportunidades if o["status"] in {"Ativa", "Em espera"})
    vencidas = sum(
        1 for o in oportunidades
        if o["status"] == "Ativa" and o["data_proxima_acao"] is not None and o["data_proxima_acao"] < hoje
    )
    sem_proxima_acao = sum(
        1 for o in oportunidades
        if o["status"] == "Ativa" and (not str(o.get("proxima_acao", "")).strip() or o["data_proxima_acao"] is None)
    )

    workbook = Workbook()
    workbook.add_defined_name("EtapasLista", "Listas!$A$4:$A$10")
    workbook.add_defined_name("StatusLista", "Listas!$B$4:$B$7")
    workbook.add_defined_name("ProbabilidadesLista", "Listas!$C$4:$C$9")

    resumo = workbook.add_sheet("Resumo")
    _cabecalho(resumo, "FUNIL COMERCIAL", "ELO Soluções Logísticas Integradas • Visão executiva", 5)
    for column, width in enumerate([24, 18, 22, 22, 22], start=1):
        resumo.set_column_width(column, width)
    resumo.append_row([])
    resumo.append_row(["Indicador", "Valor", "Indicador", "Valor", "Data-base"], styles=["header"] * 5)
    resumo.append_row(["Oportunidades ativas", ativas, "Valor potencial", total_potencial, hoje], styles=["section", "integer", "section", "currency", "date"])
    resumo.append_row(["Ações vencidas", vencidas, "Valor ponderado", total_ponderado, hoje], styles=["section", "integer", "section", "currency", "date"])
    resumo.append_row(["Ativas sem próxima ação", sem_proxima_acao, "Pendências cadastrais", len(pendencias), hoje], styles=["section", "integer", "section", "integer", "date"])
    resumo.append_row([])
    etapa_header = resumo.append_row(["Etapa", "Quantidade", "Valor potencial", "Valor ponderado", "% do ponderado"], styles=["header"] * 5)
    totais_etapa: OrderedDict[str, Tuple[int, Decimal, Decimal]] = OrderedDict()
    for etapa in ETAPAS:
        filtradas = [o for o in oportunidades if o["etapa"] == etapa]
        valor = sum((o["valor_potencial"] for o in filtradas), Decimal("0"))
        ponderado = sum((o["valor_ponderado"] for o in filtradas), Decimal("0"))
        totais_etapa[etapa] = (len(filtradas), valor, ponderado)
        participacao = ponderado / total_ponderado if total_ponderado else Decimal("0")
        resumo.append_row([etapa, len(filtradas), valor, ponderado, participacao], styles=["text", "integer", "currency", "currency", "percent"])
    resumo.set_auto_filter(f"A{etapa_header}:E{resumo.max_row}")
    resumo.freeze_panes(rows=4)
    if pendencias:
        resumo.append_row([])
        resumo.append_row(["PENDÊNCIAS", "; ".join(pendencias)], styles=["warning", "warning"])
        resumo.merge_cells(f"B{resumo.max_row}:E{resumo.max_row}")

    base = workbook.add_sheet("Oportunidades")
    _cabecalho(base, "CARTEIRA DE OPORTUNIDADES", "Atualize próxima ação e previsão de fechamento em cada contato", 18)
    widths = [14, 28, 24, 28, 28, 17, 15, 22, 18, 15, 18, 16, 34, 18, 20, 18, 26, 38]
    for column, width in enumerate(widths, start=1):
        base.set_column_width(column, width)
    headers = [
        "ID", "Cliente", "Contato", "Serviço", "Origem / Destino", "Etapa", "Status", "Responsável",
        "Valor potencial", "Probabilidade", "Valor ponderado", "Último contato", "Próxima ação",
        "Data próxima ação", "Previsão fechamento", "Cotação ID", "Motivo da perda", "Observações",
    ]
    base.append_row([])
    header_row = base.append_row(headers, styles=["header"] * len(headers))
    first_data_row = header_row + 1
    for oportunidade in oportunidades:
        row = base.append_row([
            oportunidade["id"],
            oportunidade["cliente"],
            _texto(oportunidade.get("contato"), ""),
            oportunidade["servico"],
            _texto(oportunidade.get("rota"), ""),
            oportunidade["etapa"],
            oportunidade["status"],
            oportunidade["responsavel"],
            oportunidade["valor_potencial"],
            oportunidade["probabilidade"],
            None,
            oportunidade["ultimo_contato"],
            _texto(oportunidade.get("proxima_acao"), "[PREENCHER PRÓXIMA AÇÃO]" if oportunidade["status"] == "Ativa" else ""),
            oportunidade["data_proxima_acao"],
            oportunidade["previsao_fechamento"],
            _texto(oportunidade.get("cotacao_id"), ""),
            _texto(oportunidade.get("motivo_perda"), ""),
            _texto(oportunidade.get("observacoes"), ""),
        ], styles=[
            "text", "text", "text", "text", "text", "text", "text", "text", "currency", "percent",
            "currency", "date", "text", "date", "date", "text", "text", "text",
        ])
        base.set_cell(row, 11, style="currency", formula=f"I{row}*J{row}", cached_value=oportunidade["valor_ponderado"])
    last_data_row = base.max_row
    base.set_auto_filter(f"A{header_row}:R{last_data_row}")
    base.freeze_panes(rows=header_row, columns=2)
    base.add_list_validation(f"F{first_data_row}:F1000", "EtapasLista", allow_blank=False)
    base.add_list_validation(f"G{first_data_row}:G1000", "StatusLista", allow_blank=False)
    base.add_list_validation(f"J{first_data_row}:J1000", "ProbabilidadesLista", allow_blank=False, error_message="Use uma probabilidade permitida entre 0% e 100%.")

    listas = workbook.add_sheet("Listas")
    _cabecalho(listas, "LISTAS DE CONTROLE", "Edite com cautela: estas listas alimentam as validações do funil", 3)
    for column, width in enumerate([22, 20, 20], start=1):
        listas.set_column_width(column, width)
    listas.append_row([])
    listas.append_row(["Etapas", "Status", "Probabilidades"], styles=["header"] * 3)
    max_items = max(len(ETAPAS), len(STATUS), 6)
    probabilidades = [Decimal("0"), Decimal("0.10"), Decimal("0.25"), Decimal("0.50"), Decimal("0.75"), Decimal("1")]
    for index in range(max_items):
        listas.append_row([
            ETAPAS[index] if index < len(ETAPAS) else None,
            STATUS[index] if index < len(STATUS) else None,
            probabilidades[index] if index < len(probabilidades) else None,
        ], styles=["text", "text", "percent"])
    listas.freeze_panes(rows=4)

    if saida is None:
        saida = str(Path(__file__).parent / "output" / f"funil_comercial_elo_{hoje.isoformat()}.xlsx")
    caminho = workbook.save(saida)
    validate_xlsx(caminho)
    return caminho


if __name__ == "__main__":
    exemplo = [
        {
            "id": "OPP-001",
            "cliente": "[CLIENTE EXEMPLO A]",
            "contato": "[PREENCHER CONTATO]",
            "servico": "Armazenagem e distribuição",
            "rota": "Itajaí/SC → [PREENCHER DESTINO]",
            "etapa": "Diagnóstico",
            "status": "Ativa",
            "responsavel": "Equipe Comercial ELO",
            "valor_potencial": 48000,
            "probabilidade": 0.25,
            "ultimo_contato": "10/10/2026",
            "proxima_acao": "Validar volume médio e pico",
            "data_proxima_acao": "15/10/2026",
            "previsao_fechamento": "30/10/2026",
            "cotacao_id": "",
            "observacoes": "Dados demonstrativos; substituir antes do uso real.",
        },
        {
            "id": "OPP-002",
            "cliente": "[CLIENTE EXEMPLO B]",
            "contato": "[PREENCHER CONTATO]",
            "servico": "Transporte rodoviário",
            "rota": "Navegantes/SC → Curitiba/PR",
            "etapa": "Cotação",
            "status": "Ativa",
            "responsavel": "Equipe Comercial ELO",
            "valor_potencial": 32000,
            "probabilidade": 0.50,
            "ultimo_contato": "09/10/2026",
            "proxima_acao": "Apresentar composição de preço",
            "data_proxima_acao": "14/10/2026",
            "previsao_fechamento": "25/10/2026",
            "cotacao_id": "COT-EXEMPLO-001",
            "observacoes": "Dados demonstrativos; substituir antes do uso real.",
        },
    ]
    arquivo = gerar_funil(exemplo)
    relatorio = validate_xlsx(arquivo)
    print(f"Funil gerado: {arquivo}")
    print(f"Validação: {relatorio}")
