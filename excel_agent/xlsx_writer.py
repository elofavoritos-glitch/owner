"""Motor OOXML offline para arquivos Microsoft Excel (.xlsx).

Gera workbooks reais sem openpyxl/xlsxwriter. O módulo usa somente a biblioteca
padrão do Python e oferece células tipadas, fórmulas com valor em cache, estilos,
filtros, painéis congelados, larguras, mesclagens e validações por lista.
"""
from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from html import escape
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from xml.etree import ElementTree


STYLE_IDS = {
    "default": 0,
    "title": 1,
    "subtitle": 2,
    "header": 3,
    "currency": 4,
    "decimal": 5,
    "integer": 6,
    "percent": 7,
    "date": 8,
    "total_label": 9,
    "total_currency": 10,
    "section": 11,
    "warning": 12,
    "text": 13,
}

INVALID_SHEET_CHARS = re.compile(r"[\\/*?:\[\]]")


def column_name(column: int) -> str:
    if column < 1:
        raise ValueError("A coluna deve ser maior ou igual a 1.")
    result = ""
    while column:
        column, remainder = divmod(column - 1, 26)
        result = chr(65 + remainder) + result
    return result


def cell_reference(row: int, column: int) -> str:
    if row < 1:
        raise ValueError("A linha deve ser maior ou igual a 1.")
    return f"{column_name(column)}{row}"


def excel_serial(value: Union[date, datetime]) -> float:
    """Converte data para o serial usado pelo Excel (sistema 1900)."""
    if isinstance(value, datetime):
        delta = value - datetime(1899, 12, 30)
        return delta.days + (delta.seconds + delta.microseconds / 1_000_000) / 86400
    return float((value - date(1899, 12, 30)).days)


def _number_text(value: Union[int, float, Decimal]) -> str:
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, int):
        return str(value)
    return format(value, ".15g")


def _style_id(style: Union[str, int]) -> int:
    if isinstance(style, int):
        if style < 0:
            raise ValueError("O identificador de estilo não pode ser negativo.")
        return style
    try:
        return STYLE_IDS[style]
    except KeyError as exc:
        raise ValueError(f"Estilo desconhecido: {style}") from exc


@dataclass
class Cell:
    value: Any = None
    style: int = 0
    formula: Optional[str] = None
    cached_value: Optional[Union[int, float, Decimal]] = None


@dataclass
class DataValidation:
    cell_range: str
    formula1: str
    allow_blank: bool = True
    error_title: str = "Valor inválido"
    error_message: str = "Selecione um valor permitido na lista."


@dataclass
class Worksheet:
    name: str
    hidden: bool = False
    cells: Dict[Tuple[int, int], Cell] = field(default_factory=dict)
    column_widths: Dict[int, float] = field(default_factory=dict)
    merged_ranges: List[str] = field(default_factory=list)
    validations: List[DataValidation] = field(default_factory=list)
    freeze: Tuple[int, int] = (0, 0)
    auto_filter: Optional[str] = None

    def set_cell(
        self,
        row: int,
        column: int,
        value: Any = None,
        *,
        style: Union[str, int] = "default",
        formula: Optional[str] = None,
        cached_value: Optional[Union[int, float, Decimal]] = None,
    ) -> None:
        if row < 1 or column < 1:
            raise ValueError("Linha e coluna devem ser maiores ou iguais a 1.")
        sid = _style_id(style)
        if isinstance(value, (date, datetime)) and sid == 0:
            sid = STYLE_IDS["date"]
        self.cells[(row, column)] = Cell(value, sid, formula, cached_value)

    def append_row(
        self,
        values: List[Any],
        *,
        styles: Optional[List[Union[str, int]]] = None,
    ) -> int:
        row = self.max_row + 1
        for index, value in enumerate(values, start=1):
            style = styles[index - 1] if styles and index <= len(styles) else "default"
            self.set_cell(row, index, value, style=style)
        return row

    @property
    def max_row(self) -> int:
        return max((row for row, _ in self.cells), default=0)

    @property
    def max_column(self) -> int:
        return max((column for _, column in self.cells), default=0)

    def set_column_width(self, column: int, width: float) -> None:
        if column < 1 or width <= 0:
            raise ValueError("Coluna e largura devem ser positivas.")
        self.column_widths[column] = width

    def freeze_panes(self, *, rows: int = 0, columns: int = 0) -> None:
        if rows < 0 or columns < 0:
            raise ValueError("O congelamento não aceita valores negativos.")
        self.freeze = (rows, columns)

    def merge_cells(self, cell_range: str) -> None:
        self.merged_ranges.append(cell_range)

    def set_auto_filter(self, cell_range: str) -> None:
        self.auto_filter = cell_range

    def add_list_validation(
        self,
        cell_range: str,
        formula1: str,
        *,
        allow_blank: bool = True,
        error_title: str = "Valor inválido",
        error_message: str = "Selecione um valor permitido na lista.",
    ) -> None:
        self.validations.append(
            DataValidation(cell_range, formula1, allow_blank, error_title, error_message)
        )

    def _cell_xml(self, row: int, column: int, cell: Cell) -> str:
        ref = cell_reference(row, column)
        style = f' s="{cell.style}"' if cell.style else ""

        if cell.formula:
            formula = cell.formula[1:] if cell.formula.startswith("=") else cell.formula
            cached = cell.cached_value if cell.cached_value is not None else 0
            return (
                f'<c r="{ref}"{style}><f>{escape(formula)}</f>'
                f'<v>{_number_text(cached)}</v></c>'
            )

        value = cell.value
        if value is None:
            return f'<c r="{ref}"{style}/>'
        if isinstance(value, bool):
            return f'<c r="{ref}"{style} t="b"><v>{1 if value else 0}</v></c>'
        if isinstance(value, (date, datetime)):
            return f'<c r="{ref}"{style}><v>{_number_text(excel_serial(value))}</v></c>'
        if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
            return f'<c r="{ref}"{style}><v>{_number_text(value)}</v></c>'

        text = str(value)
        preserve = ' xml:space="preserve"' if text[:1].isspace() or text[-1:].isspace() else ""
        return (
            f'<c r="{ref}"{style} t="inlineStr"><is>'
            f'<t{preserve}>{escape(text)}</t></is></c>'
        )

    def to_xml(self) -> str:
        max_row = max(self.max_row, 1)
        max_column = max(self.max_column, 1)
        dimension = f"A1:{cell_reference(max_row, max_column)}"

        rows_xml: List[str] = []
        by_row: Dict[int, List[Tuple[int, Cell]]] = {}
        for (row, column), cell in self.cells.items():
            by_row.setdefault(row, []).append((column, cell))
        for row in sorted(by_row):
            cells = "".join(
                self._cell_xml(row, column, cell)
                for column, cell in sorted(by_row[row], key=lambda item: item[0])
            )
            rows_xml.append(f'<row r="{row}">{cells}</row>')

        rows_frozen, columns_frozen = self.freeze
        if rows_frozen or columns_frozen:
            top_left = cell_reference(rows_frozen + 1, columns_frozen + 1)
            pane_attrs = []
            if columns_frozen:
                pane_attrs.append(f'xSplit="{columns_frozen}"')
            if rows_frozen:
                pane_attrs.append(f'ySplit="{rows_frozen}"')
            pane_attrs.extend(
                [f'topLeftCell="{top_left}"', 'activePane="bottomRight"', 'state="frozen"']
            )
            sheet_views = (
                '<sheetViews><sheetView workbookViewId="0">'
                f'<pane {" ".join(pane_attrs)}/>'
                '</sheetView></sheetViews>'
            )
        else:
            sheet_views = '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'

        cols = ""
        if self.column_widths:
            cols = "<cols>" + "".join(
                f'<col min="{column}" max="{column}" width="{width}" customWidth="1"/>'
                for column, width in sorted(self.column_widths.items())
            ) + "</cols>"

        merges = ""
        if self.merged_ranges:
            merges = (
                f'<mergeCells count="{len(self.merged_ranges)}">'
                + "".join(f'<mergeCell ref="{escape(ref)}"/>' for ref in self.merged_ranges)
                + "</mergeCells>"
            )

        auto_filter = f'<autoFilter ref="{escape(self.auto_filter)}"/>' if self.auto_filter else ""

        validations = ""
        if self.validations:
            entries = []
            for item in self.validations:
                entries.append(
                    '<dataValidation type="list" '
                    f'allowBlank="{1 if item.allow_blank else 0}" showErrorMessage="1" '
                    f'errorTitle="{escape(item.error_title, quote=True)}" '
                    f'error="{escape(item.error_message, quote=True)}" '
                    f'sqref="{escape(item.cell_range, quote=True)}">'
                    f'<formula1>{escape(item.formula1)}</formula1></dataValidation>'
                )
            validations = f'<dataValidations count="{len(entries)}">{"".join(entries)}</dataValidations>'

        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<dimension ref="{dimension}"/>{sheet_views}'
            '<sheetFormatPr defaultRowHeight="15"/>'
            f'{cols}<sheetData>{"".join(rows_xml)}</sheetData>'
            f'{merges}{auto_filter}{validations}'
            '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'
            '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
            '</worksheet>'
        )


@dataclass
class Workbook:
    creator: str = "ELO Soluções Logísticas Integradas"
    sheets: List[Worksheet] = field(default_factory=list)
    defined_names: Dict[str, str] = field(default_factory=dict)

    def add_defined_name(self, name: str, reference: str) -> None:
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.]*", name):
            raise ValueError(f"Nome definido inválido: {name!r}")
        if name.casefold() in {existing.casefold() for existing in self.defined_names}:
            raise ValueError(f"Nome definido duplicado: {name}")
        self.defined_names[name] = reference

    def add_sheet(self, name: str, *, hidden: bool = False) -> Worksheet:
        cleaned = name.strip()
        if not cleaned or len(cleaned) > 31 or INVALID_SHEET_CHARS.search(cleaned):
            raise ValueError(f"Nome de aba inválido: {name!r}")
        if any(sheet.name.casefold() == cleaned.casefold() for sheet in self.sheets):
            raise ValueError(f"Nome de aba duplicado: {cleaned}")
        sheet = Worksheet(cleaned, hidden=hidden)
        self.sheets.append(sheet)
        return sheet

    def _workbook_xml(self) -> str:
        sheets_xml = []
        for index, sheet in enumerate(self.sheets, start=1):
            state = ' state="hidden"' if sheet.hidden else ""
            sheets_xml.append(
                f'<sheet name="{escape(sheet.name, quote=True)}" sheetId="{index}" '
                f'r:id="rId{index}"{state}/>'
            )
        defined_names_xml = ""
        if self.defined_names:
            defined_names_xml = "<definedNames>" + "".join(
                f'<definedName name="{escape(name, quote=True)}">{escape(reference)}</definedName>'
                for name, reference in self.defined_names.items()
            ) + "</definedNames>"
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<bookViews><workbookView activeTab="0"/></bookViews>'
            f'<sheets>{"".join(sheets_xml)}</sheets>'
            f'{defined_names_xml}'
            '<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>'
            '</workbook>'
        )

    def _workbook_rels_xml(self) -> str:
        rels = []
        for index in range(1, len(self.sheets) + 1):
            rels.append(
                f'<Relationship Id="rId{index}" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
                f'Target="worksheets/sheet{index}.xml"/>'
            )
        styles_id = len(self.sheets) + 1
        rels.append(
            f'<Relationship Id="rId{styles_id}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
            'Target="styles.xml"/>'
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f'{"".join(rels)}</Relationships>'
        )

    def _content_types_xml(self) -> str:
        worksheets = "".join(
            f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            for index in range(1, len(self.sheets) + 1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/styles.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            f'{worksheets}</Types>'
        )

    def save(self, path: Union[str, Path]) -> str:
        if not self.sheets:
            raise ValueError("O workbook precisa ter pelo menos uma aba.")
        output = Path(path)
        if output.suffix.lower() != ".xlsx":
            output = output.with_suffix(".xlsx")
        output.parent.mkdir(parents=True, exist_ok=True)

        root_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="xl/workbook.xml"/>'
            '</Relationships>'
        )

        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", self._content_types_xml())
            archive.writestr("_rels/.rels", root_rels)
            archive.writestr("xl/workbook.xml", self._workbook_xml())
            archive.writestr("xl/_rels/workbook.xml.rels", self._workbook_rels_xml())
            archive.writestr("xl/styles.xml", _styles_xml())
            for index, sheet in enumerate(self.sheets, start=1):
                archive.writestr(f"xl/worksheets/sheet{index}.xml", sheet.to_xml())
        return str(output)


def _styles_xml() -> str:
    """Catálogo fixo de estilos usado pelos geradores comerciais."""
    xfs = [
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>',
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>',
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
        '<xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
        '<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
        '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
        '<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
        '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>',
        '<xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>',
        '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    ]
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<numFmts count="3">'
        '<numFmt numFmtId="164" formatCode="R$ #,##0.00;[Red]-R$ #,##0.00"/>'
        '<numFmt numFmtId="165" formatCode="0.00%"/>'
        '<numFmt numFmtId="166" formatCode="dd/mm/yyyy"/>'
        '</numFmts>'
        '<fonts count="4">'
        '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'
        '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><color rgb="FF1F3864"/><sz val="18"/><name val="Calibri"/></font>'
        '<font><b/><color rgb="FF1F3864"/><sz val="11"/><name val="Calibri"/></font>'
        '</fonts>'
        '<fills count="5">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>'
        '</fills>'
        '<borders count="2">'
        '<border><left/><right/><top/><bottom/><diagonal/></border>'
        '<border><left style="thin"><color rgb="FFD9E1F2"/></left>'
        '<right style="thin"><color rgb="FFD9E1F2"/></right>'
        '<top style="thin"><color rgb="FFD9E1F2"/></top>'
        '<bottom style="thin"><color rgb="FFD9E1F2"/></bottom><diagonal/></border>'
        '</borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        f'<cellXfs count="{len(xfs)}">{"".join(xfs)}</cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>'
    )


def validate_xlsx(path: Union[str, Path]) -> Dict[str, Any]:
    """Valida integridade ZIP, partes obrigatórias e todos os XMLs do XLSX."""
    target = Path(path)
    if target.suffix.lower() != ".xlsx":
        raise ValueError("O arquivo precisa usar a extensão .xlsx.")
    if not target.is_file():
        raise FileNotFoundError(target)

    required = {
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/_rels/workbook.xml.rels",
        "xl/styles.xml",
    }
    with zipfile.ZipFile(target) as archive:
        corrupt = archive.testzip()
        if corrupt:
            raise ValueError(f"Entrada ZIP corrompida: {corrupt}")
        names = set(archive.namelist())
        missing = sorted(required - names)
        if missing:
            raise ValueError(f"Partes obrigatórias ausentes: {', '.join(missing)}")

        xml_parts = [name for name in names if name.endswith(".xml") or name.endswith(".rels")]
        for name in xml_parts:
            ElementTree.fromstring(archive.read(name))

        ns = {
            "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
            "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        }
        workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        sheets = workbook.findall("main:sheets/main:sheet", ns)
        if not sheets:
            raise ValueError("O workbook não contém abas.")

        sheet_names = [sheet.attrib["name"] for sheet in sheets]
        if len({name.casefold() for name in sheet_names}) != len(sheet_names):
            raise ValueError("O workbook contém nomes de abas duplicados.")
        for name in sheet_names:
            if not name or len(name) > 31 or INVALID_SHEET_CHARS.search(name):
                raise ValueError(f"Nome de aba inválido no workbook: {name!r}")

        worksheet_parts = sorted(name for name in names if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"))
        if len(worksheet_parts) != len(sheets):
            raise ValueError("A quantidade de abas não corresponde aos XMLs de planilha.")

    return {
        "arquivo": str(target.resolve()),
        "zip_integro": True,
        "xmls_validos": len(xml_parts),
        "abas": sheet_names,
        "tamanho_bytes": target.stat().st_size,
    }
