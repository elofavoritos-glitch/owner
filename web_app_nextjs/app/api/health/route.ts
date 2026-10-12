// Healthcheck mínimo: confirma apenas se o app está configurado e consegue
// alcançar o Supabase. NÃO expõe segredos, prefixos de chave nem detalhes de
// ambiente (evita reconhecimento por terceiros).
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configurado = Boolean(url && anon);

  let supabaseOk = false;
  if (configurado) {
    try {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon! }, cache: "no-store" });
      supabaseOk = r.ok;
    } catch {
      supabaseOk = false;
    }
  }

  return NextResponse.json({ ok: configurado && supabaseOk, configurado, supabase: supabaseOk });
}
