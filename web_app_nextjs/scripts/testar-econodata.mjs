#!/usr/bin/env node
// Teste rápido da integração REST da Econodata (API v4).
// Uso:  ELO_ECONODATA_API_KEY=ek_live_... node scripts/testar-econodata.mjs
//
// Roda um smoke test: saldo -> consulta de 1 empresa -> contagem de mercado.
// Não escreve nada e usa recortes pequenos para gastar o mínimo de tokens.

import https from "node:https";

const API = "https://api.econodata.com.br/v4";
const KEY = (process.env.ELO_ECONODATA_API_KEY || "").trim();

if (!KEY) {
  console.error("Defina ELO_ECONODATA_API_KEY (ek_live_...) antes de rodar.");
  process.exit(1);
}

function call(method, path, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const u = new URL(API + path);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          let json = null;
          try { json = d ? JSON.parse(d) : null; } catch { /* mantém cru */ }
          resolve({ status: res.statusCode, json, raw: d, tokens: res.headers["x-tokens-charged"] });
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, raw: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, raw: "timeout" }); });
    if (payload) req.write(payload);
    req.end();
  });
}

function linha(titulo, r) {
  const ok = r.status >= 200 && r.status < 300;
  console.log(`\n${ok ? "✅" : "❌"} ${titulo}  [HTTP ${r.status}${r.tokens ? `, tokens: ${r.tokens}` : ""}]`);
  console.log(JSON.stringify(r.json ?? r.raw, null, 2).slice(0, 700));
  return ok;
}

(async () => {
  console.log("== Smoke test Econodata API v4 ==");

  const saldo = await call("GET", "/account/balance");
  if (!linha("Saldo da conta", saldo)) {
    if (saldo.status === 401) console.log("   → chave inválida/ausente.");
    if (saldo.status === 403) console.log("   → conta sem API v4 liberada (ou trial).");
    process.exit(1);
  }

  // Consulta 1 empresa (Magazine Luiza) — cadastro enxuto.
  const empresa = await call("POST", "/companies/search", {
    criterios: { cnpj: "47.960.950/0001-21" },
    campos: ["cadastro.razaoSocial", "cadastro.uf", "perfilNegocio.porte"],
  });
  linha("Consulta de empresa (Magazine Luiza)", empresa);

  // Dimensiona um mercado (contagem barata).
  const mercado = await call("POST", "/companies/calc_list", {
    filtros: { uf: ["SC"], situacao: ["ATIVA"] },
  });
  linha("Dimensionar mercado (SC, ativas)", mercado);

  console.log("\nSmoke test concluído.");
})();
