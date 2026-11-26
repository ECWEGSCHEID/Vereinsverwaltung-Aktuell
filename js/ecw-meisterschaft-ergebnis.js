/* EC Wegscheid – Ergebnisse der Meisterschaften im Terminplaner.
   Jeder Termin vom Typ „Meisterschaft“ bekommt ein Ergebnis (Platz X von Y, Notiz) und optional ein Foto.
   Ab PFLICHT_AB gilt eine vergangene Meisterschaft erst als abgeschlossen, wenn das Ergebnis eingetragen ist.
   Ergebnis: Feld „ergebnis“ im Termin (tournamentPlanner/{id}).
   Foto: eigenes Dokument meisterschaftsFotos/{id}, damit der Terminplaner klein und schnell bleibt. */
(function(){
'use strict';
const PFLICHT_AB='2027-01-01';
const FOTO_COLL='meisterschaftsFotos';
const fotoCache=new Map();
let current=null,pendingPhoto=undefined;

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const today=()=>typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);
const toast=(m,t)=>{if(typeof showToast==='function')showToast(m,t||5000);};
const db=()=>typeof firestoreDb!=='undefined'?firestoreDb:null;
const isChamp=x=>typeof tpIsChampionshipEvent==='function'?tpIsChampionshipEvent(x):/meisterschaft/i.test(String(x&&x.type||''));
const dateOf=x=>String(x&&x.date||'').slice(0,10);
const canEdit=()=>typeof tpCanEditPlanner==='function'&&tpCanEditPlanner()&&!(typeof isWhiteboardUser==='function'&&isWhiteboardUser());

function hasResult(x){const e=x&&x.ergebnis;return !!(e&&Number(e.platz)>0);}
// Vergangene Meisterschaft ab 2027 ohne Ergebnis = noch nicht abgeschlossen.
function isOpen(x){return isChamp(x)&&dateOf(x)&&dateOf(x)<today()&&dateOf(x)>=PFLICHT_AB&&!hasResult(x);}
function resultText(e){
  if(!e||!(Number(e.platz)>0))return '';
  return Number(e.platz)+'.'+(Number(e.von)>0?' von '+Number(e.von):'');
}
// Kachel im Terminplaner (nur Meisterschaften, ab dem Spieltag).
// Turniere (extern und als Ausrichter) zeigen ihr Ergebnis ebenfalls kompakt an, sobald eines eingetragen ist.
const isTournament=x=>{const t=String(x&&x.type||'').toLowerCase();return /turnier/.test(t)&&!/intern/.test(t)&&x.internal!==true;};
function cardHtml(x){
  const id=JSON.stringify(String(x.id)).replace(/"/g,'&quot;');
  if(!isChamp(x)){
    if(!isTournament(x)||!hasResult(x))return '';
    return '<button type="button" class="tp-result tp-result-done" onclick="ECWMeisterschaftErgebnis.open('+id+')" title="Ergebnis ansehen'+(canEdit()?' / ändern':'')+'">🏆 '+esc(resultText(x.ergebnis))+(x.ergebnis.foto?' · 📷':'')+'</button>';
  }
  if(!dateOf(x)||dateOf(x)>today())return '';
  if(hasResult(x)){
    return '<button type="button" class="tp-result tp-result-done" onclick="ECWMeisterschaftErgebnis.open('+id+')" title="Ergebnis ansehen'+(canEdit()?' / ändern':'')+'">🏆 '+esc(resultText(x.ergebnis))+(x.ergebnis.foto?' · 📷':'')+'</button>';
  }
  const open=isOpen(x);
  if(!canEdit())return open?'<span class="tp-result tp-result-open">Ergebnis fehlt</span>':'';
  return '<button type="button" class="tp-result '+(open?'tp-result-open':'tp-result-add')+'" onclick="ECWMeisterschaftErgebnis.open('+id+')">'+(open?'⚠ Ergebnis eintragen':'Ergebnis eintragen')+'</button>';
}

/* ---------- Foto ---------- */
function shrink(file){return new Promise((res,rej)=>{
  const r=new FileReader();r.onerror=()=>rej(Error('Foto konnte nicht gelesen werden.'));
  r.onload=()=>{const img=new Image();img.onerror=()=>rej(Error('Kein gültiges Bild.'));img.onload=()=>{
    let side=1600,q=.82,out='';
    for(let i=0;i<6;i++){
      const s=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);out=c.toDataURL('image/jpeg',q);
      if(out.length<850000)break;side=Math.round(side*.8);q=Math.max(.6,q-.06);
    }
    res(out);
  };img.src=r.result;};r.readAsDataURL(file);
});}
async function loadPhoto(id){
  if(fotoCache.has(id))return fotoCache.get(id);
  const d=db();if(!d)return '';
  try{const s=await d.collection(FOTO_COLL).doc(String(id)).get();const v=s.exists&&s.data()&&s.data().data||'';fotoCache.set(id,v);return v;}
  catch(e){console.warn('Meisterschaftsfoto',e);return '';}
}

/* ---------- Dialog ---------- */
function modal(){
  let m=document.getElementById('msErgModal');
  if(!m){
    m=document.createElement('div');m.id='msErgModal';m.className='tp-history-modal';
    m.innerHTML='<div class="tp-history-dialog ms-erg-dialog" role="dialog" aria-modal="true"></div>';
    m.addEventListener('click',e=>{if(e.target===m)close();});
    document.body.appendChild(m);
  }
  return m;
}
function close(){const m=document.getElementById('msErgModal');if(m)m.classList.remove('show');current=null;pendingPhoto=undefined;}
async function open(id){
  const x=typeof tpFindEvent==='function'?tpFindEvent(id):null;if(!x)return;
  current=x;pendingPhoto=undefined;
  const e=x.ergebnis||{},edit=canEdit(),m=modal(),box=m.firstElementChild;
  const head='<h2>'+esc(x.name)+'</h2><div class="small">'+esc(typeof tpFormatDate==='function'?tpFormatDate(x.date):x.date)+(x.location?' · '+esc(x.location):'')+(x.contestClass?' · '+esc(x.contestClass):'')+'</div>';
  const team=(x.players||[]).filter(Boolean);
  if(!edit){
    box.innerHTML=head+'<div class="ms-erg-big">'+(hasResult(x)?'🏆 '+esc(resultText(e)):'Noch kein Ergebnis')+'</div>'
      +(team.length?'<div class="small">'+esc(team.join(', '))+'</div>':'')+(e.notiz?'<p>'+esc(e.notiz)+'</p>':'')
      +'<div class="ms-erg-photo" id="msErgPhoto"></div><div class="ms-erg-actions"><button type="button" onclick="ECWMeisterschaftErgebnis.close()">Schließen</button></div>';
  }else{
    box.innerHTML=head+(team.length?'<div class="small">Teilnehmer: '+esc(team.join(', '))+'</div>':'')
      +'<div class="ms-erg-place"><label>Platz<input type="number" min="1" inputmode="numeric" id="msErgPlatz" value="'+esc(e.platz||'')+'"></label><span>von</span><label>Teilnehmer<input type="number" min="1" inputmode="numeric" id="msErgVon" value="'+esc(e.von||'')+'"></label></div>'
      +'<label class="ms-erg-note">Notiz (optional)<input type="text" id="msErgNotiz" maxlength="200" value="'+esc(e.notiz||'')+'" placeholder="z. B. Qualifikation für die Bezirksliga"></label>'
      +'<div class="ms-erg-photo" id="msErgPhoto"></div>'
      +'<div class="ms-erg-photo-btns"><label class="ms-erg-file">📷 Foto '+(e.foto?'ersetzen':'hinzufügen')+'<input type="file" accept="image/*" id="msErgFile"></label>'
      +'<button type="button" id="msErgFotoDel"'+(e.foto?'':' hidden')+'>Foto entfernen</button></div>'
      +'<div class="ms-erg-actions">'+(hasResult(x)?'<button type="button" class="danger" onclick="ECWMeisterschaftErgebnis.remove()">Ergebnis löschen</button>':'')
      +'<button type="button" onclick="ECWMeisterschaftErgebnis.close()">Abbrechen</button><button type="button" class="primary" id="msErgSave" onclick="ECWMeisterschaftErgebnis.save()">Speichern</button></div>';
    box.querySelector('#msErgFile').onchange=async ev=>{
      const f=ev.target.files&&ev.target.files[0];ev.target.value='';if(!f)return;
      try{pendingPhoto=await shrink(f);showPhoto(pendingPhoto);box.querySelector('#msErgFotoDel').hidden=false;}catch(err){toast(err.message);}
    };
    box.querySelector('#msErgFotoDel').onclick=()=>{pendingPhoto=null;showPhoto('');box.querySelector('#msErgFotoDel').hidden=true;};
  }
  m.classList.add('show');
  if(e.foto){const ph=document.getElementById('msErgPhoto');if(ph)ph.innerHTML='<div class="small">Foto wird geladen …</div>';const src=await loadPhoto(x.id);if(current===x&&pendingPhoto===undefined)showPhoto(src);}
  if(edit)setTimeout(()=>document.getElementById('msErgPlatz')?.focus(),50);
}
function showPhoto(src){const ph=document.getElementById('msErgPhoto');if(!ph)return;ph.innerHTML=src?'<img src="'+src+'" alt="Foto zur Meisterschaft">':'';}

async function persist(x){
  if(typeof save==='function')save();
  if(typeof renderTournamentPlanner==='function')renderTournamentPlanner();
  const ok=typeof tpSyncEventToFirebase==='function'?await tpSyncEventToFirebase(x):false;
  if(!ok)toast('Ergebnis lokal gespeichert, aber nicht in Firebase. Bitte später erneut speichern.',7000);
  return ok;
}
async function saveResult(){
  const x=current;if(!x||!canEdit())return;
  const platz=parseInt(document.getElementById('msErgPlatz').value,10),von=parseInt(document.getElementById('msErgVon').value,10);
  if(!(platz>0))return toast('Bitte den Platz eintragen.');
  if(!(von>0))return toast('Bitte die Anzahl der Teilnehmer eintragen.');
  if(platz>von)return toast('Der Platz kann nicht größer sein als die Teilnehmerzahl.');
  const btn=document.getElementById('msErgSave');if(btn)btn.disabled=true;
  const old=x.ergebnis||{};
  let foto=!!old.foto;
  try{
    if(pendingPhoto!==undefined){
      const ref=db().collection(FOTO_COLL).doc(String(x.id));
      if(pendingPhoto){await ref.set({data:pendingPhoto,eventId:String(x.id),name:String(x.name||''),date:String(x.date||''),updatedAt:new Date().toISOString()});foto=true;fotoCache.set(String(x.id),pendingPhoto);}
      else{await ref.delete();foto=false;fotoCache.delete(String(x.id));}
    }
  }catch(err){
    if(btn)btn.disabled=false;
    return toast('Foto konnte nicht gespeichert werden'+(err&&err.code==='permission-denied'?' (keine Berechtigung – Firebase-Regel für „'+FOTO_COLL+'“ fehlt)':'')+'. Das Ergebnis wurde noch nicht gespeichert.',9000);
  }
  x.ergebnis={platz,von,notiz:String(document.getElementById('msErgNotiz').value||'').trim(),foto,eingetragenAm:new Date().toISOString(),
    eingetragenVon:(typeof firebaseAuthUser!=='undefined'&&firebaseAuthUser&&(firebaseAuthUser.email||firebaseAuthUser.uid))||''};
  x.updatedAt=new Date().toISOString();
  close();
  if(await persist(x))toast('Ergebnis gespeichert: '+resultText(x.ergebnis)+(foto?' mit Foto':'')+'.');
}
async function removeResult(){
  const x=current;if(!x||!canEdit())return;
  if(!confirm('Ergebnis'+(x.ergebnis&&x.ergebnis.foto?' und Foto':'')+' wirklich löschen?'))return;
  if(x.ergebnis&&x.ergebnis.foto){try{await db().collection(FOTO_COLL).doc(String(x.id)).delete();fotoCache.delete(String(x.id));}catch(e){console.warn(e);}}
  delete x.ergebnis;x.updatedAt=new Date().toISOString();close();
  if(await persist(x))toast('Ergebnis gelöscht.');
}
function openCount(){return ((typeof data!=='undefined'&&data.tournamentPlanner)||[]).filter(x=>x&&isOpen(x)).length;}

window.ECWMeisterschaftErgebnis={open,close,save:saveResult,remove:removeResult,cardHtml,isOpen,hasResult,resultText,openCount,PFLICHT_AB};
})();
