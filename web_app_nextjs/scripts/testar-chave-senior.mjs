#!/usr/bin/env node
// Testa loginWithKey (access_key + secret) em hosts/paths diferentes para achar
// onde a chave de aplicação autentica.
import https from "node:https";
const AK=(process.env.SENIOR_ACCESS_KEY||"").trim(), SK=(process.env.SENIOR_SECRET||"").trim();
const TENANT=(process.env.SENIOR_TENANT||"elo.log.br").trim();

function call(url,{headers={},body}={}){return new Promise(res=>{let u;try{u=new URL(url)}catch{return res({status:0,raw:"url"})}
  const r=https.request({hostname:u.hostname,path:u.pathname+u.search,method:"POST",timeout:15000,headers:{...headers,...(body?{"Content-Length":Buffer.byteLength(body)}:{})}},
    s=>{let d="";s.on("data",c=>d+=c);s.on("end",()=>res({status:s.statusCode,raw:d}))});
  r.on("error",e=>res({status:0,raw:e.message}));r.on("timeout",()=>{r.destroy();res({status:0,raw:"timeout"})});if(body)r.write(body);r.end();});}

function result(r){
  const t=(r.raw||"");
  let token="";try{let j=JSON.parse(t);if(typeof j.jsonToken==="string")j=JSON.parse(j.jsonToken);token=j.access_token||j.token||"";}catch{}
  if(token) return `✅ TOKEN OK! (len ${token.length})`;
  if(/client_id/i.test(t)) return "🔑 pede client_id";
  if(/route blocked/i.test(t)) return "🔒 route blocked";
  if(/could not route/i.test(t)) return "❌ 404 rota";
  return `[${r.status}] ${t.replace(/\s+/g," ").slice(0,90)}`;
}

(async()=>{
  console.log("access_key len:", AK.length, "| secret len:", SK.length, "\n");
  // corpos possíveis que a primitiva aceita
  const corpos = [
    { access_key: AK, secret: SK },
    { accessKey: AK, secret: SK },
    { key: AK, secret: SK },
  ];
  const hosts = [
    "https://api.senior.com.br",
    `https://platform.senior.com.br/t/${TENANT}`,
  ];
  const paths = [
    "/platform/authentication/actions/loginWithKey",
    "/platform/authentication/actions/login",
  ];
  const H = { "Content-Type":"application/json", Accept:"application/json" };
  for(const host of hosts){
    for(const p of paths){
      for(const c of corpos){
        const r=await call(host+p,{headers:H,body:JSON.stringify(c)});
        const campos = Object.keys(c).join("+");
        console.log(`${result(r)}  ${host.replace("https://","")}${p}  body={${campos}}`);
      }
    }
    console.log("");
  }
})();
