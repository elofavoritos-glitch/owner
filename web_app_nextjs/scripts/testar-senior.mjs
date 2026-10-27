#!/usr/bin/env node
// Smoke test da integração REST com a Plataforma Senior X (Senior Cloud / ERP).
//
// Uso (usuário/senha — modo padrão deste ambiente):
//   SENIOR_USERNAME=... SENIOR_PASSWORD=... SENIOR_TENANT=suaempresa.com.br \
//     node scripts/testar-senior.mjs
//
// Alternativa (chave de aplicação):
//   SENIOR_ACCESS_KEY=... SENIOR_SECRET=... SENIOR_TENANT=... node scripts/testar-senior.mjs
//
// Opcionais:
//   SENIOR_API_BASE_URL  (default https://api.senior.com.br)
//   SENIOR_AUTH_PATH     (default depende do modo: .../login ou .../loginWithKey)
//
// O que faz: só AUTENTICA e informa se o token veio. Não escreve nada e NUNCA
// imprime a senha/segredo nem o token completo (só um prefixo mascarado).
//
// Observação honesta: o path exato pode variar por tenant. Se der 404, ajuste
// SENIOR_AUTH_PATH conforme a documentação/ambiente de vocês.

import https from "node:https";

const BASE = (process.env.SENIOR_API_BASE_URL || "https://api.senior.com.br").replace(/\/+$/, "");
const TENANT = (process.env.SENIOR_TENANT || "").trim();
const USERNAME = (process.env.SENIOR_USERNAME || "").trim();
const PASSWORD = (process.env.SENIOR_PASSWORD || "").trim();
const ACCESS_KEY = (process.env.SENIOR_ACCESS_KEY || "").trim();
const SECRET = (process.env.SENIOR_SECRET || "").trim();
const CLIENT_ID = (process.env.SENIOR_CLIENT_ID || "").trim();

// Detecta o modo: usuário/senha tem prioridade; senão chave/segredo.
let MODE, PAYLOAD, DEFAULT_PATH;
if (USERNAME && PASSWORD) {
  MODE = "password";
  PAYLOAD = { username: USERNAME, password: PASSWORD };
  DEFAULT_PATH = "/platform/authentication/actions/login";
} else if (ACCESS_KEY && SECRET) {
  MODE = "key";
  PAYLOAD = { access_key: ACCESS_KEY, secret: SECRET };
  DEFAULT_PATH = "/platform/authentication/actions/loginWithKey";
}

if (!TENANT || !MODE) {
  console.error(
    "Defina SENIOR_TENANT e um par de credenciais:\n" +
      "  SENIOR_USERNAME + SENIOR_PASSWORD (usuário/senha), ou\n" +
      "  SENIOR_ACCESS_KEY + SENIOR_SECRET (chave de aplicação).",
  );
  process.exit(1);
}

const AUTH_PATH = process.env.SENIOR_AUTH_PATH || DEFAULT_PATH;

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
          ...(CLIENT_ID ? { client_id: CLIENT_ID } : {}),
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
  console.log(`modo: ${MODE === "password" ? "usuário/senha (login)" : "chave/segredo (loginWithKey)"}`);
  console.log(`client_id: ${CLIENT_ID ? "informado" : "⚠️  AUSENTE (o gateway Sensedia costuma exigir SENIOR_CLIENT_ID)"}`);

  const r = await call("POST", `${BASE}${AUTH_PATH}`, PAYLOAD);
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
  const corpoErro = JSON.stringify(r.json ?? r.raw ?? "");
  if (/client_id/i.test(corpoErro)) {
    console.log("   → o GATEWAY barrou por falta de client_id válido. Defina SENIOR_CLIENT_ID");
    console.log("     (obtido ao criar um aplicativo no portal do desenvolvedor dev.senior.com.br).");
  } else if (r.status === 400 || r.status === 401) {
    console.log("   → credenciais inválidas (usuário/senha ou chave/segredo, e tenant).");
  }
  else if (r.status === 403) console.log("   → chave sem permissão para autenticar.");
  else if (r.status === 404) console.log("   → endpoint não encontrado; ajuste SENIOR_AUTH_PATH conforme a doc do tenant.");
  else if (r.status >= 500) console.log("   → instabilidade na plataforma Senior X.");
  else if (r.status === 0) console.log("   → falha de rede/timeout.");
  console.log("\nResposta (recorte):");
  console.log(JSON.stringify(r.json ?? r.raw, null, 2).slice(0, 700));
  process.exit(1);
})();
