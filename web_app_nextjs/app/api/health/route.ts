// Diagnóstico de produção: confirma presença das env vars e conectividade.
// NÃO expõe segredos — mostra apenas se as variáveis existem e um prefixo.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const diag: Record<string, unknown> = {
    NEXT_PUBLIC_SUPABASE_URL: {
      present: Boolean(url),
      value: url ? `${url.slice(0, 24)}…` : null,
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      present: Boolean(anon),
      prefix: anon ? `${anon.slice(0, 12)}…` : null,
    },
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV ?? null,
  };

  // Testa conectividade com o Supabase (sem segredos).
  if (url && anon) {
    try {
      const r = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: anon },
        cache: "no-store",
      });
      diag.supabase_reachable = r.ok;
      diag.supabase_status = r.status;
    } catch (e) {
      diag.supabase_reachable = false;
      diag.supabase_error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(diag);
}
