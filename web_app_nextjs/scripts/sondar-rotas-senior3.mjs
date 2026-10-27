#!/usr/bin/env node
// 3ª leva: o padrão platform.senior.com.br/t/{tenant}/... deu 403 "route blocked"
// (existe mas bloqueada). Explora variações desse host/padrão.
import https from "node:https";
const USER=(process.env.SENIOR_USERNAME||"").trim(), PASS=(process.env.SENIOR_PASSWORD||"").trim();

function call(url,{method="GET",headers={},body}={}){return new Promise(res=>{let u;try{u=new URL(url)}catch{return res({status:0,raw:"url"})}
  const r=https.request({hostname:u.hostname,path:u.pathname+u.search,method,timeout:20000,headers:{...headers,...(body?{"Content-Length":Buffer.byteLength(body)}:{})}},
    s=>{let d="";s.on("data",c=>d+=c);s.on("end",()=>res({status:s.statusCode,raw:d}))});
  r.on("error",e=>res({status:0,raw:e.message}));r.on("timeout",()=>{r.destroy();res({status:0,raw:"timeout"})});if(body)r.write(body);r.end();});}

(async()=>{
  const a=await call("https://api.senior.com.br/platform/authentication/actions/login",{method:"POST",
    headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({username:USER,password:PASS})});
  let token="";try{let j=JSON.parse(a.raw);if(typeof j.jsonToken==="string")j=JSON.parse(j.jsonToken);token=j.access_token||""}catch{}
  console.log(token?"✅ autenticado\n":"❌ sem token\n");
  const H={Authorization:token,Accept:"application/json"};

  // Variações sobre platform.senior.com.br/t/{tenant} (o que deu 403 = existe)
  const urls=[
    "https://platform.senior.com.br/t/senior.com.br/erpx_fnd/queries/listClientes",
    "https://platform.senior.com.br/t/senior.com.br/erpx_com_ven/entities/cliente",
    "https://platform.senior.com.br/t/senior.com.br/bridge/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes",
    "https://platform.senior.com.br/t/senior.com.br/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes",
    "https://platform.senior.com.br/t/senior.com.br/anywhere/g5-senior-services/sapiens_Synccom_senior_g5_co_cad_clientes",
    // descoberta: tenta um endpoint de 'foundations' conhecido que costuma existir
    "https://platform.senior.com.br/t/senior.com.br/platform/user_management/queries/getLoggedUser",
  ];
  for(const url of urls){
    const soap = url.includes("g5-senior-services");
    const body = soap ? `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a="http://services.senior.com.br"><S:Body><a:run><exec>sapiens</exec><user>${USER.split("@")[0]}</user><key>com.senior.g5.co.cad.clientes@exportar</key><parent></parent><lot>0</lot><parameters>&lt;request&gt;&lt;/request&gt;</parameters></a:run></S:Body></S:Envelope>` : undefined;
    const headers = soap ? {Authorization:token,"Content-Type":"text/xml; charset=utf-8",SOAPAction:"run"} : H;
    const r=await call(url,{method:soap?"POST":"GET",headers,body});
    const t=(r.raw||"").replace(/\s+/g," ").slice(0,130);
    const marca = r.status>=200&&r.status<300?"✅":r.status===403?"🔒 403 (existe, bloqueada)":"❌";
    console.log(`${marca} [HTTP ${r.status}] ${url.replace("https://platform.senior.com.br","")}\n   → ${t}\n`);
  }
})();
