/* EC Wegscheid V2.9.27: Admin-Finalrunde und Siegerliste; keine Änderung der Vorrunden-Daten. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tid=()=>($('adminPrintSelectTournament')?.value||$('adminSelectTournament')?.value||'');
const cup=()=>tournaments[tid()];
const isAdmin=()=>((typeof window.getEffectiveRole==='function'?window.getEffectiveRole():window.currentRole)==='admin');
const requireAdmin=()=>{if(isAdmin())return true;alert('Nur Administratoren dürfen die Cup-Finalrunde bearbeiten oder drucken.');return false;};
function groups(t){return cupSortedGroups(t.groups||{});}
function standings(t){return groups(t).map(([id,g])=>({id,name:g.name||id,rows:calculateStandingsForTournamentGroup(t,id)}));}
function seed(t,n){
 const g=standings(t),out=[];let i=0;
 while(out.length<n && g.some(x=>x.rows[i])){for(const x of g){const v=x.rows[i];if(v&&!v.dq&&!v.dnf&&out.length<n)out.push({id:String(v.id),group:x.id,name:v.name,points:v.points,quota:v.quota});}i++;}
 return out;
}
function cfg(t){return t.cupFinal||null;}
function isDone(m){return m&&m.a!==''&&m.b!==''&&Number.isFinite(Number(m.a))&&Number.isFinite(Number(m.b))&&Number(m.a)!==Number(m.b);}
function win(m){return isDone(m)?(Number(m.a)>Number(m.b)?m.ta:m.tb):null;}
function pair(a,b,key){return {key,ta:a?.key||'',tb:b?.key||'',na:a?.name||'',nb:b?.name||'',a:'',b:''};}
function teams(f){return (f?.teams||[]).map(x=>({...x,key:x.group+'::'+x.id}));}
function knockout(f){
 const ts=teams(f);let round=ts.map(x=>({key:x.key,name:x.name}));let all=[];let r=0;
 while(round.length>=2){
  const old=(f.matches||[]).filter(x=>x.round===r);
  const matches=[];
  for(let i=0;i<round.length;i+=2){const x=round[i],y=round[i+1],key='r'+r+'-'+(i/2);const prev=old.find(m=>m.key===key&&m.ta===x.key&&m.tb===y.key);matches.push(prev||{...pair(x,y,key),round:r});}
  all.push(...matches);
  if(matches.length===1)break;
  round=matches.map(m=>{const winner=win(m);return winner?{key:winner,name:winner===m.ta?m.na:m.nb}:{key:'',name:'Noch offen'};});
  if(round.some(x=>!x.key))break;
  r++;
 }
 // Platz 3 aus den Halbfinal-Verlierern
 if(f.thirdPlace&&ts.length>=4){const semi=all.filter(x=>x.round===Math.log2(ts.length)-2);if(semi.length===2&&semi.every(isDone)){
  const losers=semi.map(m=>Number(m.a)<Number(m.b)?{key:m.ta,name:m.na}:{key:m.tb,name:m.nb});
  const old=(f.matches||[]).find(m=>m.key==='third');const m=old&&old.ta===losers[0].key&&old.tb===losers[1].key?old:{...pair(losers[0],losers[1],'third'),round:999};all.push(m);
 }}
 return all;
}
function roundRobin(f){const ts=teams(f),old=f.matches||[],all=[];for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++){
 const key='rr-'+i+'-'+j;const p=old.find(x=>x.key===key&&x.ta===ts[i].key&&x.tb===ts[j].key);all.push(p||pair(ts[i],ts[j],key));
}return all;}
function matches(f){return f.mode==='B'?roundRobin(f):knockout(f);}
function ranking(t){
 const f=cfg(t);if(!f)return {rows:seed(t,100).map(x=>x.name),complete:false};
 const ts=teams(f),mm=matches(f),map=new Map(ts.map(x=>[x.key,x.name]));
 if(f.mode==='B'){
 const stat=ts.map(x=>({key:x.key,name:x.name,points:0,diff:0,for:0}));const lookup=new Map(stat.map(x=>[x.key,x]));
 mm.forEach(m=>{if(!isDone(m))return;const a=lookup.get(m.ta),b=lookup.get(m.tb);if(!a||!b)return;a.diff+=Number(m.a)-Number(m.b);b.diff+=Number(m.b)-Number(m.a);a.for+=Number(m.a);b.for+=Number(m.b);if(Number(m.a)>Number(m.b))a.points+=3;else b.points+=3;});
 stat.sort((a,b)=>b.points-a.points||b.diff-a.diff||b.for-a.for||a.name.localeCompare(b.name,'de'));
 return {rows:stat.map(x=>x.name),complete:mm.length>0&&mm.every(isDone),stats:stat};
 }
 const final=mm.filter(m=>m.round!==999).at(-1),third=mm.find(m=>m.key==='third');
 const done=!!final&&isDone(final)&&(!f.thirdPlace||ts.length<4||!!third&&isDone(third));
 if(!done)return {rows:ts.map(x=>x.name),complete:false};
 const winner=win(final),loser=winner===final.ta?final.tb:final.ta;
 const ordered=[winner,loser];
 if(third&&isDone(third)){const w=win(third);ordered.push(w,w===third.ta?third.tb:third.ta);}
 // übrige Teilnehmer in der Reihenfolge ihrer Setzung, ohne eine exakte Platzierung vorzutäuschen
 ts.forEach(x=>{if(!ordered.includes(x.key))ordered.push(x.key)});
 return {rows:ordered.map(k=>map.get(k)||'–'),complete:true};
}
function printRows(arr,cols){return '<table><thead><tr>'+cols.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+arr.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
window.cupFinalLoad=function(){const t=cup(),box=$('cupFinalSettings');if(!box)return;box.style.display=(t&&isAdmin())?'block':'none';if(!t)return;
 const f=cfg(t);$('cupFinalMode').value=f?.mode||'A';$('cupFinalCount').value=String(f?.count||Math.min(4,groups(t).reduce((n,[,g])=>n+(g.teams||[]).length,0)));
 $('cupFinalThird').checked=f?.thirdPlace!==false;
 cupFinalRender();};
window.cupFinalSetup=function(){if(!requireAdmin())return;const t=cup();if(!t)return;const mode=$('cupFinalMode').value,count=Number($('cupFinalCount').value);if(count<2||count>32||!Number.isInteger(count))return alert('Bitte 2 bis 32 Finalteilnehmer wählen.');if(mode==='A'&&!([2,4,8,16,32].includes(count)))return alert('Platzierungsspiele benötigen 2, 4, 8, 16 oder 32 Teilnehmer. Für andere Zahlen bitte Finalgruppe B wählen.');
 const chosen=seed(t,count);if(chosen.length<count)return alert('Es sind nur '+chosen.length+' qualifizierbare Teilnehmer vorhanden.');
 const existing=cfg(t);if(existing?.matches?.some(isDone)&&!confirm('Finale neu einrichten? Bereits eingegebene Finalergebnisse werden zurückgesetzt.'))return;
 t.cupFinal={mode,count,thirdPlace:$('cupFinalThird').checked,teams:chosen,matches:[]};saveData();cupFinalRender();};
window.cupFinalChangeTeam=function(i,value){if(!requireAdmin())return;const t=cup(),f=cfg(t);if(!f)return;const [group,id]=value.split('::');const g=t.groups[group],tm=(g?.teams||[]).find(x=>String(x.id)===id);if(!tm)return;
 if(f.teams.some((x,j)=>j!==i&&x.group===group&&String(x.id)===id))return alert('Dieser Teilnehmer ist bereits ausgewählt.');
 if(f.matches?.some(isDone)&&!confirm('Teilnehmer ändern? Finalergebnisse werden zurückgesetzt.'))return;
 f.teams[i]={id,group,name:tm.name};f.matches=[];saveData();cupFinalRender();};
window.cupFinalSaveScore=function(key){if(!requireAdmin())return;const t=cup(),f=cfg(t);if(!f)return;const current=matches(f),m=current.find(x=>x.key===key);if(!m||!m.ta||!m.tb)return;
 const a=$('cfsA_'+key)?.value,b=$('cfsB_'+key)?.value;
 if(a===''||b===''||!Number.isInteger(Number(a))||!Number.isInteger(Number(b))||Number(a)<0||Number(b)<0||Number(a)===Number(b))return alert('Bitte zwei unterschiedliche, nichtnegative ganze Ergebnisse eingeben.');
 m.a=a;m.b=b;f.matches=(f.matches||[]).filter(x=>x.key!==key);f.matches.push(m);
 // Änderungen an früheren Runden setzen abhängige Paarungen automatisch zurück
 if(f.mode==='A')f.matches=knockout(f);
 saveData();cupFinalRender();};
window.cupFinalClearScore=function(key){if(!requireAdmin())return;const t=cup(),f=cfg(t);if(!f)return;f.matches=(f.matches||[]).filter(m=>m.key!==key);if(f.mode==='A')f.matches=knockout(f);saveData();cupFinalRender();};
window.cupFinalRender=function(){const t=cup(),area=$('cupFinalEditor');if(!area||!t)return;const f=cfg(t);if(!f){area.innerHTML='<p>Finalmodus und Teilnehmerzahl auswählen, dann „Finalrunde anlegen“.</p>';return;}
 const available=groups(t).flatMap(([group,g])=>(g.teams||[]).filter(x=>!x.dq&&!x.dnf).map(x=>({value:group+'::'+x.id,name:(g.name||group)+' · '+x.name})));
 let html='<h4>Finalteilnehmer ('+f.teams.length+')</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:5px">';
 f.teams.forEach((tm,i)=>{const value=tm.group+'::'+tm.id;html+='<label>Startplatz '+(i+1)+'<select onchange="cupFinalChangeTeam('+i+',this.value)">'+available.map(x=>'<option value="'+esc(x.value)+'" '+(x.value===value?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>';});html+='</div><h4>Finalergebnisse</h4>';
 matches(f).forEach(m=>{html+='<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:5px 0;padding:6px;border:1px solid #555;border-radius:6px"><span style="min-width:220px">'+esc(m.key==='third'?'Spiel um Platz 3':m.key)+' · '+esc(m.na)+' – '+esc(m.nb)+'</span><input id="cfsA_'+esc(m.key)+'" type="number" min="0" step="1" value="'+esc(m.a)+'" style="width:65px"><b>:</b><input id="cfsB_'+esc(m.key)+'" type="number" min="0" step="1" value="'+esc(m.b)+'" style="width:65px"><button class="btn btn-success" onclick="cupFinalSaveScore(\''+esc(m.key)+'\')">Speichern</button><button class="btn btn-secondary" onclick="cupFinalClearScore(\''+esc(m.key)+'\')">Löschen</button></div>';});
 const r=ranking(t);html+='<p><b>'+ (r.complete?'Endergebnis vollständig':'Zwischenergebnis – Finale noch nicht abgeschlossen')+'</b></p>';
 area.innerHTML=html;};
window.cupPrintSiegerliste=function(){if(!requireAdmin())return;const t=cup();if(!t)return alert('Bitte Cup auswählen.');const g=standings(t),f=cfg(t),r=ranking(t);const finalDone=r.complete;const title=finalDone?'Endergebnis':'Zwischenergebnis – vorläufige Platzierungen';
 const first=r.rows.map((name,i)=>{
  let place=i+1;
  if(f?.mode==='A'&&r.complete){
    if(!f.thirdPlace&&i===3)place=3;
    if(i>=4)place=2**Math.floor(Math.log2(i))+1;
  }
  return [String(place)+'.',name];
 });const groupHtml=g.map(x=>'<h3>'+esc(x.name)+'</h3>'+printRows(x.rows.map((v,i)=>[String(i+1)+'.',v.name,v.points,Number(v.quota||0).toLocaleString('de-DE',{minimumFractionDigits:3,maximumFractionDigits:3})]),['Platz','Mannschaft / Spieler','Punkte','Quote'])).join('');
 const two=g.length>1;const html='<!doctype html><html lang="de"><head><meta charset="utf-8"><title>'+esc(t.name||'Cup')+' – Ergebnisliste</title><style>@page{size:A4 portrait;margin:13mm 14mm}body{font:12px Arial,sans-serif;color:#111}h1,h2,h3{text-align:center}h1{font-size:21px}h2{font-size:16px}h3{font-size:14px;margin:15px 0 5px}table{width:100%;border-collapse:collapse}th,td{padding:5px 6px;border-bottom:1px solid #bbb;text-align:left}th{background:#eee}th:first-child,td:first-child{width:55px}header{display:flex;justify-content:space-between;align-items:center}section{page-break-inside:avoid}.page2{break-before:page;page-break-before:always}.note{text-align:center;margin-top:25px}.watermark{font-weight:bold;color:#777}@media screen{body{max-width:800px;margin:30px auto}.page2{margin-top:70px}}</style></head><body><section><header><b>EC Wegscheid</b><span>'+new Date().toLocaleDateString('de-DE')+'</span></header><h1>'+esc(title)+'</h1><h2>'+esc(t.name||'Interner Cup')+'</h2>'+printRows(first,['Platz','Mannschaft / Spieler'])+(finalDone?'<p class="note">Der EC Wegscheid bedankt sich für die Teilnahme und die faire Spielweise.</p>':'<p class="note watermark">Vorläufig – noch kein abgeschlossenes Finale</p>')+'</section>'+(two?'<section class="page2"><h2>Gruppenergebnisse der Vorrunde</h2>'+groupHtml+'</section>':'<section><h2>Gruppenergebnis der Vorrunde</h2>'+groupHtml+'</section>')+'</body></html>';
 const w=window.open('','_blank');if(!w)return alert('Bitte Pop-ups für die Druckvorschau erlauben.');w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);};
})();
