// Recebe clientes enviados pela regra LSP do Senior ERP (ver
// lib/senior-erp/ENVIO_CLIENTES.md). Não usa sessão de usuário: autentica pelo
// header x-elo-token, validado dentro da função senior_receber_clientes() no
// banco (security definer). O token nunca fica em env var nem no código.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decodificarCorpo, parseCorpo } from "@/lib/senior-erp/recebimento";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

// Ping simples para a regra testar a saída para a internet.
export async function GET() {
  return NextResponse.json({ ok: true, servico: "senior-clientes" });
}

export async function POST(request: Request) {
  const token = request.headers.get("x-elo-token")?.trim();
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ erro: "servidor sem configuração" }, { status: 500 });

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return NextResponse.json({ erro: "corpo vazio" }, { status: 400 });
  if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ erro: "lote acima de 4 MB" }, { status: 413 });

  let resultado;
  try {
    resultado = parseCorpo(decodificarCorpo(bytes, request.headers.get("content-type")));
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "corpo inválido" }, { status: 400 });
  }

  const { clientes, ignorados } = resultado;
  if (!clientes.length) {
    return NextResponse.json({ ok: true, gravados: 0, recebidos: 0, ignorados: ignorados.length });
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("senior_receber_clientes", {
    p_token: token,
    p_clientes: clientes,
  });

  if (error) {
    if (error.code === "28000") return NextResponse.json({ erro: "token inválido" }, { status: 401 });
    console.error("POST /api/senior/clientes:", error.code, error.message);
    return NextResponse.json({ erro: "falha ao gravar os clientes" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recebidos: clientes.length,
    gravados: typeof data === "number" ? data : 0,
    ignorados: ignorados.length,
    detalhes_ignorados: ignorados.slice(0, 20),
  });
}
