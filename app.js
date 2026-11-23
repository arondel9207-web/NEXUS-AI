import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

// Configuration Web publique reprise du projet NEXUS AI fourni.
const firebaseConfig={apiKey:'AIzaSyB81f0wurih6lnqmsdTJpP_ryeKBpKDOGY',authDomain:'nexus-a-c0167.firebaseapp.com',projectId:'nexus-a-c0167',storageBucket:'nexus-a-c0167.firebasestorage.app',messagingSenderId:'626843436720',appId:'1:626843436720:web:3765f50d2d3649121d75'};
const auth=getAuth(initializeApp(firebaseConfig));
const root=document.getElementById('app');
let user=null,conversations=[],current=null,view='chat',busy=false,loginMode='login',mobileOpen=false;
const defaultSettings={worker:'',providerId:'',model:'',system:'Tu es NEXUS AI, un assistant utile. Réponds en français.'};
let settings={...defaultSettings},providers=[],models=[],apiError='';
const escapeHtml=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\'':'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const storageKey=()=>`nexus-pages-conversations:${user.uid}`;
const settingsKey=()=>`nexus-pages-settings:${user.uid}`;
function load(){try{conversations=JSON.parse(localStorage.getItem(storageKey())||'[]');if(!Array.isArray(conversations))conversations=[]}catch{conversations=[]}try{settings={...defaultSettings,...JSON.parse(localStorage.getItem(settingsKey())||'{}')}}catch{settings={...defaultSettings}}}
function save(){localStorage.setItem(storageKey(),JSON.stringify(conversations))}
function saveSettings(){localStorage.setItem(settingsKey(),JSON.stringify(settings))}
async function request(path,method='GET',body){
 if(!settings.worker)throw Error('Configurez d’abord l’URL de votre Worker Cloudflare.');
 const token=await auth.currentUser.getIdToken();
 let res;
 try{res=await fetch(settings.worker.replace(/\\/+$/,'')+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})}
 catch{throw Error('Connexion impossible au Worker. Vérifiez son URL et ALLOWED_ORIGINS (CORS).')}
 const data=await res.json().catch(()=>({error:'Réponse non JSON du Worker'}));
 if(!res.ok)throw Error(data.error?.message||data.error||`HTTP ${res.status}`);
 return data;
}
async function refreshProviders(){
 const data=await request('/providers');providers=data.providers||[];
 if(!providers.some(p=>p.id===settings.providerId))settings.providerId=providers[0]?.id||'';
 saveSettings();
}
async function refreshModels(){
 models=[];if(!settings.providerId)return;
 const data=await request('/providers/'+settings.providerId+'/models');
 models=(Array.isArray(data.data)?data.data:Array.isArray(data.models)?data.models:[]).filter(m=>m&&typeof m.id==='string').map(m=>({id:m.id,name:m.name||m.id})).sort((a,b)=>a.id.localeCompare(b.id));
 if(!models.some(m=>m.id===settings.model))settings.model=models[0]?.id||'';
 saveSettings();
}
async function syncApis(){apiError='';try{await refreshProviders();await refreshModels()}catch(e){apiError=e.message}render()}
function authForm(message=''){root.innerHTML=`<div class="auth"><form class="authbox" id="authform"><h1>NEXUS AI</h1><p>${loginMode==='register'?'Créer un compte':'Connexion à votre espace IA'}</p><input name="email" type="email" placeholder="Adresse e-mail" autocomplete="email" required><input name="password" type="password" placeholder="Mot de passe" minlength="6" autocomplete="${loginMode==='register'?'new-password':'current-password'}" required><div class="error" id="autherror">${escapeHtml(message)}</div><button class="primary">${loginMode==='register'?'Créer mon compte':'Se connecter'}</button><div style="text-align:center;margin-top:12px"><button type="button" class="linkbtn" id="toggleauth">${loginMode==='register'?'Déjà inscrit ? Connexion':'Créer un compte'}</button><button type="button" class="linkbtn" id="resetpwd">Mot de passe oublié ?</button></div><p class="small">Authentification assurée par Firebase.</p></form></div>`;document.getElementById('toggleauth').onclick=()=>{loginMode=loginMode==='login'?'register':'login';authForm()};document.getElementById('resetpwd').onclick=async()=>{const email=document.querySelector('[name=email]').value.trim();if(!email)return authForm('Saisissez votre adresse e-mail avant de demander la réinitialisation.');try{await sendPasswordResetEmail(auth,email);authForm('Un e-mail de réinitialisation a été demandé.')}catch(e){authForm(e.message)}};document.getElementById('authform').onsubmit=async e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{document.getElementById('autherror').textContent='';if(loginMode==='register')await createUserWithEmailAndPassword(auth,data.get('email'),data.get('password'));else await signInWithEmailAndPassword(auth,data.get('email'),data.get('password'));}catch(err){document.getElementById('autherror').textContent=err.message}}}
function selected(){return conversations.find(c=>c.id===current)}
function newChat(){current=null;view='chat';mobileOpen=false;render()}
function createChat(){const c={id:uid(),title:'Nouvelle conversation',updated:Date.now(),messages:[]};conversations.unshift(c);current=c.id;save();return c}
function removeChat(id){if(!confirm('Supprimer cette conversation ?'))return;conversations=conversations.filter(c=>c.id!==id);if(current===id)current=null;save();render()}
function sidebar(){return `<aside class="sidebar ${mobileOpen?'open':''}"><div class="brand">◈ NEXUS AI</div><button class="new" id="newchat">＋ Nouvelle conversation</button><div class="sectiontitle">CONVERSATIONS</div><div class="history">${[...conversations].sort((a,b)=>b.updated-a.updated).map(c=>`<button class="${current===c.id&&view==='chat'?'active':''}" data-chat="${escapeHtml(c.id)}" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</button>`).join('')}</div><div class="bottom"><button style="width:100%" id="settingsbtn">⚙ Paramètres et API</button><button style="width:100%" id="exportbtn">↓ Exporter mes conversations</button><button style="width:100%" id="signout">⎋ Déconnexion</button><div class="small" style="padding:10px;overflow-wrap:anywhere">${escapeHtml(user.email)}</div></div></aside>`}
function modelSelect(){return `<select id="modelpicker" class="modelpicker" aria-label="Modèle actif">${models.map(m=>`<option value="${escapeHtml(m.id)}" ${m.id===settings.model?'selected':''}>${escapeHtml(m.name)}</option>`).join('')}${settings.model&&!models.some(m=>m.id===settings.model)?`<option selected value="${escapeHtml(settings.model)}">${escapeHtml(settings.model)}</option>`:''}</select>`}
function chatHtml(){const c=selected();return `<div class="chat" id="chat"><div class="thread">${!c||!c.messages.length?`<div class="welcome"><h1>Comment puis-je vous aider ?</h1><p>Choisissez une API et un modèle pour commencer.</p></div>`:c.messages.map(m=>`<div class="msg ${m.role}"><div class="bubble">${escapeHtml(m.content)}</div></div>`).join('')}${busy?'<div class="msg assistant"><div class="bubble">Génération…</div></div>':''}</div></div><div class="composerwrap"><form class="composer" id="composer"><textarea name="prompt" placeholder="Envoyer un message à NEXUS AI…" required ${busy?'disabled':''}></textarea><div class="actions"><div class="pickers"><select id="providerpicker" class="modelpicker" aria-label="API active">${providers.map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===settings.providerId?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select>${modelSelect()}</div><button class="send" type="submit" ${busy?'disabled':''}>↑</button></div></form><div class="disclaimer">API et clés conservées côté Worker. Les conversations restent sur cet appareil.</div></div>`}
function settingsHtml(){return `<div class="chat"><div class="settings"><h2>Paramètres et API</h2><p>Connectez un Worker Cloudflare pour gérer plusieurs fournisseurs et découvrir automatiquement leurs modèles.</p><form id="workerform"><label>URL de votre Worker Cloudflare</label><input class="formfield" name="worker" type="url" required placeholder="https://nexus-ai-api.votre-compte.workers.dev" value="${escapeHtml(settings.worker)}"><label>Instructions système</label><textarea class="formfield" name="system" rows="3">${escapeHtml(settings.system)}</textarea><div class="row"><button class="primary">Enregistrer et connecter</button><button type="button" class="ghost" id="reloadapis">Actualiser les API</button></div></form><p class="error" id="apierror">${escapeHtml(apiError)}</p><hr><h2>Mes fournisseurs (${providers.length})</h2>${providers.map(p=>`<div class="providerrow"><div><b>${escapeHtml(p.name)}</b><div class="small">${escapeHtml(p.url)}</div></div><div class="row"><button class="ghost" data-use="${escapeHtml(p.id)}">Utiliser</button><button class="ghost danger" data-remove="${escapeHtml(p.id)}">Supprimer</button></div></div>`).join('')||'<p>Aucune API enregistrée.</p>'}<h3>Ajouter une API</h3><form id="addprovider"><label>Nom du fournisseur</label><input class="formfield" name="name" placeholder="Numes.ai, OpenRouter, autre…" required><label>URL de base compatible OpenAI</label><input class="formfield" name="url" type="url" value="https://api.numes.ai/api/v1" required><label>Clé API</label><input class="formfield" name="key" type="password" autocomplete="off" required><button class="primary">Ajouter et détecter les modèles</button></form><hr><h2>Modèles de l’API sélectionnée (${models.length})</h2><div class="row"><button class="ghost" id="reloadmodels">Détecter les modèles</button><span class="small">${escapeHtml(providers.find(p=>p.id===settings.providerId)?.name||'Aucune API')}</span></div><label>Modèle actif</label>${modelSelect()}<label>Identifiant manuel si le fournisseur ne propose pas /models</label><input class="formfield" id="manualmodel" placeholder="author/model" value="${escapeHtml(settings.model)}"><button class="ghost" id="savemodel">Utiliser cet identifiant</button><hr><h2>Données locales</h2><button class="ghost danger" id="clearall">Supprimer mes conversations locales</button></div></div>`}
function render(){
 if(!user)return authForm();
 root.innerHTML=`<div class="layout">${sidebar()}<main class="main"><header class="top"><button class="mobilemenu" id="menu">☰</button><span class="title">${view==='settings'?'Paramètres':escapeHtml(selected()?.title||'Nouveau chat')}</span><div class="spacer"></div><span class="pill">Multi-API</span></header>${view==='settings'?settingsHtml():chatHtml()}</main></div>`;
 document.getElementById('newchat').onclick=newChat;
 document.getElementById('settingsbtn').onclick=()=>{view='settings';mobileOpen=false;render()};
 document.getElementById('signout').onclick=()=>signOut(auth);
 document.getElementById('exportbtn').onclick=exportData;
 document.querySelectorAll('[data-chat]').forEach(b=>b.onclick=()=>{current=b.dataset.chat;view='chat';mobileOpen=false;render()});
 document.getElementById('menu').onclick=()=>{mobileOpen=!mobileOpen;render()};
 if(view==='settings'){
  document.getElementById('workerform').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);settings.worker=String(f.get('worker')).trim().replace(/\\/+$/,'');settings.system=String(f.get('system'));saveSettings();await syncApis()};
  document.getElementById('reloadapis').onclick=syncApis;
  document.getElementById('addprovider').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const data=await request('/providers','POST',{name:f.get('name'),url:f.get('url'),key:f.get('key')});settings.providerId=data.provider.id;saveSettings();await syncApis()}catch(err){apiError=err.message;render()}};
  document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer cette API et sa clé ?'))return;try{await request('/providers/'+b.dataset.remove,'DELETE');await syncApis()}catch(err){apiError=err.message;render()}});
  document.querySelectorAll('[data-use]').forEach(b=>b.onclick=async()=>{settings.providerId=b.dataset.use;settings.model='';saveSettings();await syncApis()});
  document.getElementById('reloadmodels').onclick=async()=>{try{await refreshModels();apiError=''}catch(err){apiError=err.message}render()};
  document.getElementById('savemodel').onclick=()=>{settings.model=document.getElementById('manualmodel').value.trim();saveSettings();render()};
  document.getElementById('clearall').onclick=()=>{if(confirm('Supprimer toutes les conversations de ce navigateur ?')){conversations=[];current=null;save();render()}};
 }else{
  document.getElementById('composer').onsubmit=send;
  const text=document.querySelector('[name=prompt]');text.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();text.form.requestSubmit()}};
  document.getElementById('providerpicker').onchange=async e=>{settings.providerId=e.target.value;settings.model='';saveSettings();try{await refreshModels()}catch(err){apiError=err.message;view='settings'}render()};
  document.getElementById('modelpicker').onchange=e=>{settings.model=e.target.value;saveSettings()};
  document.getElementById('chat').scrollTop=document.getElementById('chat').scrollHeight;
 }
}
function exportData(){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),conversations},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nexus-ai-conversations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function send(e){
 e.preventDefault();if(busy)return;
 const area=e.currentTarget.querySelector('textarea'),text=area.value.trim();if(!text)return;
 if(!settings.providerId||!settings.model){view='settings';apiError='Ajoutez une API et sélectionnez un modèle.';render();return}
 const c=selected()||createChat();
 c.messages.push({role:'user',content:text});if(c.messages.length===1)c.title=text.slice(0,55);
 c.updated=Date.now();save();busy=true;render();
 try{
  const messages=[...(settings.system?[{role:'system',content:settings.system}]:[]),...c.messages.map(m=>({role:m.role,content:m.content}))];
  const data=await request('/providers/'+settings.providerId+'/chat','POST',{model:settings.model,messages});
  const answer=data.choices?.[0]?.message?.content;
  if(typeof answer!=='string'&&!Array.isArray(answer))throw Error('Réponse sans texte : vérifiez le modèle et le format de l’API.');
  c.messages.push({role:'assistant',content:typeof answer==='string'?answer:answer.filter(x=>x.type==='text').map(x=>x.text).join('\\n')});
 }catch(err){c.messages.push({role:'assistant',content:'Erreur API : '+err.message})}
 finally{c.updated=Date.now();save();busy=false;render()}
}
onAuthStateChanged(auth,u=>{user=u;if(user){load();current=null;view='chat';render();if(settings.worker)syncApis()}else{conversations=[];current=null;providers=[];models=[];settings={...defaultSettings};authForm()}});
