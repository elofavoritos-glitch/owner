#!/usr/bin/env node
// Descobre o que o token REALMENTE acessa. Autentica 1x e testa padrões de rota
// REST do Senior X cloud (erpx_*, sam, platform) procurando algo != 403 blocked.
import https from "node:https";
const USER=(process.env.SENIOR_USERNAME||"").trim(), PASS=(process.env.SENIOR_PASSWORD||"").trim();
const TENANT=(process.env.SENIOR_TENANT||"elo.log.br").trim();

function call(url,{method="GET",headers={},body}={}){return new Promise(res=>{let u;try{u=new URL(url)}catch{return res({status:0,raw:"url"})}
  const r=https.request({hostname:u.hostname,path:u.pathname+u.search,method,timeout:15000,headers:{...headers,...(body?{"Content-Length":Buffer.byteLength(body)}:{})}},
    s=>{let d="";s.on("data",c=>d+=c);s.on("end",()=>res({status:s.statusCode,raw:d}))});
  r.on("error",e=>res({status:0,raw:e.message}));r.on("timeout",()=>{r.destroy();res({status:0,raw:"timeout"})});if(body)r.write(body);r.end();});}

function classifica(r){
  const t=(r.raw||"");
  if(r.status>=200&&r.status<300) return "✅ OK";
  if(/route blocked/i.test(t)) return "🔒 route blocked";
  if(/could not route/i.test(t)) return "❌ não existe (404 rota)";
  if(/client_id/i.test(t)) return "🔑 pede client_id";
  if(r.status===401) return "🔑 401 (precisa auth/scope)";
  if(r.status===403) return "⛔ 403 (sem permissão)";
  return `? [${r.status}]`;
}

(async()=>{
  const a=await call("https://api.senior.com.br/platform/authentication/actions/login",{method:"POST",
    headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({username:USER,password:PASS})});
  let token="";try{let j=JSON.parse(a.raw);if(typeof j.jsonToken==="string")j=JSON.parse(j.jsonToken);token=j.access_token||"";}catch{}
  if(!token){console.log("❌ sem token");process.exit(1);}
  console.log("✅ autenticado\n");
  const H={Authorization:token,Accept:"application/json","Content-Type":"application/json"};

  // Hosts e padrões a testar
  const hosts = ["https://api.senior.com.br", `https://platform.senior.com.br/t/${TENANT}`];
  // endpoints "de serviço" comuns: queries/actions/entities + health/signin check
  const paths = [
    // identidade do próprio token (deveria ser sempre acessível)
    "/platform/authentication/queries/user",
    "/platform/user_management/queries/getLoggedUserData",
    "/platform/authorization/queries/listGrantedResources",
    // ERP vendas/foundation (catálogo público lista esses domínios)
    "/erpx_fnd/signin",
    "/erpx_fnd/actions/healthcheck",
    "/erpx_com_ven/queries/listCustomers",
    "/erpx_com_ven/entities/customer",
    "/hcm_fnd/queries/listCompanies",
  ];
  for(const host of hosts){
    console.log(`== HOST ${host} ==`);
    for(const p of paths){
      // tenta GET e POST (muitos endpoints Senior são POST)
      for(const m of ["POST"]){
        const r=await call(host+p,{method:m,headers:H,body:"{}"});
        console.log(`  ${classifica(r)}  ${m} ${p}`);
      }
    }
    console.log("");
  }
})();
