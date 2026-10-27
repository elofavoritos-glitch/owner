#!/usr/bin/env node
// Smoke test da integração REST com a Plataforma Senior X (Senior Cloud / ERP).
//
// Uso:
//   SENIOR_ACCESS_KEY=... SENIOR_SECRET=... SENIOR_TENANT=suaempresa.com.br \
//     node scripts/testar-senior.mjs
//
// Opcionais:
//   SENIOR_API_BASE_URL  (default https://api.senior.com.br)
//   SENIOR_AUTH_PATH     (default /platform/authentication/actions/loginWithKey)
//
// O que faz: só AUTENTICA (loginWithKey) e informa se o token veio. Não escreve
// nada e NUNCA imprime o segredo nem o token completo (só um prefixo mascarado).
//
// Observação honesta: o path exato do loginWithKey pode variar por tenant. Se
// der 404, ajuste SENIOR_AUTH_PATH conforme a documentação/ambiente de vocês.

import https from "node:https";

const BASE = (process.env.SENIOR_API_BASE_URL || "https://api.senior.com.br").replace(/\/+$/, "");
const AUTH_PATH = process.env.SENIOR_AUTH_PATH || "/platform/authentication/actions/loginWithKey";
const ACCESS_KEY = (process.env.SENIOR_ACCESS_KEY || "").trim();
const SECRET = (process.env.SENIOR_SECRET || "").trim();
const TENANT = (process.env.SENIOR_TENANT || "").trim();

if (!ACCESS_KEY || !SECRET || !TENANT) {
  console.error("Defina SENIOR_ACCESS_KEY, SENIOR_SECRET e SENIOR_TENANT antes de rodar.");
  process.exit(1);
}

function call(method, url, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        timeout: 20000,
        headers: {
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
          resolve({ status: res.statusCode, json, raw: d });
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, raw: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, raw: "timeout" }); });
    if (payload) req.write(payload);
    req.end();
  });
}

function mascarar(token) {
  if (!token) return "(vazio)";
  const s = String(token);
  return s.length <= 8 ? "****" : `${s.slice(0, 4)}…${s.slice(-4)} (len ${s.length})`;
}

(async () => {
  console.log("== Smoke test Senior X (autenticação) ==");
  console.log(`base: ${BASE}`);
  console.log(`auth: ${AUTH_PATH}`);
  console.log(`tenant: ${TENANT}`);

  const r = await call("POST", `${BASE}${AUTH_PATH}`, { access_key: ACCESS_KEY, secret: SECRET });
  const ok = r.status >= 200 && r.status < 300;
  const token = r.json ? (r.json.access_token || r.json.token || r.json.jwt || "") : "";

  console.log(`\n${ok && token ? "✅" : "❌"} loginWithKey  [HTTP ${r.status}]`);

  if (ok && token) {
    console.log(`   token recebido: ${mascarar(token)}`);
    if (r.json.expires_in || r.json.expiresIn) {
      console.log(`   validade (s): ${r.json.expires_in || r.json.expiresIn}`);
    }
    console.log("\nAutenticação OK. Próximo passo: chamar um endpoint de leitura do ERP.");
    process.exit(0);
  }

  // Diagnóstico amigável por status.
  if (r.status === 400 || r.status === 401) console.log("   → credenciais inválidas (access key/secret/tenant).");
  else if (r.status === 403) console.log("   → chave sem permissão para autenticar.");
  else if (r.status === 404) console.log("   → endpoint não encontrado; ajuste SENIOR_AUTH_PATH conforme a doc do tenant.");
  else if (r.status >= 500) console.log("   → instabilidade na plataforma Senior X.");
  else if (r.status === 0) console.log("   → falha de rede/timeout.");
  console.log("\nResposta (recorte):");
  console.log(JSON.stringify(r.json ?? r.raw, null, 2).slice(0, 700));
  process.exit(1);
})();
