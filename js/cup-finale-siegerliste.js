/* EC Wegscheid V2.9.28: Admin-Finalrunde und Siegerliste; keine Änderung der Vorrunden-Daten. */
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
function advancePerGroup(t){const field=$('cupAdvancePerGroup');const saved=Number(t?.cupFinal?.advancePerGroup);const val=Number(field?.value||saved||3);return Math.max(1,Math.min(32,Number.isInteger(val)?val:3));}
function qualified(t){const n=advancePerGroup(t);return standings(t).flatMap(g=>g.rows.filter(v=>!v.dq&&!v.dnf).slice(0,n).map((v,i)=>({id:String(v.id),group:g.id,groupName:g.name,name:v.name,points:v.points,quota:v.quota,groupPlace:i+1})));}
function seed(t,n){
 const groupsList=standings(t).map(g=>g.rows.filter(v=>!v.dq&&!v.dnf).slice(0,advancePerGroup(t)).map(v=>({id:String(v.id),group:g.id,name:v.name,points:v.points,quota:v.quota})));
 const out=[];let i=0;while(out.length<n&&groupsList.some(g=>g[i])){for(const g of groupsList){if(g[i]&&out.length<n)out.push(g[i]);}i++;}return out;
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
 const f=cfg(t);$('cupFinalMode').value=f?.mode||'A';$('cupFinalCount').value=String(f?.count||Math.min(32,qualified(t).length));
 $('cupFinalThird').checked=f?.thirdPlace!==false;
 if($('cupAdvancePerGroup'))$('cupAdvancePerGroup').value=String(f?.advancePerGroup||3);
 cupFinalRender();};
window.cupFinalSetup=function(){if(!requireAdmin())return;const t=cup();if(!t)return;const mode=$('cupFinalMode').value,count=Number($('cupFinalCount').value);if(count<2||count>32||!Number.isInteger(count))return alert('Bitte 2 bis 32 Finalteilnehmer wählen.');if(mode==='A'&&!([2,4,8,16,32].includes(count)))return alert('Platzierungsspiele benötigen 2, 4, 8, 16 oder 32 Teilnehmer. Für andere Zahlen bitte Finalgruppe B wählen.');
 const chosen=seed(t,count);if(chosen.length<count)return alert('Es sind nur '+chosen.length+' qualifizierbare Teilnehmer vorhanden.');
 const existing=cfg(t);if(existing?.matches?.some(isDone)&&!confirm('Finale neu einrichten? Bereits eingegebene Finalergebnisse werden zurückgesetzt.'))return;
 t.cupFinal={mode,count,advancePerGroup:advancePerGroup(t),thirdPlace:$('cupFinalThird').checked,teams:chosen,matches:[]};saveData();cupFinalRender();};
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
window.cupPrintSiegerliste=function(){
 if(!requireAdmin())return;
 const t=cup();if(!t)return alert('Bitte Cup auswählen.');
 const groupData=standings(t),f=cfg(t),r=ranking(t),done=!!f&&r.complete;
 const advances=qualified(t),advanceSet=new Set(advances.map(x=>x.group+'::'+x.id));
 // Vor dem Abschluss des Finales werden ausschließlich die Aufsteiger gezeigt.
 // Nach dem Finale werden ausschließlich die tatsächlich qualifizierten Finalteilnehmer gelistet.
 let rows=[];
 if(done){
  const finalists=new Set((f.teams||[]).map(x=>x.name));
  rows=r.rows.filter(name=>finalists.has(name)).map((name,i)=>{
   let place=i+1;
   if(f.mode==='A'){if(!f.thirdPlace&&i===3)place=3;if(i>=4)place=2**Math.floor(Math.log2(i))+1;}
   return {place,name};
  });
 }else{
  rows=advances.map(x=>({place:x.groupPlace,name:x.name,group:x.groupName}));
 }
 const tableRows=rows.map(x=>'<tr><td class="place">'+esc(x.place)+'.</td><td class="name">'+esc(x.name)+'</td>'+(done?'':'<td class="group">'+esc(x.group)+'</td>')+'</tr>').join('');
 const groupTables=groupData.map(x=>'<section class="groupblock"><h3>'+esc(x.name)+'</h3><table class="group-table"><thead><tr><th>Platz</th><th>Mannschaft</th><th>Punkte</th><th>Quote</th></tr></thead><tbody>'+x.rows.map((v,i)=>'<tr'+(advanceSet.has(x.id+'::'+v.id)?' class="qualified"':'')+'><td>'+(i+1)+'. Platz</td><td>'+esc(v.name)+'</td><td>'+esc(v.points)+'</td><td>'+Number(v.quota||0).toLocaleString('de-DE',{minimumFractionDigits:3,maximumFractionDigits:3})+'</td></tr>').join('')+'</tbody></table></section>').join('');
 const two=groupData.length>1;
 const heading=done?'Endergebnis':'Zwischenergebnis / Finalaufsteiger';
 const date=new Date().toLocaleDateString('de-DE');
 const logo=new URL('assets/ecw_ergebnis_logo-000.png',document.baseURI).href;
 const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(t.name||'Cup')} – Ergebnisliste</title><style>
 @page{size:A4 portrait;margin:10mm 14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:12px;margin:0}
 .sheet{min-height:267mm;position:relative;padding:0 0 23mm}.head{height:32mm;position:relative;text-align:center}
 .logo{position:absolute;left:0;top:0;width:23mm;height:22mm;object-fit:contain}.date{position:absolute;right:0;top:0;font-size:10px;font-weight:600}
 h1{font-size:22px;font-style:italic;margin:7mm 0 1mm}h2{font-size:20px;font-style:italic;margin:0}
 table{width:100%;border-collapse:collapse}th{font-size:10px;font-style:italic;text-decoration:underline}
 .final-table{margin-top:8mm}.final-table th{text-align:left;border-bottom:1px solid #111;padding-bottom:3mm}
 .final-table td{font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:700;font-style:italic;padding:4mm 2mm}
 .final-table .place{width:13mm;text-align:left}.final-table .name{text-align:center}.final-table .group{text-align:right;width:30mm;font:11px Arial,sans-serif}
 .thanks{position:absolute;bottom:15mm;left:5mm;right:5mm;text-align:center;font-size:11px;font-style:italic;font-weight:700}
 .provisional{text-align:center;margin-top:12mm;font-weight:700;color:#555}
 .page2{break-before:page;page-break-before:always}.group-title{text-align:center;font-size:18px;font-style:italic;text-decoration:underline;margin:0 0 6mm}
 .groupblock{break-inside:avoid;margin:0 0 9mm}.groupblock h3{text-align:center;font-size:16px;font-style:italic;text-decoration:underline;font-weight:400;margin:6mm 0 4mm}
 .group-table th{padding:1mm 2mm;text-align:center}.group-table td{padding:3mm 2mm;font-family:Georgia,'Times New Roman',serif;font-size:12px;font-style:italic;font-weight:700;text-align:center}
 .group-table td:first-child{text-align:left;width:20mm;font:11px Arial,sans-serif}.group-table td:nth-child(2){width:104mm}.group-table td:nth-child(3){width:20mm}
 .group-table .qualified td{font-weight:800}.group-table td:last-child{text-decoration:underline}
 @media screen{body{max-width:210mm;margin:15px auto}.sheet{border:1px solid #ddd;padding:10mm 14mm}.page2{margin-top:25px}}
 </style></head><body><section class="sheet"><div class="head"><img class="logo" src="${esc(logo)}" alt="EC Wegscheid"><span class="date">Wegscheid, den ${date}</span><h1>${esc(heading)}</h1><h2>${esc(t.name||'Interner Cup')}</h2></div>
 <table class="final-table"><thead><tr><th>Platz</th><th>Mannschaft / Spieler</th>${done?'':'<th>Gruppe</th>'}</tr></thead><tbody>${tableRows}</tbody></table>
 ${done?'<div class="thanks">Der EC Wegscheid bedankt sich für die Teilnahme sowie die faire Spielweise recht herzlich.</div>':'<p class="provisional">Vorläufig – '+advancePerGroup(t)+' Aufsteiger je Gruppe; Finale noch nicht abgeschlossen</p>'}</section>
 ${two?'<section class="sheet page2"><h2 class="group-title">Zwischenergebnisse nach der Vorrunde</h2>'+groupTables+'</section>':'<section class="sheet"><h2 class="group-title">Zwischenergebnisse nach der Vorrunde</h2>'+groupTables+'</section>'}
 </body></html>`;
 const w=window.open('','_blank');if(!w)return alert('Bitte Pop-ups für die Druckvorschau erlauben.');w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),600);
};
})();
