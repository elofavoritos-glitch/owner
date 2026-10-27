"""Motor OOXML offline para apresentações Microsoft PowerPoint (.pptx)."""
from __future__ import annotations

import posixpath
import zipfile
from dataclasses import dataclass, field
from html import escape
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence
from xml.etree import ElementTree


EMU_PER_INCH = 914400
SLIDE_WIDTH = 12192000
SLIDE_HEIGHT = 6858000


def _p(text: str, *, size: int = 22, color: str = "263238", bold: bool = False, bullet: bool = False) -> str:
    ppr = '<a:pPr lvl="0" marL="342900" indent="-228600"><a:buChar char="•"/></a:pPr>' if bullet else "<a:pPr/>"
    preserve = ' xml:space="preserve"' if text[:1].isspace() or text[-1:].isspace() else ""
    return (
        f'<a:p>{ppr}<a:r><a:rPr lang="pt-BR" sz="{size * 100}" b="{1 if bold else 0}">'
        f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill></a:rPr>'
        f'<a:t{preserve}>{escape(text)}</a:t></a:r>'
        f'<a:endParaRPr lang="pt-BR" sz="{size * 100}"/></a:p>'
    )


def _shape(
    shape_id: int,
    name: str,
    x: int,
    y: int,
    cx: int,
    cy: int,
    paragraphs: Sequence[str],
    *,
    fill: Optional[str] = None,
    margin: int = 160000,
) -> str:
    if fill:
        fill_xml = f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>'
    else:
        fill_xml = "<a:noFill/>"
    return (
        '<p:sp><p:nvSpPr>'
        f'<p:cNvPr id="{shape_id}" name="{escape(name, quote=True)}"/>'
        '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
        '<p:spPr><a:xfrm>'
        f'<a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/>'
        '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        f'{fill_xml}<a:ln><a:noFill/></a:ln></p:spPr>'
        f'<p:txBody><a:bodyPr wrap="square" lIns="{margin}" tIns="{margin}" rIns="{margin}" bIns="{margin}" anchor="top"/>'
        f'<a:lstStyle/>{"".join(paragraphs) if paragraphs else "<a:p/>"}</p:txBody></p:sp>'
    )


def _group_properties() -> str:
    return (
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
        '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
    )


@dataclass
class Slide:
    title: str
    bullets: List[str] = field(default_factory=list)
    subtitle: str = ""
    cover: bool = False

    def to_xml(self, number: int) -> str:
        shapes: List[str] = []
        if self.cover:
            shapes.append(_shape(2, "Fundo", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, [], fill="1F3864", margin=0))
            shapes.append(_shape(3, "Título", 900000, 1750000, 10400000, 1500000, [_p(self.title, size=32, color="FFFFFF", bold=True)]))
            if self.subtitle:
                shapes.append(_shape(4, "Subtítulo", 920000, 3300000, 9500000, 850000, [_p(self.subtitle, size=18, color="D9EAF7")]))
            shapes.append(_shape(5, "Rodapé", 920000, 5900000, 9800000, 400000, [_p("ELO Soluções Logísticas Integradas • Itajaí/SC", size=11, color="FFFFFF")]))
        else:
            shapes.append(_shape(2, "Faixa", 0, 0, SLIDE_WIDTH, 1050000, [], fill="1F3864", margin=0))
            shapes.append(_shape(3, "Título", 650000, 160000, 10900000, 700000, [_p(self.title, size=25, color="FFFFFF", bold=True)]))
            if self.subtitle:
                shapes.append(_shape(4, "Subtítulo", 750000, 1200000, 10600000, 550000, [_p(self.subtitle, size=14, color="52606D")]))
                content_y = 1900000
            else:
                content_y = 1350000
            paragraphs = [_p(item, size=20, color="263238", bullet=True) for item in self.bullets]
            shapes.append(_shape(5, "Conteúdo", 850000, content_y, 10400000, 4100000, paragraphs, fill="F7F9FC", margin=220000))
            shapes.append(_shape(6, "Rodapé", 650000, 6320000, 10900000, 280000, [_p(f"ELO Soluções Logísticas Integradas  |  {number}", size=9, color="607D8B")]))
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F7F9FC"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
            f'<p:spTree>{_group_properties()}{"".join(shapes)}</p:spTree></p:cSld>'
            '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
        )


@dataclass
class Presentation:
    slides: List[Slide] = field(default_factory=list)

    def add_slide(self, title: str, bullets: Optional[List[str]] = None, *, subtitle: str = "", cover: bool = False) -> None:
        if not title.strip():
            raise ValueError("Todo slide precisa de título.")
        self.slides.append(Slide(title.strip(), bullets or [], subtitle.strip(), cover))

    def save(self, path: str | Path) -> str:
        if not self.slides:
            raise ValueError("A apresentação precisa ter ao menos um slide.")
        output = Path(path)
        if output.suffix.lower() != ".pptx":
            output = output.with_suffix(".pptx")
        output.parent.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", self._content_types())
            archive.writestr("_rels/.rels", _root_rels())
            archive.writestr("ppt/presentation.xml", self._presentation_xml())
            archive.writestr("ppt/_rels/presentation.xml.rels", self._presentation_rels())
            archive.writestr("ppt/slideMasters/slideMaster1.xml", _slide_master())
            archive.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", _master_rels())
            archive.writestr("ppt/slideLayouts/slideLayout1.xml", _slide_layout())
            archive.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", _layout_rels())
            archive.writestr("ppt/theme/theme1.xml", _theme())
            for index, slide in enumerate(self.slides, start=1):
                archive.writestr(f"ppt/slides/slide{index}.xml", slide.to_xml(index))
                archive.writestr(f"ppt/slides/_rels/slide{index}.xml.rels", _slide_rels())
        return str(output)

    def _presentation_xml(self) -> str:
        ids = "".join(
            f'<p:sldId id="{255 + index}" r:id="rId{index + 1}"/>'
            for index in range(1, len(self.slides) + 1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
            f'<p:sldIdLst>{ids}</p:sldIdLst>'
            f'<p:sldSz cx="{SLIDE_WIDTH}" cy="{SLIDE_HEIGHT}" type="screen16x9"/>'
            '<p:notesSz cx="6858000" cy="9144000"/>'
            '</p:presentation>'
        )

    def _presentation_rels(self) -> str:
        rels = [
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
        ]
        for index in range(1, len(self.slides) + 1):
            rels.append(
                f'<Relationship Id="rId{index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{index}.xml"/>'
            )
        return _relationships(rels)

    def _content_types(self) -> str:
        slides = "".join(
            f'<Override PartName="/ppt/slides/slide{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
            for index in range(1, len(self.slides) + 1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
            '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
            '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
            '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
            f'{slides}</Types>'
        )


def _relationships(entries: Sequence[str]) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'{"".join(entries)}</Relationships>'
    )


def _root_rels() -> str:
    return _relationships([
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
    ])


def _slide_rels() -> str:
    return _relationships([
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
    ])


def _layout_rels() -> str:
    return _relationships([
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>'
    ])


def _master_rels() -> str:
    return _relationships([
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>',
    ])


def _slide_layout() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">'
        f'<p:cSld name="Em branco"><p:spTree>{_group_properties()}</p:spTree></p:cSld>'
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'
    )


def _slide_master() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        f'<p:cSld><p:spTree>{_group_properties()}</p:spTree></p:cSld>'
        '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'
        '<p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst>'
        '<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'
    )


def _theme() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="ELO">'
        '<a:themeElements><a:clrScheme name="ELO">'
        '<a:dk1><a:srgbClr val="1F3864"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>'
        '<a:dk2><a:srgbClr val="263238"/></a:dk2><a:lt2><a:srgbClr val="F7F9FC"/></a:lt2>'
        '<a:accent1><a:srgbClr val="1F3864"/></a:accent1><a:accent2><a:srgbClr val="2E75B6"/></a:accent2>'
        '<a:accent3><a:srgbClr val="70AD47"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>'
        '<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="A5A5A5"/></a:accent6>'
        '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>'
        '</a:clrScheme><a:fontScheme name="ELO"><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme>'
        '<a:fmtScheme name="ELO"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
        '<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>'
        '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
        '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>'
        '</a:themeElements></a:theme>'
    )


def validate_pptx(path: str | Path) -> Dict[str, Any]:
    target = Path(path)
    if target.suffix.lower() != ".pptx" or not target.is_file():
        raise ValueError("Arquivo PPTX inválido ou inexistente.")
    required = {"[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels", "ppt/slideMasters/slideMaster1.xml", "ppt/slideLayouts/slideLayout1.xml", "ppt/theme/theme1.xml"}
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise ValueError("Pacote PPTX corrompido.")
        names = set(archive.namelist())
        missing = required - names
        if missing:
            raise ValueError(f"Partes ausentes: {sorted(missing)}")
        xml_parts = [name for name in names if name.endswith(".xml") or name.endswith(".rels")]
        relationship_count = 0
        rel_ns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
        for name in xml_parts:
            root = ElementTree.fromstring(archive.read(name))
            if name.endswith(".rels"):
                source_dir = posixpath.dirname(posixpath.dirname(name))
                for relationship in root.findall("r:Relationship", rel_ns):
                    if relationship.attrib.get("TargetMode") == "External":
                        continue
                    target_path = posixpath.normpath(posixpath.join(source_dir, relationship.attrib["Target"])).lstrip("/")
                    if target_path not in names:
                        raise ValueError(f"Relacionamento quebrado em {name}: {target_path}")
                    relationship_count += 1
        slides = sorted(name for name in names if name.startswith("ppt/slides/slide") and name.endswith(".xml"))
        if not slides:
            raise ValueError("A apresentação não possui slides.")
    return {"arquivo": str(target.resolve()), "slides": len(slides), "xmls_validos": len(xml_parts), "relacionamentos_validos": relationship_count, "zip_integro": True, "tamanho_bytes": target.stat().st_size}
