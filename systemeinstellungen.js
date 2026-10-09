/* EC Wegscheid – Systemeinstellungen V2.0.4. Kein Einfluss auf bestehende Daten ohne ausdrückliches Speichern. */
(function(){
'use strict';
const DOC='vereinsKonfiguration';
const THEMES={
  neutral:{label:'Neutral · Anthrazit/Blau',primary:'#476581',background:'#26313c',surface:'#1c2530',text:'#ffffff'},
  carbon:{label:'Carbon Rot · EC Wegscheid',primary:'#b30000',background:'#5b0000',surface:'#211317',text:'#ffffff'},
  blue:{label:'Blau/Silber',primary:'#245fa4',background:'#142b47',surface:'#172333',text:'#ffffff'},
  green:{label:'Grün/Dunkel',primary:'#32835c',background:'#142d24',surface:'#15251f',text:'#ffffff'},
  silver:{label:'Silber Hell',primary:'#606e7d',background:'#a7afb7',surface:'#e5e7eb',text:'#1c2630'},
  blacksilver:{label:'Schwarz/Silber Original',primary:'#7c858e',background:'#202125',surface:'#33343a',text:'#ffffff'}
};
const PRESETS={
  none:{label:'Kein Vorlagenbild · bisheriger Hintergrund',file:''},
  'carbon-rot-mit-logo':{label:'Carbon Rot – mit EC Wegscheid Logo',file:'designvorlagen/carbon-rot-mit-logo.jpg',theme:'carbon'},
  'carbon-rot-ohne-logo':{label:'Carbon Rot – ohne Logo',file:'designvorlagen/carbon-rot-ohne-logo.jpg',theme:'carbon'},
  'blau-silber-mit-logo':{label:'Blau Silber – mit EC Wegscheid Logo',file:'designvorlagen/blau-silber-mit-logo.jpg',theme:'blue'},
  'blau-silber-ohne-logo':{label:'Blau Silber – ohne Logo',file:'designvorlagen/blau-silber-ohne-logo.jpg',theme:'blue'},
  'silber-hell-mit-logo':{label:'Silber Hell – mit EC Wegscheid Logo',file:'designvorlagen/silber-hell-mit-logo.jpg',theme:'silver'},
  'silber-hell-ohne-logo':{label:'Silber Hell – ohne Logo',file:'designvorlagen/silber-hell-ohne-logo.jpg',theme:'silver'},
  'schwarz-silber-original-mit-logo':{label:'Schwarz Silber – bisherige verkleinerte Vorlage',file:'designvorlagen/schwarz-silber-original-mit-logo.jpg',theme:'blacksilver'},
  'schwarz-carbon-original-mit-logo':{label:'Schwarz Carbon – EC Wegscheid (dein Originalbild)',file:'designvorlagen/schwarz-carbon-ec-wegscheid-original.png',theme:'blacksilver'}
};
function presetUrl(key){return PRESETS[key]?.file||''}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=()=>({name:'EC Wegscheid',shortName:'ECW',email:'',address:'',contact:'',theme:'carbon',primary:'#b30000',background:'#5b0000',logo:'',backgroundImage:'',backgroundPreset:'none'});
let loaded=null, draft=null, docExists=false, busy=false;
const admin=()=>typeof appPermissions!=='undefined'&&appPermissions.admin===true&&typeof firebaseAuthUser!=='undefined'&&!!firebaseAuthUser;
const db=()=>typeof firestoreDb!=='undefined'?firestoreDb:null;
const el=id=>document.getElementById(id);
function safeImage(v){return typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)&&v.length<450000?v:''}
function clean(v){
  const d=base(), x=v||{};
  for(const k of ['name','shortName','email','address','contact'])d[k]=String(x[k]??d[k]).slice(0,250);
  d.theme=Object.hasOwn(THEMES,x.theme)?x.theme:'carbon';
  for(const k of ['primary','background'])d[k]=/^#[0-9a-fA-F]{6}$/.test(x[k]||'')?x[k]:THEMES[d.theme][k];
  d.logo=safeImage(x.logo);d.backgroundImage=safeImage(x.backgroundImage);
  d.backgroundPreset=Object.hasOwn(PRESETS,x.backgroundPreset)?x.backgroundPreset:'none';
  return d;
}
function apply(v){
  if(!v)return;
  const d=clean(v),style=el('ecw-config-style')||document.createElement('style');
  style.id='ecw-config-style';
  // Theme is applied only after explicit save to Firebase. Legacy installations stay untouched.
  const bg=d.backgroundImage||presetUrl(d.backgroundPreset);
  style.textContent='body{background-color:'+d.background+' !important;'+(bg?'background-image:url("'+bg+'") !important;':'')+'background-position:center !important;background-size:cover !important;}button.primary{background:'+d.primary+' !important;}';
  if(!style.parentNode)document.head.appendChild(style);
  document.documentElement.dataset.ecwTheme=d.theme;
}
async function load(){
  if(!db()||!admin())return;
  try{
    const snap=await db().collection('appSettings').doc(DOC).get();
    docExists=snap.exists;
    loaded=snap.exists?clean(snap.data()):null;
    if(loaded)apply(loaded);
  }catch(e){console.warn('Systemkonfiguration konnte nicht geladen werden:',e);}
}
function preview(){
  const p=el('ecwConfigPreview');if(!p||!draft)return;
  const bg=draft.backgroundImage||presetUrl(draft.backgroundPreset);
  p.style.background=bg?'url("'+bg+'") center/cover':draft.background;
  p.style.color='#fff';
  p.innerHTML='<div style="display:flex;align-items:center;gap:16px">'+(draft.logo?'<img alt="Vereinslogo" style="width:78px;height:78px;object-fit:contain" src="'+draft.logo+'">':'<div style="border:1px dashed #aaa;border-radius:12px;padding:20px">LOGO</div>')+'<div><strong style="font-size:22px">'+esc(draft.name||'Vereinsname')+'</strong><div>Vereinsverwaltung · Vorschau</div></div></div><div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap"><span style="background:'+draft.primary+';padding:12px 16px;border-radius:9px">Turnierverwaltung</span><span style="background:'+draft.primary+';padding:12px 16px;border-radius:9px">Mitgliederverwaltung</span></div>';
}
function change(){
  for(const [key,id] of [['name','ecwCfgName'],['shortName','ecwCfgShort'],['email','ecwCfgEmail'],['address','ecwCfgAddress'],['contact','ecwCfgContact'],['primary','ecwCfgPrimary'],['background','ecwCfgBackground']])draft[key]=el(id).value;
  preview();
}
function setTheme(){
  const t=el('ecwCfgTheme').value;
  draft.theme=t;draft.primary=THEMES[t].primary;draft.background=THEMES[t].background;
  draft.backgroundPreset='none';draft.backgroundImage='';el('ecwCfgPreset').value='none';
  el('ecwCfgPrimary').value=draft.primary;el('ecwCfgBackground').value=draft.background;
  preview();
}
function selectPreset(){
  const key=el('ecwCfgPreset').value;draft.backgroundPreset=key;draft.backgroundImage='';
  if(PRESETS[key]?.theme){draft.theme=PRESETS[key].theme;draft.primary=THEMES[draft.theme].primary;draft.background=THEMES[draft.theme].background;el('ecwCfgTheme').value=draft.theme;el('ecwCfgPrimary').value=draft.primary;el('ecwCfgBackground').value=draft.background;}
  preview();msg('Ausgewählt: '+PRESETS[key].label+' – noch nicht gespeichert.');
}
function msg(text,isError=false){const e=el('ecwCfgStatus');if(e){e.textContent=text;e.style.color=isError?'#ff9999':'#a5f2c2';}}
async function upload(file,key){
  if(!file)return;
  if(!file.type.startsWith('image/')){msg('Bitte eine Bilddatei auswählen.',true);return;}
  try{
    const image=await createImageBitmap(file);
    const max=key==='logo'?700:1600,scale=Math.min(1,max/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
    let data=canvas.toDataURL('image/webp',0.68);
    if(!data.startsWith('data:image/webp'))data=canvas.toDataURL('image/jpeg',0.65);
    if(!safeImage(data)){msg('Bild zu groß. Bitte eine kleinere Datei wählen (maximal ca. 330 KB nach Komprimierung).',true);return;}
    draft[key]=data;if(key==='backgroundImage'){draft.backgroundPreset='none';el('ecwCfgPreset').value='none'}preview();msg('Bild für die Vorschau übernommen. Noch nicht gespeichert.');
  }catch(e){msg('Bild konnte nicht verarbeitet werden: '+e.message,true)}
}
async function save(){
  if(!admin()||busy){msg('Nur Administratoren dürfen diese Einstellungen speichern.',true);return;}
  change();draft=clean(draft);
  if(!draft.name.trim()){msg('Bitte einen Vereinsnamen eingeben.',true);return;}
  if(!db()){msg('Firebase ist nicht verbunden.',true);return;}
  busy=true;msg('Speichere in Firebase …');
  const saveButton=el('ecwCfgSave');if(saveButton)saveButton.disabled=true;
  try{
    await db().collection('appSettings').doc(DOC).set({...draft,updatedAt:new Date().toISOString(),updatedBy:firebaseAuthUser.uid});
    // Verify that the server actually persisted the selection before claiming success.
    const check=await db().collection('appSettings').doc(DOC).get({source:'server'});
    if(!check.exists)throw new Error('Nach dem Speichern kein Konfigurationsdokument gefunden.');
    loaded=clean(check.data());docExists=true;draft=clean(loaded);apply(loaded);
    msg('Erfolgreich in Firebase gespeichert: '+(PRESETS[loaded.backgroundPreset]?.label||THEMES[loaded.theme].label)+'. Nach Neustart bleibt die Auswahl erhalten.');
  }catch(e){console.error('ECW Design speichern:',e);msg('NICHT gespeichert – '+(e.code||'Fehler')+': '+(e.message||e),true)}finally{busy=false;if(saveButton)saveButton.disabled=false;}
}
async function open(){
  if(!admin())return;
  const a=el('adminMain');if(!a)return;
  a.innerHTML='<h2>⚙ Systemeinstellungen <span class="small">V2.0.4 · Designvorlagen</span></h2><div class="card" style="margin-bottom:12px"><b>Vereinsprofil und Design</b><p class="small">Änderungen werden erst mit „Einstellungen speichern“ in Firebase übernommen. Das bestehende EC-Wegscheid-Design bleibt ohne Speichern unverändert. Neue Vereinsinstallationen können die neutrale Vorlage wählen.</p><div class="row"><div><label>Vereinsname</label><input id="ecwCfgName" type="text" maxlength="120"></div><div><label>Vereinskürzel</label><input id="ecwCfgShort" type="text" maxlength="25"></div></div><div class="row"><div><label>E-Mail</label><input id="ecwCfgEmail" type="text"></div><div><label>Kontakt</label><input id="ecwCfgContact" type="text"></div></div><label>Anschrift</label><input id="ecwCfgAddress" type="text"><label>Designvorlage</label><select id="ecwCfgTheme">'+Object.entries(THEMES).map(([id,t])=>'<option value="'+id+'">'+esc(t.label)+'</option>').join('')+'</select><label>Hintergrundvorlage (mit oder ohne Logo)</label><select id="ecwCfgPreset">'+Object.entries(PRESETS).map(([id,t])=>'<option value="'+id+'">'+esc(t.label)+'</option>').join('')+'</select><div class="row"><div><label>Akzentfarbe</label><input id="ecwCfgPrimary" type="color" style="height:44px;width:100%"></div><div><label>Hintergrundfarbe</label><input id="ecwCfgBackground" type="color" style="height:44px;width:100%"></div></div><div class="row"><div><label>Vereinslogo (PNG/JPG/WebP)</label><input id="ecwCfgLogo" type="file" accept="image/png,image/jpeg,image/webp"><button type="button" id="ecwCfgRemoveLogo">Logo entfernen</button></div><div><label>Hintergrundbild (PNG/JPG/WebP)</label><input id="ecwCfgBg" type="file" accept="image/png,image/jpeg,image/webp"><button type="button" id="ecwCfgRemoveBg">Bild entfernen</button></div></div><p class="small">Bilder werden vor dem Speichern verkleinert. Große Originalbilder und die Hintergründe einzelner Module werden in einer späteren Ausbaustufe zentral verwaltet.</p></div><div class="card"><h3>Live-Vorschau (nur hier)</h3><div id="ecwConfigPreview" style="padding:24px;min-height:190px;border-radius:12px"></div><div class="row" style="margin-top:16px"><button class="primary" id="ecwCfgSave">Einstellungen speichern</button><button id="ecwCfgCancel">Änderungen verwerfen</button><button id="ecwCfgEC">EC Wegscheid Carbon Rot laden</button><button id="ecwCfgNeutral">Neutralen Entwurf laden</button></div><div id="ecwCfgStatus" role="status" style="margin-top:12px"></div></div><div class="card" style="margin-top:12px"><b>Weitere Bereiche (folgen)</b><p class="small">Modulverwaltung mit sicheren Zugriffssperren · zentrale Modulversionen · Vereins-Installationsassistent · gemeinsame Designübernahme in alle Einzelprogramme.</p></div>';
  msg('Lade aktuelle Einstellungen …');
  try{const snap=await db().collection('appSettings').doc(DOC).get();docExists=snap.exists;loaded=snap.exists?clean(snap.data()):null;}catch(e){msg('Firebase-Laden fehlgeschlagen: '+e.message,true);return;}
  draft=clean(loaded||base());
  for(const [key,id] of [['name','ecwCfgName'],['shortName','ecwCfgShort'],['email','ecwCfgEmail'],['address','ecwCfgAddress'],['contact','ecwCfgContact'],['primary','ecwCfgPrimary'],['background','ecwCfgBackground']])el(id).value=draft[key];
  el('ecwCfgTheme').value=draft.theme;
  el('ecwCfgPreset').value=draft.backgroundPreset;
  ['ecwCfgName','ecwCfgShort','ecwCfgEmail','ecwCfgAddress','ecwCfgContact','ecwCfgPrimary','ecwCfgBackground'].forEach(id=>el(id).addEventListener('input',change));
  el('ecwCfgTheme').addEventListener('change',setTheme);
  el('ecwCfgPreset').addEventListener('change',selectPreset);
  el('ecwCfgLogo').addEventListener('change',e=>upload(e.target.files[0],'logo'));
  el('ecwCfgBg').addEventListener('change',e=>upload(e.target.files[0],'backgroundImage'));
  el('ecwCfgRemoveLogo').onclick=()=>{draft.logo='';preview()};
  el('ecwCfgRemoveBg').onclick=()=>{draft.backgroundImage='';draft.backgroundPreset='none';el('ecwCfgPreset').value='none';preview()};
  el('ecwCfgSave').onclick=save;
  el('ecwCfgCancel').onclick=()=>open();
  el('ecwCfgEC').onclick=()=>{draft={...draft,theme:'carbon',primary:THEMES.carbon.primary,background:THEMES.carbon.background,backgroundPreset:'none',backgroundImage:'',logo:''};el('ecwCfgPreset').value='none';el('ecwCfgTheme').value='carbon';el('ecwCfgPrimary').value=draft.primary;el('ecwCfgBackground').value=draft.background;preview();msg('EC Wegscheid Carbon Rot als Entwurf geladen. Noch nicht gespeichert.');};
  el('ecwCfgNeutral').onclick=()=>{draft={...draft,...THEMES.neutral,theme:'neutral',logo:'',backgroundImage:'',backgroundPreset:'none'};el('ecwCfgPreset').value='none';el('ecwCfgTheme').value='neutral';el('ecwCfgPrimary').value=draft.primary;el('ecwCfgBackground').value=draft.background;preview();msg('Neutraler Entwurf geladen. Noch nicht gespeichert.')};
  preview();msg(docExists?'Aus Firebase geladen: '+(PRESETS[draft.backgroundPreset]?.label||THEMES[draft.theme].label):'Noch keine Konfiguration gespeichert – bestehendes Design bleibt unverändert.');
}
// Existing installations have no config document: do not change their appearance.
// Loading is initiated by the parent after user permissions are fully available.
// Do not rely on a timer racing the asynchronous Firebase profile load.
window.ECWConfig={open,load};
})();
