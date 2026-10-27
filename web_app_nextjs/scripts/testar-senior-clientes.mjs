#!/usr/bin/env node
// Smoke test: exportar clientes do ERP via WS SOAP com_senior_g5_co_cad_clientes,
// autenticado com o token da Senior X.
//
// Uso:
//   SENIOR_USERNAME=intapi@elo.log.br SENIOR_PASSWORD=... SENIOR_TENANT=elo.log.br \
//   [SENIOR_SOAP_PATH=/g5-senior-services/...] [SENIOR_CLIENT_ID=...] \
//     node scripts/testar-senior-clientes.mjs
//
// Não imprime credenciais. Mostra só a contagem e os primeiros clientes (dados
// cadastrais básicos). O path SOAP pode variar por ambiente — ajuste se der 404.

import https from "node:https";

const BASE = (process.env.SENIOR_API_BASE_URL || "https://api.senior.com.br").replace(/\/+$/, "");
const AUTH_PATH = process.env.SENIOR_AUTH_PATH || "/platform/authentication/actions/login";
const TENANT = (process.env.SENIOR_TENANT || "").trim();
const USERNAME = (process.env.SENIOR_USERNAME || "").trim();
const PASSWORD = (process.env.SENIOR_PASSWORD || "").trim();
const CLIENT_ID = (process.env.SENIOR_CLIENT_ID || "").trim();
const SOAP_EXEC = (process.env.SENIOR_SOAP_EXEC || "sapiens").trim();
const SOAP_USER = (process.env.SENIOR_SOAP_USER || USERNAME.split("@")[0] || "").trim();
const SOAP_PATH = process.env.SENIOR_SOAP_PATH ||
  `/g5-senior-services/${SOAP_EXEC}_Synccom_senior_g5_co_cad_clientes`;

if (!TENANT || !USERNAME || !PASSWORD) {
  console.error("Defina SENIOR_USERNAME, SENIOR_PASSWORD e SENIOR_TENANT.");
  process.exit(1);
}

function call(url, { method = "POST", headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, timeout: 30000,
        headers: { ...headers, ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}) } },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ status: res.statusCode, raw: d })); },
    );
    req.on("error", (e) => resolve({ status: 0, raw: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, raw: "timeout" }); });
    if (body) req.write(body);
    req.end();
  });
}

function campo(xml, nome) {
  const m = new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`, "i").exec(xml);
  return m ? m[1].trim() : "";
}

(async () => {
  console.log("== Smoke test: exportar clientes (Senior ERP) ==");
  console.log(`soap: ${SOAP_PATH}`);

  // 1) autentica
  const auth = await call(`${BASE}${AUTH_PATH}`, {
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(CLIENT_ID ? { client_id: CLIENT_ID } : {}) },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  let token = "";
  try {
    let j = JSON.parse(auth.raw);
    if (typeof j.jsonToken === "string") j = JSON.parse(j.jsonToken);
    token = j.access_token || j.token || j.jwt || "";
  } catch { /* ignore */ }
  if (!token) { console.log(`❌ autenticação falhou [HTTP ${auth.status}]`); process.exit(1); }
  console.log(`✅ autenticado [HTTP ${auth.status}]`);

  // 2) chama o WS SOAP exportar clientes
  const envelope =
    `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a="http://services.senior.com.br">` +
    `<S:Body><a:run><exec>${SOAP_EXEC}</exec><user>${SOAP_USER}</user>` +
    `<key>com.senior.g5.co.cad.clientes@exportar</key><parent></parent><lot>0</lot>` +
    `<parameters>&lt;request&gt;&lt;/request&gt;</parameters></a:run></S:Body></S:Envelope>`;

  const r = await call(`${BASE}${SOAP_PATH}`, {
    headers: { Authorization: token, "Content-Type": "text/xml; charset=utf-8", Accept: "text/xml", SOAPAction: "run",
      ...(CLIENT_ID ? { client_id: CLIENT_ID } : {}) },
    body: envelope,
  });

  const ok = r.status >= 200 && r.status < 300;
  const fault = /<faultstring>([\s\S]*?)<\/faultstring>/i.exec(r.raw);
  console.log(`\n${ok && !fault ? "✅" : "❌"} exportar clientes [HTTP ${r.status}]`);
  if (fault) { console.log(`   faultstring: ${fault[1].trim()}`); }

  const blocos = r.raw.match(/<cliente[\s>][\s\S]*?<\/cliente>/gi) ?? [];
  console.log(`   clientes encontrados: ${blocos.length}`);
  blocos.slice(0, 5).forEach((b, i) => {
    console.log(`   [${i + 1}] cod=${campo(b, "codCli")} nome=${campo(b, "nomCli")} cnpj=${campo(b, "cgcCpf")} uf=${campo(b, "sigUfs")}`);
  });

  if (!ok || fault) { console.log("\nRecorte da resposta:\n" + r.raw.slice(0, 600)); process.exit(1); }
  process.exit(0);
})();
