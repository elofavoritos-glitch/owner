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

async function geocodar(local: string, apiKey: string): Promise<[number, number] | null> {
  try {
    const r = await fetch(
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

  try {
    const r = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [o, d] }),
    });
    const data = (await r.json()) as {
      routes?: Array<{ summary: { distance: number; duration: number } }>;
      error?: { message?: string };
    };
    const resumo = data.routes?.[0]?.summary;
    if (!resumo) return { erro: "Rota não encontrada para o trajeto informado." };
    const km = resumo.distance / 1000;
    const horas = resumo.duration / 3600;
    return {
      origem, destino,
      distancia_km: Math.round(km),
      tempo_estimado: `${Math.floor(horas)}h${String(Math.round((horas % 1) * 60)).padStart(2, "0")}`,
      modal: "veículo pesado (caminhão)",
      fonte: "OpenRouteService",
      observacao: "Tempo estimado sem considerar trânsito em tempo real nem paradas.",
    };
  } catch {
    return { erro: "Falha ao calcular a rota." };
  }
}
