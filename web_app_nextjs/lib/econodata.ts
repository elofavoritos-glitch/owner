// ===================== ECONODATA — API v4 (dados de empresas BR) =====================
// Integração com a API v4 da Econodata (https://api.econodata.com.br/v4) para
// prospecção, enriquecimento e inteligência de empresas brasileiras — o público
// da ELO para armazenagem e transporte.
//
// Autenticação: Bearer ek_live_... na env ELO_ECONODATA_API_KEY.
// Cobrança: em tokens (header X-Tokens-Charged). Esta camada expõe o custo
// cobrado em cada chamada quando disponível, e deixa claro quando a fonte falha.
//
// Doc: https://econodata-tecnologia.github.io/api-v4-docs/
// Contrato OpenAPI v4.0; erros em RFC 7807 (application/problem+json).

const ECONODATA_BASE = "https://api.econodata.com.br/v4";

// Lê e limpa a chave (robustez contra prefixo colado por engano, como no Logcomex).
function getApiKey(): string {
  return (process.env.ELO_ECONODATA_API_KEY || "")
    .replace(/^\s*ELO_ECONODATA_API_KEY\s*=\s*/i, "")
    .trim();
}

type EconoResposta = { ok: true; dados: unknown; tokensCobrados: number | null }
  | { ok: false; erro: string; status?: number };

// Chamada HTTP genérica à API da Econodata. Trata auth, timeout e erros RFC 7807.
async function chamar(
  metodo: "GET" | "POST" | "DELETE",
  caminho: string,
  corpo?: unknown,
  timeoutMs = 20000,
  headersExtra?: Record<string, string>,
): Promise<EconoResposta> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, erro: "Consulta Econodata indisponível (chave ELO_ECONODATA_API_KEY não configurada)." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${ECONODATA_BASE}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(headersExtra ?? {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controller.signal,
    });

    const tokensCobrados = Number(resp.headers.get("X-Tokens-Charged"));
    const textoResp = await resp.text();
    let json: unknown = null;
    try { json = textoResp ? JSON.parse(textoResp) : null; } catch { /* mantém texto cru abaixo */ }

    if (!resp.ok) {
      // RFC 7807: { type, title, status, detail }
      const problema = (json as { detail?: string; title?: string }) || {};
      const detalhe = problema.detail || problema.title || textoResp.slice(0, 200);
      return { ok: false, status: resp.status, erro: traduzErro(resp.status, detalhe) };
    }

    return { ok: true, dados: json, tokensCobrados: Number.isFinite(tokensCobrados) ? tokensCobrados : null };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError"
      ? "tempo de resposta esgotado"
      : (e instanceof Error ? e.message : String(e));
    return { ok: false, erro: `Falha ao consultar a Econodata (${msg}).` };
  } finally {
    clearTimeout(timer);
  }
}

// Traduz os códigos HTTP da Econodata (RFC 7807) para mensagens claras ao comercial.
function traduzErro(status: number, detalhe: string): string {
  switch (status) {
    case 401: return "Chave da Econodata inválida ou ausente. Verifique ELO_ECONODATA_API_KEY.";
    case 402: return "Saldo de tokens da Econodata insuficiente para esta consulta.";
    case 403: return `Esta operação não está liberada na conta Econodata (possível chave trial). ${detalhe}`.trim();
    case 404: return "Empresa ou recurso não encontrado na Econodata.";
    case 422: return `Parâmetros inválidos para a Econodata: ${detalhe}`;
    case 429: return "Limite de requisições da Econodata atingido. Tente novamente em instantes.";
    case 503: return "Base da Econodata temporariamente indisponível. Tente novamente.";
    default: return `Falha na consulta Econodata (HTTP ${status}). ${detalhe}`.trim();
  }
}

// Buckets válidos para 'incluir'.
const BUCKETS_VALIDOS = new Set([
  "cadastro", "estrategico", "perfilNegocio", "contatosBasicos", "contatosAvancados",
]);
function sanitizarBuckets(incluir?: string[]): string[] | undefined {
  if (!Array.isArray(incluir)) return undefined;
  const limpos = incluir.map((b) => String(b).trim()).filter((b) => BUCKETS_VALIDOS.has(b));
  return limpos.length ? [...new Set(limpos)] : undefined;
}

// ---------- 1) Consultar/enriquecer UMA empresa ----------
// Por CNPJ, site ou e-mail. Sem 'incluir', volta só o CNPJ (cobra só a base).
export async function econodataConsultarEmpresa(
  criterios: { cnpj?: string; site?: string; email?: string },
  incluir?: string[],
): Promise<Record<string, unknown>> {
  const crit: Record<string, string> = {};
  if (criterios.cnpj) crit.cnpj = String(criterios.cnpj).trim();
  if (criterios.site) crit.site = String(criterios.site).trim();
  if (criterios.email) crit.email = String(criterios.email).trim();
  if (!Object.keys(crit).length) {
    return { erro: "Informe ao menos um identificador: CNPJ, site ou e-mail." };
  }
  const buckets = sanitizarBuckets(incluir) ?? ["cadastro", "perfilNegocio"];
  const r = await chamar("POST", "/companies/search", { criterios: crit, incluir: buckets });
  if (!r.ok) return { erro: r.erro };
  return { ...(r.dados as object), fonte: "Econodata API v4", tokens_cobrados: r.tokensCobrados };
}

// ---------- 2) Descobrir empresa por dados parciais (match) ----------
// Quando NÃO há CNPJ: nome + UF, ou site/e-mail/telefone. Top-5 por score.
export async function econodataMatch(
  criterios: { nome?: string; uf?: string; site?: string; email?: string; telefone?: string; cnpj?: string },
  incluir?: string[],
): Promise<Record<string, unknown>> {
  const crit: Record<string, string> = {};
  for (const k of ["nome", "uf", "site", "email", "telefone", "cnpj"] as const) {
    if (criterios[k]) crit[k] = String(criterios[k]).trim();
  }
  if (!Object.keys(crit).length) {
    return { erro: "Informe ao menos um critério (ex.: nome + UF)." };
  }
  const buckets = sanitizarBuckets(incluir) ?? ["cadastro"];
  const r = await chamar("POST", "/companies/match", { criterios: crit, incluir: buckets });
  if (!r.ok) return { erro: r.erro };
  return { ...(r.dados as object), fonte: "Econodata API v4", tokens_cobrados: r.tokensCobrados };
}

// Filtros aceitos pela segmentação (subconjunto prático para a ELO).
export type FiltrosProspeccao = {
  uf?: string[];
  cidade?: string[];
  situacao?: string[];            // ATIVA, BAIXADA, etc. (default ATIVA)
  porte?: string[];               // INDIVIDUAL, MICRO, PEQUENO, MEDIO, GRANDE
  setores?: string[];
  cnaePrimario?: string[];
  comTelefones?: boolean;
  comEmailsValidados?: boolean;
  palavrasChave?: { incluir?: string[]; excluir?: string[]; em?: string[] };
  funcionarios?: { de?: number; ate?: number };
  faturamento?: { de?: number; ate?: number };
};

// Monta o objeto de filtros, aplicando ATIVA como padrão (foco em empresas vivas).
function montarFiltros(f: FiltrosProspeccao): Record<string, unknown> {
  const filtros: Record<string, unknown> = {};
  if (f.uf?.length) filtros.uf = f.uf.map((u) => String(u).toUpperCase().trim());
  if (f.cidade?.length) filtros.cidade = f.cidade;
  filtros.situacao = f.situacao?.length ? f.situacao : ["ATIVA"];
  if (f.porte?.length) filtros.porte = f.porte;
  if (f.setores?.length) filtros.setores = f.setores;
  if (f.cnaePrimario?.length) filtros.cnaePrimario = f.cnaePrimario;
  if (f.comTelefones) filtros.comTelefones = true;
  if (f.comEmailsValidados) filtros.comEmailsValidados = true;
  if (f.palavrasChave?.incluir?.length || f.palavrasChave?.excluir?.length) {
    filtros.palavrasChave = {
      ...(f.palavrasChave.incluir?.length ? { incluir: f.palavrasChave.incluir } : {}),
      ...(f.palavrasChave.excluir?.length ? { excluir: f.palavrasChave.excluir } : {}),
      ...(f.palavrasChave.em?.length ? { em: f.palavrasChave.em } : {}),
    };
  }
  if (f.funcionarios && (f.funcionarios.de != null || f.funcionarios.ate != null)) filtros.funcionarios = f.funcionarios;
  if (f.faturamento && (f.faturamento.de != null || f.faturamento.ate != null)) filtros.faturamento = f.faturamento;
  return filtros;
}

// ---------- 3) Dimensionar mercado (contagem — barato, só a base) ----------
export async function econodataDimensionarMercado(
  filtros: FiltrosProspeccao,
): Promise<Record<string, unknown>> {
  const r = await chamar("POST", "/companies/calc_list", { filtros: montarFiltros(filtros) });
  if (!r.ok) return { erro: r.erro };
  const d = (r.dados as { totalRegistros?: number }) || {};
  return {
    total_empresas: d.totalRegistros ?? 0,
    filtros_aplicados: montarFiltros(filtros),
    fonte: "Econodata API v4 (calc_list)",
    observacao: "Contagem do recorte (TAM). Use para dimensionar antes de puxar a lista paga.",
  };
}

// ---------- 4) Prospectar empresas (lista paginada por filtros) ----------
export async function econodataProspectar(
  filtros: FiltrosProspeccao,
  tamanho = 20,
  cursor?: string,
): Promise<Record<string, unknown>> {
  const tam = Math.min(Math.max(Number(tamanho) || 20, 1), 100);
  const pagina: Record<string, unknown> = { tamanho: tam };
  if (cursor) pagina.cursor = cursor;
  const corpo = {
    filtros: montarFiltros(filtros),
    pagina,
    // campos enxutos para controlar custo e payload (o comercial pode pedir mais depois).
    campos: [
      "cadastro.razaoSocial", "cadastro.nomeFantasia", "cadastro.cidade", "cadastro.uf",
      "cadastro.situacao", "perfilNegocio.porte",
    ],
  };
  const r = await chamar("POST", "/companies/search_list", corpo);
  if (!r.ok) return { erro: r.erro };
  const d = (r.dados as { totalRegistros?: number; pagina?: { cursorProximo?: string | null }; resultados?: unknown[] }) || {};
  return {
    total_no_recorte: d.totalRegistros ?? 0,
    retornadas: d.resultados?.length ?? 0,
    empresas: d.resultados ?? [],
    cursor_proximo: d.pagina?.cursorProximo ?? null,
    tokens_cobrados: r.tokensCobrados,
    fonte: "Econodata API v4 (search_list)",
    observacao: "Lista de prospecção. Para a próxima página, reenvie os MESMOS filtros com o cursor_proximo.",
  };
}

// ---------- 5) Organograma: achar decisores de uma empresa ----------
export async function econodataDecisores(
  cnpj: string,
  papel: "decisores" | "colaboradores" = "decisores",
  tamanho = 20,
): Promise<Record<string, unknown>> {
  const cnpjLimpo = String(cnpj).replace(/\D/g, "");
  if (cnpjLimpo.length !== 14) return { erro: "Informe um CNPJ válido (14 dígitos)." };
  const tam = Math.min(Math.max(Number(tamanho) || 20, 1), 100);
  const papelValido = papel === "colaboradores" ? "colaboradores" : "decisores";
  const r = await chamar("GET", `/companies/${cnpjLimpo}/people?papel=${papelValido}&pagina=1&tamanho=${tam}`);
  if (!r.ok) return { erro: r.erro };
  const d = (r.dados as { total?: number; itens?: unknown[] }) || {};
  return {
    papel: papelValido,
    total: d.total ?? 0,
    pessoas: d.itens ?? [],
    tokens_cobrados: r.tokensCobrados,
    fonte: "Econodata API v4 (people)",
    observacao: "Dados pessoais — uso sob responsabilidade do controlador (LGPD). CPF de sócio vem mascarado.",
  };
}

// ---------- 6) Saldo de tokens da conta ----------
export async function econodataSaldo(): Promise<Record<string, unknown>> {
  const r = await chamar("GET", "/account/balance");
  if (!r.ok) return { erro: r.erro };
  const d = (r.dados as { saldoTokens?: number }) || {};
  return { saldo_tokens: d.saldoTokens ?? 0, fonte: "Econodata API v4" };
}

// ---------- 7) Estimar custo (dry-run, GRÁTIS) ----------
// Usa o header X-Estimate-Only: true — a API devolve { tokensEstimados } sem
// debitar nem entregar dado. Funciona MESMO com saldo zero, servindo para o
// time orçar o custo antes de recarregar/consumir tokens.
export async function econodataEstimarCusto(params: {
  // modo "empresa": orça uma consulta por CNPJ/site/e-mail
  cnpj?: string; site?: string; email?: string; incluir?: string[];
  // modo "mercado": orça prospecção/contagem por filtros
  filtros?: FiltrosProspeccao; tamanho?: number;
}): Promise<Record<string, unknown>> {
  const estimate = { "X-Estimate-Only": "true" };

  // Modo empresa: há identificador?
  const temIdent = params.cnpj || params.site || params.email;
  if (temIdent) {
    const crit: Record<string, string> = {};
    if (params.cnpj) crit.cnpj = String(params.cnpj).trim();
    if (params.site) crit.site = String(params.site).trim();
    if (params.email) crit.email = String(params.email).trim();
    const buckets = sanitizarBuckets(params.incluir) ?? ["cadastro", "perfilNegocio"];
    const r = await chamar("POST", "/companies/search", { criterios: crit, incluir: buckets }, 20000, estimate);
    if (!r.ok) return { erro: r.erro };
    const d = (r.dados as { tokensEstimados?: number }) || {};
    return {
      operacao: "consultar_empresa",
      tokens_estimados: d.tokensEstimados ?? 0,
      buckets,
      fonte: "Econodata API v4 (estimate-only, grátis)",
      observacao: "Custo estimado em tokens; nada foi debitado nem entregue.",
    };
  }

  // Modo mercado: usa os filtros. Se tamanho informado, estima a página
  // (search_list); senão estima a contagem (calc_list), que é mais barata.
  if (params.filtros) {
    const filtros = montarFiltros(params.filtros);
    if (params.tamanho) {
      const tam = Math.min(Math.max(Number(params.tamanho) || 20, 1), 100);
      const r = await chamar("POST", "/companies/search_list",
        { filtros, pagina: { tamanho: tam }, campos: ["cadastro.razaoSocial", "cadastro.uf", "perfilNegocio.porte"] },
        20000, estimate);
      if (!r.ok) return { erro: r.erro };
      const d = (r.dados as { tokensEstimados?: number }) || {};
      return {
        operacao: "prospectar",
        tamanho_pagina: tam,
        tokens_estimados: d.tokensEstimados ?? 0,
        filtros_aplicados: filtros,
        fonte: "Econodata API v4 (estimate-only, grátis)",
        observacao: "Custo estimado para UMA página com esse tamanho; nada foi debitado.",
      };
    }
    const r = await chamar("POST", "/companies/calc_list", { filtros }, 20000, estimate);
    if (!r.ok) return { erro: r.erro };
    const d = (r.dados as { tokensEstimados?: number }) || {};
    return {
      operacao: "dimensionar_mercado",
      tokens_estimados: d.tokensEstimados ?? 0,
      filtros_aplicados: filtros,
      fonte: "Econodata API v4 (estimate-only, grátis)",
      observacao: "Custo estimado da contagem do recorte; nada foi debitado.",
    };
  }

  return { erro: "Informe um identificador (CNPJ/site/e-mail) ou filtros de mercado para estimar o custo." };
}
