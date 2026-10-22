// Agregações para a página de Dashboards. Estende lib/metrics.ts com cortes de
// conversão por etapa (funil), por responsável, por segmento, por UF, por canal
// de interação e geolocalização de leads por cidade (usando COORDS_CIDADES).
// Tudo determinístico, em memória — alimentado pelo server component.
import { ETAPAS, type Oportunidade } from "./metrics";

export type Cliente = {
  id: string;
  empresa: string;
  cidade?: string | null;
  uf?: string | null;
  segmento?: string | null;
  criado_em?: string | null;
};

export type Interacao = {
  canal: string;
  direcao: string;
  data_interacao: string;
};

// Etapas abertas na ordem do funil (exclui Ganho/Perdido).
const ETAPAS_FUNIL = ["Prospecção", "Qualificação", "Diagnóstico", "Cotação", "Negociação"];

// ---------- Funil de conversão (quantidade e valor por etapa, com taxa) ----------
export function funilConversao(ops: Oportunidade[]) {
  const porEtapa = ETAPAS_FUNIL.map((etapa) => {
    const grupo = ops.filter((o) => o.etapa === etapa);
    return {
      etapa,
      quantidade: grupo.length,
      valor: grupo.reduce((s, o) => s + Number(o.valor_potencial || 0), 0),
    };
  });
  // taxa de passagem relativa ao topo do funil (Prospecção)
  const topo = porEtapa[0]?.quantidade || 0;
  return porEtapa.map((e) => ({
    ...e,
    taxa: topo ? Math.round((e.quantidade / topo) * 100) : 0,
  }));
}

// ---------- Conversão global e por responsável ----------
function taxaConv(ganhas: number, perdidas: number): number | null {
  return ganhas + perdidas ? Math.round((ganhas / (ganhas + perdidas)) * 100) : null;
}

export function conversaoPorResponsavel(ops: Oportunidade[]) {
  const mapa = new Map<string, { ganhas: number; perdidas: number; abertas: number; valor: number; ponderado: number }>();
  for (const o of ops) {
    const nome = o.responsavel_nome || "Sem responsável";
    const m = mapa.get(nome) || { ganhas: 0, perdidas: 0, abertas: 0, valor: 0, ponderado: 0 };
    const pot = Number(o.valor_potencial || 0);
    m.valor += pot;
    m.ponderado += pot * Number(o.probabilidade || 0);
    if (o.etapa === "Ganho" || o.status?.toLowerCase() === "ganha") m.ganhas++;
    else if (o.etapa === "Perdido" || o.status?.toLowerCase() === "perdida") m.perdidas++;
    else m.abertas++;
    mapa.set(nome, m);
  }
  return [...mapa.entries()]
    .map(([nome, m]) => ({ nome, ...m, conv: taxaConv(m.ganhas, m.perdidas) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);
}

// ---------- Distribuição por segmento (clientes) ----------
export function porSegmento(clientes: Cliente[]) {
  const mapa = new Map<string, number>();
  for (const c of clientes) {
    const seg = (c.segmento || "Não informado").trim() || "Não informado";
    mapa.set(seg, (mapa.get(seg) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([segmento, quantidade]) => ({ segmento, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 8);
}

// ---------- Distribuição por UF (clientes) ----------
export function porUf(clientes: Cliente[]) {
  const mapa = new Map<string, number>();
  for (const c of clientes) {
    const uf = (c.uf || "??").toUpperCase().trim().slice(0, 2) || "??";
    mapa.set(uf, (mapa.get(uf) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([uf, quantidade]) => ({ uf, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

// ---------- Interações por canal e timeline mensal ----------
export function interacoesPorCanal(inter: Interacao[]) {
  const mapa = new Map<string, number>();
  for (const i of inter) {
    const canal = (i.canal || "outro").trim();
    mapa.set(canal, (mapa.get(canal) || 0) + 1);
  }
  const rotulos: Record<string, string> = {
    email: "E-mail", ligacao: "Ligação", reuniao: "Reunião",
    whatsapp: "WhatsApp", evento: "Evento", outro: "Outro",
  };
  return [...mapa.entries()]
    .map(([canal, quantidade]) => ({ canal: rotulos[canal] || canal, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

// Timeline dos últimos 6 meses de interações (AAAA-MM -> contagem).
export function timelineInteracoes(inter: Interacao[], hoje = new Date()) {
  const meses: { chave: string; rotulo: string; quantidade: number }[] = [];
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    meses.push({ chave, rotulo: `${nomes[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, quantidade: 0 });
  }
  const idx = new Map(meses.map((m, i) => [m.chave, i]));
  for (const it of inter) {
    const chave = (it.data_interacao || "").slice(0, 7);
    const i = idx.get(chave);
    if (i != null) meses[i].quantidade++;
  }
  return meses;
}

// ---------- Geolocalização de leads por cidade ----------
// Coordenadas [lon, lat] das principais cidades da ELO (espelha COORDS_CACHE de
// servicos-externos, mantido aqui para uso no client/SVG sem import de server).
export const COORDS_CIDADES: Record<string, [number, number]> = {
  "itajai": [-48.66194, -26.90778],
  "navegantes": [-48.65, -26.8986],
  "balneario camboriu": [-48.6306, -26.9906],
  "blumenau": [-49.0661, -26.9194],
  "joinville": [-48.8456, -26.3045],
  "florianopolis": [-48.5482, -27.5969],
  "curitiba": [-49.2733, -25.4284],
  "sao paulo": [-46.6333, -23.5505],
  "campinas": [-47.0608, -22.9056],
  "santos": [-46.3336, -23.9608],
  "porto alegre": [-51.2177, -30.0346],
  "rio de janeiro": [-43.1729, -22.9068],
  "belo horizonte": [-43.9378, -19.9208],
  "chapeco": [-52.6186, -27.1004],
  "caxias do sul": [-51.1794, -29.1678],
  "londrina": [-51.1628, -23.3045],
  "maringa": [-51.9386, -23.4253],
};

function normalizarCidade(nome: string): string {
  return String(nome || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

export type LeadGeo = {
  cidade: string;
  uf: string | null;
  lon: number;
  lat: number;
  quantidade: number;
};

// Agrupa clientes por cidade conhecida (com coordenadas) para plotar no mapa.
export function leadsGeo(clientes: Cliente[]): { pontos: LeadGeo[]; semCoordenada: number } {
  const mapa = new Map<string, LeadGeo>();
  let semCoordenada = 0;
  for (const c of clientes) {
    const chave = normalizarCidade(c.cidade || "");
    const coord = COORDS_CIDADES[chave];
    if (!coord) { if (c.cidade) semCoordenada++; continue; }
    const existente = mapa.get(chave);
    if (existente) existente.quantidade++;
    else mapa.set(chave, {
      cidade: (c.cidade || "").trim(),
      uf: c.uf ? c.uf.toUpperCase() : null,
      lon: coord[0], lat: coord[1], quantidade: 1,
    });
  }
  return { pontos: [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade), semCoordenada };
}

// Reexport para conveniência do server component.
export { ETAPAS };
