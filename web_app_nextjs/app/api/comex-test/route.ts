// ROTA TEMPORÁRIA DE DIAGNÓSTICO do Logcomex. Remover após validar.
// Retorna o status e o corpo cru da API para descobrir o erro real em produção.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = supabaseServer();
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ erro: "nao auth" }, { status: 401 });
  } catch {
    return NextResponse.json({ erro: "nao auth" }, { status: 401 });
  }

  const apiKey = (process.env.ELO_LOGCOMEX_API_KEY || "").replace(/^\s*ELO_LOGCOMEX_API_KEY\s*=\s*/, "").trim();
  const diag: Record<string, unknown> = {
    chave_presente: Boolean(apiKey),
    chave_tamanho: apiKey.length,
    chave_prefixo: apiKey ? apiKey.slice(0, 6) + "…" : null,
  };

  if (!apiKey) return NextResponse.json(diag);

  const body = JSON.stringify({
    filters: [
      { name: "period", value: [202402], valueLogicalOperator: "or", relationLogicalOperator: "and" },
      { name: "ncm", value: ["39031120"], valueLogicalOperator: "and", relationLogicalOperator: "and" },
    ],
    typeOfSearch: "ncm",
    scroller: { hash: "", size: 3, page: 1, sortBy: "", sortType: "" },
  });

  try {
    const https = await import("node:https");
    const resultado = await new Promise<{ status: number; texto: string }>((resolve, reject) => {
      const u = new URL("https://api-prd-ncm-intel.logcomex.io/details");
      const req = https.request(
        { hostname: u.hostname, path: u.pathname, method: "GET",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
          timeout: 15000 },
        (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ status: res.statusCode ?? 0, texto: d })); },
      );
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
      req.write(body);
      req.end();
    });
    diag.http_status = resultado.status;
    diag.resposta_cru = resultado.texto.slice(0, 800);
  } catch (e) {
    diag.erro_fetch = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(diag);
}
