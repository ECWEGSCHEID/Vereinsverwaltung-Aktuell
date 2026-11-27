/* EC Wegscheid – Cupauswertung: ein Cup als eigener Bereich (V3.1.121).
   Aufruf aus der Vereinsverwaltung → Interne Cups:
   – …&seite=cup&bearbeiten=1&turnier=<id>  → Admin-Menü nur für diesen Cup (ohne Turnierauswahl, ohne „Neu“)
   – …&seite=cup&bearbeiten=1&neu=1          → nur „Neuen Cup hinzufügen“ */
(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const fixedId=params.get('turnier')||'';
  const onlyNew=params.get('neu')==='1';
  if(!fixedId&&!onlyNew)return;
  const SELECTS=['adminSelectTournament','adminPrintSelectTournament','adminMatchEditSelectTournament','adminHistorySelectTournament'];
  const css=document.createElement('style');
  css.textContent=(fixedId
    ?'#tabNew{display:none!important}'+SELECTS.map(id=>'#'+id).join(',')+'{display:none!important}.cup-single-label{display:none!important}'
    :'#tabMatchEdit,#tabHistory,#tabPrint,#tabEdit{display:none!important}')
    +'#adminCornerBtn{display:none!important}';
  document.head.appendChild(css);

  const cupName=()=>{try{return (typeof tournaments!=='undefined'&&tournaments[fixedId]?.name)||''}catch(e){return ''}};
  function title(){
    const h=document.querySelector('#view-admin h2');if(!h)return;
    if(onlyNew){h.textContent='➕ Neuen Cup hinzufügen';return;}
    const n=cupName();
    h.textContent=n?'⚙️ '+n:(typeof cupLoadState!=='undefined'&&cupLoadState==='ready'?'⚠️ Dieser Cup ist nicht mehr vorhanden.':'⚙️ Cup wird geladen …');
  }

  // Neu: immer den Reiter „Neu“ öffnen
  const origCheck=window.checkAdminAccess;
  if(typeof origCheck==='function'){
    window.checkAdminAccess=function(tab){origCheck(onlyNew?'new':(tab==='new'?'edit':tab));title();};
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
  document.addEventListener('DOMContentLoaded',title);
})();
