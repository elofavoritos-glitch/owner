#!/usr/bin/env node
// Sonda rotas candidatas para o WS SOAP de clientes no Senior X cloud.
// Autentica UMA vez e reutiliza o token em todas as tentativas (não martela login).
// Imprime só status + um recorte curto da resposta (sem credenciais).
import https from "node:https";

const BASE = "https://api.senior.com.br";
const TENANT = (process.env.SENIOR_TENANT || "").trim();
const USER = (process.env.SENIOR_USERNAME || "").trim();
const PASS = (process.env.SENIOR_PASSWORD || "").trim();
const SOAP_USER = USER.split("@")[0] || USER;

function call(url, { method = "POST", headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, timeout: 25000,
        headers: { ...headers, ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}) } },
      (res) => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>resolve({status:res.statusCode, raw:d})); });
    req.on("error", e => resolve({ status:0, raw:e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status:0, raw:"timeout" }); });
    if (body) req.write(body); req.end();
  });
}

const SOAP_BODY = (path) =>
  `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a="http://services.senior.com.br">`+
  `<S:Body><a:run><exec>sapiens</exec><user>${SOAP_USER}</user>`+
  `<key>com.senior.g5.co.cad.clientes@exportar</key><parent></parent><lot>0</lot>`+
  `<parameters>&lt;request&gt;&lt;/request&gt;</parameters></a:run></S:Body></S:Envelope>`;

(async () => {
  if (!TENANT || !USER || !PASS) { console.error("Faltam SENIOR_USERNAME/PASSWORD/TENANT"); process.exit(1); }

  // 1) autentica UMA vez
  const auth = await call(`${BASE}/platform/authentication/actions/login`, {
    headers: { "Content-Type":"application/json", Accept:"application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  let token = "";
  try { let j=JSON.parse(auth.raw); if (typeof j.jsonToken==="string") j=JSON.parse(j.jsonToken); token=j.access_token||j.token||""; } catch {}
  if (!token) { console.log("❌ auth falhou HTTP", auth.status); process.exit(1); }
  console.log("✅ autenticado (token reutilizado em todas as tentativas)\n");

  // 2) rotas candidatas — baseadas em padrões documentados do cloud/gateway
  const candidatas = [
    `/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
    `/t/senior.com.br/bridge/1.0/rest/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
    `/${TENANT}/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
    `/erpx/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
    `/sapiens/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
    `/bridge/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
    // também tenta a forma REST-to-SOAP genérica da plataforma
    `/platform/integration/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
  ];

  const H = { Authorization: token, "Content-Type":"text/xml; charset=utf-8", Accept:"text/xml", SOAPAction:"run" };
  for (const path of candidatas) {
    const r = await call(`${BASE}${path}`, { headers: H, body: SOAP_BODY(path) });
    const recorte = (r.raw||"").replace(/\s+/g," ").slice(0,120);
    const marca = (r.status>=200 && r.status<300 && !/fault|could not route|invalid/i.test(r.raw)) ? "✅" :
                  (/faultstring/i.test(r.raw) ? "⚠️  (chegou no serviço! faultstring)" : "❌");
    console.log(`${marca} [HTTP ${r.status}] ${path}`);
    console.log(`     → ${recorte}\n`);
  }
})();
