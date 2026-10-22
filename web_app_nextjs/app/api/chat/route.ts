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
  montarDossie, analisarDiagnostico, calcularScore, classificarRelacionamento,
  type Evidencias, type Interacao,
} from "@/lib/elo-intelligence";
import { escaparBusca, validarData, texto } from "@/lib/seguranca";
import { gerarPropostaPDF, type ItemProposta } from "@/lib/proposta-pdf";
import { consultarClima, consultarAeroportos, calcularRota, consultarComex } from "@/lib/servicos-externos";
import {
  econodataConsultarEmpresa, econodataMatch, econodataDimensionarMercado,
  econodataProspectar, econodataDecisores, econodataSaldo, econodataEstimarCusto,
  type FiltrosProspeccao,
} from "@/lib/econodata";
import { traduzir } from "@/lib/traducao";
import { qualificarLead, type EmpresaEconodata } from "@/lib/qualificacao-lead";
import { gerarApresentacaoPPTX, type SlideInput } from "@/lib/apresentacao-pptx";

export const dynamic = "force-dynamic";
// Algumas ferramentas chamam APIs externas (Econodata) e depois o modelo ainda
// redige a resposta — o conjunto pode passar de 60s. 120s dá folga (a Vercel
// limita ao teto do plano se for menor, sem quebrar).
export const maxDuration = 120;

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
// Modelo configurável; default disponível no free/developer tier da Groq e com
// suporte a function-calling (os llama-3.x versatile viraram Enterprise).
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

type ChatMsg = { role: "user" | "assistant"; content: string };

const CANAIS_VALIDOS = ["email", "ligacao", "reuniao", "whatsapp", "evento", "outro"];
const DIRECOES_VALIDAS = ["enviado", "recebido"];

// Remove o "lixo" que o LLM costuma mandar em campos opcionais (null, strings
// vazias, arrays/objetos vazios), para não montar filtros inválidos na Econodata.
function limparFiltros(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (Array.isArray(v)) {
      const arr = v.filter((x) => x != null && !(typeof x === "string" && !x.trim()));
      if (arr.length) out[k] = arr;
      continue;
    }
    if (typeof v === "object") {
      const limpo = limparFiltros(v as Record<string, unknown>);
      if (Object.keys(limpo).length) out[k] = limpo;
      continue;
    }
    out[k] = v;
  }
  return out;
}

// Executa uma ferramenta chamada pelo modelo. Retorna texto (JSON) do resultado.
// Recebe o usuário logado para gravações (nunca confia no LLM para o responsável).
async function executarTool(
  nome: string,
  input: Record<string, unknown>,
  user: { id: string; email?: string },
): Promise<string> {
  try {
    if (nome === "registrar_interacao") {
      const empresa = String(input.empresa ?? "").trim();
      if (!empresa) return JSON.stringify({ erro: "Informe a empresa para registrar a interação." });
      const canal = CANAIS_VALIDOS.includes(String(input.canal)) ? String(input.canal) : "outro";
      const direcao = DIRECOES_VALIDAS.includes(String(input.direcao)) ? String(input.direcao) : "enviado";
      const supabase = supabaseServer();
      const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
      const registro = {
        empresa,
        responsavel_id: user.id,
        responsavel_nome: perfil?.nome || user.email || null,
        canal,
        direcao,
        assunto: texto(input.assunto, 200),
        data_interacao: validarData(input.data_interacao) || new Date().toISOString().slice(0, 10),
        observacao: texto(input.observacao, 2000),
      };
      const { data, error } = await supabase.from("interacoes").insert(registro).select().single();
      if (error) return JSON.stringify({ erro: error.message });
      return JSON.stringify({ ok: true, registrado: data });
    }
    if (nome === "gerar_proposta") {
      const clienteNome = String(input.cliente ?? "").trim();
      if (!clienteNome) return JSON.stringify({ erro: "Informe o cliente." });
      const itensRaw = Array.isArray(input.itens) ? input.itens : [];
      const itens: ItemProposta[] = itensRaw
        .map((i) => {
          const o = i as Record<string, unknown>;
          const descricao = texto(o.descricao, 120);
          if (!descricao) return null;
          const q = Number(o.quantidade);
          const v = Number(o.valor_unitario);
          return {
            descricao,
            quantidade: Number.isFinite(q) && q > 0 ? q : 1,
            valor_unitario: Number.isFinite(v) && v >= 0 ? v : undefined,
          } as ItemProposta;
        })
        .filter((i): i is ItemProposta => i !== null);
      if (!itens.length) return JSON.stringify({ erro: "Informe ao menos um item com descrição." });

      const supabase = supabaseServer();
      // localiza o cliente pelo nome (precisa existir no cadastro)
      const { data: cli } = await supabase
        .from("clientes").select("id,empresa,cnpj,contato")
        .ilike("empresa", `%${escaparBusca(clienteNome)}%`).limit(1).maybeSingle();
      if (!cli) return JSON.stringify({ erro: `Cliente "${clienteNome}" não encontrado no cadastro. Cadastre-o primeiro.` });

      const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
      const responsavel = perfil?.nome || user.email || null;
      try {
        const pdf = await gerarPropostaPDF({
          cliente: cli.empresa, cnpj: cli.cnpj, contato: cli.contato, responsavel, itens,
          condicoes: texto(input.condicoes, 1000), validade_dias: Number(input.validade_dias) || 15,
        });
        const nome = `proposta-${cli.empresa.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.pdf`;
        const caminho = `${cli.id}/${crypto.randomUUID()}-${nome}`;
        const { error: upErr } = await supabase.storage.from("documentos")
          .upload(caminho, pdf, { contentType: "application/pdf", upsert: false });
        if (upErr) return JSON.stringify({ erro: "Falha ao salvar o PDF." });
        const { data: doc, error } = await supabase.from("documentos").insert({
          cliente_id: cli.id, empresa: cli.empresa, tipo: "proposta", nome_arquivo: nome,
          caminho, tamanho_bytes: pdf.length, mime: "application/pdf",
          responsavel_id: user.id, responsavel_nome: responsavel,
        }).select("id").single();
        if (error) { await supabase.storage.from("documentos").remove([caminho]); return JSON.stringify({ erro: "Falha ao registrar a proposta." }); }
        return JSON.stringify({
          ok: true, cliente: cli.empresa, itens: itens.length,
          link_download: `/api/documentos/download?id=${doc.id}`,
          aviso: "PDF gerado e salvo nos documentos do cliente. Informe o link ao usuário.",
        });
      } catch (e) {
        return JSON.stringify({ erro: e instanceof Error ? e.message : "Falha ao gerar o PDF." });
      }
    }
    if (nome === "gerar_apresentacao") {
      const clienteNome = String(input.cliente ?? "").trim();
      if (!clienteNome) return JSON.stringify({ erro: "Informe o cliente." });
      const slidesRaw = Array.isArray(input.slides) ? input.slides : [];
      const slides: SlideInput[] = slidesRaw
        .map((s) => {
          const o = s as Record<string, unknown>;
          const titulo = texto(o.titulo, 120);
          if (!titulo) return null;
          const bulletsRaw = Array.isArray(o.bullets) ? o.bullets : [];
          const bullets = bulletsRaw
            .map((b) => texto(b, 240))
            .filter((b): b is string => !!b)
            .slice(0, 12);
          return {
            titulo,
            subtitulo: texto(o.subtitulo, 160) || undefined,
            bullets,
            capa: o.capa === true,
          } as SlideInput;
        })
        .filter((s): s is SlideInput => s !== null)
        .slice(0, 30);
      if (!slides.length) return JSON.stringify({ erro: "Informe ao menos um slide com título." });

      const supabase = supabaseServer();
      const { data: cli } = await supabase
        .from("clientes").select("id,empresa")
        .ilike("empresa", `%${escaparBusca(clienteNome)}%`).limit(1).maybeSingle();
      if (!cli) return JSON.stringify({ erro: `Cliente "${clienteNome}" não encontrado no cadastro. Cadastre-o primeiro.` });

      const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
      const responsavel = perfil?.nome || user.email || null;
      try {
        const pptx = gerarApresentacaoPPTX(slides);
        const nomeArq = `apresentacao-${cli.empresa.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.pptx`;
        const caminho = `${cli.id}/${crypto.randomUUID()}-${nomeArq}`;
        const mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        const { error: upErr } = await supabase.storage.from("documentos")
          .upload(caminho, pptx, { contentType: mime, upsert: false });
        if (upErr) return JSON.stringify({ erro: "Falha ao salvar a apresentação." });
        const { data: doc, error } = await supabase.from("documentos").insert({
          cliente_id: cli.id, empresa: cli.empresa, tipo: "outro", nome_arquivo: nomeArq,
          caminho, tamanho_bytes: pptx.length, mime,
          responsavel_id: user.id, responsavel_nome: responsavel,
        }).select("id").single();
        if (error) { await supabase.storage.from("documentos").remove([caminho]); return JSON.stringify({ erro: "Falha ao registrar a apresentação." }); }
        return JSON.stringify({
          ok: true, cliente: cli.empresa, slides: slides.length,
          link_download: `/api/documentos/download?id=${doc.id}`,
          aviso: "Apresentação .pptx gerada e salva nos documentos do cliente. Informe o link ao usuário e lembre de revisar no PowerPoint antes de apresentar.",
        });
      } catch (e) {
        return JSON.stringify({ erro: e instanceof Error ? e.message : "Falha ao gerar a apresentação." });
      }
    }
    if (nome === "consultar_comex") {
      const periodos = Array.isArray(input.periodos) ? (input.periodos as number[]) : undefined;
      return JSON.stringify(await consultarComex(String(input.ncm ?? ""), periodos));
    }
    // ---------- Econodata (inteligência de empresas) ----------
    if (nome === "econodata_dimensionar_mercado") {
      return JSON.stringify(await econodataDimensionarMercado(limparFiltros(input) as FiltrosProspeccao));
    }
    if (nome === "econodata_prospectar") {
      const { tamanho, cursor, ...resto } = input as FiltrosProspeccao & { tamanho?: number; cursor?: unknown };
      const filtros = limparFiltros(resto) as FiltrosProspeccao;
      const cur = typeof cursor === "string" && cursor.trim() ? cursor : undefined;
      return JSON.stringify(await econodataProspectar(filtros, Number(tamanho) || 20, cur));
    }
    if (nome === "econodata_consultar_empresa") {
      const incluir = Array.isArray(input.incluir) ? (input.incluir as string[]) : undefined;
      return JSON.stringify(await econodataConsultarEmpresa(
        { cnpj: input.cnpj as string, site: input.site as string, email: input.email as string },
        incluir,
      ));
    }
    if (nome === "econodata_match") {
      return JSON.stringify(await econodataMatch({
        nome: input.nome as string, uf: input.uf as string, site: input.site as string,
        email: input.email as string, telefone: input.telefone as string, cnpj: input.cnpj as string,
      }));
    }
    if (nome === "econodata_decisores") {
      const papel = input.papel === "colaboradores" ? "colaboradores" : "decisores";
      return JSON.stringify(await econodataDecisores(String(input.cnpj ?? ""), papel, Number(input.tamanho) || 20));
    }
    if (nome === "econodata_saldo") {
      return JSON.stringify(await econodataSaldo());
    }
    if (nome === "econodata_estimar_custo") {
      const { cnpj, site, email, incluir, tamanho, ...resto } = input as FiltrosProspeccao & {
        cnpj?: string; site?: string; email?: string; incluir?: string[]; tamanho?: number;
      };
      const filtros = limparFiltros(resto) as FiltrosProspeccao;
      const temFiltro = Object.keys(filtros).length > 0;
      return JSON.stringify(await econodataEstimarCusto({
        cnpj: cnpj as string, site: site as string, email: email as string,
        incluir: Array.isArray(incluir) ? incluir : undefined,
        filtros: temFiltro ? (filtros as FiltrosProspeccao) : undefined,
        tamanho: tamanho != null ? Number(tamanho) : undefined,
      }));
    }
    // ---------- Tradução ----------
    if (nome === "traduzir") {
      return JSON.stringify(await traduzir(String(input.texto ?? ""), String(input.idioma_destino ?? "espanhol")));
    }
    // ---------- Cadastrar cliente a partir da Econodata ----------
    if (nome === "cadastrar_cliente_econodata") {
      const cnpjIn = String(input.cnpj ?? "").replace(/\D/g, "");
      if (cnpjIn.length !== 14) return JSON.stringify({ erro: "Informe um CNPJ válido (14 dígitos)." });
      const dados = await econodataConsultarEmpresa({ cnpj: cnpjIn }, ["cadastro", "perfilNegocio", "contatosBasicos"]);
      if (dados.erro) return JSON.stringify({ erro: `Não foi possível consultar a empresa na Econodata: ${dados.erro}` });
      const emp = (dados.empresa ?? {}) as EmpresaEconodata;
      const cad = emp.cadastro ?? {};
      const razao = cad.razaoSocial || cad.nomeFantasia;
      if (!razao) return JSON.stringify({ erro: "A Econodata não retornou a razão social; não é seguro cadastrar sem nome." });
      const tel = emp.contatosBasicos?.telefones?.[0]?.numero ?? null;
      const porte = emp.perfilNegocio?.porte ?? null;
      const supabase = supabaseServer();
      // evita duplicar: já existe cliente com esse CNPJ?
      const { data: existente } = await supabase.from("clientes").select("id,empresa").eq("cnpj", emp.cnpj ?? cnpjIn).limit(1).maybeSingle();
      if (existente) return JSON.stringify({ ok: true, ja_existia: true, cliente: existente.empresa, aviso: "Empresa já estava no cadastro." });
      const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
      const obsPartes = [porte ? `Porte: ${porte}` : null, texto(input.observacoes, 1500)].filter(Boolean);
      const registro = {
        empresa: texto(razao, 160),
        cnpj: texto(emp.cnpj ?? cnpjIn, 20),
        cidade: texto(cad.cidade, 80),
        uf: texto(cad.uf, 2),
        telefone: texto(tel, 30),
        segmento: texto(input.segmento ?? (cad.setores?.[0] ?? null), 80),
        observacoes: obsPartes.length ? obsPartes.join(" · ") : null,
        responsavel_id: user.id,
        responsavel_nome: perfil?.nome || user.email || null,
      };
      const { data, error } = await supabase.from("clientes").insert(registro).select("id,empresa").single();
      if (error) return JSON.stringify({ erro: error.message });
      return JSON.stringify({ ok: true, cadastrado: data, dados_preenchidos: { cnpj: registro.cnpj, cidade: registro.cidade, uf: registro.uf, telefone: registro.telefone, porte } });
    }
    // ---------- Briefing do dia ----------
    if (nome === "briefing_do_dia") {
      const supabase = supabaseServer();
      const hoje = new Date().toISOString().slice(0, 10);
      // oportunidades com proxima acao vencida ou para hoje (RLS limita ao usuário/gestor)
      const { data: ops, error: e1 } = await supabase
        .from("oportunidades")
        .select("cliente_nome,etapa,proxima_acao,data_proxima_acao,valor_potencial")
        .not("data_proxima_acao", "is", null)
        .lte("data_proxima_acao", hoje)
        .in("status", ["Ativa", "Em espera"])
        .order("data_proxima_acao", { ascending: true })
        .limit(30);
      if (e1) return JSON.stringify({ erro: e1.message });
      return JSON.stringify({
        data: hoje,
        acoes_pendentes: ops ?? [],
        total: ops?.length ?? 0,
        observacao: (ops?.length ?? 0) === 0
          ? "Sem próximas ações vencidas ou para hoje. Bom momento para prospectar novos leads."
          : "Próximas ações vencidas ou para hoje — priorize por data.",
      });
    }
    // ---------- Qualificar lead (Econodata × ICP) ----------
    if (nome === "qualificar_lead") {
      const cnpjIn = String(input.cnpj ?? "").replace(/\D/g, "");
      if (cnpjIn.length !== 14) return JSON.stringify({ erro: "Informe um CNPJ válido (14 dígitos)." });
      const dados = await econodataConsultarEmpresa({ cnpj: cnpjIn }, ["cadastro", "perfilNegocio"]);
      if (dados.erro) return JSON.stringify({ erro: `Não foi possível consultar a empresa na Econodata: ${dados.erro}` });
      const emp = (dados.empresa ?? {}) as EmpresaEconodata;
      try {
        const q = qualificarLead(emp);
        // Retorno enxuto: o cálculo já está pronto; o modelo só traduz em
        // linguagem simples (evita payload grande que atrasa a resposta).
        return JSON.stringify({
          empresa: q.resumo.razaoSocial,
          cnpj: q.resumo.cnpj,
          uf: q.resumo.uf,
          porte: q.resumo.porte,
          comercio_exterior: q.resumo.comComex,
          score: q.score.score,
          prioridade: q.score.prioridade,
          servicos_recomendados: q.score.servicos_recomendados,
          pendencias: q.score.pendencias,
        });
      } catch (e) {
        return JSON.stringify({ erro: e instanceof Error ? e.message : "Falha ao qualificar o lead." });
      }
    }
    if (nome === "consultar_clima") {
      return JSON.stringify(await consultarClima(String(input.cidade ?? ""), Number(input.dias) || 3));
    }
    if (nome === "consultar_aeroportos") {
      return JSON.stringify(consultarAeroportos(input.busca ? String(input.busca) : undefined));
    }
    if (nome === "calcular_rota") {
      return JSON.stringify(await calcularRota(String(input.origem ?? ""), String(input.destino ?? "")));
    }
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
    if (nome === "consultar_relacionamento") {
      const empresa = String(input.empresa ?? "").trim();
      if (!empresa) return JSON.stringify({ erro: "Informe a empresa." });
      const supabase = supabaseServer();
      const { data, error } = await supabase
        .from("interacoes")
        .select("canal,direcao,assunto,data_interacao,responsavel_nome")
        .ilike("empresa", `%${escaparBusca(empresa)}%`)
        .order("data_interacao", { ascending: false })
        .limit(200);
      if (error) return JSON.stringify({ erro: error.message });
      return JSON.stringify(classificarRelacionamento(empresa, (data ?? []) as Interacao[]));
    }
    if (nome === "consultar_oportunidades") {
      const supabase = supabaseServer();
      let q = supabase
        .from("oportunidades")
        .select("cliente_nome,responsavel_nome,servico,etapa,status,valor_potencial,probabilidade,proxima_acao,data_proxima_acao");
      if (input.filtro_cliente) q = q.ilike("cliente_nome", `%${escaparBusca(String(input.filtro_cliente))}%`);
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
          const out = await executarTool(tc.function.name, args, { id: user.id, email: user.email ?? undefined });
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
