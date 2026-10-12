// API de interações (histórico de relacionamento). Lista e cria registros,
// respeitando a RLS. O responsável é sempre o usuário logado.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { escaparBusca, validarData, texto, erroGenerico } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

const CANAIS = ["email", "ligacao", "reuniao", "whatsapp", "evento", "outro"];
const DIRECOES = ["enviado", "recebido"];

async function getUser() {
  const supabase = supabaseServer();
  try {
    const { data } = await supabase.auth.getUser();
    return { supabase, user: data.user };
  } catch {
    return { supabase, user: null };
  }
}

// GET /api/interacoes?empresa=texto  → lista as interações (RLS aplicada)
export async function GET(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const empresa = new URL(request.url).searchParams.get("empresa")?.trim();
  let q = supabase
    .from("interacoes")
    .select("id,empresa,canal,direcao,assunto,data_interacao,observacao,responsavel_nome")
    .order("data_interacao", { ascending: false })
    .limit(100);
  if (empresa) {
    const b = escaparBusca(empresa);
    if (b) q = q.ilike("empresa", `%${b}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("GET /api/interacoes:", error.message);
    return NextResponse.json({ erro: erroGenerico("listar as interações") }, { status: 500 });
  }
  return NextResponse.json({ interacoes: data ?? [] });
}

// POST /api/interacoes  → cria uma interação para o usuário logado
export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const empresa = texto(body.empresa, 160);
  if (!empresa) return NextResponse.json({ erro: "Informe a empresa." }, { status: 400 });

  const canal = String(body.canal ?? "email");
  const direcao = String(body.direcao ?? "enviado");
  if (!CANAIS.includes(canal)) return NextResponse.json({ erro: "Canal inválido." }, { status: 400 });
  if (!DIRECOES.includes(direcao)) return NextResponse.json({ erro: "Direção inválida." }, { status: 400 });

  // Nome do responsável: do perfil, com fallback para o e-mail.
  const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
  const responsavelNome = perfil?.nome || user.email || null;

  const registro = {
    empresa,
    responsavel_id: user.id,
    responsavel_nome: responsavelNome,
    canal,
    direcao,
    assunto: texto(body.assunto, 200),
    data_interacao: validarData(body.data_interacao) || new Date().toISOString().slice(0, 10),
    observacao: texto(body.observacao, 2000),
  };

  const { data, error } = await supabase.from("interacoes").insert(registro).select().single();
  if (error) {
    console.error("POST /api/interacoes:", error.message);
    return NextResponse.json({ erro: erroGenerico("registrar a interação") }, { status: 500 });
  }
  return NextResponse.json({ interacao: data }, { status: 201 });
}
