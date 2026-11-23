
const enc=new TextEncoder();
const json=(obj,status=200,headers={})=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const err=(s,status=400)=>json({error:s},status);
function base(url){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('URL HTTPS valide requise');if(u.hostname==='localhost'||u.hostname.endsWith('.local')||/^(127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))throw Error('Adresse locale interdite');return u.href.replace(/\/+$/,'')}
async function auth(req,env){
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /i,'');
 const parts=token.split('.');if(parts.length!==3)throw Error('Connexion Firebase requise');
 const header=JSON.parse(new TextDecoder().decode(b64(parts[0])));
 const payload=JSON.parse(new TextDecoder().decode(b64(parts[1])));
 if(header.alg!=='RS256'||payload.aud!==env.FIREBASE_PROJECT_ID||payload.iss!==`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`||!payload.sub||payload.exp<=Date.now()/1000||payload.iat>Date.now()/1000)throw Error('Jeton Firebase invalide');
 const cert=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
 if(!cert.ok)throw Error('Validation Firebase indisponible');
 const jwks=await cert.json();const jwk=jwks.keys.find(k=>k.kid===header.kid);
 if(!jwk)throw Error('Signature Firebase inconnue');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64(parts[2]),enc.encode(parts[0]+'.'+parts[1])))throw Error('Signature Firebase incorrecte');
 return payload.sub;
}
async function aes(env){const raw=b64(env.ENCRYPTION_KEY);if(raw.length!==32)throw Error('ENCRYPTION_KEY doit contenir 32 octets encodés en base64');return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt'])}
async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aes(env),enc.encode(value));return {iv:Array.from(iv),data:Array.from(new Uint8Array(cipher))}}
async function unseal(blob,env){const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(blob.iv)},await aes(env),new Uint8Array(blob.data));return new TextDecoder().decode(bytes)}
async function getProviders(uid,env){return await env.PROVIDERS.get('user:'+uid,'json')||[]}
async function upstream(p,path,env,method='GET',body=null){
 const key=await unseal(p.secret,env);
 const res=await fetch(base(p.url)+path,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(90000)});
 const text=await res.text();
 if(text.length>4000000)throw Error('Réponse du fournisseur trop volumineuse');
 let data;try{data=JSON.parse(text)}catch{throw Error(`Réponse non JSON du fournisseur (HTTP ${res.status})`)}
 return {status:res.status,data};
}
export default {async fetch(req,env){
 const origin=req.headers.get('Origin')||'';
 const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const cors={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Cache-Control':'no-store'};
 if(req.method==='OPTIONS')return new Response(null,{status:allowed.includes(origin)?204:403,headers:cors});
 if(!allowed.includes(origin))return err('Origine non autorisée',403);
 try{
 if(!env.PROVIDERS||!env.ENCRYPTION_KEY||!env.FIREBASE_PROJECT_ID)throw Error('Worker non configuré (KV, chiffrement, Firebase)');
 const uid=await auth(req,env);
 const url=new URL(req.url),path=url.pathname;
 let providers=await getProviders(uid,env);
 const list=()=>providers.map(({secret,...p})=>({...p,hasKey:!!secret}));
 if(path==='/providers'&&req.method==='GET')return json({providers:list()},200,cors);
 if(path==='/providers'&&req.method==='POST'){
  const input=await req.json();if(providers.length>=20)return json({error:'Limite de 20 API par compte'},400,cors);
  if(!input.name||!input.key||!input.url)return json({error:'Nom, URL et clé requis'},400,cors);
  const p={id:crypto.randomUUID(),name:String(input.name).slice(0,70),url:base(String(input.url)),secret:await seal(String(input.key),env)};
  providers.push(p);await env.PROVIDERS.put('user:'+uid,JSON.stringify(providers));
  return json({provider:{id:p.id,name:p.name,url:p.url,hasKey:true}},201,cors);
 }
 const match=path.match(/^\/providers\/([0-9a-f-]+)(?:\/(models|chat))?$/);
 if(!match)return json({error:'Route inconnue'},404,cors);
 const p=providers.find(x=>x.id===match[1]);if(!p)return json({error:'API inconnue'},404,cors);
 if(!match[2]&&req.method==='DELETE'){providers=providers.filter(x=>x.id!==p.id);await env.PROVIDERS.put('user:'+uid,JSON.stringify(providers));return json({ok:true},200,cors)}
 if(match[2]==='models'&&req.method==='GET'){
  const r=await upstream(p,'/models'+(new URL(p.url).hostname==='api.numes.ai'?'?output_modalities=text':''),env);
  return json(r.data,r.status,cors);
 }
 if(match[2]==='chat'&&req.method==='POST'){
  const body=await req.json();
  if(typeof body.model!=='string'||!Array.isArray(body.messages)||body.messages.length>100||JSON.stringify(body).length>150000)return json({error:'Requête invalide ou trop volumineuse'},400,cors);
  const messages=body.messages.map(m=>({role:m.role,content:String(m.content||'').slice(0,16000)})).filter(m=>['system','user','assistant'].includes(m.role));
  const r=await upstream(p,'/chat/completions',env,'POST',{model:body.model,messages,stream:false});
  return json(r.data,r.status,cors);
 }
 return json({error:'Méthode non autorisée'},405,cors);
 }catch(e){return json({error:String(e.message||e)},/Firebase|Jeton|Signature|Connexion/.test(String(e.message))?401:500,cors)}
}}};
