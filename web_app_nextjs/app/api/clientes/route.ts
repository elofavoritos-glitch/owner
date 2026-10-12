// API de clientes (cadastro). Lista e cria, respeitando RLS.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = supabaseServer();
  try {
    const { data } = await supabase.auth.getUser();
    return { supabase, user: data.user };
  } catch {
    return { supabase, user: null };
  }
}

// GET /api/clientes?busca=texto  → lista (RLS aplicada)
export async function GET(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const busca = new URL(request.url).searchParams.get("busca")?.trim();
  let q = supabase
    .from("clientes")
    .select("id,empresa,cnpj,contato,email,telefone,segmento,cidade,uf,regiao,responsavel_nome,observacoes,criado_em")
    .order("empresa", { ascending: true })
    .limit(200);
  if (busca) q = q.or(`empresa.ilike.%${busca}%,cnpj.ilike.%${busca}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ clientes: data ?? [] });
}

// POST /api/clientes  → cria um cliente
export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const empresa = String(body.empresa ?? "").trim();
  if (!empresa) return NextResponse.json({ erro: "Informe o nome da empresa." }, { status: 400 });

  const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();

  const texto = (k: string) => (body[k] ? String(body[k]).trim() : null);
  const registro = {
    empresa,
    cnpj: texto("cnpj"),
    contato: texto("contato"),
    email: texto("email"),
    telefone: texto("telefone"),
    segmento: texto("segmento"),
    cidade: texto("cidade"),
    uf: texto("uf"),
    regiao: texto("regiao"),
    observacoes: texto("observacoes"),
    responsavel_id: user.id,
    responsavel_nome: perfil?.nome || user.email || null,
  };

  const { data, error } = await supabase.from("clientes").insert(registro).select().single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ cliente: data }, { status: 201 });
}
