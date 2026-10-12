"""Motor PDF offline em Python puro, sem dependências externas."""
from __future__ import annotations

import re
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _pdf_string(text: str) -> bytes:
    raw = text.encode("cp1252", errors="replace")
    result = bytearray()
    for byte in raw:
        if byte in (40, 41, 92):
            result.extend(b"\\" + bytes([byte]))
        elif 32 <= byte <= 126:
            result.append(byte)
        else:
            result.extend(f"\\{byte:03o}".encode("ascii"))
    return bytes(result)


@dataclass
class PDFPage:
    operations: List[Tuple[str, float, float, float, str]] = field(default_factory=list)

    def add_text(self, text: str, x: float, y: float, size: float, font: str = "F1") -> None:
        self.operations.append((font, size, x, y, text))

    def content(self) -> bytes:
        chunks = []
        for font, size, x, y, text in self.operations:
            chunks.append(
                f"BT /{font} {size:.1f} Tf {x:.1f} {y:.1f} Td (".encode("ascii")
                + _pdf_string(text)
                + b") Tj ET\n"
            )
        return b"".join(chunks)


@dataclass
class PDFDocument:
    title: str
    author: str = "ELO Soluções Logísticas Integradas"
    pages: List[PDFPage] = field(default_factory=list)
    width: float = 595.0
    height: float = 842.0
    margin: float = 50.0
    _y: float = 0.0

    def __post_init__(self) -> None:
        self._new_page()

    @property
    def page(self) -> PDFPage:
        return self.pages[-1]

    def _new_page(self) -> None:
        self.pages.append(PDFPage())
        self._y = self.height - self.margin
        self.page.add_text("ELO Soluções Logísticas Integradas", self.margin, self._y, 9, "F2")
        self.page.add_text("https://eloarmazenagem.com.br", 365, self._y, 8, "F1")
        self._y -= 28

    def _ensure(self, height: float) -> None:
        if self._y - height < self.margin + 25:
            self._footer()
            self._new_page()

    def _footer(self) -> None:
        page_no = len(self.pages)
        self.page.add_text(f"Página {page_no}", 275, 25, 8, "F1")

    def add_title(self, text: str) -> None:
        self._ensure(50)
        self.page.add_text(text, self.margin, self._y, 22, "F2")
        self._y -= 38

    def add_heading(self, text: str) -> None:
        self._ensure(34)
        self._y -= 8
        self.page.add_text(text, self.margin, self._y, 14, "F2")
        self._y -= 25

    def add_paragraph(self, text: str, *, bold: bool = False, width: int = 92) -> None:
        lines = textwrap.wrap(str(text), width=width, break_long_words=False, replace_whitespace=False) or [""]
        for line in lines:
            self._ensure(16)
            self.page.add_text(line, self.margin, self._y, 10, "F2" if bold else "F1")
            self._y -= 15
        self._y -= 5

    def add_bullets(self, items: List[str]) -> None:
        for item in items:
            lines = textwrap.wrap(str(item), width=86, break_long_words=False) or [""]
            for index, line in enumerate(lines):
                self._ensure(16)
                prefix = "• " if index == 0 else "  "
                self.page.add_text(prefix + line, self.margin + 8, self._y, 10, "F1")
                self._y -= 15
            self._y -= 2

    def add_key_value(self, label: str, value: str) -> None:
        self._ensure(18)
        self.page.add_text(f"{label}:", self.margin, self._y, 10, "F2")
        self.page.add_text(str(value), self.margin + 125, self._y, 10, "F1")
        self._y -= 17

    def add_table(self, headers: List[str], rows: List[List[str]], widths: List[int] | None = None) -> None:
        self._ensure(35)
        widths = widths or [24] * len(headers)
        header = " | ".join(str(value)[:widths[i]] for i, value in enumerate(headers))
        self.add_paragraph(header, bold=True, width=110)
        self.add_paragraph("-" * min(108, len(header)), width=110)
        for row in rows:
            text = " | ".join(str(value)[:widths[i]] for i, value in enumerate(row))
            self.add_paragraph(text, width=110)

    def save(self, path: str | Path) -> str:
        self._footer()
        output = Path(path)
        if output.suffix.lower() != ".pdf":
            output = output.with_suffix(".pdf")
        output.parent.mkdir(parents=True, exist_ok=True)

        page_count = len(self.pages)
        font_regular = 3 + page_count * 2
        font_bold = font_regular + 1
        objects: Dict[int, bytes] = {}
        objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
        kids = " ".join(f"{3 + index * 2} 0 R" for index in range(page_count))
        objects[2] = f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode("ascii")

        for index, page in enumerate(self.pages):
            page_id = 3 + index * 2
            content_id = page_id + 1
            stream = page.content()
            objects[page_id] = (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {self.width:.0f} {self.height:.0f}] "
                f"/Resources << /Font << /F1 {font_regular} 0 R /F2 {font_bold} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            ).encode("ascii")
            objects[content_id] = f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"endstream"

        objects[font_regular] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
        objects[font_bold] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"

        data = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for object_id in range(1, font_bold + 1):
            offsets.append(len(data))
            data.extend(f"{object_id} 0 obj\n".encode("ascii"))
            data.extend(objects[object_id])
            data.extend(b"\nendobj\n")
        xref = len(data)
        data.extend(f"xref\n0 {font_bold + 1}\n".encode("ascii"))
        data.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            data.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
        data.extend(
            f"trailer\n<< /Size {font_bold + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii")
        )
        output.write_bytes(data)
        return str(output)


def validate_pdf(path: str | Path) -> Dict[str, Any]:
    target = Path(path)
    data = target.read_bytes()
    if not data.startswith(b"%PDF-") or not data.rstrip().endswith(b"%%EOF"):
        raise ValueError("Assinatura ou finalização PDF inválida.")
    if b"xref" not in data or b"startxref" not in data or b"/Type /Catalog" not in data:
        raise ValueError("Estrutura PDF obrigatória ausente.")
    start_match = re.search(rb"startxref\s+(\d+)\s+%%EOF", data)
    if not start_match:
        raise ValueError("Ponteiro startxref ausente ou inválido.")
    xref_offset = int(start_match.group(1))
    if data[xref_offset:xref_offset + 4] != b"xref":
        raise ValueError("startxref não aponta para a tabela xref.")
    xref_block = data[xref_offset:start_match.start()]
    entries = re.findall(rb"^(\d{10}) 00000 n", xref_block, flags=re.MULTILINE)
    for object_id, offset_raw in enumerate(entries, start=1):
        offset = int(offset_raw)
        if not data[offset:].startswith(f"{object_id} 0 obj".encode("ascii")):
            raise ValueError(f"Entrada xref inválida para o objeto {object_id}.")
    pages = len(re.findall(rb"/Type\s*/Page(?!s)", data))
    if pages < 1:
        raise ValueError("PDF sem páginas.")
    return {"arquivo": str(target.resolve()), "paginas": pages, "objetos_xref": len(entries), "estrutura_valida": True, "tamanho_bytes": len(data)}
