// Motor de geração do PDF de proposta comercial da ELO.
// Função pura: recebe os dados e devolve os bytes do PDF. Reaproveitada pela
// tela /propostas e pela ferramenta do assistente. Nunca inventa valores —
// usa exatamente os itens recebidos.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ItemProposta = {
  descricao: string;
  quantidade?: number;
  valor_unitario?: number; // em reais
};

export type DadosProposta = {
  cliente: string;
  cnpj?: string | null;
  contato?: string | null;
  responsavel?: string | null;
  itens: ItemProposta[];
  condicoes?: string | null;
  validade_dias?: number;
};

const AZUL = rgb(0.12, 0.22, 0.39);   // #1F3864
const AZUL_CLARO = rgb(0.18, 0.46, 0.71);
const CINZA = rgb(0.38, 0.49, 0.55);
const LINHA = rgb(0.89, 0.91, 0.94);

function moeda(v: number): string {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Remove caracteres que a fonte padrão (WinAnsi) não suporta, para não quebrar.
function limpar(s: string): string {
  return String(s ?? "").replace(/[^\x00-\xFF]/g, "");
}

export async function gerarPropostaPDF(dados: DadosProposta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const fonteB = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]); // A4
  const margem = 50;
  const larg = 595 - margem * 2;
  let y = 792;

  const texto = (t: string, x: number, yy: number, f: PDFFont, size: number, cor = rgb(0.1, 0.1, 0.1)) =>
    page.drawText(limpar(t), { x, y: yy, size, font: f, color: cor });

  // Cabeçalho
  page.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: AZUL });
  texto("ELO Solucoes Logisticas Integradas", margem, 815, fonteB, 16, rgb(1, 1, 1));
  texto("Proposta Comercial", margem, 770, fonteB, 20, AZUL);
  texto(`Emitida em ${new Date().toLocaleDateString("pt-BR")}`, margem, 754, fonte, 10, CINZA);
  y = 730;

  // Dados do cliente
  page.drawLine({ start: { x: margem, y }, end: { x: margem + larg, y }, thickness: 1, color: LINHA });
  y -= 20;
  texto("CLIENTE", margem, y, fonteB, 11, AZUL_CLARO);
  y -= 16;
  texto(dados.cliente, margem, y, fonteB, 13);
  y -= 15;
  if (dados.cnpj) { texto(`CNPJ: ${dados.cnpj}`, margem, y, fonte, 10, CINZA); y -= 13; }
  if (dados.contato) { texto(`Contato: ${dados.contato}`, margem, y, fonte, 10, CINZA); y -= 13; }
  y -= 10;

  // Cabeçalho da tabela de itens
  const colDesc = margem;
  const colQtd = margem + 300;
  const colUnit = margem + 360;
  const colTotal = margem + 450;
  page.drawRectangle({ x: margem, y: y - 4, width: larg, height: 22, color: rgb(0.93, 0.95, 0.98) });
  texto("DESCRICAO", colDesc + 4, y + 3, fonteB, 9, AZUL);
  texto("QTD", colQtd, y + 3, fonteB, 9, AZUL);
  texto("VALOR UNIT.", colUnit, y + 3, fonteB, 9, AZUL);
  texto("TOTAL", colTotal, y + 3, fonteB, 9, AZUL);
  y -= 22;

  // Itens
  let totalGeral = 0;
  let temPendencia = false;
  for (const item of dados.itens) {
    if (y < 120) { page = doc.addPage([595, 842]); y = 792; }
    const qtd = Number(item.quantidade ?? 1);
    const unit = Number(item.valor_unitario ?? 0);
    const totalItem = qtd * unit;
    totalGeral += totalItem;
    const semValor = !item.valor_unitario;
    if (semValor) temPendencia = true;

    texto(item.descricao.slice(0, 55), colDesc + 4, y, fonte, 10);
    texto(String(qtd), colQtd, y, fonte, 10);
    texto(semValor ? "a definir" : moeda(unit), colUnit, y, fonte, 10, semValor ? CINZA : rgb(0.1, 0.1, 0.1));
    texto(semValor ? "-" : moeda(totalItem), colTotal, y, fonte, 10, semValor ? CINZA : rgb(0.1, 0.1, 0.1));
    y -= 18;
    page.drawLine({ start: { x: margem, y: y + 4 }, end: { x: margem + larg, y: y + 4 }, thickness: 0.5, color: LINHA });
  }

  // Total
  y -= 10;
  page.drawRectangle({ x: colUnit - 10, y: y - 6, width: margem + larg - colUnit + 10, height: 24, color: AZUL });
  texto("TOTAL", colUnit, y + 2, fonteB, 11, rgb(1, 1, 1));
  texto(moeda(totalGeral), colTotal, y + 2, fonteB, 11, rgb(1, 1, 1));
  y -= 40;

  if (temPendencia) {
    texto("* Itens marcados como 'a definir' dependem de levantamento e nao estao no total.", margem, y, fonte, 8, CINZA);
    y -= 20;
  }

  // Condições
  const validade = dados.validade_dias ?? 15;
  texto("CONDICOES", margem, y, fonteB, 11, AZUL_CLARO);
  y -= 16;
  const condicoes = dados.condicoes
    ? dados.condicoes
    : `Proposta valida por ${validade} dias. Valores sujeitos a confirmacao apos levantamento tecnico.`;
  // quebra de linha simples
  const linhas = quebrar(condicoes, fonte, 10, larg);
  for (const l of linhas) { texto(l, margem, y, fonte, 10, CINZA); y -= 14; }

  // Rodapé
  texto(
    `Responsavel: ${dados.responsavel || "Equipe comercial ELO"}  |  ELO Solucoes Logisticas Integradas - Itajai/SC`,
    margem, 40, fonte, 8, CINZA,
  );

  return doc.save();
}

function quebrar(txt: string, fonte: PDFFont, size: number, maxLarg: number): string[] {
  const palavras = limpar(txt).split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(teste, size) > maxLarg) {
      if (atual) linhas.push(atual);
      atual = p;
    } else {
      atual = teste;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}
