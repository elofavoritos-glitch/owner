// Motor de geração de apresentações PowerPoint (.pptx) da ELO, em TypeScript
// puro — sem dependências externas. Portado do powerpoint_agent (Python).
// Um .pptx é um pacote OOXML (ZIP com XMLs). Função pura: recebe os slides e
// devolve os bytes do arquivo. Reaproveitada pela ferramenta do assistente.

import { deflateRawSync } from "node:zlib";

const SLIDE_WIDTH = 12192000;
const SLIDE_HEIGHT = 6858000;

export type SlideInput = {
  titulo: string;
  bullets?: string[];
  subtitulo?: string;
  capa?: boolean;
};

// ---------- escaping XML ----------
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ---------- parágrafo e shape (iguais ao motor Python) ----------
function par(texto: string, { size = 22, color = "263238", bold = false, bullet = false } = {}): string {
  const ppr = bullet
    ? '<a:pPr lvl="0" marL="342900" indent="-228600"><a:buChar char="•"/></a:pPr>'
    : "<a:pPr/>";
  const preserve = /^\s|\s$/.test(texto) ? ' xml:space="preserve"' : "";
  return (
    `<a:p>${ppr}<a:r><a:rPr lang="pt-BR" sz="${size * 100}" b="${bold ? 1 : 0}">` +
    `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr>` +
    `<a:t${preserve}>${esc(texto)}</a:t></a:r>` +
    `<a:endParaRPr lang="pt-BR" sz="${size * 100}"/></a:p>`
  );
}

function shape(
  id: number, name: string, x: number, y: number, cx: number, cy: number,
  paragraphs: string[], { fill, margin = 160000 }: { fill?: string; margin?: number } = {},
): string {
  const fillXml = fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : "<a:noFill/>";
  return (
    "<p:sp><p:nvSpPr>" +
    `<p:cNvPr id="${id}" name="${esc(name)}"/>` +
    '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    `${fillXml}<a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="${margin}" tIns="${margin}" rIns="${margin}" bIns="${margin}" anchor="top"/>` +
    `<a:lstStyle/>${paragraphs.length ? paragraphs.join("") : "<a:p/>"}</p:txBody></p:sp>`
  );
}

function grupo(): string {
  return (
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
  );
}

function slideXml(s: SlideInput, numero: number): string {
  const shapes: string[] = [];
  if (s.capa) {
    shapes.push(shape(2, "Fundo", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, [], { fill: "1F3864", margin: 0 }));
    shapes.push(shape(3, "Título", 900000, 1750000, 10400000, 1500000, [par(s.titulo, { size: 32, color: "FFFFFF", bold: true })]));
    if (s.subtitulo) shapes.push(shape(4, "Subtítulo", 920000, 3300000, 9500000, 850000, [par(s.subtitulo, { size: 18, color: "D9EAF7" })]));
    shapes.push(shape(5, "Rodapé", 920000, 5900000, 9800000, 400000, [par("ELO Soluções Logísticas Integradas • Itajaí/SC", { size: 11, color: "FFFFFF" })]));
  } else {
    shapes.push(shape(2, "Faixa", 0, 0, SLIDE_WIDTH, 1050000, [], { fill: "1F3864", margin: 0 }));
    shapes.push(shape(3, "Título", 650000, 160000, 10900000, 700000, [par(s.titulo, { size: 25, color: "FFFFFF", bold: true })]));
    let contentY = 1350000;
    if (s.subtitulo) {
      shapes.push(shape(4, "Subtítulo", 750000, 1200000, 10600000, 550000, [par(s.subtitulo, { size: 14, color: "52606D" })]));
      contentY = 1900000;
    }
    const paragraphs = (s.bullets ?? []).map((b) => par(b, { size: 20, color: "263238", bullet: true }));
    shapes.push(shape(5, "Conteúdo", 850000, contentY, 10400000, 4100000, paragraphs, { fill: "F7F9FC", margin: 220000 }));
    shapes.push(shape(6, "Rodapé", 650000, 6320000, 10900000, 280000, [par(`ELO Soluções Logísticas Integradas  |  ${numero}`, { size: 9, color: "607D8B" })]));
  }
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F7F9FC"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    `<p:spTree>${grupo()}${shapes.join("")}</p:spTree></p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
  );
}

// ---------- partes estáticas do pacote ----------
function rels(entries: string[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `${entries.join("")}</Relationships>`
  );
}
const ROOT_RELS = rels(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>']);
const SLIDE_RELS = rels(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>']);
const LAYOUT_RELS = rels(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>']);
const MASTER_RELS = rels([
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>',
]);
const SLIDE_LAYOUT =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">' +
  `<p:cSld name="Em branco"><p:spTree>${grupo()}</p:spTree></p:cSld>` +
  '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
const SLIDE_MASTER =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
  `<p:cSld><p:spTree>${grupo()}</p:spTree></p:cSld>` +
  '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst>' +
  '<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>';
const THEME =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="ELO">' +
  '<a:themeElements><a:clrScheme name="ELO">' +
  '<a:dk1><a:srgbClr val="1F3864"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
  '<a:dk2><a:srgbClr val="263238"/></a:dk2><a:lt2><a:srgbClr val="F7F9FC"/></a:lt2>' +
  '<a:accent1><a:srgbClr val="1F3864"/></a:accent1><a:accent2><a:srgbClr val="2E75B6"/></a:accent2>' +
  '<a:accent3><a:srgbClr val="70AD47"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>' +
  '<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="A5A5A5"/></a:accent6>' +
  '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>' +
  '</a:clrScheme><a:fontScheme name="ELO"><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme>' +
  '<a:fmtScheme name="ELO"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
  '<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
  '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
  '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>' +
  '</a:themeElements></a:theme>';

function presentationXml(n: number): string {
  let ids = "";
  for (let i = 1; i <= n; i++) ids += `<p:sldId id="${255 + i}" r:id="rId${i + 1}"/>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:sldIdLst>${ids}</p:sldIdLst>` +
    `<p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}" type="screen16x9"/>` +
    '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>'
  );
}
function presentationRels(n: number): string {
  const entries = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'];
  for (let i = 1; i <= n; i++) entries.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`);
  return rels(entries);
}
function contentTypes(n: number): string {
  let slides = "";
  for (let i = 1; i <= n; i++) slides += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    `${slides}</Types>`
  );
}

// ---------- ZIP (OOXML) via CRC32 + DEFLATE nativo ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type Entrada = { nome: string; dados: Buffer };

function montarZip(entradas: Entrada[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;
  for (const { nome, dados } of entradas) {
    const nomeBuf = Buffer.from(nome, "utf8");
    const crc = crc32(dados);
    const comprimido = deflateRawSync(dados);
    const usaDeflate = comprimido.length < dados.length;
    const corpo = usaDeflate ? comprimido : dados;
    const metodo = usaDeflate ? 8 : 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);       // versão
    localHeader.writeUInt16LE(0, 6);        // flags
    localHeader.writeUInt16LE(metodo, 8);   // método
    localHeader.writeUInt16LE(0, 10);       // hora
    localHeader.writeUInt16LE(0x21, 12);    // data (1980-01-01)
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(corpo.length, 18);
    localHeader.writeUInt32LE(dados.length, 22);
    localHeader.writeUInt16LE(nomeBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    locais.push(localHeader, nomeBuf, corpo);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(corpo.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nomeBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrais.push(central, nomeBuf);

    offset += localHeader.length + nomeBuf.length + corpo.length;
  }
  const centralBuf = Buffer.concat(centrais);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entradas.length, 8);
  eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, centralBuf, eocd]);
}

/**
 * Gera os bytes de um .pptx 16:9 com os slides informados.
 * @throws se não houver slides ou algum slide sem título.
 */
export function gerarApresentacaoPPTX(slides: SlideInput[]): Buffer {
  if (!slides.length) throw new Error("A apresentação precisa ter ao menos um slide.");
  slides.forEach((s) => { if (!s.titulo?.trim()) throw new Error("Todo slide precisa de título."); });
  const n = slides.length;
  const b = (s: string) => Buffer.from(s, "utf8");

  const entradas: Entrada[] = [
    { nome: "[Content_Types].xml", dados: b(contentTypes(n)) },
    { nome: "_rels/.rels", dados: b(ROOT_RELS) },
    { nome: "ppt/presentation.xml", dados: b(presentationXml(n)) },
    { nome: "ppt/_rels/presentation.xml.rels", dados: b(presentationRels(n)) },
    { nome: "ppt/slideMasters/slideMaster1.xml", dados: b(SLIDE_MASTER) },
    { nome: "ppt/slideMasters/_rels/slideMaster1.xml.rels", dados: b(MASTER_RELS) },
    { nome: "ppt/slideLayouts/slideLayout1.xml", dados: b(SLIDE_LAYOUT) },
    { nome: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", dados: b(LAYOUT_RELS) },
    { nome: "ppt/theme/theme1.xml", dados: b(THEME) },
  ];
  slides.forEach((s, i) => {
    entradas.push({ nome: `ppt/slides/slide${i + 1}.xml`, dados: b(slideXml(s, i + 1)) });
    entradas.push({ nome: `ppt/slides/_rels/slide${i + 1}.xml.rels`, dados: b(SLIDE_RELS) });
  });
  return montarZip(entradas);
}
