/* EC Wegscheid – Verwaltung: Hinweis auf ungespeicherte Änderungen (V3.1.122).
   Sobald im Verwaltungsbereich etwas geändert wurde und der Bereich gewechselt (oder die Verwaltung
   verlassen) wird, kommt die Frage: Speichern / Nicht speichern / Abbrechen.
   Ohne Änderung kommt keine Frage. */
(function(){
  'use strict';
  let dirty=false,current=null,busy=false;
  const main=()=>document.getElementById('adminMain');
  // Felder, die nur filtern/auswählen und nichts verändern
  const IGNORE=/filter|search|suche|month|monat|season|saison|period|zeitraum|select(?:ed)?tournament|tadminmonth|eaSum/i;
  function ignored(el){
    if(!el||el.closest?.('[data-no-dirty],dialog'))return true;
    if(el.type==='file'||el.type==='search')return true; // Hochladen speichert in den Bereichen selbst
    return IGNORE.test(el.id||'')||IGNORE.test(el.name||'');
  }
  function mark(e){if(busy)return;const el=e?.target;if(e&&(!main()?.contains(el)||ignored(el)))return;dirty=true;}
  window.ecwMarkDirty=()=>{dirty=true;};
  window.ecwClearDirty=()=>{dirty=false;};
  window.ecwIsDirty=()=>dirty;
  document.addEventListener('input',mark,true);
  document.addEventListener('change',mark,true);
  // Klick auf einen Speichern-Button: Änderungen gelten als übernommen
  document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(b&&main()?.contains(b)&&/speichern|veröffentlichen/i.test(b.textContent||''))setTimeout(()=>{dirty=false},0);},true);

  function saveButton(){
    const bs=[...(main()?.querySelectorAll('button')||[])].filter(b=>/speichern/i.test(b.textContent||'')&&!b.disabled&&b.offsetParent!==null);
    return bs.find(b=>b.classList.contains('primary'))||bs[0]||null;
  }
  async function runSave(){
    const b=saveButton();if(!b)return false;
    const m=String(b.getAttribute('onclick')||'').match(/^\s*(?:this\.disabled=true;\s*Promise\.resolve\()?\s*([\w.$]+)\(\)/);
    if(m){let fn=window;for(const k of m[1].split('.'))fn=fn?.[k];
      if(typeof fn==='function'){const ctx=m[1].includes('.')?m[1].split('.').slice(0,-1).reduce((o,k)=>o?.[k],window):window;const r=await fn.call(ctx);return r!==false;}}
    b.click();return true;
  }
  function ask(){
    return new Promise(res=>{
      let d=document.getElementById('ecwDirtyDlg');
      if(!d){d=document.createElement('dialog');d.id='ecwDirtyDlg';
        d.innerHTML='<h3 style="margin:0 0 8px">Änderungen speichern?</h3><p style="margin:0 0 14px">In diesem Bereich wurden Änderungen gemacht, die noch nicht gespeichert sind.</p>'
          +'<div class="ecw-dirty-btns" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button type="button" data-a="cancel">Abbrechen</button><button type="button" data-a="discard">Nicht speichern</button><button type="button" class="primary" data-a="save">💾 Speichern</button></div>';
        const st=document.createElement('style');st.textContent='#ecwDirtyDlg .ecw-dirty-btns button{width:auto;flex:none;padding:9px 16px;margin:0}#ecwDirtyDlg::backdrop{background:rgba(0,0,0,.6)}';document.head.appendChild(st);
        d.style.cssText='border:0;border-radius:14px;padding:18px 20px;max-width:560px;background:#1b1719;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.6)';
        document.body.appendChild(d);}
      d.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{d.close();res(b.dataset.a);});
      d.oncancel=e=>{e.preventDefault();d.close();res('cancel');};
      d.showModal();d.querySelector('[data-a="save"]').focus();
    });
  }
  // true = weitermachen
  async function leaveOk(){
    if(!dirty)return true;
    const a=await ask();
    if(a==='cancel')return false;
    if(a==='save'){try{busy=true;const ok=await runSave();busy=false;if(!ok){if(window.showToast)showToast('Speichern nicht möglich – bitte Eingaben prüfen.',5000);return false;}}catch(e){busy=false;console.error('Speichern:',e);if(window.showToast)showToast('Speichern fehlgeschlagen: '+(e?.message||e),6000);return false;}}
    dirty=false;return true;
  }
  function wrap(){
    const origSection=window.adminSection,origView=window.showView;
    if(typeof origSection!=='function'||typeof origView!=='function'||origSection.__ecwDirty)return false;
    const sec=function(s,...rest){
      if(s===current||!dirty){current=s;dirty=false;return origSection.call(this,s,...rest);}
      leaveOk().then(ok=>{if(ok){current=s;origSection.call(this,s,...rest);}});
    };sec.__ecwDirty=true;window.adminSection=sec;
    const view=function(id,...rest){
      const inAdmin=document.getElementById('admin')?.classList.contains('active');
      if(!inAdmin||id==='admin'||!dirty){if(id!=='admin')current=null;return origView.call(this,id,...rest);}
      leaveOk().then(ok=>{if(ok){current=null;origView.call(this,id,...rest);}});
    };window.showView=view;
    return true;
  }
  // Hinweise wie „… bitte speichern“ (z. B. nach Drag & Drop) bedeuten: es gibt eine ungespeicherte Änderung
  function wrapToast(){const t=window.showToast;if(typeof t!=='function'||t.__ecwDirty)return;const w=function(msg,...r){if(/bitte[^.]*speicher/i.test(String(msg||''))&&document.getElementById('admin')?.classList.contains('active'))dirty=true;return t.call(this,msg,...r);};w.__ecwDirty=true;window.showToast=w;}
  wrapToast();
  if(!wrap())document.addEventListener('DOMContentLoaded',()=>{wrap();wrapToast();});
  // Fenster schließen / neu laden
  window.addEventListener('beforeunload',e=>{if(dirty&&document.getElementById('admin')?.classList.contains('active')){e.preventDefault();e.returnValue='';}});
})();
