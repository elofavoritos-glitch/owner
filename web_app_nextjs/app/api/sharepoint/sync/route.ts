// Sincroniza os procedimentos comerciais do SharePoint (via Microsoft Graph) e
// grava o texto extraído na base de conhecimento (tabela conhecimento_comercial),
// que o assistente carrega no SYSTEM_PROMPT. Restrito a gestor/admin.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { listarArquivos, baixarArquivo, extrairTexto } from "@/lib/sharepoint";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = supabaseServer();
  // auth
  let user = null;
  try { const { data } = await supabase.auth.getUser(); user = data.user; } catch { user = null; }
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  // só gestor/admin podem sincronizar
  const { data: perfil } = await supabase.from("perfis").select("papel,nome").eq("id", user.id).maybeSingle();
  if (!perfil || !["gestor", "admin"].includes(perfil.papel)) {
    return NextResponse.json({ erro: "Apenas gestor ou admin podem sincronizar o SharePoint." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { pasta?: string };
  const pasta = typeof body.pasta === "string" ? body.pasta : "COMERCIAL/PROCEDIMENTOS COMERCIAIS";

  const lista = await listarArquivos(pasta);
  if (!lista.ok) return NextResponse.json({ erro: lista.erro }, { status: 502 });

  const extraidos: { nome: string; caracteres: number }[] = [];
  const ignorados: { nome: string; motivo: string }[] = [];
  const partes: string[] = [];

  for (const arq of lista.arquivos) {
    if (arq.pasta) { ignorados.push({ nome: arq.nome, motivo: "é uma subpasta (sincronize separadamente)" }); continue; }
    if (arq.tamanho > 5_000_000) { ignorados.push({ nome: arq.nome, motivo: "arquivo muito grande (>5MB)" }); continue; }
    const dl = await baixarArquivo(arq.driveId, arq.id);
    if (!dl.ok) { ignorados.push({ nome: arq.nome, motivo: dl.erro }); continue; }
    const { texto, aviso } = await extrairTexto(arq.nome, dl.bytes);
    if (!texto || !texto.trim()) { ignorados.push({ nome: arq.nome, motivo: aviso || "sem texto extraível" }); continue; }
    const limpo = texto.trim().slice(0, 20000); // limita por documento
    partes.push(`### ${arq.nome}\n\n${limpo}`);
    extraidos.push({ nome: arq.nome, caracteres: limpo.length });
  }

  const conteudo = partes.join("\n\n---\n\n").slice(0, 60000); // teto total

  if (extraidos.length) {
    // upsert numa linha única de conhecimento (id fixo 'procedimentos-comerciais')
    const { error } = await supabase.from("conhecimento_comercial").upsert({
      id: "procedimentos-comerciais",
      fonte: `SharePoint: ${pasta}`,
      conteudo,
      arquivos: extraidos.map((e) => e.nome),
      atualizado_por: perfil.nome || user.email || null,
      atualizado_em: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ erro: `Falha ao gravar o conhecimento: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    site: lista.site,
    pasta,
    extraidos,
    ignorados,
    total_caracteres: conteudo.length,
    aviso: ignorados.length
      ? "Alguns arquivos não foram extraídos (ver 'ignorados'). PDFs e formatos Office antigos precisam ser convertidos para .docx/.txt/.md."
      : undefined,
  });
}

// GET: mostra o que está sincronizado atualmente.
export async function GET() {
  const supabase = supabaseServer();
  let user = null;
  try { const { data } = await supabase.auth.getUser(); user = data.user; } catch { user = null; }
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { data } = await supabase
    .from("conhecimento_comercial")
    .select("fonte,arquivos,atualizado_por,atualizado_em")
    .eq("id", "procedimentos-comerciais")
    .maybeSingle();
  return NextResponse.json({ sincronizado: data ?? null });
}
