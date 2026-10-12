// API de clientes (cadastro). Lista e cria, respeitando RLS.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { escaparBusca, texto, erroGenerico } from "@/lib/seguranca";

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
  if (busca) {
    const b = escaparBusca(busca);
    if (b) q = q.or(`empresa.ilike.%${b}%,cnpj.ilike.%${b}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("GET /api/clientes:", error.message);
    return NextResponse.json({ erro: erroGenerico("listar os clientes") }, { status: 500 });
  }
  return NextResponse.json({ clientes: data ?? [] });
}

// POST /api/clientes  → cria um cliente
export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const empresa = texto(body.empresa, 160);
  if (!empresa) return NextResponse.json({ erro: "Informe o nome da empresa." }, { status: 400 });

  const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();

  const registro = {
    empresa,
    cnpj: texto(body.cnpj, 20),
    contato: texto(body.contato, 120),
    email: texto(body.email, 160),
    telefone: texto(body.telefone, 30),
    segmento: texto(body.segmento, 80),
    cidade: texto(body.cidade, 80),
    uf: texto(body.uf, 2),
    regiao: texto(body.regiao, 80),
    observacoes: texto(body.observacoes, 2000),
    responsavel_id: user.id,
    responsavel_nome: perfil?.nome || user.email || null,
  };

  const { data, error } = await supabase.from("clientes").insert(registro).select().single();
  if (error) {
    console.error("POST /api/clientes:", error.message);
    return NextResponse.json({ erro: erroGenerico("cadastrar o cliente") }, { status: 500 });
  }
  return NextResponse.json({ cliente: data }, { status: 201 });
}
