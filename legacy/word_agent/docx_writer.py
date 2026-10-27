"""
docx_writer — Gerador de arquivos Word (.docx) em Python puro.

Um arquivo .docx é um pacote ZIP contendo XMLs no padrão Office Open XML (OOXML).
Este módulo monta esse pacote sem depender de bibliotecas externas (python-docx),
o que o torna 100% offline e sem dependências.

Uso: construa um Document, adicione parágrafos/títulos/tabelas e salve.
"""
from __future__ import annotations

import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from html import escape
from typing import List, Optional, Tuple


# ---------------------------------------------------------------------------
# Helpers de XML
# ---------------------------------------------------------------------------

def _rgb(color: str) -> str:
    """Normaliza cor hex (aceita '#RRGGBB' ou 'RRGGBB')."""
    return color.lstrip("#").upper()


def _run_xml(
    text: str,
    *,
    bold: bool = False,
    italic: bool = False,
    size: Optional[int] = None,      # em pontos
    color: Optional[str] = None,     # hex 'RRGGBB'
    font: Optional[str] = None,
) -> str:
    rpr_parts: List[str] = []
    if font:
        rpr_parts.append(
            f'<w:rFonts w:ascii="{escape(font)}" w:hAnsi="{escape(font)}"/>'
        )
    if bold:
        rpr_parts.append("<w:b/>")
    if italic:
        rpr_parts.append("<w:i/>")
    if color:
        rpr_parts.append(f'<w:color w:val="{_rgb(color)}"/>')
    if size:
        # OOXML usa meio-pontos
        rpr_parts.append(f'<w:sz w:val="{size * 2}"/>')
        rpr_parts.append(f'<w:szCs w:val="{size * 2}"/>')
    rpr = f"<w:rPr>{''.join(rpr_parts)}</w:rPr>" if rpr_parts else ""
    # xml:space="preserve" mantém espaços à esquerda/direita
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


# ---------------------------------------------------------------------------
# Modelo de documento
# ---------------------------------------------------------------------------

@dataclass
class Document:
    body: List[str] = field(default_factory=list)
    default_font: str = "Calibri"
    brand_color: str = "1F3864"  # azul corporativo escuro

    # ---- Parágrafos e títulos ------------------------------------------
    def add_paragraph(
        self,
        text: str = "",
        *,
        bold: bool = False,
        italic: bool = False,
        size: Optional[int] = None,
        color: Optional[str] = None,
        align: Optional[str] = None,   # 'left' | 'center' | 'right' | 'both'
        space_after: int = 160,        # em twips (1/20 pt)
    ) -> None:
        ppr_parts: List[str] = []
        if align:
            ppr_parts.append(f'<w:jc w:val="{align}"/>')
        ppr_parts.append(f'<w:spacing w:after="{space_after}"/>')
        ppr = f"<w:pPr>{''.join(ppr_parts)}</w:pPr>"
        run = _run_xml(
            text, bold=bold, italic=italic, size=size,
            color=color, font=self.default_font,
        ) if text else ""
        self.body.append(f"<w:p>{ppr}{run}</w:p>")

    def add_heading(self, text: str, *, level: int = 1) -> None:
        sizes = {1: 20, 2: 15, 3: 13}
        size = sizes.get(level, 12)
        self.add_paragraph(
            text, bold=True, size=size, color=self.brand_color,
            space_after=120,
        )

    def add_hrule(self) -> None:
        """Linha horizontal (borda inferior em parágrafo vazio)."""
        ppr = (
            "<w:pPr><w:pBdr>"
            f'<w:bottom w:val="single" w:sz="12" w:space="1" w:color="{self.brand_color}"/>'
            "</w:pBdr></w:pPr>"
        )
        self.body.append(f"<w:p>{ppr}</w:p>")

    # ---- Tabelas --------------------------------------------------------
    def add_table(
        self,
        headers: List[str],
        rows: List[List[str]],
        *,
        col_widths: Optional[List[int]] = None,  # em twips
    ) -> None:
        total = 9000
        n = len(headers)
        widths = col_widths or [total // n] * n

        grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)

        def cell(text: str, w: int, *, header: bool = False) -> str:
            shd = (
                f'<w:shd w:val="clear" w:color="auto" w:fill="{self.brand_color}"/>'
                if header else ""
            )
            tc_pr = (
                f'<w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{shd}</w:tcPr>'
            )
            run = _run_xml(
                text, bold=header,
                color="FFFFFF" if header else None,
                font=self.default_font, size=10,
            )
            return f'<w:tc>{tc_pr}<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>{run}</w:p></w:tc>'

        tbl_pr = (
            "<w:tblPr>"
            '<w:tblStyle w:val="TableGrid"/>'
            '<w:tblW w:w="9000" w:type="dxa"/>'
            "<w:tblBorders>"
            '<w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
            '<w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
            '<w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
            '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
            '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
            "</w:tblBorders>"
            "</w:tblPr>"
        )

        header_row = "<w:tr>" + "".join(
            cell(h, widths[i], header=True) for i, h in enumerate(headers)
        ) + "</w:tr>"

        body_rows = ""
        for row in rows:
            body_rows += "<w:tr>" + "".join(
                cell(str(c), widths[i]) for i, c in enumerate(row)
            ) + "</w:tr>"

        self.body.append(
            f'<w:tbl>{tbl_pr}<w:tblGrid>{grid}</w:tblGrid>{header_row}{body_rows}</w:tbl>'
        )
        self.add_paragraph("", space_after=120)

    def add_page_break(self) -> None:
        self.body.append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')

    # ---- Geração do arquivo --------------------------------------------
    def _document_xml(self) -> str:
        body = "".join(self.body)
        sect = (
            "<w:sectPr>"
            '<w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" '
            'w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>'
            "</w:sectPr>"
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document '
            'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f"<w:body>{body}{sect}</w:body></w:document>"
        )

    def save(self, path: str) -> str:
        if not path.endswith(".docx"):
            path += ".docx"

        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>'
        )
        rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="word/document.xml"/>'
            '</Relationships>'
        )

        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("[Content_Types].xml", content_types)
            z.writestr("_rels/.rels", rels)
            z.writestr("word/document.xml", self._document_xml())
        return path
