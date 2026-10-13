// Serviços externos para o assistente: clima (Open-Meteo), aeroportos (dados de
// referência) e rotas (OpenRouteService). Determinístico onde possível; sem
// inventar dados — se a fonte falhar, retorna erro explícito.

// ===================== CLIMA (Open-Meteo, grátis, sem chave) =====================

const WMO: Record<number, string> = {
  0: "céu limpo", 1: "predomínio de sol", 2: "parcialmente nublado", 3: "nublado",
  45: "névoa", 48: "névoa com geada", 51: "garoa fraca", 53: "garoa", 55: "garoa forte",
  61: "chuva fraca", 63: "chuva", 65: "chuva forte", 66: "chuva congelante", 67: "chuva congelante forte",
  71: "neve fraca", 73: "neve", 75: "neve forte", 77: "grãos de neve",
  80: "pancadas de chuva fracas", 81: "pancadas de chuva", 82: "pancadas de chuva fortes",
  85: "pancadas de neve", 86: "pancadas de neve fortes",
  95: "trovoada", 96: "trovoada com granizo", 99: "trovoada com granizo forte",
};

export async function consultarClima(cidade: string, dias = 3): Promise<Record<string, unknown>> {
  const nome = String(cidade).trim();
  if (!nome) return { erro: "Informe a cidade." };
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=1&language=pt&country=BR`,
      { cache: "no-store" },
    );
    const gd = (await geo.json()) as { results?: Array<{ name: string; latitude: number; longitude: number; admin1?: string }> };
    const loc = gd.results?.[0];
    if (!loc) return { erro: `Cidade "${nome}" não encontrada.` };

    const n = Math.max(1, Math.min(7, dias));
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
        `&current=temperature_2m,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=America/Sao_Paulo&forecast_days=${n}`,
      { cache: "no-store" },
    );
    const d = (await r.json()) as {
      current?: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
      daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] };
    };
    if (!d.daily) return { erro: "Previsão indisponível." };

    const dias_prev = d.daily.time.map((data, i) => ({
      data: data.split("-").reverse().join("/"),
      condicao: WMO[d.daily!.weather_code[i]] ?? "—",
      min: Math.round(d.daily!.temperature_2m_min[i]),
      max: Math.round(d.daily!.temperature_2m_max[i]),
      chuva_prob: d.daily!.precipitation_probability_max[i],
    }));
    return {
      cidade: `${loc.name}${loc.admin1 ? " - " + loc.admin1 : ""}`,
      agora: d.current ? {
        temperatura: Math.round(d.current.temperature_2m),
        condicao: WMO[d.current.weather_code] ?? "—",
        vento_kmh: Math.round(d.current.wind_speed_10m),
      } : null,
      previsao: dias_prev,
      fonte: "Open-Meteo",
    };
  } catch {
    return { erro: "Falha ao consultar o clima." };
  }
}

// ===================== AEROPORTOS (principais do Brasil) =====================
// Dados de referência (IATA, cidade, estado, nome). Não é status de voo ao vivo.

type Aeroporto = { iata: string; nome: string; cidade: string; uf: string; obs?: string };

const AEROPORTOS: Aeroporto[] = [
  { iata: "GRU", nome: "Guarulhos - Gov. André Franco Montoro", cidade: "Guarulhos/São Paulo", uf: "SP", obs: "maior do Brasil; principal hub de carga internacional" },
  { iata: "CGH", nome: "Congonhas", cidade: "São Paulo", uf: "SP", obs: "voos domésticos" },
  { iata: "VCP", nome: "Viracopos", cidade: "Campinas", uf: "SP", obs: "um dos maiores hubs de carga do país" },
  { iata: "GIG", nome: "Galeão - Antônio Carlos Jobim", cidade: "Rio de Janeiro", uf: "RJ", obs: "internacional" },
  { iata: "SDU", nome: "Santos Dumont", cidade: "Rio de Janeiro", uf: "RJ", obs: "doméstico, centro do Rio" },
  { iata: "BSB", nome: "Presidente Juscelino Kubitschek", cidade: "Brasília", uf: "DF", obs: "hub central" },
  { iata: "CNF", nome: "Confins - Tancredo Neves", cidade: "Belo Horizonte", uf: "MG" },
  { iata: "POA", nome: "Salgado Filho", cidade: "Porto Alegre", uf: "RS" },
  { iata: "CWB", nome: "Afonso Pena", cidade: "Curitiba", uf: "PR" },
  { iata: "FLN", nome: "Hercílio Luz", cidade: "Florianópolis", uf: "SC" },
  { iata: "NVT", nome: "Ministro Victor Konder", cidade: "Navegantes", uf: "SC", obs: "atende o Vale do Itajaí e o porto de Itajaí/Navegantes" },
  { iata: "JOI", nome: "Lauro Carneiro de Loyola", cidade: "Joinville", uf: "SC" },
  { iata: "XAP", nome: "Serafin Enoss Bertaso", cidade: "Chapecó", uf: "SC" },
  { iata: "IGU", nome: "Cataratas", cidade: "Foz do Iguaçu", uf: "PR" },
  { iata: "SSA", nome: "Deputado Luís Eduardo Magalhães", cidade: "Salvador", uf: "BA" },
  { iata: "REC", nome: "Guararapes - Gilberto Freyre", cidade: "Recife", uf: "PE", obs: "hub do Nordeste" },
  { iata: "FOR", nome: "Pinto Martins", cidade: "Fortaleza", uf: "CE" },
  { iata: "MCZ", nome: "Zumbi dos Palmares", cidade: "Maceió", uf: "AL" },
  { iata: "NAT", nome: "Gov. Aluízio Alves", cidade: "Natal", uf: "RN" },
  { iata: "BEL", nome: "Val de Cans", cidade: "Belém", uf: "PA" },
  { iata: "MAO", nome: "Eduardo Gomes", cidade: "Manaus", uf: "AM", obs: "importante hub de carga (Zona Franca)" },
  { iata: "VIX", nome: "Eurico de Aguiar Salles", cidade: "Vitória", uf: "ES" },
  { iata: "GYN", nome: "Santa Genoveva", cidade: "Goiânia", uf: "GO" },
  { iata: "CGB", nome: "Marechal Rondon", cidade: "Cuiabá", uf: "MT" },
  { iata: "CGR", nome: "Campo Grande", cidade: "Campo Grande", uf: "MS" },
  { iata: "SLZ", nome: "Marechal Cunha Machado", cidade: "São Luís", uf: "MA" },
  { iata: "THE", nome: "Senador Petrônio Portella", cidade: "Teresina", uf: "PI" },
  { iata: "JPA", nome: "Castro Pinto", cidade: "João Pessoa", uf: "PB" },
  { iata: "AJU", nome: "Santa Maria", cidade: "Aracaju", uf: "SE" },
  { iata: "PMW", nome: "Palmas", cidade: "Palmas", uf: "TO" },
];

export function consultarAeroportos(busca?: string): Record<string, unknown> {
  const q = String(busca ?? "").trim().toLowerCase();
  if (!q) {
    return { total: AEROPORTOS.length, aeroportos: AEROPORTOS };
  }
  const achados = AEROPORTOS.filter((a) =>
    a.iata.toLowerCase() === q ||
    a.cidade.toLowerCase().includes(q) ||
    a.uf.toLowerCase() === q ||
    a.nome.toLowerCase().includes(q),
  );
  return { total: achados.length, aeroportos: achados, fonte: "base de referência ELO" };
}

// ===================== ROTAS (OpenRouteService) =====================

// Cache de coordenadas [lon, lat] das cidades mais usadas pela ELO.
// Evita a chamada de geocoding (economiza ~1-2 idas ao servidor por rota).
const COORDS_CACHE: Record<string, [number, number]> = {
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
  "itajai sc": [-48.66194, -26.90778],
};

// Normaliza o nome para a chave do cache: remove UF, acentos, pontuação.
function chaveCache(local: string): string {
  return String(local)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[,/-].*$/, "")           // corta tudo após vírgula/barra/traço (ex.: "Itajaí, SC" -> "itajai")
    .replace(/\s*\(.*\)\s*/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

// fetch com timeout para não pendurar a requisição.
async function fetchComTimeout(url: string, opts: RequestInit = {}, ms = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function geocodar(local: string, apiKey: string): Promise<[number, number] | null> {
  // 1) tenta o cache (instantâneo, sem rede)
  const cacheado = COORDS_CACHE[chaveCache(local)];
  if (cacheado) return cacheado;
  // 2) senão, geocoding via ORS (com timeout)
  try {
    const r = await fetchComTimeout(
      `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}` +
        `&text=${encodeURIComponent(local)}&boundary.country=BR&size=1`,
      { cache: "no-store" },
    );
    const d = (await r.json()) as { features?: Array<{ geometry: { coordinates: [number, number] } }> };
    const c = d.features?.[0]?.geometry?.coordinates;
    return c ? [c[0], c[1]] : null;
  } catch {
    return null;
  }
}

export async function calcularRota(origem: string, destino: string): Promise<Record<string, unknown>> {
  // Limpa um eventual prefixo "NOME = " que pode vir na variável de ambiente.
  const apiKey = (process.env.ELO_ORS_API_KEY || "").replace(/^\s*ELO_ORS_API_KEY\s*=\s*/, "").trim();
  if (!apiKey) return { erro: "Rotas indisponíveis (chave de geolocalização não configurada)." };
  if (!origem?.trim() || !destino?.trim()) return { erro: "Informe origem e destino." };

  const [o, d] = await Promise.all([geocodar(origem, apiKey), geocodar(destino, apiKey)]);
  if (!o) return { erro: `Origem "${origem}" não localizada.` };
  if (!d) return { erro: `Destino "${destino}" não localizado.` };

  const fmtTempo = (horas: number) =>
    `${Math.floor(horas)}h${String(Math.round((horas % 1) * 60)).padStart(2, "0")}`;

  try {
    // driving-car é bem mais rápido no ORS que driving-hgv; para distância/tempo
    // estimado a diferença é pequena. Aplicamos um fator ao tempo p/ simular caminhão.
    const r = await fetchComTimeout("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [o, d] }),
    }, 5000);
    const data = (await r.json()) as { routes?: Array<{ summary: { distance: number; duration: number } }> };
    const resumo = data.routes?.[0]?.summary;
    if (resumo) {
      const km = resumo.distance / 1000;
      const horas = (resumo.duration / 3600) * 1.15; // caminhão ~15% mais lento que carro
      return {
        origem, destino,
        distancia_km: Math.round(km),
        tempo_estimado: fmtTempo(horas),
        modal: "caminhão (estimativa)",
        fonte: "OpenRouteService",
        observacao: "Tempo estimado para caminhão, sem considerar trânsito em tempo real nem paradas.",
      };
    }
  } catch {
    // cai para o fallback abaixo
  }

  // Fallback: estimativa por distância em linha reta (Haversine) × fator de
  // estrada, quando o ORS está lento/indisponível. Melhor que falhar.
  const [lon1, lat1] = o, [lon2, lat2] = d;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const retaKm = 2 * R * Math.asin(Math.sqrt(a));
  const kmEstrada = retaKm * 1.3;        // estradas ~30% maiores que a linha reta
  const horas = kmEstrada / 65;          // ~65 km/h média de caminhão em estrada
  return {
    origem, destino,
    distancia_km: Math.round(kmEstrada),
    tempo_estimado: fmtTempo(horas),
    modal: "caminhão (estimativa aproximada)",
    fonte: "estimativa (serviço de rotas indisponível no momento)",
    observacao: "Distância e tempo aproximados por cálculo direto; confirme em um roteirizador para precisão.",
  };
}
