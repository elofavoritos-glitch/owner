// Fonte única de verdade dos nomes das ferramentas do assistente.
//
// Objetivo: ligar, em tempo de compilação, o catálogo de tools (TOOLS em
// elo-agent.ts) ao despacho em app/api/chat/route.ts. Em vez de strings soltas
// espalhadas e sincronizadas à mão, ambos os lados referenciam esta lista.
// Um nome de tool escrito errado passa a ser erro de typecheck/teste, não um
// bug silencioso que só aparece como "Ferramenta desconhecida" em runtime.

export const TOOL_NAMES = [
  "montar_dossie",
  "analisar_diagnostico",
  "calcular_score",
  "registrar_interacao",
  "gerar_proposta",
  "gerar_apresentacao",
  "consultar_comex",
  "econodata_dimensionar_mercado",
  "econodata_prospectar",
  "econodata_consultar_empresa",
  "econodata_match",
  "econodata_decisores",
  "econodata_saldo",
  "econodata_estimar_custo",
  "traduzir",
  "cadastrar_cliente_econodata",
  "briefing_do_dia",
  "qualificar_lead",
  "consultar_clima",
  "consultar_aeroportos",
  "calcular_rota",
  "consultar_relacionamento",
  "consultar_oportunidades",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

const TOOL_NAME_SET = new Set<string>(TOOL_NAMES);

/** True se `nome` é uma ferramenta conhecida (narrowing para ToolName). */
export function isToolName(nome: string): nome is ToolName {
  return TOOL_NAME_SET.has(nome);
}
