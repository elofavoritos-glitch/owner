// Gera o PDF de proposta, salva no Storage como documento do cliente e devolve
// o metadado. Reutiliza o motor lib/proposta-pdf e o bucket 'documentos'.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { gerarPropostaPDF, type ItemProposta } from "@/lib/proposta-pdf";
import { texto, erroGenerico } from "@/lib/seguranca";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "documentos";

export async function POST(request: Request) {
  const supabase = supabaseServer();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clienteId = String(body.cliente_id ?? "").trim();
  const clienteNome = texto(body.cliente, 160);
  if (!clienteId || !clienteNome) {
    return NextResponse.json({ erro: "Selecione o cliente." }, { status: 400 });
  }

  const itensRaw = Array.isArray(body.itens) ? body.itens : [];
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

  if (!itens.length) {
    return NextResponse.json({ erro: "Adicione ao menos um item à proposta." }, { status: 400 });
  }

  // Confirma que o cliente é visível ao usuário (RLS).
  const { data: cli } = await supabase.from("clientes").select("id,cnpj,contato").eq("id", clienteId).maybeSingle();
  if (!cli) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });

  const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
  const responsavel = perfil?.nome || user.email || null;

  let pdf: Uint8Array;
  try {
    pdf = await gerarPropostaPDF({
      cliente: clienteNome,
      cnpj: cli.cnpj,
      contato: cli.contato,
      responsavel,
      itens,
      condicoes: texto(body.condicoes, 1000),
      validade_dias: Number(body.validade_dias) || 15,
    });
  } catch (e) {
    console.error("gerarPropostaPDF:", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: erroGenerico("gerar a proposta") }, { status: 500 });
  }

  const nome = `proposta-${clienteNome.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const caminho = `${clienteId}/${crypto.randomUUID()}-${nome}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, pdf, { contentType: "application/pdf", upsert: false });
  if (upErr) {
    console.error("upload proposta:", upErr.message);
    return NextResponse.json({ erro: erroGenerico("salvar a proposta") }, { status: 500 });
  }

  const { data: doc, error } = await supabase
    .from("documentos")
    .insert({
      cliente_id: clienteId,
      empresa: clienteNome,
      tipo: "proposta",
      nome_arquivo: nome,
      caminho,
      tamanho_bytes: pdf.length,
      mime: "application/pdf",
      responsavel_id: user.id,
      responsavel_nome: responsavel,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    console.error("metadado proposta:", error.message);
    return NextResponse.json({ erro: erroGenerico("salvar a proposta") }, { status: 500 });
  }

  return NextResponse.json({ ok: true, documento_id: doc.id, nome }, { status: 201 });
}
