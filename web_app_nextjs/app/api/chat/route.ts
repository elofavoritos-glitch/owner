// Rota do chat do assistente comercial da ELO.
// Orquestra o Claude (Anthropic) com function-calling, expondo a inteligência
// determinística da ELO (dossiê, score, diagnóstico) e o funil do Supabase.
//
// Sem ANTHROPIC_API_KEY, entra em MODO DEMONSTRAÇÃO: responde com a inteligência
// determinística (dossiê/score), sem conversa livre, para não quebrar o app.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { SYSTEM_PROMPT, TOOLS } from "@/lib/elo-agent";
import {
  montarDossie, analisarDiagnostico, calcularScore,
  type Evidencias,
} from "@/lib/elo-intelligence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-3-5-sonnet-latest";

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

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ---------- MODO DEMONSTRAÇÃO (sem chave) ----------
  if (!apiKey) {
    const ultima = historico[historico.length - 1]?.content ?? "";
    const empresa = ultima.replace(/[?.!]/g, "").trim().slice(0, 80) || "a empresa informada";
    const dossie = montarDossie(empresa, {});
    const texto =
      `**[Modo demonstração — sem ANTHROPIC_API_KEY configurada]**\n\n` +
      `A conversa livre fica disponível quando a chave do Claude for adicionada na Vercel. ` +
      `Por enquanto, segue o cálculo determinístico da inteligência da ELO para **${empresa}**:\n\n` +
      `- **Score:** ${dossie.score.score}/100 (prioridade ${dossie.score.prioridade})\n` +
      `- **Pendências para pontuar:** ${dossie.score.pendencias.join(", ") || "nenhuma"}\n` +
      `- **Próxima melhor ação:** ${dossie.proxima_melhor_acao}\n\n` +
      `Para avaliar de verdade, me passe o diagnóstico (produto, volume, origem/destino, ` +
      `se precisa de armazenagem/transporte, etc.).`;
    return NextResponse.json({ content: texto, demo: true });
  }

  // ---------- MODO COMPLETO (Claude com tools) ----------
  const anthropic = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = historico.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Loop de function-calling (até 5 rodadas de tools).
    for (let i = 0; i < 5; i++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      if (resp.stop_reason === "tool_use") {
        const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        messages.push({ role: "assistant", content: resp.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const out = await executarTool(tu.name, tu.input as Record<string, unknown>);
          results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      // Resposta final em texto.
      const texto = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return NextResponse.json({ content: texto || "(sem resposta)" });
    }

    return NextResponse.json({ content: "Não consegui concluir a análise. Tente reformular a pergunta." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Erro no chat:", msg);
    return NextResponse.json(
      { erro: "Falha ao falar com o assistente. Verifique a ANTHROPIC_API_KEY.", detalhe: msg },
      { status: 500 },
    );
  }
}
