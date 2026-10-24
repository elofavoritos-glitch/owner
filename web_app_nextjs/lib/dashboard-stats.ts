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
  // --- Santa Catarina (base da ELO) ---
  "itajai": [-48.66194, -26.90778],
  "navegantes": [-48.65, -26.8986],
  "balneario camboriu": [-48.6306, -26.9906],
  "blumenau": [-49.0661, -26.9194],
  "joinville": [-48.8456, -26.3045],
  "florianopolis": [-48.5482, -27.5969],
  "sao jose": [-48.6383, -27.5969],
  "palhoca": [-48.6678, -27.6453],
  "brusque": [-48.9178, -27.0978],
  "jaragua do sul": [-49.0661, -26.4858],
  "chapeco": [-52.6186, -27.1004],
  "criciuma": [-49.3697, -28.6775],
  "lages": [-50.3261, -27.8156],
  "tubarao": [-48.9981, -28.4669],
  "sao bento do sul": [-49.3781, -26.2503],
  "rio do sul": [-49.6436, -27.2142],
  "concordia": [-52.0286, -27.2342],
  "cacador": [-50.9872, -26.7753],
  // --- Paraná ---
  "curitiba": [-49.2733, -25.4284],
  "londrina": [-51.1628, -23.3045],
  "maringa": [-51.9386, -23.4253],
  "ponta grossa": [-50.1619, -25.0950],
  "cascavel": [-53.4553, -24.9556],
  "foz do iguacu": [-54.5881, -25.5478],
  "paranagua": [-48.5119, -25.5161],
  "sao jose dos pinhais": [-49.2064, -25.5306],
  "guarapuava": [-51.4583, -25.3936],
  "toledo": [-53.7431, -24.7136],
  // --- Rio Grande do Sul ---
  "porto alegre": [-51.2177, -30.0346],
  "caxias do sul": [-51.1794, -29.1678],
  "pelotas": [-52.3425, -31.7654],
  "canoas": [-51.1836, -29.9178],
  "santa maria": [-53.8069, -29.6842],
  "novo hamburgo": [-51.1306, -29.6783],
  "passo fundo": [-52.4064, -28.2628],
  "rio grande": [-52.0986, -32.0350],
  "gravatai": [-50.9922, -29.9442],
  // --- Sudeste: São Paulo ---
  "sao paulo": [-46.6333, -23.5505],
  "campinas": [-47.0608, -22.9056],
  "santos": [-46.3336, -23.9608],
  "guarulhos": [-46.5333, -23.4628],
  "sao bernardo do campo": [-46.5650, -23.6939],
  "osasco": [-46.7919, -23.5325],
  "ribeirao preto": [-47.8103, -21.1775],
  "sorocaba": [-47.4581, -23.5017],
  "sao jose dos campos": [-45.8872, -23.1794],
  "jundiai": [-46.8839, -23.1861],
  "piracicaba": [-47.6492, -22.7250],
  "bauru": [-49.0606, -22.3147],
  "cubatao": [-46.4253, -23.8953],
  "guaruja": [-46.2564, -23.9931],
  "sao jose do rio preto": [-49.3794, -20.8197],
  // --- Sudeste: RJ, MG, ES ---
  "rio de janeiro": [-43.1729, -22.9068],
  "niteroi": [-43.1036, -22.8833],
  "duque de caxias": [-43.3117, -22.7858],
  "campos dos goytacazes": [-41.3297, -21.7622],
  "belo horizonte": [-43.9378, -19.9208],
  "contagem": [-44.0536, -19.9317],
  "uberlandia": [-48.2772, -18.9186],
  "juiz de fora": [-43.3503, -21.7642],
  "betim": [-44.1983, -19.9678],
  "uberaba": [-47.9319, -19.7472],
  "vitoria": [-40.3376, -20.3194],
  "vila velha": [-40.2925, -20.3297],
  "serra": [-40.3078, -20.1289],
  // --- Centro-Oeste ---
  "brasilia": [-47.9292, -15.7801],
  "goiania": [-49.2539, -16.6869],
  "anapolis": [-48.9531, -16.3267],
  "campo grande": [-54.6464, -20.4697],
  "cuiaba": [-56.0969, -15.6014],
  "varzea grande": [-56.1326, -15.6464],
  "dourados": [-54.8056, -22.2211],
  "rondonopolis": [-54.6356, -16.4708],
  // --- Nordeste ---
  "salvador": [-38.5014, -12.9714],
  "feira de santana": [-38.9667, -12.2667],
  "recife": [-34.8811, -8.0539],
  "jaboatao dos guararapes": [-35.0147, -8.1128],
  "fortaleza": [-38.5267, -3.7319],
  "caucaia": [-38.6531, -3.7361],
  "sao luis": [-44.3028, -2.5297],
  "natal": [-35.2094, -5.7945],
  "joao pessoa": [-34.8631, -7.1195],
  "maceio": [-35.7353, -9.6658],
  "aracaju": [-37.0731, -10.9472],
  "teresina": [-42.8019, -5.0892],
  "suape": [-34.9644, -8.3936],
  "camacari": [-38.3239, -12.6997],
  // --- Norte ---
  "manaus": [-60.0217, -3.1190],
  "belem": [-48.5044, -1.4558],
  "porto velho": [-63.9039, -8.7619],
  "rio branco": [-67.8220, -9.9747],
  "boa vista": [-60.6733, 2.8197],
  "macapa": [-51.0694, 0.0349],
  "palmas": [-48.3603, -10.1844],
  "maraba": [-49.1178, -5.3686],
  "santarem": [-54.7081, -2.4431],
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
