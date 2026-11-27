/* EC Wegscheid – Smartphone-Admin-Zugang: Ergänzungen (V3.1.132)
   1. Zurück-Taste des Handys bleibt in der App (vorher: App verlassen → neu anmelden)
   2. Termin anlegen Schritt für Schritt wie in der Verwaltung (Pflichtfelder, Ort Pflicht, Mitspieler optional)
   3. Interne Cup: gleiche Auswahl wie auf der Startseite (nur aktive Bereiche, Duo Cup, Frauencup, Solo Pyramide Herren/Damen …) */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const HOME=['homeView','loginView','qrView'];
  const EXTRA_VIEWS=['cupView'];

  /* ---------- 1. Verlauf / Zurück-Taste ---------- */
  let restoring=false;
  const pending=(location.hash||'').replace('#','');
  let restoreDone=false;
  function wrapShow(){
    const orig=window.show;if(typeof orig!=='function'||orig.__ecwHist)return false;
    const w=function(id){
      // nach Rückkehr von einer Unterseite (z. B. Cup) wieder dort weitermachen
      const first=id==='homeView'&&!restoreDone;
      if(first){restoreDone=true;if(pending&&$(pending+'View')&&pending!=='home'){setTimeout(()=>openView(pending+'View'),0);}}
      EXTRA_VIEWS.forEach(v=>{const e=$(v);if(e)e.classList.add('hidden');});
      orig(id);
      if(EXTRA_VIEWS.includes(id))$(id)?.classList.remove('hidden');
      if(restoring||first)return;
      try{
        const d=Number(history.state?.d)||0;
        if(HOME.includes(id)){ if(id==='homeView'&&d>0)history.go(-d); else history.replaceState({mz:id,d:0},'',location.pathname+location.search); }
        else if(history.state?.mz!==id)history.pushState({mz:id,d:d+1},'',location.pathname+location.search+'#'+id.replace(/View$/,''));
      }catch(e){}
    };
    w.__ecwHist=true;window.show=w;return true;
  }
  window.addEventListener('popstate',e=>{
    const id=e.state?.mz||'homeView';
    if(!window.currentUser&&typeof currentUser!=='undefined'&&!currentUser)return;
    restoring=true;try{window.show(id);if(typeof applyTiles==='function')applyTiles();}finally{restoring=false;}
    if(id==='cupView')renderCups();
  });
  function openView(id){if(id==='cupView'){window.show('cupView');renderCups();}else if(id==='plannerView'){$('tilePlanner')?.click();}else if($(id)){window.show(id);}}

  /* ---------- 2. Termin anlegen Schritt für Schritt ---------- */
  function buildPlannerSteps(){
    const view=$('plannerView');if(!view||view.dataset.steps)return;view.dataset.steps='1';
    const take=ids=>ids.map(id=>$(id)).filter(Boolean);
    const lab=el=>{const p=el?.previousElementSibling;return p&&p.tagName==='LABEL'?p:null;};
    const parts=[
      {t:'Bezeichnung',els:[lab($('tpName')),$('tpName')],req:()=>$('tpName').value.trim()?'':'Bitte die Bezeichnung eingeben.'},
      {t:'Datum und Uhrzeit',els:[$('tpDate')?.closest('.row')],req:()=>$('tpDate').value?'':'Bitte das Datum eingeben.'},
      {t:'Veranstaltungsart',els:[lab($('tpType')),$('tpType'),$('tpClassRow')],req:()=>{const cls=typeof plannerClasses==='function'?plannerClasses():[];return cls.length&&!cls.includes($('tpClass').value)?'Bitte die Wettkampfklasse wählen.':'';}},
      {t:'Veranstaltungsort',els:[lab($('tpLocation')),$('tpLocation')],req:()=>$('tpLocation').value.trim()?'':'Bitte den Veranstaltungsort eingeben.'},
      {t:'Mitspieler',els:[$('tpRoster')],opt:true,req:()=>''},
      {t:'Speichern',els:[view.querySelector('.actions'),$('plannerStatus')],req:()=>''}
    ];
    const lt=lab($('tpLocation'));if(lt)lt.textContent='Ort *';
    const anchor=$('tpExisting');
    const wrap=document.createElement('div');wrap.className='mz-steps';
    parts.forEach((p,i)=>{
      const sec=document.createElement('section');sec.className='mz-step';sec.dataset.n=i+1;
      sec.innerHTML='<div class="mz-step-head"><span class="mz-num">'+(i+1)+'</span><b>'+p.t+'</b>'+(p.opt?'<span class="mz-opt"> · optional</span>':'')+'<span class="mz-sum"></span></div><div class="mz-step-body"></div>';
      const body=sec.querySelector('.mz-step-body');p.els.filter(Boolean).forEach(e=>body.appendChild(e));
      if(i<parts.length-1){const nav=document.createElement('div');nav.className='mz-nav';
        nav.innerHTML=(i?'<button type="button" class="secondary" data-b>‹ Zurück</button>':'')+(p.opt?'<button type="button" class="secondary" data-s>Überspringen</button>':'')+'<button type="button" class="primary" data-w>Weiter ›</button>';
        body.appendChild(nav);}
      else{const nav=document.createElement('div');nav.className='mz-nav';nav.innerHTML='<button type="button" class="secondary" data-b>‹ Zurück</button>';body.insertBefore(nav,body.firstChild);}
      sec.querySelector('.mz-step-head').onclick=()=>go(i+1);
      wrap.appendChild(sec);
    });
    anchor.after(wrap);
    let cur=1;
    const err=n=>parts[n-1].req();
    function summary(){
      const v=id=>String($(id)?.value||'').trim();
      const s=[v('tpName'),v('tpDate')?v('tpDate').split('-').reverse().join('.')+(v('tpTime')?' · '+v('tpTime'):''):'',v('tpType')+(v('tpClass')?' · '+v('tpClass'):''),v('tpLocation'),
        [0,1,2,3].map(i=>v('mobileTpPlayer'+i)).filter(Boolean).join(', '),''];
      wrap.querySelectorAll('.mz-step').forEach((sec,i)=>{sec.querySelector('.mz-sum').textContent=s[i]?' – '+s[i]:'';});
    }
    function go(n){
      if(!wrap.classList.contains('mz-all'))for(let k=1;k<n;k++){const e=err(k);if(e){n=k;msg(e);break;}}
      cur=n;wrap.querySelectorAll('.mz-step').forEach(sec=>{const k=+sec.dataset.n;sec.classList.toggle('open',wrap.classList.contains('mz-all')||k===n);sec.classList.toggle('done',k<n);});
      summary();
      const f=wrap.querySelector('.mz-step[data-n="'+n+'"] .mz-step-body').querySelector('input:not([type=hidden]),select');if(f&&!wrap.classList.contains('mz-all'))setTimeout(()=>f.focus(),40);
    }
    function msg(t){if(typeof setStatus==='function')setStatus('plannerStatus',t,'err');const s=$('plannerStatus');if(s&&!s.closest('.mz-step.open')){alert(t);}}
    wrap.addEventListener('click',e=>{
      const sec=e.target.closest('.mz-step');if(!sec)return;const n=+sec.dataset.n;
      if(e.target.matches('[data-w]')){const m=err(n);if(m){msg(m);return;}go(n+1);}
      else if(e.target.matches('[data-s]'))go(n+1);
      else if(e.target.matches('[data-b]'))go(n-1);
    });
    wrap.addEventListener('keydown',e=>{if(e.key!=='Enter'||wrap.classList.contains('mz-all'))return;const sec=e.target.closest('.mz-step');if(!sec||e.target.tagName==='BUTTON')return;const n=+sec.dataset.n;if(n<parts.length){e.preventDefault();const m=err(n);if(m){msg(m);return;}go(n+1);}});
    // Speichern: alle Pflichtfelder prüfen (auch Ort)
    const save=$('savePlannerBtn');
    if(save){const orig=save.onclick;save.onclick=async ev=>{for(let k=1;k<=4;k++){const m=err(k);if(m){wrap.classList.remove('mz-all');go(k);msg(m);return;}}
      await (orig?orig.call(save,ev):(typeof savePlanner==='function'?savePlanner():null));};}
    // Neu anlegen → Schritt 1; vorhandenen Termin geöffnet → alle Schritte offen
    window.__mzStepsAll=on=>{wrap.classList.toggle('mz-all',!!on);go(on?1:1);};
    if(typeof window.selectPlannerEntry==='function'&&!window.selectPlannerEntry.__ecw){const o=window.selectPlannerEntry;const w=function(...a){const r=o.apply(this,a);window.__mzStepsAll(!!(typeof editingPlanner!=='undefined'&&editingPlanner));return r;};w.__ecw=true;window.selectPlannerEntry=w;}
    const tile=$('tilePlanner');if(tile){const o=tile.onclick;tile.onclick=e=>{o&&o.call(tile,e);window.__mzStepsAll(false);};}
    go(1);
  }

  /* ---------- 3. Interne Cup wie auf der Startseite ---------- */
  function buildCupView(){
    if($('cupView'))return;
    const host=document.querySelector('main')||document.body;
    const s=document.createElement('section');s.id='cupView';s.className='panel hidden';
    s.innerHTML='<div class="section-head"><h2>🏆 Interne Cup</h2><button type="button" class="secondary back" id="cupBack">← Zurück</button></div><div class="grid mz-cup-grid" id="cupTiles"><p class="small">Wird geladen …</p></div>';
    host.append(s);
    $('cupBack').onclick=()=>history.back();
    const t=$('tileCup');if(t)t.onclick=()=>{if(window.currentUser||typeof currentUser!=='undefined'&&currentUser){window.show('cupView');renderCups();}};
  }
  const FS='https://firestore.googleapis.com/v1/projects/ec-wegscheid-verwaltung-neu/databases/(default)/documents/';
  function keyOf(it){
    const u=String(it.u||''),t=String(it.t||'').toLowerCase();
    if(/solo-pyramide/i.test(u))return /pyramide=frauen/i.test(u)?'soloDamen':'soloHerren';
    const m=u.match(/[?&#]seite=(cup|doppelko|jahresmeisterschaft|auslosung|stockdart)/i);
    if(m){const k=m[1].toLowerCase();if(k==='cup'){const c=(u.match(/[?&]cup=(duo|frauen)/i)||[])[1];if(c)return c.toLowerCase()==='duo'?'cupDuo':'cupFrauen';}return k;}
    if(/doppel\s*ko/.test(t))return 'doppelko';if(/stockdart/.test(t))return 'stockdart';if(/auslosung/.test(t))return 'auslosung';if(/jahresmeister/.test(t))return 'jahresmeisterschaft';if(/cup/.test(t))return 'cup';
    return '';
  }
  async function pyr(doc){try{const r=await fetch(FS+'smartphoneBetrieb/'+doc,{cache:'no-store'});return r.ok&&(await r.json()).fields?.aktiv?.booleanValue===true;}catch(e){return false}}
  async function renderCups(){
    const box=$('cupTiles');if(!box)return;
    try{
      const snap=await db.collection('appSettings').doc('startseite').get();
      const x=snap.data()||{},cfg=x.config||x.startseite||x;
      const grp=(cfg.buttons||[]).find(b=>/ergebnisse\s+turniere\s+intern/i.test(String(b.t||'').replace(/\n/g,' '))&&Array.isArray(b.sub));
      if(!grp){box.innerHTML='<p class="small">Keine internen Cups gefunden.</p>';return;}
      const act=cfg.internActive||{};const [sh,sd]=await Promise.all([pyr('soloPyramide'),pyr('soloPyramideFrauen')]);
      const on=it=>{const k=keyOf(it);if(k==='soloHerren')return sh;if(k==='soloDamen')return sd;return !k||act[k]!==false;};
      const items=grp.sub.filter(it=>it&&it.t&&it.u&&on(it)).sort((a,b)=>(Number.isInteger(a.cell)?a.cell:999)-(Number.isInteger(b.cell)?b.cell:999));
      const label=it=>{const k=keyOf(it);if(k==='cup'&&/^cup/i.test(String(it.t).trim()))return 'Cup Ergebnisse';return String(it.t).replace(/\n/g,' ');};
      box.innerHTML=items.length?items.map((it,i)=>'<button class="tile mz-cup" type="button" data-i="'+i+'"><span class="ico">🏆</span><span><h2>'+label(it).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</h2></span></button>').join(''):'<p class="small">Derzeit ist kein interner Cup aktiv.</p>';
      box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const it=items[+b.dataset.i];let u=String(it.u);
        // Adressen eines anderen Rechners auf diese Seite umbiegen
        try{const p=new URL(u,location.href);const name=p.pathname.split('/').pop();u=new URL(name+p.search+p.hash,location.href).href;}catch(e){}
        location.href=u;});
    }catch(e){box.innerHTML='<p class="small">Cups konnten nicht geladen werden: '+String(e.message||e)+'</p>';}
  }

  const css=document.createElement('style');
  css.textContent='.mz-step{border:1px solid rgba(255,255,255,.18);border-radius:12px;margin:0 0 8px;padding:0 10px}.mz-step-head{display:flex;align-items:center;gap:8px;padding:10px 0;cursor:pointer}'
    +'.mz-num{flex:none;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;background:#555;color:#fff}.mz-step.open .mz-num{background:#a31c28}.mz-step.done .mz-num{background:#1f7a3a}'
    +'.mz-sum{opacity:.8;font-size:.9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.mz-step.open .mz-sum{display:none}.mz-opt{opacity:.7;font-size:.85em}'
    +'.mz-step-body{display:none;padding:0 0 12px}.mz-step.open .mz-step-body{display:block}.mz-nav{display:flex;gap:8px;margin-top:10px}.mz-nav button{flex:1}.mz-steps.mz-all .mz-nav{display:none}'
    +'.mz-cup-grid .tile h2{margin:0}';
  document.head.appendChild(css);

  function init(){
    wrapShow();buildCupView();buildPlannerSteps();
    try{if(!history.state)history.replaceState({mz:'homeView',d:0},'',location.pathname+location.search+location.hash);}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else init();
})();
