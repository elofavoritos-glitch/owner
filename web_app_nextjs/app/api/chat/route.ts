// Rota do chat do assistente comercial da ELO.
// Orquestra a Groq (API compatível com OpenAI) com function-calling, expondo a
// inteligência determinística da ELO (dossiê, score, diagnóstico) e o funil.
//
// Sem GROQ_API_KEY, entra em MODO DEMONSTRAÇÃO: responde com a inteligência
// determinística (dossiê/score), sem conversa livre, para não quebrar o app.
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { SYSTEM_PROMPT, TOOLS } from "@/lib/elo-agent";
import {
  montarDossie, analisarDiagnostico, calcularScore, type Evidencias,
} from "@/lib/elo-intelligence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
// Modelo configurável; default disponível no free/developer tier da Groq e com
// suporte a function-calling (os llama-3.x versatile viraram Enterprise).
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

type ChatMsg = { role: "user" | "assistant"; content: string };

// Executa uma ferramenta chamada pelo modelo. Retorna texto (JSON) do resultado.
async function executarTool(nome: string, input: Record<string, unknown>): Promise<string> {
  try {
    if (nome === "montar_dossie") {
      const dossie = montarDossie(String(input.empresa ?? ""), {
        respostas_diagnostico: input.respostas_diagnostico as Record<string, unknown> | undefined,
        relacionamento: input.relacionamento as never,
      });
      return JSON.stringify(dossie);
    }
    if (nome === "analisar_diagnostico") {
      return JSON.stringify(analisarDiagnostico((input.respostas as Record<string, unknown>) ?? {}));
    }
    if (nome === "calcular_score") {
      return JSON.stringify(calcularScore(String(input.empresa ?? ""), (input.evidencias as Evidencias) ?? {}));
    }
    if (nome === "consultar_oportunidades") {
      const supabase = supabaseServer();
      let q = supabase
        .from("oportunidades")
        .select("cliente_nome,responsavel_nome,servico,etapa,status,valor_potencial,probabilidade,proxima_acao,data_proxima_acao");
      if (input.filtro_cliente) q = q.ilike("cliente_nome", `%${String(input.filtro_cliente)}%`);
      if (input.etapa) q = q.eq("etapa", String(input.etapa));
      const { data, error } = await q.limit(50);
      if (error) return JSON.stringify({ erro: error.message });
      return JSON.stringify({ total: data?.length ?? 0, oportunidades: data ?? [] });
    }
    return JSON.stringify({ erro: `Ferramenta desconhecida: ${nome}` });
  } catch (e) {
    return JSON.stringify({ erro: e instanceof Error ? e.message : String(e) });
  }
}

export async function POST(request: Request) {
  // Exige usuário autenticado.
  const supabase = supabaseServer();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { messages?: ChatMsg[] };
  const historico = Array.isArray(body.messages) ? body.messages : [];
  if (!historico.length) {
    return NextResponse.json({ erro: "Envie ao menos uma mensagem." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;

  // ---------- MODO DEMONSTRAÇÃO (sem chave) ----------
  if (!apiKey) {
    const ultima = historico[historico.length - 1]?.content ?? "";
    const empresa = ultima.replace(/[?.!]/g, "").trim().slice(0, 80) || "a empresa informada";
    const dossie = montarDossie(empresa, {});
    const texto =
      `**[Modo demonstração — sem GROQ_API_KEY configurada]**\n\n` +
      `A conversa livre fica disponível quando a chave da Groq for adicionada na Vercel. ` +
      `Por enquanto, segue o cálculo determinístico da inteligência da ELO para **${empresa}**:\n\n` +
      `- **Score:** ${dossie.score.score}/100 (prioridade ${dossie.score.prioridade})\n` +
      `- **Pendências para pontuar:** ${dossie.score.pendencias.join(", ") || "nenhuma"}\n` +
      `- **Próxima melhor ação:** ${dossie.proxima_melhor_acao}\n\n` +
      `Para avaliar de verdade, me passe o diagnóstico (produto, volume, origem/destino, ` +
      `se precisa de armazenagem/transporte, etc.).`;
    return NextResponse.json({ content: texto, demo: true });
  }

  // ---------- MODO COMPLETO (Groq com tools) ----------
  const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historico.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    // Loop de function-calling (até 5 rodadas de tools).
    for (let i = 0; i < 5; i++) {
      const resp = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 1500,
        messages,
        tools: TOOLS,
      });

      const choice = resp.choices[0];
      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length) {
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          if (tc.type !== "function") continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            args = {};
          }
          const out = await executarTool(tc.function.name, args);
          messages.push({ role: "tool", tool_call_id: tc.id, content: out });
        }
        continue;
      }

      // Resposta final em texto.
      const texto = (msg.content ?? "").trim();
      return NextResponse.json({ content: texto || "(sem resposta)" });
    }

    return NextResponse.json({ content: "Não consegui concluir a análise. Tente reformular a pergunta." });
  } catch (e) {
    // Extrai o máximo de detalhe do erro da Groq (APIError compatível OpenAI).
    let status: number | undefined;
    let detalhe = e instanceof Error ? e.message : String(e);
    if (e instanceof OpenAI.APIError) {
      status = e.status;
      detalhe = JSON.stringify(e.error ?? e.message);
    }

    let erro = "Falha ao falar com o assistente.";
    if (status === 401) erro = "GROQ_API_KEY inválida ou ausente.";
    else if (status === 403) erro = "Sem permissão na conta Groq.";
    else if (status === 404) erro = `Modelo '${MODEL}' indisponível. Ajuste GROQ_MODEL.`;
    else if (status === 429) erro = "Limite de requisições atingido na Groq. Tente em instantes.";
    else if (status && status >= 500) erro = "Instabilidade na API da Groq. Tente novamente.";

    console.error("Erro no chat:", status, detalhe);
    return NextResponse.json({ erro, status: status ?? null, detalhe }, { status: 500 });
  }
}
