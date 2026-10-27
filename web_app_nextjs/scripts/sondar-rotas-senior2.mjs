#!/usr/bin/env node
// Segunda leva de sondagem: hosts alternativos e descoberta de serviços REST do ERP.
import https from "node:https";

const TENANT = (process.env.SENIOR_TENANT||"").trim();
const USER = (process.env.SENIOR_USERNAME||"").trim();
const PASS = (process.env.SENIOR_PASSWORD||"").trim();

function call(url, { method="GET", headers={}, body }={}) {
  return new Promise((resolve) => {
    let u; try { u = new URL(url); } catch { return resolve({status:0, raw:"url inválida"}); }
    const req = https.request({ hostname:u.hostname, path:u.pathname+u.search, method, timeout:20000,
      headers:{ ...headers, ...(body?{"Content-Length":Buffer.byteLength(body)}:{}) } },
      (res)=>{ let d=""; res.on("data",c=>d+=c); res.on("end",()=>resolve({status:res.statusCode, raw:d})); });
    req.on("error", e=>resolve({status:0, raw:e.message}));
    req.on("timeout", ()=>{req.destroy(); resolve({status:0, raw:"timeout"});});
    if (body) req.write(body); req.end();
  });
}

(async () => {
  // token
  const auth = await call("https://api.senior.com.br/platform/authentication/actions/login", {
    method:"POST", headers:{ "Content-Type":"application/json", Accept:"application/json" },
    body: JSON.stringify({ username:USER, password:PASS }) });
  let token=""; try { let j=JSON.parse(auth.raw); if(typeof j.jsonToken==="string")j=JSON.parse(j.jsonToken); token=j.access_token||""; } catch {}
  console.log(token ? "✅ autenticado\n" : "❌ sem token\n");

  // Descoberta: endpoints REST do ERP cloud (erpx_*) que listam clientes.
  // São GETs de leitura — se existirem e tivermos permissão, retornam 200/JSON.
  const H = { Authorization: token, Accept:"application/json" };
  const candidatosRest = [
    "https://api.senior.com.br/erpx_fnd/entities/clientes",
    "https://api.senior.com.br/erpx_com_ven/entities/cliente",
    "https://api.senior.com.br/erpx_com_ven/queries/listarClientes",
    "https://platform.senior.com.br/t/senior.com.br/erpx_fnd/entities/clientes",
  ];
  console.log("== REST erpx_* (GET) ==");
  for (const url of candidatosRest) {
    const r = await call(url, { headers:H });
    console.log(`[HTTP ${r.status}] ${url}\n   → ${(r.raw||"").replace(/\s+/g," ").slice(0,140)}\n`);
  }

  // Hosts alternativos para o g5-senior-services (SOAP), via POST simples (só status).
  console.log("== hosts alternativos (SOAP host) ==");
  const SOAP = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a="http://services.senior.com.br"><S:Body><a:run><exec>sapiens</exec><user>${USER.split("@")[0]}</user><key>com.senior.g5.co.cad.clientes@exportar</key><parent></parent><lot>0</lot><parameters>&lt;request&gt;&lt;/request&gt;</parameters></a:run></S:Body></S:Envelope>`;
  const hosts = [
    `https://platform.senior.com.br/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
    `https://api.senior.com.br/http/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
    `https://api.senior.com.br/rest/sapiens/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes`,
  ];
  const HS = { Authorization: token, "Content-Type":"text/xml; charset=utf-8", SOAPAction:"run" };
  for (const url of hosts) {
    const r = await call(url, { method:"POST", headers:HS, body:SOAP });
    console.log(`[HTTP ${r.status}] ${url}\n   → ${(r.raw||"").replace(/\s+/g," ").slice(0,140)}\n`);
  }
})();
