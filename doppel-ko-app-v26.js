(()=>{'use strict';
const __health=document.getElementById('dko-js-health');
function __report(err){
  const msg=(err&&err.stack)||String(err||'Unbekannter Fehler');
  if(__health){__health.style.background='#751b2c';__health.style.color='#fff';__health.textContent='✕ JavaScript-Fehler: '+msg.slice(0,850);}
  console.error('DKO V2.6 Initialisierung:',err);
}
if(__health){__health.style.background='#725019';__health.textContent='◌ V2.6: JavaScript geladen – Initialisierung läuft …';}
try {
const __memoryStore=new Map();
let __storageAvailable=true;
const safeStorage={
 getItem(k){try{return window.localStorage.getItem(k)}catch(e){__storageAvailable=false;return __memoryStore.get(k)??null}},
 setItem(k,v){try{window.localStorage.setItem(k,v)}catch(e){__storageAvailable=false;__memoryStore.set(k,String(v))}},
 removeItem(k){try{window.localStorage.removeItem(k)}catch(e){__storageAvailable=false;__memoryStore.delete(k)}}
};
try{safeStorage.setItem('__ecw_probe__','1');safeStorage.removeItem('__ecw_probe__')}catch(e){__storageAvailable=false}

const $=id=>document.getElementById(id);const STORE='ecw_doppel_ko_prototyp_v01';
let state={size:16,name:'EC Wegscheid – Doppel KO',date:'',players:[],results:{},fastMode:false,withdrawn:[],venue:'Stocksporthalle EC Wegscheid',organizer:'EC Wegscheid',director:'EC Wegscheid',turns:{first:6,later:8,final:10},autoSheets:true,sheetPrompts:[]};let graph=null;let activeTab='winner';let editId=null;let correctionMode=false;let turnPlan=null;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seedOrder=n=>{if(n===2)return[1,2];return seedOrder(n/2).flatMap(x=>[x,n+1-x])};
// Der bewusst gewählte Turniermodus bestimmt die Feldgröße; fehlende Plätze sind Freilose.
const effectiveSize=()=>state.size;
const source=(kind,id)=>({kind,id});const slot=i=>({kind:'seed',id:i});
function buildGraph(){let all=[],win=[],lose=[];const add=(id,section,round,a,b)=>{let m={id,section,round,sources:[a,b],a:null,b:null,winner:null,loser:null,ready:false,done:false,auto:false,void:false,score:null};all.push(m);return m};
 let seeds=seedOrder(effectiveSize()).map(s=>slot(s-1));let inputs=seeds;
 for(let r=1;r<=Math.log2(effectiveSize());r++){let matches=[];for(let j=0;j<inputs.length;j+=2)matches.push(add(`W${r}-${j/2+1}`,'winner',r,inputs[j],inputs[j+1]));win.push(matches);inputs=matches.map(m=>source('winner',m.id))}
 let prev=[];const k=Math.log2(effectiveSize());
 for(let w=2;w<=k;w++){
  if(w===2){let r=[];for(let j=0;j<win[0].length;j+=2)r.push(add(`L1-${j/2+1}`,'loser',1,source('loser',win[0][j].id),source('loser',win[0][j+1].id)));lose.push(r);prev=r}
  let r=2*(w-1),even=[];for(let j=0;j<prev.length;j++){let swap=prev.length>1?j^1:j;even.push(add(`L${r}-${j+1}`,'loser',r,source('winner',prev[j].id),source('loser',win[w-1][swap].id)))}lose.push(even);prev=even;
  if(w<k){let odd=[];for(let j=0;j<prev.length;j+=2)odd.push(add(`L${r+1}-${j/2+1}`,'loser',r+1,source('winner',prev[j].id),source('winner',prev[j+1].id)));lose.push(odd);prev=odd}
 }
 let gf=add('GF','final',1,source('winner',win[k-1][0].id),source('winner',prev[0].id));let reset=add('RESET','final',2,source('winner',gf.id),source('loser',gf.id));
 let byId=Object.fromEntries(all.map(m=>[m.id,m]));return{all,win,lose,gf,reset,byId};
}
function calculate(){graph=buildGraph();let changed=false;
 for(const m of graph.all){
  if(m.id==='RESET'&&!graph.gf.done){m.void=true;continue}
  if(m.id==='RESET'&&graph.gf.winner!==graph.gf.b){m.void=true;continue}
  let resolved=m.sources.map(s=>{
   if(s.kind==='seed')return {ready:true,value:state.players[s.id]||null};
   let prev=graph.byId[s.id];return {ready:prev.done,value:prev[s.kind]};
  });
  // Ein bereits feststehender Spieler wird sofort in seinem nächsten Feld angezeigt,
  // auch wenn die zweite Paarung dieser Runde noch gespielt werden muss.
  m.a=resolved[0].ready?resolved[0].value:null;
  m.b=resolved[1].ready?resolved[1].value:null;
  const historical=state.results[m.id];
  if((state.withdrawn||[]).length&&historical&&state.players.includes(historical.a)&&state.players.includes(historical.b)&&Number.isInteger(historical.sa)&&Number.isInteger(historical.sb)&&historical.sa!==historical.sb){
   m.a=historical.a;m.b=historical.b;m.ready=true;m.done=true;
   m.score=[historical.sa,historical.sb];m.winner=historical.sa>historical.sb?m.a:m.b;
   m.loser=historical.sa>historical.sb?m.b:m.a;continue;
  }
  if(!resolved.every(x=>x.ready))continue;
  m.ready=true;
  // Gespielte Begegnungen bleiben historisch unverändert. Abgemeldete Spieler
  // verlieren nur noch offene Begegnungen kampflos, ohne den Turnierbaum neu zu setzen.
  const saved=state.results[m.id];
  if(saved&&saved.a===m.a&&saved.b===m.b&&Number.isInteger(saved.sa)&&Number.isInteger(saved.sb)&&saved.sa!==saved.sb){
    m.score=[saved.sa,saved.sb];m.winner=saved.sa>saved.sb?m.a:m.b;
    m.loser=saved.sa>saved.sb?m.b:m.a;m.done=true;continue;
  }
  const removed=new Set((state.withdrawn||[]).map(i=>state.players[i]));
  if(m.a&&removed.has(m.a))m.a=null;
  if(m.b&&removed.has(m.b))m.b=null;
  if(!m.a&&!m.b){m.done=true;m.void=true;continue}
  // Ein echtes Freilos gilt sofort als gewonnen: ohne Ergebniseingabe,
  // unabhängig davon, ob andere Spiele der aktuellen Runde noch laufen.
  if(!m.a||!m.b){m.done=true;m.auto=true;m.winner=m.a||m.b;continue}
  let oldSaved=state.results[m.id];
  if(oldSaved){if(oldSaved.a!==m.a||oldSaved.b!==m.b||!Number.isInteger(oldSaved.sa)||!Number.isInteger(oldSaved.sb)||oldSaved.sa===oldSaved.sb){delete state.results[m.id];changed=true}
  else{m.score=[oldSaved.sa,oldSaved.sb];m.winner=oldSaved.sa>oldSaved.sb?m.a:m.b;m.loser=oldSaved.sa>oldSaved.sb?m.b:m.a;m.done=true}}
 }
 if(changed)persist();return graph;
}
function persist(){safeStorage.setItem(STORE,JSON.stringify(state));scheduleCloudSave(false)}
// Turnierleitung: Sieger- und Verliererrunden bewusst abwechselnd spielen.
// Innerhalb einer Runde sind alle Begegnungen gleichzeitig zur Eingabe freigegeben.
function stageDefinitions(){
 // Jede Runde bildet eine eigene, parallel spielbare Gruppe. Erst wenn alle
 // Begegnungen entschieden (oder als Freilos automatisch beendet) sind,
 // wird die nächste Runde freigeschaltet. Sieger- und Verliererbaum wechseln.
 const k=Math.log2(effectiveSize()),stages=[{name:'Siegerbaum · Runde 1',ids:graph.win[0].map(m=>m.id)}];
 for(let w=2;w<=k;w++){
  const odd=graph.lose[2*w-4]||[];
  stages.push({name:`Verliererbaum · Runde ${2*w-3}`,ids:odd.map(m=>m.id)});
  stages.push({name:`Siegerbaum · Runde ${w}`,ids:graph.win[w-1].map(m=>m.id)});
  const even=graph.lose[2*w-3]||[];
  stages.push({name:`Verliererbaum · Runde ${2*w-2}`,ids:even.map(m=>m.id)});
 }
 stages.push({name:'Großes Finale',ids:['GF']});
 stages.push({name:'Entscheidungsfinale (falls erforderlich)',ids:['RESET']});
 return stages;
}
function planCurrent(){
 const stages=stageDefinitions();let current=null,activeIds=[],remaining=0;
 if(state.fastMode){
  // Vier-Bahnen-Modus: alle noch offenen, bereits besetzten Paarungen in der
  // üblichen abwechselnden Sieger-/Verliererrunden-Reihenfolge betrachten.
  // Eine Runde muss hier NICHT komplett beendet sein: eine folgende Paarung
  // darf starten, sobald beide Teilnehmer tatsächlich feststehen.
  const reserved=new Set();
  const pending=stages.flatMap(st=>st.ids.map(id=>graph.byId[id])).filter(m=>m&&!m.done&&!m.void);
  for(const m of pending){
   if(activeIds.length>=4)break;
   if(!m.ready||!m.a||!m.b||m.auto)continue;
   // Kein Spieler darf gleichzeitig für zwei Bahnen freigegeben werden.
   if(reserved.has(m.a)||reserved.has(m.b))continue;
   activeIds.push(m.id);reserved.add(m.a);reserved.add(m.b);
  }
  remaining=pending.length;
  const first=pending[0];
  if(first){
   const idx=stages.findIndex(st=>st.ids.includes(first.id)),st=stages[idx];
   const pendingInStage=st.ids.map(id=>graph.byId[id]).filter(m=>m&&!m.done&&!m.void);
   current={...st,index:idx,total:st.ids.length,finished:st.ids.length-pendingInStage.length,remaining:pendingInStage.length};
  }
 }else{
  // Klassischer Modus: die ganze Runde muss abgeschlossen sein, bevor die
  // nächste Runde freigegeben wird. Innerhalb der Runde parallel spielbar.
  for(let i=0;i<stages.length;i++){
   const st=stages[i],pending=st.ids.map(id=>graph.byId[id]).filter(m=>m&&!m.done&&!m.void);
   if(pending.length){
    current={...st,index:i,total:st.ids.length,finished:st.ids.length-pending.length,remaining:pending.length};
    activeIds=pending.filter(m=>m.ready&&m.a&&m.b&&!m.auto).map(m=>m.id);
    remaining=pending.length;break;
   }
  }
 }
 turnPlan={stages,current,activeIds,activeId:activeIds[0]||null,remaining};
 return turnPlan;
}
function matchAccess(m){
 if(m.auto||m.void)return 'automatic';
 if(m.score)return correctionMode?'editable':'finished';
 return turnPlan?.activeIds?.includes(m.id)?'active':'locked';
}
function matchClass(m){const mode=matchAccess(m);return mode==='active'?'turn-active':mode==='locked'?'turn-locked':mode==='finished'?'turn-finished':''}
function readyGames(){return graph.all.filter(m=>m.ready&&!m.done&&m.a&&m.b)}
function metrics(){
 let played=graph.all.filter(m=>m.score).length;let n=state.players.length-(state.withdrawn||[]).length;
 $('sumPlayers').textContent=n;$('sumField').textContent=effectiveSize();
 $('sumGames').textContent=played+' / '+(n>1?(2*n-2+(graph.gf.score&&graph.gf.winner===graph.gf.b?1:0)):0);
 $('sumNext').textContent=state.fastMode?(turnPlan?.activeIds?.length?turnPlan.activeIds.join(' · '):(turnPlan?.current?.name||'Fertig')):(turnPlan?.current?.name|| (graph.gf.done&&(graph.reset.done||graph.reset.void)?'Fertig':'–'));
 $('status').textContent=!n?'Turnier vorbereiten':turnPlan?.current?(state.fastMode?`⚡ 4-Bahnen-Modus · ${turnPlan.activeIds.length} Begegnungen frei`:`${turnPlan.current.name} · nächstes Spiel ${turnPlan.activeId||'wartet'}`):'🏆 Turnier abgeschlossen';
 $('turnBanner').innerHTML=!n?'Teilnehmer eingeben, um die Spielreihenfolge zu starten.':turnPlan?.current?
 (state.fastMode?`<span class="turn-stage">⚡ SCHNELLES SPIEL</span><strong>4 Bahnen · laufende Freigabe</strong><span class="turn-game">JETZT: ${turnPlan.activeIds.length} von 4 möglichen Spielen · ${turnPlan.remaining} noch offen</span>`:
 `<span class="turn-stage">ABSCHNITT ${turnPlan.current.index+1} / ${turnPlan.stages.length}</span><strong>${safe(turnPlan.current.name)}</strong><span class="turn-game">JETZT: ${turnPlan.activeIds.length} Spiele freigegeben · ${turnPlan.current.finished} / ${turnPlan.current.total} erledigt</span>`):
 '<strong>🏆 Turnier abgeschlossen</strong>';
 $('wbCorrection').textContent=correctionMode?'✓ Korrektur beenden':'✎ Korrektur';$('correction').textContent=correctionMode?'✓ Korrekturmodus beenden':'✎ Ergebnisse korrigieren';
 $('correction').classList.toggle('active-correction',correctionMode);$('fastMode').checked=!!state.fastMode;
}
function inlineScore(m,idx,whiteboard=false){
 const access=matchAccess(m);
 if(access==='active'||access==='editable'){
  const value=m.score?m.score[idx]:0;
  return `<span class="touch-score" data-score-input="${safe(m.id)}" data-side="${idx}"><button type="button" class="score-step" data-score-step="${safe(m.id)}" data-side="${idx}" data-delta="-1" aria-label="Punkt abziehen bei ${safe(idx===0?m.a:m.b)}">−</button><output class="score-value" data-score-value>${value}</output><button type="button" class="score-step" data-score-step="${safe(m.id)}" data-side="${idx}" data-delta="1" aria-label="Punkt hinzufügen bei ${safe(idx===0?m.a:m.b)}">+</button></span>`;
 }
 return `<b class="score">${m.score?m.score[idx]:''}</b>`;
}
function scoreActions(m){
 const access=matchAccess(m);
 if(access!=='active'&&access!=='editable')return '';
 return `<span class="score-actions"><button type="button" class="score-action save" data-score-save="${safe(m.id)}" title="Ergebnis speichern" aria-label="Ergebnis ${safe(m.id)} speichern">✓</button>${m.score?`<button type="button" class="score-action clear" data-score-remove="${safe(m.id)}" title="Ergebnis löschen" aria-label="Ergebnis ${safe(m.id)} löschen">↺</button>`:''}</span>`;
}
function finalConfirmButton(m,whiteboard=false){
 // Additional, prominently visible touch target for the decisive final.
 // The original checkmark in the match header is preserved as well.
 if(m.id!=='RESET'||!['active','editable'].includes(matchAccess(m)))return '';
 return `<div class="decider-confirm"><button type="button" class="decider-confirm-btn" data-score-save="RESET" aria-label="Entscheidungsfinale Ergebnis bestätigen">✓ ${whiteboard?'Bestätigen':'Ergebnis bestätigen'}</button></div>`;
}
function matchHtml(m){
 let label=m.section==='winner'?'Siegerbaum':m.section==='loser'?'Verliererbaum':'Finale';
 let status=m.void?'entfällt':m.auto?'FREILOS → weiter':m.score?'gespielt':matchAccess(m)==='active'?'BAHN FREI':'gesperrt';
 let a=m.a||(m.ready&&m.b?'FREILOS':'—'),b=m.b||(m.ready&&m.a?'FREILOS':'—');
 return `<article class="match ${m.score?'done':m.ready&&!m.done?'ready':''} ${matchClass(m)}" data-match-id="${safe(m.id)}"><div class="match-head"><span>${safe(m.id)} · ${label} · ${status}</span>${scoreActions(m)}</div><div class="team ${m.winner&&m.a===m.winner?'winner':''} ${!m.a&&!m.auto?'empty':''} ${!m.a&&m.auto?'bye-team':''}"><span title="${safe(a)}">${safe(a)}</span>${inlineScore(m,0)}</div><div class="team ${m.winner&&m.b===m.winner?'winner':''} ${!m.b&&!m.auto?'empty':''} ${!m.b&&m.auto?'bye-team':''}"><span title="${safe(b)}">${safe(b)}</span>${inlineScore(m,1)}</div>${finalConfirmButton(m)}</article>`;
}
function bracketHtml(rounds,title){return `<div class="scroll"><div class="bracket">${rounds.map((arr,i)=>`<div class="round"><div class="round-head">${title} · Runde ${i+1}<small>${arr.length} ${arr.length===1?'Spiel':'Spiele'}</small></div>${arr.map(matchHtml).join('')}</div>`).join('')}</div></div>`}
function rankings(){let eliminated=[];for(let i=0;i<graph.lose.length;i++){let out=graph.lose[i].filter(m=>m.loser).map(m=>m.loser);if(out.length)eliminated.push({round:i+1,names:out})}
 let rows=[];let n=state.players.length;
 if(graph.gf.done&&(graph.reset.done||graph.reset.void)){let final=graph.reset.done&&!graph.reset.void?graph.reset:graph.gf;rows.push({pos:'1.',name:final.winner,info:'Turniersieger'});rows.push({pos:'2.',name:final.loser,info:'Finale'})}
 else {rows.push({pos:'1.',name:'Noch offen',info:'Finale ausstehend'});rows.push({pos:'2.',name:'Noch offen',info:'Finale ausstehend'})}
 let active=n-eliminated.reduce((a,g)=>a+g.names.length,0);for(let i=eliminated.length-1;i>=0;i--){let g=eliminated[i];let place=n-eliminated.slice(0,i+1).reduce((a,v)=>a+v.names.length,0)+1;for(const name of g.names)rows.push({pos:place+'.',name,info:`Verliererbaum · Runde ${g.round}`})}
 return `<div class="ranking"><h2>Aktuelle Platzierungen</h2><p class="hint">Gleiche Platzierung für Teilnehmer, die in derselben Ausscheidungsrunde ausgeschieden sind. Endgültige Plätze 1 und 2 nach dem Finale.</p>${rows.map(r=>`<div class="rank-row"><div class="pos">${r.pos}</div><strong>${safe(r.name)}</strong><div class="detail">${r.info}</div></div>`).join('')}</div>`}
function render(){calculate();planCurrent();metrics();$('tournamentName').value=state.name;$('tournamentDate').value=state.date;$('fieldSize').value=state.size;$('venue').value=state.venue||'Stocksporthalle EC Wegscheid';$('organizer').value=state.organizer||'EC Wegscheid';$('director').value=state.director||'EC Wegscheid';state.turns=normalizeTurns(state.turns);$('turnsFirst').value=state.turns.first;$('turnsLater').value=state.turns.later;$('turnsFinal').value=state.turns.final;$('autoSheets').checked=state.autoSheets!==false;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===activeTab));let html='';if(!state.players.length)html='<div class="empty-state"><strong>Turnier anlegen</strong>Teilnehmer eingeben und Turnier erstellen.</div>';else if(activeTab==='winner')html='<h2>Siegerbaum</h2><p class="match-note">Von links nach rechts: Gewinner werden automatisch in die nächste Runde gesetzt; Verlierer wechseln in den Verliererbaum.</p>'+bracketHtml(graph.win,'S');else if(activeTab==='loser')html='<h2>Verliererbaum</h2><p class="match-note">Nach der zweiten Niederlage scheidet ein Teilnehmer aus. Freilose werden sofort ohne Ergebnis übernommen und der Spieler direkt in die nächste Runde geschrieben.</p>'+bracketHtml(graph.lose,'V');else if(activeTab==='final')html='<h2 style="text-align:center">Großes Finale</h2><p class="info">Der Sieger des Siegerbaums trifft auf den Sieger des Verliererbaums. Gewinnt der bisher ungeschlagene Teilnehmer, steht der Sieger fest. Gewinnt der Teilnehmer aus dem Verliererbaum, gibt es ein zweites entscheidendes Finale.</p><div class="grand"><div><h3>Finale 1</h3>'+matchHtml(graph.gf)+'</div><div><h3>Entscheidungsfinale (falls nötig)</h3>'+matchHtml(graph.reset)+'</div></div>';else html=rankings();$('content').innerHTML=html;}
function openMatch(id){let m=graph.byId[id];if(!m||!m.ready||!['active','editable'].includes(matchAccess(m)))return;editId=id;$('modalTitle').textContent=id==='GF'?'Finale 1':id==='RESET'?'Entscheidungsfinale':'Ergebnis '+id;$('modalSub').textContent=state.name;$('leftName').textContent=m.a;$('rightName').textContent=m.b;$('scoreA').value=m.score?.[0]??'';$('scoreB').value=m.score?.[1]??'';$('removeScore').disabled=!m.score;$('modal').classList.remove('hidden');$('scoreA').focus()}
function closeModal(){$('modal').classList.add('hidden');editId=null}
function updateScore(remove=false){if(!editId)return;let m=graph.byId[editId];if(!['active','editable'].includes(matchAccess(m)))return;if(remove){delete state.results[editId]}else{let sa=Number($('scoreA').value),sb=Number($('scoreB').value);if($('scoreA').value===''||$('scoreB').value===''||!Number.isInteger(sa)||!Number.isInteger(sb)||sa<0||sb<0||sa>999||sb>999){alert('Bitte zwei gültige ganze Ergebnisse zwischen 0 und 999 eingeben.');return}if(sa===sb){alert('Im Doppel-KO muss es einen Sieger geben. Bitte ein entscheidendes Ergebnis eintragen.');return}state.results[editId]={a:m.a,b:m.b,sa,sb}}
 persist();closeModal();render();syncReleasedSheets(true);scheduleCloudSave(true)}

// Stammliste ist aus der bestehenden Turnierauslosung übernommen (Stand der Testversion).
// Keine direkte Firebase- oder Mitgliederverwaltungs-Abfrage in dieser lokalen Testdatei.
const ECW_ROSTER=["Allmannsberger Adi", "Bauer Patrick", "Breitenfellner Astrid", "Breitenfellner Lisa", "Breitenfellner Paul", "Breitenfellner Philipp", "Breitenfellner Thomas", "Dobretsberger Bettina", "Eberhardt Christian", "Eberhardt Toni", "Fesl Simon", "Fesl Thomas", "Freund Heiner", "Freund Johannes", "Freund Jonas", "Freund Stefan", "Gottinger Klaus", "Gottinger Renate", "Grimbs Daniela", "Haselbeck Wolfgang", "Heidinger Günter", "Hellauer Herbert", "Hellauer Manfred", "Hellauer Matthias", "Hirz Monika", "Hogger Diana", "Hogger Luca", "Hogger Madeleine", "Hogger Matthias", "Höglinger Heinz", "Höglinger Juliane", "Höglinger Paul", "Hoheneder Angelika", "Hoheneder Tobias", "Kasberger Tobias", "Knollmüller Heinz", "Kössler Julian", "Krause Joachim", "Kutnik Michael", "Ledermüller Martina", "Ledermüller Michael", "Münichshofer Timo", "Neussl Josef", "Pendelin Manuel", "Pendelin Neo", "Pilsl Alexander", "Resch Christina", "Resch Daniel", "Resch Johannes", "Resch Katharina", "Resch Michael", "Richtsfeld Thomas", "Schaubschläger Thomas", "Schichl Josef", "Simml Felix", "Simml Hannah", "Simml Lothar", "Simml Renate", "Simml Thomas", "Stadler Annemarie", "Stadler Martin", "Steininger Dirk", "Steininger Fritz", "Steininger Jürgen", "Stemplinger Kerstin", "Stögbauer Lukas", "Stögmüller Gerhard", "Stoiber Franz", "Weiss Wolfgang"];
const rosterChecked=new Set();
const playerKey=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');
const inputNames=()=> $('players').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
function showRosterMessage(msg,error=false){const el=$('rosterFeedback');el.textContent=msg;el.classList.toggle('error',error)}
let lastRosterCount=null;
function updateModeChoices(){
 const n=inputNames().length,sel=$('fieldSize'),eligible=[8,16,32].filter(size=>n>=2&&n<=size);
 const countChanged=lastRosterCount!==null&&lastRosterCount!==n;
 for(const opt of sel.options)opt.disabled=!eligible.includes(Number(opt.value));
 sel.disabled=eligible.length===0;
 if(eligible.length&&(countChanged||!eligible.includes(Number(sel.value))))sel.value=String(eligible[0]);
 $('create').disabled=eligible.length===0;
 $('modeHint').textContent=n<2?'Bitte zuerst mindestens 2 Spieler hinzufügen.':n>32?'Maximal 32 Spieler möglich. Bitte Teilnehmerliste kürzen.':`${n} Spieler ausgewählt · verfügbare Felder: ${eligible.map(x=>x+'er').join(', ')}. Vorschlag: ${eligible[0]}er-Feld.`;
 lastRosterCount=n;
}
function updateRosterSlots(){const n=inputNames().length;$('rosterSlots').textContent=`${n} / 32 Spieler`;$('rosterSlots').style.color=n>32?'#ff9a9a':'#f3cb72';updateModeChoices();}
function renderRoster(){
 const current=new Set(inputNames().map(playerKey)),query=playerKey($('rosterSearch').value);
 const visible=ECW_ROSTER.filter(name=>playerKey(name).includes(query));
 $('rosterGrid').innerHTML=visible.map(name=>{
  const added=current.has(playerKey(name)),checked=rosterChecked.has(name);
  return `<label class="roster-option ${added?'in-list':''}" title="${safe(name)}"><input type="checkbox" data-roster-name="${safe(name)}" ${checked?'checked':''} ${added?'disabled':''}><span>${safe(name)}${added?' ✓':''}</span></label>`;
 }).join('')||'<div style="padding:15px;color:#e5b8c0">Keine passenden Spieler gefunden.</div>';
 $('rosterCount').textContent=`${rosterChecked.size} angehakt · ${visible.length} Vorschläge sichtbar · ${ECW_ROSTER.length} insgesamt`;
 updateRosterSlots();renderPlayerManager();
}
function renderPlayerManager(){
 const current=inputNames(),withdrawn=new Set(state.withdrawn||[]);
 $('playerManager').innerHTML=current.map((name,i)=>`<div class="player-manager-row"><span title="${safe(name)}">${safe(name)}</span><button class="player-remove" type="button" data-remove-player="${safe(name)}" aria-label="${safe(name)} entfernen" title="Spieler entfernen">✕</button></div>`).join('');
 $('withdrawnNote').textContent=withdrawn.size?`${withdrawn.size} Spieler während des laufenden Turniers abgemeldet (frühere Ergebnisse bleiben erhalten): ${[...withdrawn].map(i=>state.players[i]).join(', ')}`:'';
}
function removePlayer(name){
 const names=inputNames(),i=names.findIndex(n=>playerKey(n)===playerKey(name));if(i<0)return;
 const started=Object.keys(state.results).length>0;
 if(!confirm(started?`${name} vom laufenden Turnier abmelden? Bereits gespielte Ergebnisse bleiben erhalten. Offene Spiele mit diesem Spieler werden kampflos gewertet.`:`${name} aus der Teilnehmerliste entfernen?`))return;
 if(started){
  const seed=state.players.findIndex((n,j)=>playerKey(n)===playerKey(name)&&!(state.withdrawn||[]).includes(j));
  if(seed<0){alert('Dieser Spieler ist nicht als aktiver Teilnehmer im Turnier vorhanden.');return;}
  state.withdrawn=[...new Set([...(state.withdrawn||[]),seed])];
 }else{
  // Noch keine Ergebnisse: das bestehende Turnierfeld direkt neu setzen.
  if(state.players.length){state.players=state.players.filter(n=>playerKey(n)!==playerKey(name));state.withdrawn=[];}
 }
 names.splice(i,1);$('players').value=names.join('\n');
 if(!started&&state.players.length<2){state.players=[];state.results={};}
 persist();render();renderRoster();
}
$('playerManager').addEventListener('click',e=>{const b=e.target.closest('[data-remove-player]');if(b)removePlayer(b.dataset.removePlayer)});
function addParticipants(names){
 const size=32,current=inputNames(),existing=new Set(current.map(playerKey));
 let added=0,duplicates=0,full=0;
 for(const raw of names){const name=String(raw).trim().replace(/\s+/g,' ');if(!name)continue;
  const key=playerKey(name);if(existing.has(key)){duplicates++;continue}
  if(current.length>=size){full++;continue}
  current.push(name);existing.add(key);added++;
 }
 $('players').value=current.join('\n');renderRoster();
 showRosterMessage(`${added} Spieler hinzugefügt.${duplicates?' '+duplicates+' bereits vorhanden.':''}${full?' '+full+' wegen voller Teilnehmerliste nicht übernommen.':''}`,full>0||added===0);
 return added;
}
$('rosterToggle').onclick=()=>{const body=$('rosterBody'),open=body.classList.toggle('hidden')===false;$('rosterToggle').setAttribute('aria-expanded',String(open));$('rosterChevron').textContent=open?'⌃':'⌄'};
$('rosterSearch').addEventListener('input',renderRoster);
$('players').addEventListener('input',renderRoster);
$('fieldSize').addEventListener('change',renderRoster);
$('rosterGrid').addEventListener('change',e=>{const cb=e.target.closest('input[data-roster-name]');if(!cb)return;const name=cb.dataset.rosterName;if(cb.checked)rosterChecked.add(name);else rosterChecked.delete(name);renderRoster()});
$('rosterAll').onclick=()=>{const query=playerKey($('rosterSearch').value),existing=new Set(inputNames().map(playerKey));ECW_ROSTER.filter(n=>playerKey(n).includes(query)&&!existing.has(playerKey(n))).forEach(n=>rosterChecked.add(n));renderRoster()};
$('rosterNone').onclick=()=>{rosterChecked.clear();renderRoster()};
$('rosterAdd').onclick=()=>{addParticipants(ECW_ROSTER.filter(n=>rosterChecked.has(n)));rosterChecked.clear();renderRoster()};
function addGuest(){const input=$('guestName'),name=input.value.trim();if(!name){showRosterMessage('Bitte zuerst einen Namen eingeben.',true);input.focus();return}if(addParticipants([name]))input.value=''}
$('guestAdd').onclick=addGuest;
$('guestName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addGuest()}});

function makeTournament(){let size=Number($('fieldSize').value),name=$('tournamentName').value.trim()||'Doppel KO',date=$('tournamentDate').value;let names=$('players').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(![8,16,32].includes(size)||names.length<2||names.length>size){alert('Bitte zuerst mindestens 2 Spieler auswählen und danach ein ausreichend großes Turnierfeld wählen.');return}if(new Set(names.map(s=>s.toLocaleLowerCase('de'))).size!==names.length){alert('Teilnehmernamen müssen eindeutig sein.');return}if(Object.keys(state.results).length&&!confirm('Alle bisherigen Ergebnisse zurücksetzen und Turnier neu erstellen?'))return;if(soloPrintCurrent)finishSoloPrint(false);soloPrintQueue.length=0;soloQueueStatus();state={size,name,date,players:names,results:{},fastMode:$('fastMode').checked,withdrawn:[],venue:$('venue').value.trim(),organizer:$('organizer').value.trim(),director:$('director').value.trim(),turns:normalizeTurns({first:$('turnsFirst').value,later:$('turnsLater').value,final:$('turnsFinal').value}),autoSheets:$('autoSheets').checked,sheetPrompts:[]};correctionMode=false;cloudEnsureId();persist();activeTab='winner';renderRoster();render();syncReleasedSheets(true);scheduleCloudSave(true);}
$('create').onclick=makeTournament;$('example').onclick=()=>{const count=9;$('players').value=Array.from({length:count},(_,i)=>'Spieler '+(i+1)).join('\n');$('tournamentName').value='EC Wegscheid – Testturnier';renderRoster()};$('clear').onclick=()=>{if(!confirm('Turnier und alle lokalen Ergebnisse löschen?'))return;if(soloPrintCurrent)finishSoloPrint(false);soloPrintQueue.length=0;soloQueueStatus();state={size:16,name:'EC Wegscheid – Doppel KO',date:'',players:[],results:{},fastMode:false,withdrawn:[],venue:'Stocksporthalle EC Wegscheid',organizer:'EC Wegscheid',director:'EC Wegscheid',turns:{first:6,later:8,final:10},autoSheets:true,sheetPrompts:[]};correctionMode=false;cloudResetSelection();persist();$('players').value='';rosterChecked.clear();renderRoster();render()};$('fastMode').onchange=()=>{if(!state.players.length)return;const selected=$('fieldSize').value,enteredName=$('tournamentName').value,enteredDate=$('tournamentDate').value,enteredVenue=$('venue').value,enteredOrg=$('organizer').value,enteredDirector=$('director').value;state.fastMode=$('fastMode').checked;persist();render();$('fieldSize').value=selected;$('tournamentName').value=enteredName;$('tournamentDate').value=enteredDate;$('venue').value=enteredVenue;$('organizer').value=enteredOrg;$('director').value=enteredDirector;if(!$('wbView').classList.contains('hidden'))renderWhiteboard()};$('toggleSetup').onclick=()=>{let field=$('players').parentElement;field.classList.toggle('hidden');$('toggleSetup').textContent=field.classList.contains('hidden')?'Teilnehmer anzeigen':'Teilnehmer ausblenden'};
// Ergebnis direkt in der jeweiligen Spielkarte speichern – auch im Whiteboard.
function commitInline(id,container,remove=false){
 const m=graph.byId[id];if(!m||!m.ready||!m.a||!m.b||m.auto||m.void)return;
 const access=matchAccess(m);if(access!=='active'&&access!=='editable')return;
 const scores=[...container.querySelectorAll('[data-score-input]')].filter(el=>el.dataset.scoreInput===id);
 if(!remove){
  const a=scores.find(el=>el.dataset.side==='0'),b=scores.find(el=>el.dataset.side==='1');if(!a||!b)return;
  const sa=Number(a.querySelector('[data-score-value]')?.textContent),sb=Number(b.querySelector('[data-score-value]')?.textContent);
  if(!Number.isInteger(sa)||!Number.isInteger(sb)||sa<0||sb<0||sa>999||sb>999){alert('Bitte ein gültiges Ergebnis zwischen 0 und 999 einstellen.');return}
  if(sa===sb){alert('Es muss einen Sieger geben. Bitte mit + oder − ein eindeutiges Ergebnis einstellen.');return}
  if(m.score&&m.score[0]===sa&&m.score[1]===sb)return;
  if(m.score&&!confirm('Ergebnis ändern? Abhängige Folgeergebnisse können dadurch zurückgesetzt werden.'))return;
  state.results[id]={a:m.a,b:m.b,sa,sb};
 }else{
  if(!m.score||!confirm('Ergebnis wirklich löschen? Abhängige Folgeergebnisse können ebenfalls zurückgesetzt werden.'))return;
  delete state.results[id];
 }
 const wbVisible=!$('wbView').classList.contains('hidden');
 const positions={};if(wbVisible){for(const k of ['wbLoser','wbWinner']){const el=$(k);positions[k]=[el.scrollLeft,el.scrollTop]}}else{const el=$('content').querySelector('.scroll');if(el)positions.main=[el.scrollLeft,el.scrollTop]}
 persist();calculate();planCurrent();if(!wbVisible&&!correctionMode&&turnPlan.activeId){activeTab=graph.byId[turnPlan.activeId].section;}render();
 if(wbVisible){renderWhiteboard();}
 else if(positions.main){const el=$('content').querySelector('.scroll');if(el){el.scrollLeft=positions.main[0];el.scrollTop=positions.main[1]}}
 syncReleasedSheets(true);scheduleCloudSave(true);
}
document.addEventListener('click',e=>{
 const step=e.target.closest('[data-score-step]');
 if(step){const card=step.closest('.match,.wb-match,.wb-final-game');if(!card)return;
  const id=step.dataset.scoreStep,m=graph.byId[id];if(!m||!['active','editable'].includes(matchAccess(m)))return;
  const parent=step.closest('[data-score-input]'),output=parent?.querySelector('[data-score-value]');if(!output)return;
  const value=Math.max(0,Math.min(999,Number(output.textContent)+Number(step.dataset.delta)));
  output.textContent=String(value);return;
 }
 const save=e.target.closest('[data-score-save]'),remove=e.target.closest('[data-score-remove]');
 if(!save&&!remove)return;
 const button=save||remove,card=button.closest('.match,.wb-match,.wb-final-game');if(card)commitInline(save?save.dataset.scoreSave:remove.dataset.scoreRemove,card,!!remove);
});
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{activeTab=t.dataset.tab;render()});$('cancel').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};$('saveScore').onclick=()=>updateScore();$('removeScore').onclick=()=>{if(confirm('Ergebnis löschen? Nachfolgende Spiele können dadurch ebenfalls ungültig werden.'))updateScore(true)};document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('wbView').classList.contains('hidden')?closeModal():exitWhiteboard()}});

// A4-Ergebnisliste nach der vom Verein bereitgestellten Herbstturnier-Vorlage.
const ECW_PRINT_BANNER='data:image/jpeg;base64,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';
// V2.1 Wertungsblätter: eine A4-Querformat-Seite pro freigegebener Begegnung.
const turnsDefaults={first:6,later:8,final:10};
function normalizeTurns(t){const out={};for(const k of ['first','later','final']){const n=Number(t?.[k]);out[k]=Number.isInteger(n)&&n>=1&&n<=20?n:turnsDefaults[k]}return out;}
function readSheetSettings(){state.turns=normalizeTurns({first:$('turnsFirst').value,later:$('turnsLater').value,final:$('turnsFinal').value});state.autoSheets=$('autoSheets').checked;persist();}
function turnsForMatch(m){const t=normalizeTurns(state.turns);return m.section==='final'?t.final:(m.round===1?t.first:t.later);}
function sheetKey(m){return [m.id,m.a,m.b].join('|');}
function stageLabel(m){if(m.section==='winner')return 'Siegerbaum · Runde '+m.round;if(m.section==='loser')return 'Verliererbaum · Runde '+m.round;return m.id==='RESET'?'Entscheidungsfinale':'Großes Finale';}
function laneForMatch(m){if(!state.fastMode)return '—';const idx=turnPlan?.activeIds?.indexOf(m.id)??-1;return idx>=0?String(idx+1):'—';}
function printSheetHtml(matches,auto,embedded=false){
 // Vorlage "Solo Spiegel 1x.pdf": Schwarz-weiß, gleiche Aufteilung,
 // Beschriftungen und Unterschriften. Nur Kehrenspaltenzahl wird angepasst.
 const tournament=safe(state.name||'Doppel KO');
 const date=state.date?new Date(state.date+'T12:00:00').toLocaleDateString('de-DE'):'____________';
 const sheets=matches.map(m=>{
  const turns=turnsForMatch(m),lane=laneForMatch(m);
  const columns=Array.from({length:turns},()=>'<span class="turn-cell"></span>').join('');
  const stage=m.section==='winner'?'Vorrunde '+m.round:(m.section==='loser'?'Verliererrunde '+m.round:(m.id==='RESET'?'Entscheidungsfinale':'Finale'));
  return `<article class="solo-sheet" data-match="${safe(m.id)}" data-turns="${turns}">
    <div class="solo-top"><div>Spiel Nr.</div><div class="value">${safe(m.id)}</div><div class="stage">${safe(stage)}</div><div>Bahn</div><div class="value">${lane}</div><div class="top-blank"></div></div>
    <div class="solo-players"><div><b>Spieler 1 -</b><strong>${safe(m.a)}</strong></div><div><b>Spieler 2 -</b><strong>${safe(m.b)}</strong></div></div>
    <div class="solo-scores" style="--turns:${turns}">
      <div class="solo-half solo-left"><div class="solo-heading"><span>Anschuss</span><span>Eigene Stockpunkte</span><span>Stock-<br>punkte</span><span>Punkte</span></div><div class="solo-entry"><div class="anschuss">Spieler 1</div><div class="turn-grid">${columns}</div><div class="stock-col"></div><div class="points-col"></div></div></div>
      <div class="solo-half solo-right"><div class="solo-heading"><span>Fremde Stockpunkte</span><span>Stock-<br>punkte</span><span>Punkte</span></div><div class="solo-entry"><div class="turn-grid">${columns}</div><div class="stock-col"></div><div class="points-col"></div></div></div>
    </div>
    <div class="solo-bottom"><div class="sig"><b>Unterschrift für Spieler 2</b><span></span></div><div class="sig date"><b>Datum</b><span>${date}</span></div><div class="sig"><b>Unterschrift für Spieler 1</b><span></span></div></div>
   </article>`;
 }).join('');
 const style=`
 @page{size:A4 landscape;margin:7mm}
 *{box-sizing:border-box}html,body{margin:0}body{background:#dedede;font-family:Arial,Helvetica,sans-serif;color:#050505}
 .print-toolbar{position:sticky;top:0;z-index:10;background:#24191b;color:white;display:flex;align-items:center;justify-content:center;gap:10px;padding:11px;font-size:14px}
 .print-toolbar button{background:#a21e33;color:white;border:0;border-radius:5px;padding:9px 13px;font-weight:bold;cursor:pointer}
 .solo-sheet{background:white;width:283mm;height:133mm;margin:25px auto 22px;display:flex;flex-direction:column;border:2.5px solid black;overflow:hidden}
 .solo-top{display:grid;grid-template-columns:21mm 13mm minmax(0,1fr) 19mm 12mm 77mm;height:20mm;border-bottom:2.5px solid black;flex:none}
 .solo-top>div{border-right:1.5px solid black;display:flex;align-items:center;justify-content:center;font-size:12pt;white-space:nowrap}
 .solo-top>div:last-child{border-right:0}.solo-top .stage{font-size:21pt;font-weight:800}.solo-top .value{font-size:11pt;font-weight:700}
 .solo-players{display:grid;grid-template-columns:1fr 1fr;height:27mm;border-bottom:2px solid black;flex:none}
 .solo-players>div{display:flex;gap:7mm;align-items:center;min-width:0;padding:0 4mm;font-size:15pt}
 .solo-players>div:first-child{border-right:3px solid black}.solo-players b{font-style:italic;font-size:14pt;white-space:nowrap}.solo-players strong{font-size:17pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .solo-scores{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0;border-bottom:2.5px solid black}
 .solo-half{min-width:0;display:flex;flex-direction:column}.solo-left{border-right:3px solid black}
 .solo-heading{height:13mm;display:grid;border-bottom:1.5px solid black;flex:none}
 .solo-left .solo-heading,.solo-left .solo-entry{grid-template-columns:14mm minmax(0,1fr) 14mm 14mm}
 .solo-right .solo-heading,.solo-right .solo-entry{grid-template-columns:minmax(0,1fr) 14mm 14mm}
 .solo-heading>span{font-size:10pt;text-align:center;display:flex;align-items:center;justify-content:center;border-right:1.5px solid black;font-weight:bold}
 .solo-heading>span:last-child{border-right:0}
 .solo-entry{display:grid;flex:1;min-height:0}
 .solo-entry>.anschuss{display:flex;align-items:center;justify-content:center;font-size:9pt;font-weight:bold;border-right:1.5px solid black}
 .turn-grid{display:grid;grid-template-columns:repeat(var(--turns),minmax(0,1fr));min-width:0}
 .turn-cell{border-right:1.2px solid black}.turn-cell:last-child{border-right:0}
 .stock-col{border-left:3px solid black;border-right:3px solid black}.points-col{border-right:0}
 .solo-bottom{display:grid;grid-template-columns:1fr 33mm 1fr;gap:9mm;align-items:stretch;height:31mm;flex:none;padding:3mm 3mm 2mm}
 .sig{display:flex;flex-direction:column;justify-content:space-between;font-size:11pt;font-style:italic}
 .sig span{display:block;border-bottom:2px solid black;min-height:9mm;font-size:10pt;font-style:normal;text-align:center;padding-top:5mm}
 .sig.date{text-align:center}.sig.date span{min-height:10mm}
 @media print{body{background:white}.print-toolbar{display:none!important}.solo-sheet{width:100%;height:133mm;margin:31mm 0 0;border:2.5px solid black;page-break-after:auto;break-after:auto;page-break-inside:avoid;break-inside:avoid}}
 `;
 // Für den Direktdruck liegt die Druckvorlage in einem unsichtbaren iframe.
 // Es wird KEINE zusätzliche sichtbare Vorschauseite geöffnet.
 if(embedded)return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Wertungsblatt</title><style>${style}</style></head><body>${sheets}</body></html>`;
 // Einmaliger automatischer Aufruf pro Blatt: doppelte afterprint-Ereignisse,
 // wiederholte Browser-Events oder schnelle Klicks dürfen keinen zweiten Auftrag erzeugen.
 const script=`<scr${'ipt'}>
 (function(){
  const jobs=Array.from(document.querySelectorAll('.solo-sheet'));
  const status=document.getElementById('job-status');
  const btn=document.getElementById('print-next');
  const skip=document.getElementById('skip-next');
  const automatically=${auto?'true':'false'};
  const autoStarted=new Set();
  let index=0, activePrint=null, pendingAdvance=null, advanceSerial=0;
  function show(){
   jobs.forEach((el,i)=>el.style.display=i===index?'flex':'none');
   status.textContent='Wertungsblatt '+(index+1)+' von '+jobs.length+' · Spiel '+jobs[index].dataset.match+' · 1 A4-Seite';
   btn.textContent=autoStarted.has(index)?'Bei Bedarf nachdrucken':'Drucken: Spiel '+jobs[index].dataset.match;
   btn.disabled=activePrint!==null;
   skip.disabled=activePrint!==null || index===jobs.length-1;
  }
  function printOne(isAutomatic){
   if(activePrint!==null)return;
   if(isAutomatic && autoStarted.has(index))return;
   if(isAutomatic)autoStarted.add(index);
   if(pendingAdvance!==null){clearTimeout(pendingAdvance);pendingAdvance=null;}
   activePrint=index;
   show();
   window.focus();
   window.print();
  }
  function advance(){
   if(activePrint!==null || index>=jobs.length-1)return;
   advanceSerial++;
   if(pendingAdvance!==null){clearTimeout(pendingAdvance);pendingAdvance=null;}
   index++;show();
   if(automatically && !autoStarted.has(index)){
    const serial=advanceSerial;
    pendingAdvance=setTimeout(()=>{pendingAdvance=null;if(serial===advanceSerial && activePrint===null)printOne(true);},900);
   }
  }
  window.addEventListener('afterprint',()=>{
   if(activePrint===null)return; // zweites afterprint ignorieren
   const finished=activePrint;
   activePrint=null;
   show();
   if(automatically && finished===index && index<jobs.length-1){
    const serial=++advanceSerial;
    if(pendingAdvance!==null)clearTimeout(pendingAdvance);
    pendingAdvance=setTimeout(()=>{pendingAdvance=null;if(serial===advanceSerial && activePrint===null)advance();},850);
   }
  });
  btn.onclick=()=>printOne(false);
  skip.onclick=advance;
  show();
  if(automatically)setTimeout(()=>printOne(true),500);
 })();<\/scr${'ipt'}>`;
 return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>EC Wegscheid · Solo-Spiegel Wertungsblätter</title><style>${style}</style></head><body><div class="print-toolbar"><span id="job-status"></span><button id="print-next">Drucken</button><button id="skip-next">Nächstes Blatt</button><button onclick="window.close()">Schließen</button></div>${sheets}${script}</body></html>`;
}
// V2.1: Pro NEU freigegebener Spielpaarung ein EIGENER Druckdialog.
// "1x" gilt PRO PAARUNG, nicht einmalig pro Turnier. Der Browser darf
// wiederholte Dialoge blockieren: daher bleibt ein direkter Touch-Druckbutton sichtbar.
const soloPrintQueue=[];
let soloPrintCurrent=null,soloPrintFrame=null,soloPrintNextTimer=null;
let soloPrintStarted=false,soloPrintFrameReady=false,soloPrintGeneration=0;
function soloQueueStatus(){
 let el=document.getElementById('solo-queue-status');
 if(!el){el=document.createElement('div');el.id='solo-queue-status';
  el.style.cssText='position:fixed;bottom:16px;right:16px;z-index:99999;background:#24191b;color:#fff;border:1px solid #e45a6c;border-radius:10px;padding:12px 14px;box-shadow:0 6px 30px #0009;font:14px Arial;max-width:440px';
  el.innerHTML='<span id="solo-queue-text"></span> <button id="solo-queue-next" type="button" style="background:#a21e33;color:white;border:0;padding:9px 11px;border-radius:6px;cursor:pointer;margin-left:8px;font-weight:bold">Wertungsblatt drucken</button>';
  document.body.appendChild(el);
  document.getElementById('solo-queue-next').onclick=()=>{
   // Direkter Benutzerklick ist zuverlässiger als ein automatischer Folgedialog.
   if(soloPrintCurrent){
    if(soloPrintStarted){finishSoloPrint(false);runSoloPrint(true);}
    else if(soloPrintFrameReady){launchSoloPrint(true);}
   }else runSoloPrint(true);
  };
 }
 const remaining=soloPrintQueue.length;
 el.style.display=(soloPrintCurrent||remaining)?'block':'none';
 if(soloPrintCurrent||remaining){
  document.getElementById('solo-queue-text').textContent=soloPrintCurrent?
   'Spiel '+soloPrintCurrent.match.id+' · '+(remaining?remaining+' weitere Blätter warten':'1 Wertungsblatt'):
   remaining+' Wertungsblatt'+(remaining===1?'':'blätter')+' bereit';
  document.getElementById('solo-queue-next').textContent=soloPrintCurrent&&soloPrintStarted?'Nächstes Wertungsblatt':'Wertungsblatt drucken';
 }
}
function finishSoloPrint(autoContinue=true){
 if(!soloPrintCurrent)return;
 const frame=soloPrintFrame;
 soloPrintCurrent=null;soloPrintFrame=null;soloPrintStarted=false;soloPrintFrameReady=false;
 soloPrintGeneration++;
 if(frame)frame.remove();
 if(soloPrintNextTimer){clearTimeout(soloPrintNextTimer);soloPrintNextTimer=null;}
 soloQueueStatus();
 if(autoContinue&&soloPrintQueue.length){
  soloPrintNextTimer=setTimeout(()=>{soloPrintNextTimer=null;runSoloPrint();},700);
 }
}
function launchSoloPrint(userGesture=false){
 if(!soloPrintCurrent||!soloPrintFrameReady||soloPrintStarted||!soloPrintFrame)return;
 const job=soloPrintCurrent,frame=soloPrintFrame;
 soloPrintStarted=true;
 soloQueueStatus();
 try{frame.contentWindow.focus();frame.contentWindow.print();}
 catch(e){console.error('Druckdialog konnte nicht geöffnet werden',e);
  soloPrintStarted=false;soloQueueStatus();}
}
function runSoloPrint(userGesture=false){
 if(soloPrintCurrent||!soloPrintQueue.length)return;
 if(soloPrintNextTimer){clearTimeout(soloPrintNextTimer);soloPrintNextTimer=null;}
 const job=soloPrintQueue.shift();soloPrintCurrent=job;
 soloPrintStarted=false;soloPrintFrameReady=false;
 const generation=++soloPrintGeneration;
 const frame=document.createElement('iframe');soloPrintFrame=frame;
 frame.setAttribute('title','Wertungsblatt '+job.match.id);
 frame.setAttribute('aria-hidden','true');
 frame.style.cssText='position:fixed;left:-200vw;top:0;width:1123px;height:794px;border:0;opacity:0;pointer-events:none';
 frame.onload=()=>{
  if(soloPrintCurrent!==job||soloPrintGeneration!==generation)return;
  soloPrintFrameReady=true;
  try{
   frame.contentWindow.addEventListener('afterprint',()=>{
    if(soloPrintCurrent===job&&soloPrintGeneration===generation)finishSoloPrint();
   });
   // Falls der Browser "afterprint" nur am Hauptfenster meldet,
   // bleibt der manuelle Folgedruck-Button als sichere Alternative.
   setTimeout(()=>{
    if(soloPrintCurrent===job&&soloPrintGeneration===generation)launchSoloPrint(userGesture);
   },120);
  }catch(e){console.error('Druckvorlage konnte nicht geladen werden',e);soloPrintStarted=false;soloQueueStatus();}
 };
 document.body.appendChild(frame);
 frame.srcdoc=printSheetHtml([job.match],false,true);
 soloQueueStatus();
}
function openSheets(matches,auto=false){
 if(!matches.length){if(!auto)alert('Keine freigegebenen Paarungen vorhanden.');return false;}
 let added=0;
 for(const m of matches){
  const key=sheetKey(m);
  // Doppelte Automatik-Ereignisse pro Paarung abfangen, NICHT weitere Paarungen sperren.
  if(auto&&(soloPrintCurrent?.key===key||soloPrintQueue.some(j=>j.key===key)))continue;
  soloPrintQueue.push({match:m,key});added++;
 }
 soloQueueStatus();
 if(!soloPrintCurrent){runSoloPrint();}
 return added>0;
}
function syncReleasedSheets(automatic){if(!state.players.length)return;
 const prompted=new Set(state.sheetPrompts||[]);
 const fresh=(turnPlan?.activeIds||[]).map(id=>graph.byId[id]).filter(m=>m&&m.ready&&!m.done&&m.a&&m.b&&!prompted.has(sheetKey(m)));
 if(!fresh.length)return;
 if(automatic&&state.autoSheets){
  // Wird bereits die NÄCHSTE Begegnung gespielt, ist der vorherige Druckdialog
  // definitiv nicht mehr im Vordergrund. Bei fehlendem afterprint die Warteschlange lösen.
  if(soloPrintCurrent&&soloPrintStarted)finishSoloPrint(false);
  if(openSheets(fresh,true)){
   state.sheetPrompts=[...prompted,...fresh.map(sheetKey)];persist();
  }
 }
}
function printActiveSheets(){calculate();planCurrent();
 const matches=(turnPlan?.activeIds||[]).map(id=>graph.byId[id]).filter(m=>m&&m.ready&&!m.done&&m.a&&m.b);
 if(openSheets(matches,false)){
  const keys=new Set(state.sheetPrompts||[]);matches.forEach(m=>keys.add(sheetKey(m)));
  state.sheetPrompts=[...keys];persist();
 }
}
$('printSheets').onclick=printActiveSheets;$('wbPrintSheets').onclick=printActiveSheets;
$('autoSheets').addEventListener('change',readSheetSettings);
for(const id of ['turnsFirst','turnsLater','turnsFinal'])$(id).addEventListener('change',readSheetSettings);
function printResultSheet(){
 calculate();planCurrent();
 if(!state.players.length){alert('Bitte zuerst ein Turnier anlegen.');return;}
 const finished=graph.gf.done&&(graph.reset.done||graph.reset.void);
 if(!finished&&!confirm('Das Turnier ist noch nicht abgeschlossen. Eine vorläufige Ergebnisliste als Zwischenstand öffnen?'))return;
 const inputDate=$('tournamentDate').value||state.date;
 const date=inputDate?new Date(inputDate+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}):'–';
 const eliminated=[];
 for(let i=0;i<graph.lose.length;i++){
  const names=graph.lose[i].filter(m=>m.loser).map(m=>m.loser);
  if(names.length)eliminated.push({round:i+1,names});
 }
 const withdrawn=new Set((state.withdrawn||[]).map(i=>state.players[i]));
 let places=[];
 if(finished){
  const f=graph.reset.done&&!graph.reset.void?graph.reset:graph.gf;
  places.push({rank:1,name:f.winner},{rank:2,name:f.loser});
 }
 const originalN=state.players.length;
 for(let i=eliminated.length-1;i>=0;i--){
  const rank=originalN-eliminated.slice(0,i+1).reduce((a,g)=>a+g.names.length,0)+1;
  eliminated[i].names.forEach(name=>places.push({rank,name}));
 }
 // Abgemeldete Spieler separat kennzeichnen; nicht fälschlich als reguläre Sieger ausweisen.
 for(const name of withdrawn)if(!places.some(p=>p.name===name))places.push({rank:'–',name,status:'Abgemeldet'});
 const remaining=state.players.filter(n=>!withdrawn.has(n)&&!places.some(p=>p.name===n));
 if(!finished)remaining.forEach(name=>places.push({rank:'–',name,status:'Platzierung offen'}));
 const sheetTitle=($('tournamentName').value.trim()||state.name);
 const venue=$('venue').value.trim()||state.venue||'–';
 const organizer=$('organizer').value.trim()||state.organizer||'–';
 const director=$('director').value.trim()||state.director||'–';
 // Druckdaten für die lokale Testversion aktualisieren, ohne Ergebnisse zu verändern.
 state.name=sheetTitle;state.date=$('tournamentDate').value;state.venue=venue;state.organizer=organizer;state.director=director;persist();
 const printClass=places.length>16?'compact-32':places.length>8?'compact-16':'compact-8';
 const rows=places.map((p,i)=>`<tr><td>${safe(p.rank==='–'?'–':p.rank+'.')}</td><td><strong>${safe(p.name)}</strong>${p.status&&printClass==='compact-8'?`<small>${safe(p.status)}</small>`:p.status==='Abgemeldet'?'<small> (Abgemeldet)</small>':''}</td></tr>`).join('');
 const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${safe(sheetTitle)} – Ergebnisliste</title><style>
 @page{size:A4;margin:13mm 15mm 15mm}*{box-sizing:border-box}body{font:12pt Arial,Helvetica,sans-serif;color:#161616;margin:0;background:#eee}
 .sheet{width:210mm;min-height:297mm;margin:10mm auto;background:white;padding:13mm 15mm 15mm;box-shadow:0 8px 35px #0002}
 .banner{width:100%;height:29mm;object-fit:cover;display:block}.title{font-size:28pt;font-weight:900;line-height:1.05;margin:7mm 0 6mm;overflow-wrap:anywhere}
 .meta{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm 6mm;font-size:10pt;margin-bottom:7mm}.meta div{display:flex;gap:5px}.meta label{color:#444;min-width:29mm}.meta strong{font-weight:750}
 .line{border-top:1px solid #555;margin-top:4mm}.result-title{text-align:center;font-size:17pt;font-weight:900;letter-spacing:6px;margin:6mm 0 13mm}
 table{width:100%;border-collapse:collapse;font-size:12pt}th{text-align:left;border-bottom:2px solid #555;padding:3mm 3mm}td{padding:3.3mm 3mm;vertical-align:top}th:first-child,td:first-child{width:20mm;text-align:center}tbody tr:nth-child(even){background:#f0f0f0}tr{break-inside:avoid}td small{display:block;color:#666;font-size:9pt;margin-top:1mm}
 .notice{text-align:center;color:#9d2737;font-weight:800;font-size:11pt;margin:-8mm 0 8mm}.print-actions{margin:15px auto;display:flex;gap:10px;justify-content:center}.print-actions button{background:#8f2131;border:0;color:white;padding:12px 18px;border-radius:8px;cursor:pointer;font-size:15px}
 /* V1.6: die vollständige Rangliste passt auch mit 32 Spielern auf genau ein A4-Blatt. */
 .sheet{min-height:0}
 .compact-16 .banner{height:24mm}.compact-16 .title{font-size:24pt;margin:5mm 0 4mm}
 .compact-16 .meta{font-size:9pt;margin-bottom:4mm}.compact-16 .result-title{font-size:15pt;margin:4mm 0 7mm}
 .compact-16 table{font-size:10.5pt}.compact-16 th{padding:2mm}.compact-16 td{padding:2mm 2.5mm;line-height:1.13}
 .compact-32 .banner{height:18mm}.compact-32 .title{font-size:20pt;line-height:1.02;margin:3.5mm 0 3mm}
 .compact-32 .meta{font-size:8.5pt;gap:1mm 4mm;margin-bottom:3mm;line-height:1.15}
 .compact-32 .meta label{min-width:23mm}.compact-32 .line{margin-top:2mm}
 .compact-32 .result-title{font-size:14pt;letter-spacing:4px;margin:3mm 0 5mm}
 .compact-32 table{font-size:9.5pt;line-height:1.08;table-layout:fixed}
 .compact-32 th{padding:1.3mm 2mm}.compact-32 td{padding:1.3mm 2mm;line-height:1.08}
 .compact-32 th:first-child,.compact-32 td:first-child{width:15mm}
 .compact-32 td small{display:inline;font-size:7pt;margin-top:0;line-height:1.0}
 .compact-32 .notice{font-size:9pt;margin:-2mm 0 2mm}
 @media print{
  @page{size:A4 portrait;margin:8mm 11mm}
  html,body{width:100%;margin:0;padding:0;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{width:100%;min-height:0;height:auto;margin:0;padding:0;box-shadow:none;break-inside:avoid;page-break-inside:avoid}
  .print-actions{display:none!important}
  .sheet .banner{max-width:100%}
  .sheet table{break-inside:auto;page-break-inside:auto}
  .sheet tr{break-inside:avoid;page-break-inside:avoid}
 }

 </style></head><body><div class="print-actions"><button onclick="window.print()">Drucken / Als PDF speichern</button><button onclick="window.close()">Schließen</button></div>
 <div class="sheet ${printClass}"><img class="banner" src="${ECW_PRINT_BANNER}"><div class="title">${safe(sheetTitle)}</div><div class="meta"><div><label>Austragungsort:</label><strong>${safe(venue)}</strong></div><div><label>Datum:</label><strong>${safe(date)}</strong></div><div><label>Veranstalter:</label><strong>${safe(organizer)}</strong></div><div><label>Durchführer:</label><strong>${safe(director)}</strong></div></div><div class="line"></div><div class="result-title">ERGEBNIS</div>${finished?'':'<div class="notice">ZWISCHENSTAND – Platzierungen noch nicht endgültig</div>'}<table><thead><tr><th>Rang</th><th>Spieler</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
 const w=window.open('','_blank');
 if(!w){alert('Der Browser hat das Druckfenster blockiert. Bitte Pop-ups erlauben.');return;}
 w.document.open();w.document.write(html);w.document.close();
}
$('printResults').onclick=printResultSheet;

$('export').onclick=()=>{let blob=new Blob([JSON.stringify({app:'ECW_DOPPEL_KO',version:1,...state},null,2)],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ECW_Doppel_KO_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};$('import').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let x=JSON.parse(await f.text());if(x.app!=='ECW_DOPPEL_KO'||![8,16,32].includes(x.size)||!Array.isArray(x.players)||x.players.length<2||x.players.length>x.size||!x.results||typeof x.results!=='object')throw Error('Keine gültige Doppel-KO-Sicherung');if(!confirm('Vorhandenes Turnier durch die Sicherung ersetzen?'))return;state={size:x.size,name:String(x.name||'Doppel KO'),date:String(x.date||''),players:x.players.map(String),results:x.results,fastMode:!!x.fastMode,withdrawn:Array.isArray(x.withdrawn)?x.withdrawn:[],venue:x.venue||'Stocksporthalle EC Wegscheid',organizer:x.organizer||'EC Wegscheid',director:x.director||'EC Wegscheid',turns:normalizeTurns(x.turns),autoSheets:x.autoSheets!==false,sheetPrompts:Array.isArray(x.sheetPrompts)?x.sheetPrompts:[]};correctionMode=false;persist();$('players').value=state.players.filter((_,i)=>!(state.withdrawn||[]).includes(i)).join('\n');lastRosterCount=inputNames().length;render();renderRoster()}catch(err){alert('Import fehlgeschlagen: '+err.message)}finally{e.target.value=''}};

function whiteboardMatch(m){
 const done=m.score?'done':m.ready&&!m.done?'ready':m.auto?'auto':'';
 const line=(name,idx)=>{
  const bye=m.auto&&!name&&m.ready,display=bye?'FREILOS':(name||'–');
  return `<div class="wb-team ${m.winner&&name===m.winner?'win':''} ${!name&&!bye?'missing':''} ${bye?'bye-team':''}"><strong title="${safe(display)}">${safe(display)}</strong>${bye?'<span class="bye-indicator">F</span>':inlineScore(m,idx,true)}</div>`;
 };
 return `<div class="wb-match ${done} ${matchClass(m)}" data-match-id="${safe(m.id)}" title="${safe(m.id)}"><div class="wb-match-top"><span>${safe(m.id)} ${m.auto?'· FREILOS → WEITER':''}</span>${scoreActions(m)}</div>${line(m.a,0)}${line(m.b,1)}</div>`;
}
function whiteboardRounds(rounds,mirror){
 const displayed=mirror?[...rounds].reverse():rounds;
 return `<div class="wb-rounds" style="grid-template-columns:repeat(${displayed.length},minmax(0,1fr))">${displayed.map(arr=>`<div class="wb-round"><div class="wb-round-label">R${arr[0]?.round??'–'}</div><div class="wb-round-games">${arr.map(whiteboardMatch).join('')}</div></div>`).join('')}</div>`;
}
function whiteboardFinal(){
 const gf=graph.gf,reset=graph.reset,finished=gf.done&&(reset.done||reset.void),champ=finished?(reset.done&&!reset.void?reset.winner:gf.winner):null;
 const finalCard=(m,label)=>`<div class="wb-final-game ${matchClass(m)}" data-match-id="${safe(m.id)}"><div class="wb-final-title"><span>${label}</span>${scoreActions(m)}</div>${[m.a,m.b].map((name,idx)=>`<div class="wb-final-team ${m.winner&&name===m.winner?'win':''}"><strong title="${safe(name||'Noch offen')}">${safe(name||'–')}</strong>${inlineScore(m,idx,true)}</div>`).join('')}${finalConfirmButton(m,true)}</div>`;
 return `<div class="wb-center-label">🏆 FINALE</div>${finalCard(gf,'Finale 1')}${!reset.void?finalCard(reset,'Entscheidungsfinale'):''}<div class="wb-champion"><div class="wb-center-small">${finished?'TURNIERSIEGER':'Turnier läuft'}</div><div class="wb-center-name" style="color:#f6cf76">${safe(champ||'Noch offen')}</div></div>`;
}

function fitWhiteboardNames(){
 const view=$('wbView');if(view.classList.contains('hidden'))return;
 const minFont=view.classList.contains('wb-32')?8:9;
 view.querySelectorAll('.wb-team strong,.wb-final-team strong').forEach(el=>{
  el.style.fontSize='';
  const base=parseFloat(getComputedStyle(el).fontSize)||12;
  let font=base;
  // scrollWidth misst den ungekürzten Namen, clientWidth den freien Platz.
  while(font>minFont&&el.scrollWidth>el.clientWidth+1){
   font=Math.max(minFont,font-.5);el.style.fontSize=font+'px';
  }
 });
}
function renderWhiteboard(){
 calculate();planCurrent();
 $('wbSubtitle').textContent=`${state.name}${state.date?' · '+state.date:''} · ${state.players.length} Teilnehmer · ${effectiveSize()}er-Feld`;
 if(!state.players.length){$('wbLoser').innerHTML='<div class="wb-empty">Noch kein Turnier</div>';$('wbWinner').innerHTML='<div class="wb-empty">Noch kein Turnier</div>';}
 else{$('wbLoser').innerHTML=whiteboardRounds(graph.lose,true);$('wbWinner').innerHTML=whiteboardRounds(graph.win,false);}
 $('wbFinal').innerHTML=state.players.length?whiteboardFinal():'<div class="wb-center-label">FINALE</div>';
 for(const size of [8,16,32])$('wbView').classList.toggle('wb-'+size,effectiveSize()===size);
 $('wbProgress').textContent=turnPlan?.current?(state.fastMode?`⚡ Schnelles Spiel · ${turnPlan.activeIds.length}/4 Bahnen freigegeben · ${turnPlan.remaining} Spiele offen`:`${turnPlan.current.name} · JETZT: ${turnPlan.activeIds.length} Spiele freigegeben · ${turnPlan.current.finished}/${turnPlan.current.total} erledigt`):'🏆 Turnier abgeschlossen';$('wbModeLabel').innerHTML=state.fastMode?'<strong>WHITEBOARD</strong> · ⚡ 4-Bahnen-Modus · + / − und ✓ · Firebase':'<strong>WHITEBOARD</strong> · Rundenmodus · + / − und ✓ · nur lokal';
 // Der gesamte Turnierbaum bleibt ohne Scrollen auf einer Whiteboard-Seite.
 fitWhiteboardNames();
}
function enterWhiteboard(){
 closeModal();
 $('wbView').classList.remove('hidden');
 document.body.style.overflow='hidden';
 // Muss synchron zum Klick erfolgen: Browser verlangen Benutzeraktivierung.
 let parentHandled=false;
 try{if(window.parent!==window&&typeof window.parent.ECW_DKO_ENTER_WHITEBOARD==='function'){
  parentHandled=window.parent.ECW_DKO_ENTER_WHITEBOARD()===true;
 }}catch(e){}
 if(!parentHandled&&document.fullscreenElement!==document.documentElement&&document.documentElement.requestFullscreen){
  try{const p=document.documentElement.requestFullscreen({navigationUI:'hide'});if(p&&p.catch)p.catch(()=>{});}catch(e){}
 }
 renderWhiteboard();
 requestAnimationFrame(()=>fitWhiteboardNames());
}
function exitWhiteboard(fromHost=false){
 $('wbView').classList.add('hidden');
 document.body.style.overflow='';
 if(!fromHost){
  try{if(window.parent!==window&&typeof window.parent.ECW_DKO_EXIT_WHITEBOARD==='function')window.parent.ECW_DKO_EXIT_WHITEBOARD();}catch(e){}
  if(document.fullscreenElement===document.documentElement&&document.exitFullscreen){
   try{const p=document.exitFullscreen();if(p&&p.catch)p.catch(()=>{});}catch(e){}
  }
 }
 render();
}
window.ECW_DKO_EXIT_FROM_HOST=()=>exitWhiteboard(true);
// Nach einem Browser-Druckdialog im Whiteboard bleiben und Namen erneut anpassen.
window.ECW_DKO_FIT_AFTER_PRINT=()=>{if(!$('wbView').classList.contains('hidden'))requestAnimationFrame(fitWhiteboardNames);};

$('correction').onclick=()=>{correctionMode=!correctionMode;render();if(!$('wbView').classList.contains('hidden'))renderWhiteboard()};$('whiteboardMode').onclick=enterWhiteboard;$('wbExit').onclick=()=>exitWhiteboard();$('wbCorrection').onclick=()=>{$('correction').click()};$('wbRefresh').onclick=renderWhiteboard;

window.addEventListener('resize',()=>{if(!$('wbView').classList.contains('hidden'))fitWhiteboardNames()});
document.addEventListener('fullscreenchange',()=>{if(!$('wbView').classList.contains('hidden'))requestAnimationFrame(fitWhiteboardNames)});
$('fullscreen').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};$('back').onclick=()=>{try{if(window.parent!==window && typeof window.parent.showHome==='function'){window.parent.showHome();return}}catch(e){} if(history.length>1)history.back();else location.href='turnierauswertung.html'};

// V2.2: Firebase-Turnierarchiv. Daten werden nicht beim bloßen Rendern oder Laden gedruckt.
let cloudId=null,cloudRevision=0,cloudReady=false,cloudLoading=false,cloudTimer=null;
let cloudSaving=false,cloudQueued=false,cloudDirty=false,cloudSavePromise=Promise.resolve();
let cloudWatchStop=null,cloudList=[];
const cloudAPI=()=>{try{return window.parent!==window?window.parent.ECW_DKO_API:null}catch(e){return null}};
function cloudStatus(message,kind=''){const el=$('cloudStatus');if(el){el.textContent=message;el.className=kind}}
function cloudEnsureId(){if(!cloudId){cloudId='dko_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);cloudRevision=0;safeStorage.setItem(STORE+'_id',cloudId)}return cloudId}
function cloudResetSelection(){if(cloudTimer)clearTimeout(cloudTimer);cloudId=null;cloudRevision=0;cloudDirty=false;cloudQueued=false;safeStorage.removeItem(STORE+'_id');$('cloudSelect').value=''}
function cloudSnapshot(){return {name:String(state.name||'Doppel KO'),date:String(state.date||''),archived:!!state.archived,state:JSON.parse(JSON.stringify(state))}}
function scheduleCloudSave(immediate=false){
 if(cloudLoading||!cloudReady||!state.players.length)return;
 cloudEnsureId();cloudDirty=true;
 cloudStatus('● Ungespeicherte Änderungen · Firebase …');
 if(cloudTimer)clearTimeout(cloudTimer);
 if(immediate)void cloudFlush();else cloudTimer=setTimeout(()=>void cloudFlush(),350);
}
async function cloudFlush(){
 if(cloudTimer){clearTimeout(cloudTimer);cloudTimer=null}
 if(!cloudReady||cloudLoading||!cloudDirty||!state.players.length)return;
 if(cloudSaving){cloudQueued=true;return cloudSavePromise}
 const api=cloudAPI();if(!api||!api.ready()){cloudStatus('Nur lokal · Firebase-Anmeldung erforderlich','error');return}
 cloudSaving=true;cloudDirty=false;cloudQueued=false;
 const snapshot=cloudSnapshot(),id=cloudEnsureId(),rev=cloudRevision;
 cloudStatus('☁ Speichern …');
 cloudSavePromise=(async()=>{
  try{
   const next=await api.save(id,snapshot,rev);
   cloudRevision=next;
   cloudStatus('✓ Firebase gespeichert · Version '+next,'ok');
   await cloudRefreshList(false);
  }catch(err){cloudDirty=true;cloudStatus('✗ Firebase: '+(err.message||err),'error');console.error('Doppel KO speichern',err)}
  finally{cloudSaving=false;if(cloudQueued&&!String($('cloudStatus').textContent).includes('KONFLIKT')){cloudQueued=false;void cloudFlush()}}
 })();return cloudSavePromise;
}
async function cloudRefreshList(selectCurrent=true){
 const api=cloudAPI();if(!api||!api.ready())return;
 const items=await api.list();cloudList=items;
 const sel=$('cloudSelect'),old=selectCurrent?(cloudId||sel.value):sel.value;
 sel.innerHTML='<option value="">– Gespeichertes Turnier auswählen –</option>';
 for(const t of items){const opt=document.createElement('option');opt.value=t.id;opt.textContent=(t.archived?'✓ Archiv · ':'')+(t.name||'Doppel KO')+' · '+(t.date||'ohne Datum')+' · '+(t.playerCount||'')+' Spieler';sel.appendChild(opt)}
 if(old&&items.some(x=>x.id===old))sel.value=old;
}
function cloudApply(data){
 if(!data?.state||!Array.isArray(data.state.players)||![8,16,32].includes(data.state.size)||!data.state.results)throw Error('Ungültige gespeicherte Turnierdaten');
 cloudLoading=true;
 try{
  if(soloPrintCurrent)finishSoloPrint(false);
  soloPrintQueue.length=0;soloQueueStatus();
  state={...data.state,turns:normalizeTurns(data.state.turns),sheetPrompts:Array.isArray(data.state.sheetPrompts)?data.state.sheetPrompts:[],autoSheets:data.state.autoSheets!==false};
  cloudId=data.id;cloudRevision=Number(data.revision||0);cloudDirty=false;
  safeStorage.setItem(STORE,JSON.stringify(state));safeStorage.setItem(STORE+'_id',cloudId);
  $('players').value=state.players.filter((_,i)=>!(state.withdrawn||[]).includes(i)).join('\n');
  $('fastMode').checked=!!state.fastMode;rosterChecked.clear();lastRosterCount=inputNames().length;
  correctionMode=false;activeTab='winner';render();renderRoster();
  if(!$('wbView').classList.contains('hidden'))renderWhiteboard();
  $('cloudSelect').value=cloudId;
  cloudStatus('✓ Turnier geladen · Firebase Version '+cloudRevision,'ok');
 }finally{cloudLoading=false}
}
async function cloudOpenSelected(){
 const id=$('cloudSelect').value;if(!id)return;
 if(cloudDirty&&!confirm('Ungespeicherte Änderungen verwerfen und anderes Turnier laden?'))return;
 const api=cloudAPI();if(!api||!api.ready()){cloudStatus('Firebase-Anmeldung erforderlich','error');return}
 try{cloudStatus('☁ Turnier wird geladen …');const data=await api.get(id);if(!data)throw Error('Turnier nicht gefunden');cloudApply(data)}catch(e){cloudStatus('✗ Laden fehlgeschlagen: '+e.message,'error')}
}
async function initCloud(){
 const api=cloudAPI();if(!api){cloudStatus('Nur lokale Datei · Firebase über Turnierauswertung verfügbar','error');return}
 // Das Modul kann vor Abschluss der Firebase-Anmeldung geladen werden.
 for(let i=0;i<24&&!api.ready();i++)await new Promise(r=>setTimeout(r,250));
 if(!api.ready()){cloudStatus('Nur lokal · Am Whiteboard für Firebase anmelden','error');$('cloudLogin').style.display='';return}
 $('cloudLogin').style.display='none';
 try{
  cloudLoading=true;await cloudRefreshList(false);
  const savedId=safeStorage.getItem(STORE+'_id');
  if(savedId&&cloudList.some(x=>x.id===savedId)){
   const d=await api.get(savedId);if(d)cloudApply(d);
  }
  cloudReady=true;
  if(!cloudId)cloudStatus('✓ Firebase bereit · Turnier auswählen oder neu anlegen','ok');
 }catch(e){cloudStatus('✗ Firebase: '+e.message,'error')}
 finally{cloudLoading=false}
}
$('cloudOpen').onclick=cloudOpenSelected;
$('cloudLogin').onclick=()=>{$('cloudLoginForm').classList.remove('hidden')};
$('cloudLoginCancel').onclick=()=>{$('cloudLoginForm').classList.add('hidden')};
$('cloudLoginSubmit').onclick=async()=>{const api=cloudAPI();if(!api?.login)return cloudStatus('Anmeldung nicht verfügbar','error');try{cloudStatus('Firebase-Anmeldung wird geprüft …');await api.login($('cloudEmail').value,$('cloudPassword').value);$('cloudPassword').value='';$('cloudLoginForm').classList.add('hidden');cloudStatus('✓ Angemeldet','ok');await initCloud()}catch(e){cloudStatus('✗ Anmeldung: '+e.message,'error')}};
$('cloudNew').onclick=()=>{if(cloudDirty&&!confirm('Es gibt noch nicht in Firebase gespeicherte Änderungen. Trotzdem ein neues Turnier beginnen?'))return;$('clear').click();cloudStatus('Neues Turnier · Teilnehmer auswählen')};
$('cloudSave').onclick=()=>{if(!state.players.length){alert('Bitte zuerst ein Turnier erstellen.');return}cloudDirty=true;scheduleCloudSave(true)};
$('cloudArchive').onclick=()=>{if(!cloudId||!state.players.length)return alert('Bitte zuerst ein Turnier auswählen.');state.archived=!state.archived;persist();scheduleCloudSave(true)};
$('cloudDelete').onclick=async()=>{
 const api=cloudAPI();if(!api?.ready()||!cloudId)return alert('Bitte zuerst ein gespeichertes Turnier öffnen.');
 if(!confirm('Dieses Turnier endgültig aus Firebase löschen?'))return;
 try{await api.remove(cloudId);cloudResetSelection();$('clear').click();await cloudRefreshList();cloudStatus('✓ Turnier aus Firebase gelöscht','ok')}catch(e){cloudStatus('✗ Löschen fehlgeschlagen: '+e.message,'error')}
};
try{let s=JSON.parse(safeStorage.getItem(STORE));if(s&&[8,16,32].includes(s.size)&&Array.isArray(s.players)&&s.results)state={...s,fastMode:!!s.fastMode,withdrawn:Array.isArray(s.withdrawn)?s.withdrawn:[],venue:s.venue||'Stocksporthalle EC Wegscheid',organizer:s.organizer||'EC Wegscheid',director:s.director||'EC Wegscheid',turns:normalizeTurns(s.turns),autoSheets:s.autoSheets!==false,sheetPrompts:Array.isArray(s.sheetPrompts)?s.sheetPrompts:[]}}catch(e){}$('players').value=state.players.filter((_,i)=>!(state.withdrawn||[]).includes(i)).join('\n');lastRosterCount=inputNames().length;render();renderRoster();initCloud();

if(__health){__health.style.background=__storageAvailable?'#143a2b':'#725019';__health.textContent='✓ V2.6: 69 Spielervorschläge geladen · Gastspieler und Turniererstellung bereit'+(__storageAvailable?'':' · Hinweis: Lokale Browserspeicherung blockiert (Firebase separat prüfen)');}
} catch(__dkoError) { __report(__dkoError); }
})();
