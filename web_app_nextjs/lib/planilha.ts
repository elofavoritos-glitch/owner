// Leitura e mapeamento de planilhas (xlsx/csv) para clientes e oportunidades.
// Lê a primeira aba, cabeçalho na primeira linha. Mapeia colunas por sinônimos.
import * as XLSX from "xlsx";

export type Destino = "clientes" | "oportunidades";

// Campos de destino e os sinônimos de cabeçalho aceitos (normalizados).
const CAMPOS: Record<Destino, Record<string, string[]>> = {
  clientes: {
    empresa: ["empresa", "razao social", "razaosocial", "cliente", "nome", "nome fantasia", "fantasia"],
    cnpj: ["cnpj", "cnpj/cpf", "documento"],
    contato: ["contato", "responsavel", "nome contato", "pessoa"],
    email: ["email", "e-mail", "e mail"],
    telefone: ["telefone", "fone", "celular", "whatsapp", "tel"],
    segmento: ["segmento", "setor", "ramo", "atividade"],
    cidade: ["cidade", "municipio"],
    uf: ["uf", "estado"],
    regiao: ["regiao", "região", "area", "zona"],
    observacoes: ["observacoes", "observacao", "obs", "notas", "comentarios"],
  },
  oportunidades: {
    cliente_nome: ["cliente", "empresa", "razao social", "razaosocial", "nome"],
    responsavel_nome: ["responsavel", "vendedor", "comercial", "consultor", "responsável"],
    servico: ["servico", "serviço", "produto", "solucao", "solução"],
    etapa: ["etapa", "estagio", "estágio", "fase", "funil"],
    status: ["status", "situacao", "situação"],
    valor_potencial: ["valor", "valor potencial", "valor_potencial", "potencial", "ticket", "montante"],
    probabilidade: ["probabilidade", "prob", "chance", "%"],
    proxima_acao: ["proxima acao", "próxima ação", "proxima_acao", "acao", "ação", "next step"],
    data_proxima_acao: ["data proxima acao", "data acao", "data_proxima_acao", "prazo acao"],
    previsao_fechamento: ["previsao fechamento", "previsão fechamento", "previsao", "fechamento", "data fechamento"],
    observacoes: ["observacoes", "observacao", "obs", "notas"],
  },
};

export const CAMPOS_OBRIGATORIOS: Record<Destino, string> = {
  clientes: "empresa",
  oportunidades: "cliente_nome",
};

const ETAPAS_VALIDAS = ["Prospecção", "Qualificação", "Diagnóstico", "Cotação", "Negociação", "Ganho", "Perdido"];
const STATUS_VALIDOS = ["Ativa", "Em espera", "Ganha", "Perdida"];

function norm(s: string): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
}

export type Planilha = { cabecalhos: string[]; linhas: Record<string, unknown>[] };

// Lê o buffer (xlsx ou csv) e devolve cabeçalhos + linhas como objetos.
export const MAX_LINHAS = 5000;

export function lerPlanilha(buffer: ArrayBuffer): Planilha {
  const wb = XLSX.read(buffer, { type: "array" });
  const primeira = wb.SheetNames[0];
  if (!primeira) throw new Error("Planilha vazia.");
  const sheet = wb.Sheets[primeira];
  // raw:false + defval:"" → lê o texto formatado da célula (evita o SheetJS
  // reinterpretar "150.000,00" como número e quebrar o separador brasileiro).
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, blankrows: false, defval: "", raw: false,
  });
  if (!matriz.length) throw new Error("Planilha sem dados.");

  // Desduplica cabeçalhos vazios/repetidos para não sobrescrever colunas.
  const vistos = new Map<string, number>();
  const cabecalhos = (matriz[0] as unknown[]).map((h, i) => {
    let nome = String(h ?? "").trim() || `coluna_${i + 1}`;
    const n = vistos.get(nome) ?? 0;
    vistos.set(nome, n + 1);
    if (n > 0) nome = `${nome} (${n + 1})`;
    return nome;
  });

  const linhas: Record<string, unknown>[] = [];
  for (let i = 1; i < matriz.length && linhas.length < MAX_LINHAS; i++) {
    const row = matriz[i] as unknown[];
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    cabecalhos.forEach((h, j) => { obj[h] = row[j]; });
    linhas.push(obj);
  }
  return { cabecalhos, linhas };
}

// Mapeia cada cabeçalho da planilha para um campo de destino (ou null).
export function mapearColunas(cabecalhos: string[], destino: Destino): Record<string, string | null> {
  const campos = CAMPOS[destino];
  const mapa: Record<string, string | null> = {};
  for (const cab of cabecalhos) {
    const n = norm(cab);
    let achou: string | null = null;
    for (const [campo, sinonimos] of Object.entries(campos)) {
      if (sinonimos.some((s) => norm(s) === n)) { achou = campo; break; }
    }
    mapa[cab] = achou;
  }
  return mapa;
}

function numero(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  let normalizado: string;
  if (s.includes(",")) {
    // formato BR: vírgula é decimal, pontos são milhares (1.234,56)
    normalizado = s.replace(/\./g, "").replace(",", ".");
  } else if ((s.match(/\./g) || []).length > 1) {
    // múltiplos pontos sem vírgula = separador de milhar (1.234.567)
    normalizado = s.replace(/\./g, "");
  } else {
    normalizado = s;
  }
  const n = parseFloat(normalizado);
  return Number.isNaN(n) ? 0 : n;
}

// Converte as linhas da planilha em registros prontos para inserir, aplicando
// o mapeamento. Retorna { registros, ignoradas } (linhas sem o campo obrigatório).
export function montarRegistros(
  planilha: Planilha,
  destino: Destino,
  mapa: Record<string, string | null>,
): { registros: Record<string, unknown>[]; ignoradas: number } {
  const obrig = CAMPOS_OBRIGATORIOS[destino];
  const registros: Record<string, unknown>[] = [];
  let ignoradas = 0;

  for (const linha of planilha.linhas) {
    const reg: Record<string, unknown> = {};
    for (const [cab, campo] of Object.entries(mapa)) {
      if (!campo) continue;
      const bruto = linha[cab];
      if (bruto === undefined || bruto === null || String(bruto).trim() === "") continue;
      reg[campo] = String(bruto).trim();
    }

    if (!reg[obrig]) { ignoradas++; continue; }

    if (destino === "oportunidades") {
      if (reg.valor_potencial !== undefined) reg.valor_potencial = numero(reg.valor_potencial);
      if (reg.probabilidade !== undefined) {
        let p = numero(reg.probabilidade);
        if (p > 1) p = p / 100; // aceita 35 como 35%
        reg.probabilidade = Math.max(0, Math.min(1, p));
      }
      // normaliza etapa/status para os valores aceitos; se não bater, usa default
      if (reg.etapa && !ETAPAS_VALIDAS.includes(String(reg.etapa))) delete reg.etapa;
      if (reg.status && !STATUS_VALIDOS.includes(String(reg.status))) delete reg.status;
      if (!reg.cliente_nome) { ignoradas++; continue; }
    }

    registros.push(reg);
  }
  return { registros, ignoradas };
}
