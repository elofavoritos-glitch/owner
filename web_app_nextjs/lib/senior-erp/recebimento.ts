// ============ SENIOR ERP — recebimento de clientes enviados pelo ERP ============
// O ERP G5 (Senior Cloud) não aceita conexões vindas de fora, mas consegue sair
// para a internet. A regra LSP `regra-envio-clientes.lsp` lê a E085CLI e faz
// POST do texto abaixo para /api/senior/clientes.
//
// Formato do corpo (texto puro, para não depender de escapar JSON em LSP):
//   ELO1~<registro>~<registro>~...
//   registro = codcli|nomcli|apecli|tipcli|cgccpf|cidcli|sigufs|foncli|intnet|sitcli
// A regra troca "|", "~" e quebras de linha dos valores por espaço antes de enviar.
// O ERP manda o texto em windows-1252 por padrão (doc da função HttpPost).

export const VERSAO_FORMATO = "ELO1";
export const MAX_REGISTROS_POR_LOTE = 1000;

export type ClienteRecebido = {
  codigo: number;
  empresa: string;
  fantasia: string;
  cnpj: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  situacao: string;
};

export type ResultadoParse = {
  clientes: ClienteRecebido[];
  ignorados: { posicao: number; motivo: string }[];
};

/** Decodifica o corpo conforme o charset do Content-Type (padrão do ERP: windows-1252). */
export function decodificarCorpo(bytes: ArrayBuffer, contentType: string | null): string {
  const charset = /charset=([^;]+)/i.exec(contentType ?? "")?.[1]?.trim().toLowerCase();
  const usarUtf8 = charset === "utf-8" || charset === "utf8";
  return new TextDecoder(usarUtf8 ? "utf-8" : "windows-1252").decode(bytes);
}

const limpar = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Só dígitos, completando zeros à esquerda que o ERP perde por guardar CGC/CPF como número. */
export function normalizarDocumento(valor: string, tipo: string): string {
  const digitos = valor.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digitos || /^0+$/.test(digitos)) return "";
  const tamanho = tipo.toUpperCase() === "F" ? 11 : 14;
  return digitos.length <= tamanho ? digitos.padStart(tamanho, "0") : digitos;
}

export function parseCorpo(texto: string): ResultadoParse {
  const partes = texto.replace(/^\uFEFF/, "").split("~");
  if (limpar(partes[0]) !== VERSAO_FORMATO) {
    throw new Error(`Formato inválido: o corpo deve começar com "${VERSAO_FORMATO}~".`);
  }

  const registros = partes.slice(1).filter((p) => p.trim() !== "");
  if (registros.length > MAX_REGISTROS_POR_LOTE) {
    throw new Error(`Lote acima de ${MAX_REGISTROS_POR_LOTE} registros.`);
  }

  const vistos = new Map<number, ClienteRecebido>();
  const ignorados: ResultadoParse["ignorados"] = [];

  registros.forEach((reg, i) => {
    const [cod, nome, fantasia, tipo, doc, cidade, uf, fone, email, sit] = reg.split("|");
    const codigoTxt = limpar(cod).replace(/[.,]0+$/, "");
    if (!/^\d{1,9}$/.test(codigoTxt)) {
      ignorados.push({ posicao: i + 1, motivo: "código do cliente inválido" });
      return;
    }
    const empresa = limpar(nome).slice(0, 160);
    if (!empresa) {
      ignorados.push({ posicao: i + 1, motivo: "sem nome" });
      return;
    }
    const emailLimpo = limpar(email).toLowerCase();
    const codigo = Number(codigoTxt);
    vistos.set(codigo, {
      codigo,
      empresa,
      fantasia: limpar(fantasia).slice(0, 160),
      cnpj: normalizarDocumento(limpar(doc).replace(/[.,]0+$/, ""), limpar(tipo)),
      cidade: limpar(cidade).slice(0, 80),
      uf: limpar(uf).toUpperCase().slice(0, 2),
      telefone: limpar(fone).slice(0, 30),
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLimpo) ? emailLimpo.slice(0, 160) : "",
      situacao: limpar(sit).toUpperCase().slice(0, 1),
    });
  });

  return { clientes: [...vistos.values()], ignorados };
}
