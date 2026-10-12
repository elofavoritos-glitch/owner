// Configuração do agente comercial da ELO para o chat (Claude / Anthropic).
// System prompt baseado nas regras do agente de inteligência comercial
// (elo-inteligencia-comercial-logistica.md) + definição das ferramentas que
// expõem a inteligência determinística (lib/elo-intelligence.ts).
import type OpenAI from "openai";
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
7. Responde "já falamos com essa empresa? qual o estágio do relacionamento?" consultando o histórico de interações registrado (ligações, e-mails, reuniões).

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
- Use **consultar_relacionamento** para saber se a ELO já abordou uma empresa e em qual estágio está (nunca abordada, contatado sem resposta, esfriado, ativo). Útil antes de uma abordagem.
- Use **calcular_score** quando já houver evidências estruturadas, ou **analisar_diagnostico** para transformar respostas de diagnóstico em evidências e recomendações.
- Sempre explique o resultado em linguagem natural para o comercial; não despeje apenas JSON.

## Perfil de cliente ideal (ICP) da ELO
Segmentos: ${ICP.segmentos_prioritarios.join(", ")}.
Regiões: ${ICP.regioes_prioritarias.join(", ")}.

## Pesos do score (somam 100)
${Object.entries(PESOS_SCORE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Empresa: ${EMPRESA.nome} — ${EMPRESA.posicionamento} (${EMPRESA.cidade}).`;

export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "montar_dossie",
      description:
        "Monta o dossiê pré-reunião de uma empresa: consolida diagnóstico, score de oportunidade (0-100), serviços recomendados e a próxima melhor ação. Use quando o comercial quer avaliar/abordar uma empresa específica.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "analisar_diagnostico",
      description:
        "Transforma as respostas de um diagnóstico logístico em serviços recomendados, evidências para o score e pendências. Use para orientar quais perguntas ainda faltam.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "consultar_relacionamento",
      description:
        "Verifica o histórico de relacionamento da ELO com uma empresa (ligações, e-mails, reuniões registrados) e classifica o estágio: 'nunca abordada', 'contatado sem resposta', 'esfriado (reativar)' ou 'ativo'. Use antes de uma abordagem para saber se já houve contato e qual a próxima ação.",
      parameters: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Nome (ou parte do nome) da empresa a investigar." },
        },
        required: ["empresa"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_oportunidades",
      description:
        "Consulta o funil de oportunidades real da ELO no banco de dados (respeitando as permissões do usuário logado). Use para perguntas sobre clientes cadastrados, pipeline, valores potenciais, etapas e responsáveis.",
      parameters: {
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
  },
];
