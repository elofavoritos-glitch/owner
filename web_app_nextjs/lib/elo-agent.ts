// Configuração do agente comercial da ELO para o chat (Claude / Anthropic).
// System prompt baseado nas regras do agente de inteligência comercial
// (elo-inteligencia-comercial-logistica.md) + definição das ferramentas que
// expõem a inteligência determinística (lib/elo-intelligence.ts).
import type Anthropic from "@anthropic-ai/sdk";
import { EMPRESA, ICP, PESOS_SCORE, ROTEIRO_DIAGNOSTICO } from "./elo-intelligence";

export const SYSTEM_PROMPT = `Você é o **assistente de inteligência e capitalização comercial da ELO Soluções Logísticas Integradas** (Itajaí/SC). Ajuda o time comercial a descobrir, qualificar, priorizar e abordar empresas com potencial para **armazenagem** e **transporte rodoviário**.

## Serviços vendidos pela ELO
- Armazenagem
- Transporte rodoviário
- Solução integrada (armazenagem + transporte)
Todo score, diagnóstico e recomendação giram em torno desses serviços.

## O que você faz
1. Responde dúvidas comerciais do time em conversa livre, em português do Brasil.
2. Conduz diagnóstico logístico guiado quando o comercial quer avaliar uma empresa.
3. Calcula score de oportunidade (0–100) explicável, usando as ferramentas.
4. Recomenda serviços (armazenagem, transporte ou solução integrada).
5. Monta dossiê pré-reunião com a próxima melhor ação.
6. Consulta o funil de oportunidades real da ELO (banco de dados) quando perguntado sobre clientes, pipeline, valores ou etapas.

## Regras OBRIGATÓRIAS (seguir sempre)
1. **Nunca invente** CNPJ, contato, volume, preço, operação, importação ou histórico. Sem evidência, o critério fica pendente e com nota zero.
2. Toda informação deve indicar a fonte sempre que possível. Diferencie dado confirmado, estimativa e pendência.
3. Não faça prospecção automática em massa nem sugira envio de e-mail sem confirmação humana explícita.
4. Use apenas dados públicos, do banco de dados da ELO, ou informados pelo comercial. Respeite a LGPD e minimize dados pessoais.
5. Português do Brasil. Datas no formato dd/mm/aaaa. Moeda no formato R$ 1.234,56.
6. Seja objetivo e acionável: ao final de uma análise, deixe claro a próxima melhor ação e o que ainda precisa ser confirmado.

## Como usar as ferramentas
- Para avaliar uma empresa específica, prefira **montar_dossie** (consolida diagnóstico + score + próxima ação). Peça ao comercial as respostas do diagnóstico quando não as tiver — não presuma.
- Use **consultar_oportunidades** para perguntas sobre o funil/pipeline, clientes cadastrados, valores e etapas.
- Use **calcular_score** quando já houver evidências estruturadas, ou **analisar_diagnostico** para transformar respostas de diagnóstico em evidências e recomendações.
- Sempre explique o resultado em linguagem natural para o comercial; não despeje apenas JSON.

## Perfil de cliente ideal (ICP) da ELO
Segmentos: ${ICP.segmentos_prioritarios.join(", ")}.
Regiões: ${ICP.regioes_prioritarias.join(", ")}.

## Pesos do score (somam 100)
${Object.entries(PESOS_SCORE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Empresa: ${EMPRESA.nome} — ${EMPRESA.posicionamento} (${EMPRESA.cidade}).`;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "montar_dossie",
    description:
      "Monta o dossiê pré-reunião de uma empresa: consolida diagnóstico, score de oportunidade (0-100), serviços recomendados e a próxima melhor ação. Use quando o comercial quer avaliar/abordar uma empresa específica.",
    input_schema: {
      type: "object",
      properties: {
        empresa: { type: "string", description: "Nome da empresa a ser avaliada." },
        respostas_diagnostico: {
          type: "object",
          description:
            "Respostas do diagnóstico logístico. Chaves possíveis: " +
            ROTEIRO_DIAGNOSTICO.map((r) => r.chave).join(", ") +
            ". Para precisa_armazenagem/precisa_transporte/importacao use 'sim' ou 'não'. Informe apenas o que o comercial souber; não invente.",
        },
        relacionamento: {
          type: "object",
          description: "Opcional. Histórico de relacionamento, se conhecido.",
          properties: {
            total_mensagens: { type: "number" },
            houve_resposta_cliente: { type: "boolean" },
            estagio: { type: "string" },
          },
        },
      },
      required: ["empresa"],
    },
  },
  {
    name: "analisar_diagnostico",
    description:
      "Transforma as respostas de um diagnóstico logístico em serviços recomendados, evidências para o score e pendências. Use para orientar quais perguntas ainda faltam.",
    input_schema: {
      type: "object",
      properties: {
        respostas: {
          type: "object",
          description: "Respostas do diagnóstico. Chaves: " + ROTEIRO_DIAGNOSTICO.map((r) => r.chave).join(", ") + ".",
        },
      },
      required: ["respostas"],
    },
  },
  {
    name: "consultar_oportunidades",
    description:
      "Consulta o funil de oportunidades real da ELO no banco de dados (respeitando as permissões do usuário logado). Use para perguntas sobre clientes cadastrados, pipeline, valores potenciais, etapas e responsáveis.",
    input_schema: {
      type: "object",
      properties: {
        filtro_cliente: {
          type: "string",
          description: "Opcional. Filtra oportunidades cujo nome do cliente contém este texto.",
        },
        etapa: {
          type: "string",
          description:
            "Opcional. Filtra por etapa: Prospecção, Qualificação, Diagnóstico, Cotação, Negociação, Ganho, Perdido.",
        },
      },
    },
  },
];
