// Inteligência comercial da ELO — portada fielmente dos agentes Python
// (sales_intelligence_agent/perfil_elo.py, scoring.py, diagnostico.py, dossie.py).
//
// Lógica 100% determinística: nunca inventa dados. Critério sem evidência vira
// pendência com nota zero. É exposta ao LLM do chat como "ferramentas".

// ===================== Perfil da ELO (perfil_elo.py) =====================

export const EMPRESA = {
  nome: "ELO Soluções Logísticas Integradas",
  cidade: "Itajaí/SC",
  site: "https://eloarmazenagem.com.br",
  posicionamento: "soluções logísticas integradas e personalizadas",
};

export const SERVICOS = {
  armazenagem: { nome: "Armazenagem" },
  transporte_rodoviario: { nome: "Transporte rodoviário" },
};

export const ICP = {
  segmentos_prioritarios: [
    "importação e exportação", "indústria", "varejo e e-commerce",
    "distribuição e atacado", "bens de consumo",
  ],
  regioes_prioritarias: [
    "Itajaí/SC", "Navegantes/SC", "Vale do Itajaí", "Grande Florianópolis",
    "Santa Catarina", "Paraná", "Rio Grande do Sul",
  ],
};

// Pesos do score (somam 100).
export const PESOS_SCORE: Record<string, number> = {
  aderencia_icp: 30,
  potencial_servicos_elo: 30,
  regiao_rotas: 15,
  relacionamento_anterior: 10,
  atividade_logistica: 5,
  sinal_recente: 10,
};

const ROTULOS: Record<string, string> = {
  aderencia_icp: "Aderência ao cliente ideal",
  atividade_logistica: "Atividade logística/comércio exterior",
  potencial_servicos_elo: "Potencial para armazenagem e transporte",
  regiao_rotas: "Região e rotas atendidas",
  relacionamento_anterior: "Relacionamento anterior",
  sinal_recente: "Sinal recente de oportunidade",
};

// ===================== Score (scoring.py) =====================

export type Evidencia = {
  nota?: number; // 0..1
  justificativa?: string;
  fonte?: string;
  servicos?: string[];
};
export type Evidencias = Record<string, Evidencia>;

export type CriterioResultado = {
  criterio: string;
  peso: number;
  nota: number;
  pontos: number;
  justificativa: string;
  fonte: string;
};

export type ResultadoScore = {
  empresa: string;
  score: number;
  prioridade: string;
  servicos_recomendados: string[];
  criterios: CriterioResultado[];
  pendencias: string[];
};

function prioridade(score: number): string {
  if (score >= 70) return "Alta";
  if (score >= 45) return "Média";
  return "Baixa";
}

function servicosRecomendados(evidencias: Evidencias): string[] {
  const rec: string[] = [];
  const potencial = evidencias["potencial_servicos_elo"] ?? {};
  const marcadores = new Set((potencial.servicos ?? []).map((s) => String(s).toLowerCase()));
  if (marcadores.has("armazenagem")) rec.push("Armazenagem");
  if (marcadores.has("transporte") || marcadores.has("transporte_rodoviario")) rec.push("Transporte rodoviário");
  if (marcadores.has("armazenagem") && (marcadores.has("transporte") || marcadores.has("transporte_rodoviario"))) {
    rec.push("Solução integrada (armazenagem + transporte)");
  }
  return rec;
}

export function calcularScore(empresa: string, evidencias: Evidencias): ResultadoScore {
  if (!String(empresa).trim()) throw new Error("Informe o nome da empresa avaliada.");

  const pendencias: string[] = [];
  const criterios: CriterioResultado[] = [];
  let total = 0;

  for (const [chave, peso] of Object.entries(PESOS_SCORE)) {
    const dado = evidencias[chave];
    if (!dado || dado.nota === undefined || dado.nota === null) {
      pendencias.push(ROTULOS[chave]);
      criterios.push({
        criterio: ROTULOS[chave], peso, nota: 0, pontos: 0,
        justificativa: "sem evidência informada", fonte: "não informado",
      });
      continue;
    }
    const nota = Number(dado.nota);
    if (Number.isNaN(nota) || nota < 0 || nota > 1) {
      throw new Error("A nota de cada critério deve ficar entre 0 e 1.");
    }
    total += peso * nota;
    criterios.push({
      criterio: ROTULOS[chave], peso, nota: Math.round(nota * 100) / 100,
      pontos: Math.round(peso * nota * 10) / 10,
      justificativa: (dado.justificativa ?? "").trim() || "sem evidência informada",
      fonte: (dado.fonte ?? "não informado").trim() || "não informado",
    });
  }

  const score = Math.round(total);
  return {
    empresa: String(empresa).trim(),
    score,
    prioridade: prioridade(score),
    servicos_recomendados: servicosRecomendados(evidencias),
    criterios,
    pendencias,
  };
}

// ===================== Diagnóstico (diagnostico.py) =====================

export const ROTEIRO_DIAGNOSTICO = [
  { chave: "produto", pergunta: "O que a empresa movimenta (tipo de produto/carga)?" },
  { chave: "volume_medio", pergunta: "Qual o volume médio mensal (pallets, toneladas ou contêineres)?" },
  { chave: "volume_pico", pergunta: "Qual o volume de pico e quando ocorre?" },
  { chave: "origem", pergunta: "Qual a origem predominante da carga?" },
  { chave: "destino", pergunta: "Qual o destino predominante?" },
  { chave: "frequencia", pergunta: "Qual a frequência de embarques por semana?" },
  { chave: "precisa_armazenagem", pergunta: "Há necessidade de armazenagem? (sim/não)" },
  { chave: "precisa_transporte", pergunta: "Há necessidade de transporte rodoviário? (sim/não)" },
  { chave: "importacao", pergunta: "A operação envolve importação ou exportação? (sim/não)" },
  { chave: "sla", pergunta: "Existe janela de entrega ou SLA exigido?" },
  { chave: "fornecedor_atual", pergunta: "Já possui operador logístico? Qual a principal dor com ele?" },
  { chave: "decisor", pergunta: "Quem decide a contratação?" },
  { chave: "prazo_inicio", pergunta: "Quando a solução precisa começar?" },
];

const SIM = new Set(["sim", "s", "true", "verdadeiro", "yes", "y", "1"]);
const ehSim = (v: unknown) => SIM.has(String(v ?? "").trim().toLowerCase());

export type Diagnostico = {
  servicos_recomendados: string[];
  respostas: Record<string, unknown>;
  pendencias: string[];
  evidencias: Evidencias;
};

export function analisarDiagnostico(respostas: Record<string, unknown>): Diagnostico {
  if (typeof respostas !== "object" || respostas === null) {
    throw new Error("As respostas do diagnóstico devem ser um objeto.");
  }

  const pendencias = ROTEIRO_DIAGNOSTICO
    .filter((item) => !String(respostas[item.chave] ?? "").trim())
    .map((item) => item.pergunta);

  const servicos: string[] = [];
  const marcadores: string[] = [];
  if (ehSim(respostas["precisa_armazenagem"])) { servicos.push(SERVICOS.armazenagem.nome); marcadores.push("armazenagem"); }
  if (ehSim(respostas["precisa_transporte"])) { servicos.push(SERVICOS.transporte_rodoviario.nome); marcadores.push("transporte"); }
  if (marcadores.length === 2) servicos.push("Solução integrada (armazenagem + transporte)");

  const evidencias: Evidencias = {};
  if (marcadores.length) {
    evidencias["potencial_servicos_elo"] = {
      nota: marcadores.length === 2 ? 1.0 : 0.6,
      justificativa: "Necessidade declarada: " + marcadores.join(", "),
      fonte: "diagnóstico guiado",
      servicos: marcadores,
    };
  }

  const temFrequencia = Boolean(String(respostas["frequencia"] ?? "").trim());
  const temVolume = Boolean(String(respostas["volume_medio"] ?? "").trim());
  if (ehSim(respostas["importacao"])) {
    evidencias["atividade_logistica"] = {
      nota: 1.0, justificativa: "Opera importação/exportação, com atividade logística recorrente.",
      fonte: "diagnóstico guiado",
    };
  } else if (temFrequencia || temVolume) {
    evidencias["atividade_logistica"] = {
      nota: 0.8, justificativa: "Atividade logística recorrente (volume/frequência declarados).",
      fonte: "diagnóstico guiado",
    };
  }

  const origem = String(respostas["origem"] ?? "").toLowerCase();
  const destino = String(respostas["destino"] ?? "").toLowerCase();
  const regioes = ["sc", "santa catarina", "itaja", "navegantes", "parana", "paraná", "sul", "rio grande"];
  if (regioes.some((r) => origem.includes(r) || destino.includes(r))) {
    evidencias["regiao_rotas"] = {
      nota: 0.8, justificativa: "Origem/destino na área de atuação da ELO.", fonte: "diagnóstico guiado",
    };
  }

  return { servicos_recomendados: servicos, respostas: { ...respostas }, pendencias, evidencias };
}

// ===================== Dossiê (dossie.py) =====================

export type DadosRelacionamento = {
  total_mensagens?: number;
  houve_resposta_cliente?: boolean;
  estagio?: string;
};

export function proximaMelhorAcao(
  rel: DadosRelacionamento | undefined, prioridadeStr: string, servicos: string[],
): string {
  if (!rel || !rel.total_mensagens) {
    return "Primeira abordagem: enviar apresentação institucional e qualificar necessidade.";
  }
  if (rel.estagio === "Prospect contatado sem resposta") {
    return "Enviar follow-up contextual retomando o último assunto.";
  }
  if (rel.estagio === "Relacionamento esfriado (reativar)") {
    return "Reativar: contato de reaproximação e oferta de diagnóstico gratuito.";
  }
  if (prioridadeStr === "Alta" && servicos.length) {
    return "Agendar reunião de diagnóstico e preparar cotação.";
  }
  return "Registrar próxima ação e manter cadência de follow-up.";
}

export type Dossie = {
  empresa: string;
  data: string;
  score: ResultadoScore;
  diagnostico: Partial<Diagnostico>;
  relacionamento: DadosRelacionamento;
  servicos_recomendados: string[];
  proxima_melhor_acao: string;
  observacao: string;
};

export function montarDossie(
  empresa: string,
  opts: {
    respostas_diagnostico?: Record<string, unknown>;
    relacionamento?: DadosRelacionamento;
    evidencias_extras?: Evidencias;
  } = {},
): Dossie {
  if (!String(empresa).trim()) throw new Error("Informe o nome da empresa.");

  let evidencias: Evidencias = {};
  let diagnosticoResumo: Partial<Diagnostico> = {};
  let servicos: string[] = [];

  if (opts.respostas_diagnostico) {
    const diag = analisarDiagnostico(opts.respostas_diagnostico);
    diagnosticoResumo = diag;
    servicos = diag.servicos_recomendados;
    evidencias = { ...evidencias, ...diag.evidencias };
  }

  const rel = opts.relacionamento;
  if (rel && rel.total_mensagens) {
    evidencias["relacionamento_anterior"] = {
      nota: rel.houve_resposta_cliente ? 0.9 : 0.6,
      justificativa: `Estágio: ${rel.estagio ?? "não informado"}.`,
      fonte: "Outlook (conta do usuário)",
    };
  }

  if (opts.evidencias_extras) evidencias = { ...evidencias, ...opts.evidencias_extras };

  const resultado = calcularScore(empresa, evidencias);
  if (servicos.length && !resultado.servicos_recomendados.length) {
    resultado.servicos_recomendados = servicos;
  }

  return {
    empresa: empresa.trim(),
    data: new Date().toISOString().slice(0, 10),
    score: resultado,
    diagnostico: diagnosticoResumo,
    relacionamento: rel ?? {},
    servicos_recomendados: resultado.servicos_recomendados.length ? resultado.servicos_recomendados : servicos,
    proxima_melhor_acao: proximaMelhorAcao(rel, resultado.prioridade, servicos),
    observacao: "Dados sem fonte confirmada devem ser validados antes do uso comercial.",
  };
}

// ===================== Relacionamento (relacionamento.py) =====================
// Classifica o estágio do relacionamento a partir do histórico de interações.

export type Interacao = {
  canal: string;
  direcao: string; // 'enviado' | 'recebido' (recebido = iniciativa/resposta do cliente)
  assunto?: string | null;
  data_interacao: string; // AAAA-MM-DD
  responsavel_nome?: string | null;
};

export type Relacionamento = {
  empresa: string;
  estagio: string;
  total_interacoes: number;
  ultimo_contato: string | null;
  dias_sem_contato: number | null;
  houve_resposta_cliente: boolean;
  responsaveis: string[];
  assuntos_recentes: string[];
};

export function classificarRelacionamento(
  empresa: string,
  interacoes: Interacao[],
): Relacionamento {
  const total = interacoes.length;
  const datas = interacoes
    .map((i) => new Date(i.data_interacao))
    .filter((d) => !Number.isNaN(d.getTime()));
  const ultimo = datas.length ? new Date(Math.max(...datas.map((d) => d.getTime()))) : null;
  const dias = ultimo ? Math.max(0, Math.floor((Date.now() - ultimo.getTime()) / 86_400_000)) : null;
  const houveResposta = interacoes.some((i) => i.direcao === "recebido");

  const responsaveis = Array.from(
    new Set(interacoes.map((i) => (i.responsavel_nome ?? "").trim()).filter(Boolean)),
  ).sort();
  const assuntos: string[] = [];
  for (const i of interacoes) {
    const a = (i.assunto ?? "").trim();
    if (a && !assuntos.includes(a)) assuntos.push(a);
  }

  // Mesma classificação do relacionamento.py.
  let estagio: string;
  if (total === 0) estagio = "Empresa nunca abordada por esta conta";
  else if (!houveResposta) estagio = "Prospect contatado sem resposta";
  else if (dias !== null && dias > 120) estagio = "Relacionamento esfriado (reativar)";
  else estagio = "Relacionamento ativo";

  return {
    empresa,
    estagio,
    total_interacoes: total,
    ultimo_contato: ultimo ? ultimo.toISOString().slice(0, 10) : null,
    dias_sem_contato: dias,
    houve_resposta_cliente: houveResposta,
    responsaveis,
    assuntos_recentes: assuntos.slice(0, 5),
  };
}
