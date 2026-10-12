// Cálculo de indicadores do painel (espelha a lógica dos agentes Python).
export type Oportunidade = {
  id: string;
  cliente_nome: string;
  responsavel_nome?: string;
  etapa: string;
  status: string;
  valor_potencial: number;
  probabilidade: number;
  proxima_acao?: string | null;
  data_proxima_acao?: string | null;
};

export const ETAPAS = ["Prospecção","Qualificação","Diagnóstico","Cotação","Negociação","Ganho","Perdido"];
const ABERTAS = new Set(["Prospecção","Qualificação","Diagnóstico","Cotação","Negociação"]);

export function resumo(ops: Oportunidade[], hoje = new Date()) {
  let potencial = 0, ponderado = 0, ganhas = 0, perdidas = 0, abertas = 0, risco = 0;
  for (const o of ops) {
    const pot = Number(o.valor_potencial || 0);
    const prob = Number(o.probabilidade || 0);
    potencial += pot; ponderado += pot * prob;
    if (o.etapa === "Ganho" || o.status?.toLowerCase() === "ganha") ganhas++;
    else if (o.etapa === "Perdido" || o.status?.toLowerCase() === "perdida") perdidas++;
    else {
      abertas++;
      const semAcao = !(o.proxima_acao || "").trim();
      const dp = o.data_proxima_acao ? new Date(o.data_proxima_acao) : null;
      if (semAcao || (dp && dp < hoje)) risco++;
    }
  }
  const conv = ganhas + perdidas ? Math.round((ganhas / (ganhas + perdidas)) * 100) : null;
  return { potencial, ponderado, ganhas, perdidas, abertas, risco, conv, total: ops.length };
}

export function porEtapa(ops: Oportunidade[]) {
  return ETAPAS.map((etapa) => {
    const grupo = ops.filter((o) => o.etapa === etapa);
    const pot = grupo.reduce((s, o) => s + Number(o.valor_potencial || 0), 0);
    const pond = grupo.reduce((s, o) => s + Number(o.valor_potencial || 0) * Number(o.probabilidade || 0), 0);
    return { etapa, quantidade: grupo.length, valor_potencial: pot, valor_ponderado: pond };
  });
}

export const moeda = (v: number) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
