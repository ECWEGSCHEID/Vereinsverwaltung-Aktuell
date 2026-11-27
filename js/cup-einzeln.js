/* EC Wegscheid – Cupauswertung: ein Cup als eigener Bereich (V3.1.121).
   Aufruf aus der Vereinsverwaltung → Interne Cups:
   – …&seite=cup&bearbeiten=1&turnier=<id>  → Admin-Menü nur für diesen Cup (ohne Turnierauswahl, ohne „Neu“)
   – …&seite=cup&bearbeiten=1&neu=1          → nur „Neuen Cup hinzufügen“ */
(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  let fixedId=params.get('turnier')||'';
  const onlyNew=params.get('neu')==='1';
  const direct=['duo','frauen'].includes(params.get('cup'));
  const SELECTS=['adminSelectTournament','adminPrintSelectTournament','adminMatchEditSelectTournament','adminHistorySelectTournament'];
  if(direct)setupDirect();
  if(!fixedId&&!onlyNew)return;
  const css=document.createElement('style');
  css.textContent=(fixedId
    ?'#tabNew{display:none!important}'+SELECTS.map(id=>'#'+id).join(',')+'{display:none!important}.cup-single-label{display:none!important}'
    :'#tabMatchEdit,#tabHistory,#tabPrint,#tabEdit{display:none!important}')
    +'#adminCornerBtn,#globalStartMenuBtn,#view-admin .btn-mainmenu,#view-admin .btn-section-start-fixed{display:none!important}'
    // Reiter gut lesbar (Text war im eingebetteten Modus kaum zu sehen)
    +'#view-admin .admin-tab-bar{gap:6px;padding-bottom:6px;overflow:visible}'
    +'#view-admin .admin-tab{min-height:40px;padding:9px 8px;font-size:.92rem;font-weight:700;line-height:1.15;display:flex;align-items:center;justify-content:center;color:#fff!important;background:#2b2f3a;border:1px solid #556}'
    +'#view-admin .admin-tab.active{background:#a31c28;border-color:#e04a55}';
  document.head.appendChild(css);

  function cupName(){try{return (typeof tournaments!=='undefined'&&tournaments[fixedId]?.name)||''}catch(e){return ''}}
  function title(){
    const h=document.querySelector('#view-admin h2');if(!h)return;
    if(onlyNew){h.textContent='➕ Neuen Cup hinzufügen';return;}
    const n=cupName();
    h.textContent=n?'⚙️ '+n:(typeof cupLoadState!=='undefined'&&cupLoadState==='ready'?'⚠️ Dieser Cup ist nicht mehr vorhanden.':'⚙️ Cup wird geladen …');
  }

  // Neu: immer den Reiter „Neu“ öffnen
  const origCheck=window.checkAdminAccess;
  if(typeof origCheck==='function'){
    // Ein Cup: gleich „Ergebnisse eingeben“ öffnen
    window.checkAdminAccess=function(tab){origCheck(onlyNew?'new':((tab==='new'||tab==='edit')?'matchEdit':tab));title();};
  }

  if(fixedId){
    // Turnierauswahl fest auf diesen Cup stellen und die Auswahlfelder ausblenden
    const origFill=window.fillTournamentSelect;
    if(typeof origFill==='function'){
      window.fillTournamentSelect=function(id,includeBlank){
        origFill(id,includeBlank);
        const sel=document.getElementById(id);if(!sel)return;
        const lab=sel.previousElementSibling;if(lab&&lab.tagName==='LABEL')lab.classList.add('cup-single-label');
        if([...sel.options].some(o=>o.value===fixedId)&&sel.value!==fixedId){
          sel.value=fixedId;
          try{sel.onchange&&sel.onchange.call(sel)}catch(e){console.error('Cup-Auswahl:',e)}
        }
        title();
      };
    }
  }
  // Nach dem Anlegen eines Cups: Vereinsverwaltung informieren (Buttonliste neu laden)
  const origGo=window.goToMainMenu;
  if(onlyNew&&typeof origGo==='function'){
    window.goToMainMenu=function(){
      try{window.parent!==window&&window.parent.postMessage({type:'ecw-cup-created'},location.origin)}catch(e){}
      origGo();
    };
  }
  function labels(){if(!fixedId)return;const L={tabMatchEdit:'✍️ Ergebnisse eingeben',tabHistory:'🕘 Historie',tabPrint:'🖨 Drucken',tabEdit:'⚙️ Mannschaften & Einstellungen'};
    Object.entries(L).forEach(([id,t])=>{const e=document.getElementById(id);if(e)e.textContent=t;});}
  document.addEventListener('DOMContentLoaded',()=>{title();labels();});

  /* Startseite → „Duo Cup“ / „Frauencup“: Tabelle des aktuellen Cups.
     Zurück führt wieder zur Startseite (Ergebnisse Turniere Intern) statt ins alte Cup-Menü.
     Admins bekommen zusätzlich „Ergebnisse eingeben“ für genau diesen Cup. */
  function setupDirect(){
    const close=()=>{try{if(window.parent!==window){window.parent.postMessage({type:'ecw-close-external'},location.origin);return;}}catch(e){}history.back();};
    const hook=()=>{
      ['goToMainMenu','goBackToStartMenu','showHome'].forEach(n=>{const f=window[n];if(typeof f==='function'&&!f.__ecwDirect){const w=function(...a){
        // im Admin-Bereich normal zurück, sonst Cup verlassen
        // Nur ein echter Klick auf „Zurück“ verlässt den Cup – interne Aufrufe beim Laden (openCup → goToMainMenu) laufen normal
        const ev=window.event;if(!(ev&&ev.isTrusted&&(ev.type==='click'||ev.type==='keydown'||ev.type==='pointerup')))return f.apply(this,a);
        if(document.getElementById('view-admin')?.classList.contains('active')){
          // aus „Ergebnisse eingeben“ zurück zur Tabelle dieses Cups
          try{const t=tournaments[fixedId];const g=cupSortedGroups(t.groups)[0]?.[0];if(t&&g){openGroupSelection(fixedId);openGroupTable(g);return;}}catch(e){}
          return f.apply(this,a);}
        close();};w.__ecwDirect=true;window[n]=w;}});
    };
    hook();document.addEventListener('DOMContentLoaded',hook);
    // Gruppenübersicht → Zurück verlässt ebenfalls den Cup
    const css=document.createElement('style');css.textContent='#ecwDirectAdminBtn{position:fixed;left:14px;bottom:14px;z-index:9999;padding:10px 16px;border-radius:10px;border:1px solid #e04a55;background:#a31c28;color:#fff;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.5)}';document.head.appendChild(css);
    const btn=document.createElement('button');btn.id='ecwDirectAdminBtn';btn.type='button';btn.hidden=true;btn.textContent='✍️ Ergebnisse eingeben';
    btn.onclick=()=>{const id=typeof activeId!=='undefined'?activeId:null;if(!id)return;fixedId=id;enableSingle();window.checkAdminAccess('matchEdit');};
    const role=()=>{try{return String(window.getEffectiveRole?window.getEffectiveRole():(window.currentRole||'guest')).toLowerCase()}catch(e){return 'guest'}};
    setInterval(()=>{const adm=document.getElementById('view-admin')?.classList.contains('active');btn.hidden=adm||!['admin','turnierauswertung'].includes(role())||typeof activeId==='undefined'||!activeId;},700);
    document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(btn));
    if(document.body)document.body.appendChild(btn);
  }
  // Einzel-Cup-Modus nachträglich einschalten (aus der Tabelle heraus)
  function enableSingle(){
    if(window.__ecwSingleOn)return;window.__ecwSingleOn=true;
    const st=document.createElement('style');
    st.textContent='#tabNew{display:none!important}'+SELECTS.map(id=>'#'+id).join(',')+'{display:none!important}.cup-single-label{display:none!important}'
      +'#view-admin .admin-tab-bar{gap:6px;padding-bottom:6px;overflow:visible}#view-admin .admin-tab{min-height:40px;padding:9px 8px;font-size:.92rem;font-weight:700;display:flex;align-items:center;justify-content:center;color:#fff!important;background:#2b2f3a;border:1px solid #556}#view-admin .admin-tab.active{background:#a31c28;border-color:#e04a55}';
    document.head.appendChild(st);
    const origFill=window.fillTournamentSelect;
    window.fillTournamentSelect=function(id,b){origFill(id,b);const sel=document.getElementById(id);if(!sel)return;const lab=sel.previousElementSibling;if(lab&&lab.tagName==='LABEL')lab.classList.add('cup-single-label');if([...sel.options].some(o=>o.value===fixedId)&&sel.value!==fixedId){sel.value=fixedId;try{sel.onchange&&sel.onchange.call(sel)}catch(e){}}title();};
    SELECTS.forEach(id=>{const sel=document.getElementById(id);if(sel&&[...sel.options].some(o=>o.value===fixedId)){sel.value=fixedId;try{sel.onchange&&sel.onchange.call(sel)}catch(e){}const lab=sel.previousElementSibling;if(lab&&lab.tagName==='LABEL')lab.classList.add('cup-single-label');}});
    labelsFor();title();
  }
  function labelsFor(){const L={tabMatchEdit:'✍️ Ergebnisse eingeben',tabHistory:'🕘 Historie',tabPrint:'🖨 Drucken',tabEdit:'⚙️ Mannschaften & Einstellungen'};Object.entries(L).forEach(([id,t])=>{const e=document.getElementById(id);if(e)e.textContent=t;});}
})();
