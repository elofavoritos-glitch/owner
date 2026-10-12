// API de documentos dos clientes: lista, faz upload (Storage) e exclui.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { erroGenerico } from "@/lib/seguranca";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "documentos";
const TIPOS = ["planilha", "contrato", "cartao_cnpj", "danfe", "nfe", "nfse", "duimp", "outro"];
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

async function getUser() {
  const supabase = supabaseServer();
  try {
    const { data } = await supabase.auth.getUser();
    return { supabase, user: data.user };
  } catch {
    return { supabase, user: null };
  }
}

function sanitizar(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

// GET /api/documentos?cliente_id=...  → lista os documentos do cliente
export async function GET(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const clienteId = new URL(request.url).searchParams.get("cliente_id")?.trim();
  let q = supabase
    .from("documentos")
    .select("id,cliente_id,empresa,tipo,nome_arquivo,caminho,tamanho_bytes,mime,responsavel_nome,criado_em")
    .order("criado_em", { ascending: false })
    .limit(200);
  if (clienteId) q = q.eq("cliente_id", clienteId);

  const { data, error } = await q;
  if (error) {
    console.error("GET /api/documentos:", error.message);
    return NextResponse.json({ erro: erroGenerico("listar os documentos") }, { status: 500 });
  }
  return NextResponse.json({ documentos: data ?? [] });
}

// POST /api/documentos  (multipart/form-data: file, cliente_id, empresa, tipo)
export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });

  const file = form.get("file");
  const clienteId = String(form.get("cliente_id") ?? "").trim();
  const empresa = String(form.get("empresa") ?? "").trim();
  const tipo = TIPOS.includes(String(form.get("tipo"))) ? String(form.get("tipo")) : "outro";

  if (!(file instanceof File)) return NextResponse.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
  if (!clienteId || !empresa) return NextResponse.json({ erro: "Cliente não identificado." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ erro: "Arquivo acima de 15 MB." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ erro: "Arquivo vazio." }, { status: 400 });

  // Aceita apenas extensões de documentos/planilhas comuns.
  const EXT_OK = [".pdf", ".xml", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".txt"];
  const nomeLower = file.name.toLowerCase();
  if (!EXT_OK.some((e) => nomeLower.endsWith(e))) {
    return NextResponse.json({ erro: "Tipo de arquivo não permitido." }, { status: 400 });
  }

  // Confirma que o cliente existe e é visível ao usuário (RLS) antes de anexar.
  const { data: cli } = await supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle();
  if (!cli) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });

  const caminho = `${clienteId}/${crypto.randomUUID()}-${sanitizar(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return NextResponse.json({ erro: "Falha no upload: " + upErr.message }, { status: 500 });

  const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
  const { data, error } = await supabase
    .from("documentos")
    .insert({
      cliente_id: clienteId,
      empresa,
      tipo,
      nome_arquivo: file.name.slice(0, 160),
      caminho,
      tamanho_bytes: file.size,
      mime: file.type || null,
      responsavel_id: user.id,
      responsavel_nome: perfil?.nome || user.email || null,
    })
    .select()
    .single();

  if (error) {
    // rollback do arquivo se o metadado falhar
    await supabase.storage.from(BUCKET).remove([caminho]);
    console.error("POST /api/documentos:", error.message);
    return NextResponse.json({ erro: erroGenerico("anexar o documento") }, { status: 500 });
  }
  return NextResponse.json({ documento: data }, { status: 201 });
}

// DELETE /api/documentos?id=...  → remove metadado + arquivo
export async function DELETE(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ erro: "Informe o id." }, { status: 400 });

  const { data: doc } = await supabase.from("documentos").select("caminho").eq("id", id).maybeSingle();
  const { error } = await supabase.from("documentos").delete().eq("id", id);
  if (error) {
    console.error("DELETE /api/documentos:", error.message);
    return NextResponse.json({ erro: erroGenerico("excluir o documento") }, { status: 500 });
  }
  if (doc?.caminho) await supabase.storage.from(BUCKET).remove([doc.caminho]);
  return NextResponse.json({ ok: true });
}
