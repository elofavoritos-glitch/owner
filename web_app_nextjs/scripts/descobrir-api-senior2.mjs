#!/usr/bin/env node
// Foca no host api.senior.com.br (onde rotas respondem "pede client_id", não "blocked").
// Testa: (1) o header client_id muda algo? (2) quais serviços de negócio existem lá?
import https from "node:https";
const USER=(process.env.SENIOR_USERNAME||"").trim(), PASS=(process.env.SENIOR_PASSWORD||"").trim();

function call(url,{method="POST",headers={},body="{}"}={}){return new Promise(res=>{let u;try{u=new URL(url)}catch{return res({status:0,raw:"url"})}
  const r=https.request({hostname:u.hostname,path:u.pathname+u.search,method,timeout:15000,headers:{...headers,...(body?{"Content-Length":Buffer.byteLength(body)}:{})}},
    s=>{let d="";s.on("data",c=>d+=c);s.on("end",()=>res({status:s.statusCode,raw:d}))});
  r.on("error",e=>res({status:0,raw:e.message}));r.on("timeout",()=>{r.destroy();res({status:0,raw:"timeout"})});if(body)r.write(body);r.end();});}

const show=(r)=>`[${r.status}] ${(r.raw||"").replace(/\s+/g," ").slice(0,150)}`;

(async()=>{
  const a=await call("https://api.senior.com.br/platform/authentication/actions/login",{
    headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({username:USER,password:PASS})});
  let token="";try{let j=JSON.parse(a.raw);if(typeof j.jsonToken==="string")j=JSON.parse(j.jsonToken);token=j.access_token||"";}catch{}
  console.log(token?"✅ autenticado\n":"❌ sem token\n");

  const BASE="https://api.senior.com.br";
  // 1) A rota 'user' pede client_id. Testa variações de header para ver se passa.
  console.log("== teste: header client_id em /platform/authentication/queries/user ==");
  const variantes = [
    {nome:"sem client_id", h:{}},
    {nome:"client_id=senior", h:{client_id:"senior"}},
    {nome:"client_id vazio", h:{client_id:""}},
    {nome:"Client-Id (hífen)", h:{"Client-Id":"senior"}},
  ];
  for(const v of variantes){
    const r=await call(`${BASE}/platform/authentication/queries/user`,{headers:{Authorization:token,"Content-Type":"application/json",Accept:"application/json",...v.h}});
    console.log(`  ${v.nome}: ${show(r)}`);
  }

  // 2) Mapeia serviços de negócio do ERP no host api.senior.com.br
  console.log("\n== serviços de negócio em api.senior.com.br ==");
  const paths=[
    "/erpx_com_ven/queries/listClientes",
    "/erpx_com_ven/entities/cliente",
    "/erpx_com_ven/clientes",
    "/erpx_fnd/entities/pessoa",
    "/erpx_fnd/queries/pessoaQuery",
    "/com_senior_g5_co_cad_clientes/exportar",
    "/g5/com.senior.g5.co.cad.clientes/exportar",
  ];
  for(const p of paths){
    const r=await call(BASE+p,{headers:{Authorization:token,"Content-Type":"application/json",Accept:"application/json"}});
    console.log(`  ${show(r)}  <- ${p}`);
  }
})();
