// Qualificação automática de lead: cruza os dados de uma empresa (vindos da
// Econodata) com o ICP da ELO e gera evidências para o score determinístico
// (lib/elo-intelligence.ts). Nunca inventa dado: o que não vier da fonte vira
// pendência com nota baixa.
import { ICP, calcularScore, type Evidencias, type ResultadoScore } from "./elo-intelligence";

// UFs prioritárias da ELO (região sul + base em SC). Derivado do ICP.
const UFS_PRIORITARIAS = new Set(["SC", "PR", "RS"]);

// Mapeia o porte da Econodata para um sinal de potencial de serviços da ELO.
// Empresas maiores tendem a ter volume para armazenagem/transporte.
const PESO_PORTE: Record<string, number> = {
  GRANDE: 1.0, MEDIO: 0.75, PEQUENO: 0.45, MICRO: 0.2, INDIVIDUAL: 0.1,
};

export type EmpresaEconodata = {
  cnpj?: string;
  cadastro?: {
    razaoSocial?: string; nomeFantasia?: string; uf?: string; cidade?: string;
    situacao?: string; setores?: string[];
    cnaePrimario?: { codigo?: string; descricao?: string };
  };
  perfilNegocio?: {
    porte?: string;
    comercioExterior?: { exportacaoAnos?: string[]; importacaoAnos?: string[] };
  };
  contatosBasicos?: { telefones?: Array<{ numero?: string }> };
};

// Verifica se algum setor/cnae da empresa casa com os segmentos do ICP da ELO.
function aderenciaSegmento(empresa: EmpresaEconodata): { nota: number; motivo: string } {
  const setores = (empresa.cadastro?.setores ?? []).map((s) => s.toLowerCase());
  const cnae = (empresa.cadastro?.cnaePrimario?.descricao ?? "").toLowerCase();
  const alvo = [...setores, cnae].join(" ");
  const termos = ["import", "export", "indústria", "industria", "varejo", "e-commerce",
    "comércio", "comercio", "distribui", "atacad", "logístic", "logistic", "bens de consumo",
    "alimento", "fabrica", "fábrica"];
  const casou = termos.filter((t) => alvo.includes(t));
  if (casou.length) return { nota: 0.9, motivo: `Atividade aderente ao ICP (${casou.slice(0, 3).join(", ")})` };
  if (alvo.trim()) return { nota: 0.4, motivo: "Atividade informada, aderência parcial ao ICP" };
  return { nota: 0, motivo: "Sem setor/CNAE para avaliar aderência" };
}

// Gera evidências (notas 0..1) a partir dos dados da Econodata e calcula o score.
export function qualificarLead(empresa: EmpresaEconodata): {
  score: ResultadoScore;
  resumo: { razaoSocial: string | null; cnpj: string | null; uf: string | null; porte: string | null; comComex: boolean };
} {
  const nome = empresa.cadastro?.razaoSocial || empresa.cadastro?.nomeFantasia || empresa.cnpj || "Empresa";
  const uf = (empresa.cadastro?.uf || "").toUpperCase();
  const porte = (empresa.perfilNegocio?.porte || "").toUpperCase();
  const comex = empresa.perfilNegocio?.comercioExterior;
  const temComex = Boolean((comex?.exportacaoAnos?.length ?? 0) || (comex?.importacaoAnos?.length ?? 0));

  const evid: Evidencias = {};

  // Aderência ao ICP (segmento/atividade).
  const seg = aderenciaSegmento(empresa);
  evid.aderencia_icp = { nota: seg.nota, justificativa: seg.motivo, fonte: "Econodata" };

  // Potencial de serviços ELO — inferido do porte (volume) + comércio exterior.
  const notaPorte = PESO_PORTE[porte] ?? 0;
  if (notaPorte > 0 || temComex) {
    const servicos = ["armazenagem"];
    if (temComex) servicos.push("transporte"); // comex puxa movimentação/frete
    evid.potencial_servicos_elo = {
      nota: Math.min(1, notaPorte + (temComex ? 0.2 : 0)),
      justificativa: `Porte ${porte || "n/d"}${temComex ? " + atividade de comércio exterior" : ""}`,
      fonte: "Econodata",
      servicos,
    };
  }

  // Região/rotas — prioriza SC/PR/RS.
  if (uf) {
    evid.regiao_rotas = UFS_PRIORITARIAS.has(uf)
      ? { nota: 1.0, justificativa: `Na região prioritária da ELO (${uf})`, fonte: "Econodata" }
      : { nota: 0.3, justificativa: `Fora da região prioritária (${uf})`, fonte: "Econodata" };
  }

  // Atividade logística — comércio exterior é forte sinal.
  if (temComex) {
    evid.atividade_logistica = { nota: 1.0, justificativa: "Registros de importação/exportação", fonte: "Econodata" };
  }

  const score = calcularScore(nome, evid);
  return {
    score,
    resumo: {
      razaoSocial: empresa.cadastro?.razaoSocial ?? null,
      cnpj: empresa.cnpj ?? null,
      uf: uf || null,
      porte: porte || null,
      comComex: temComex,
    },
  };
}
