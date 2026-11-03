/* Übernimmt ausschließlich die Aufstellung eines bereits angelegten Cupturniers. */
(() => {
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const fingerprint=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const keys=t=>Object.keys(t.groups||{}).sort((a,b)=>a.localeCompare(b,'de',{numeric:true}));
function played(value){
 if(!value||typeof value!=='object')return false;
 if(value.completed===true||value.finished===true||value.done===true||value.started===true||value.archived===true||value.startedAt)return true;
 if(typeof value.status==='string'&&['gestartet','begonnen','abgeschlossen','erledigt','running','finished','completed','archived'].includes(value.status.toLowerCase()))return true;
 if(value.cupFinal||value.skmrStats?.length)return true;
 if(Array.isArray(value.games)&&value.games.length)return true;
 if(['pointsA','pointsB','stocksA','stocksB'].some(k=>Number(value[k]||0)!==0))return true;
 return Object.values(value).some(x=>x&&typeof x==='object'&&played(x));
}
function validate(draw){
 if(!Array.isArray(draw)||draw.length<1||draw.length>16)throw Error('Bitte zuerst eine Auslosung mit höchstens 16 Mannschaften abschließen.');
 const names=new Set();const members=new Set();
 draw.forEach(t=>{
  if(!t||typeof t.name!=='string'||!t.name.trim()||t.name.length>1000)throw Error('Jede Mannschaft benötigt einen Namen (maximal 1000 Zeichen).');
  if(names.has(t.name.trim().toLocaleLowerCase('de')))throw Error('Mannschaftsnamen müssen eindeutig sein.');
  names.add(t.name.trim().toLocaleLowerCase('de'));
  if(!Number.isInteger(t.groupIndex)||t.groupIndex<0||t.groupIndex>3||!Array.isArray(t.members)||t.members.length>8)throw Error('Ungültige Mannschaftsaufstellung.');
  t.members.forEach(p=>{if(typeof p!=='string'||!p.trim()||p.length>200||members.has(p))throw Error('Spieler fehlen oder wurden doppelt zugeordnet.');members.add(p);});
 });return draw;
}
function apply(t,draw,expected){
 validate(draw);
 if(!t||!t.groups)throw Error('Das ausgewählte Turnier ist nicht mehr vorhanden.');
 if(expected!==fingerprint(t))throw Error('Das Turnier wurde inzwischen geändert. Bitte neu auswählen und die Vorschau prüfen.');
 if(played(t))throw Error('Dieses Turnier enthält bereits Spielergebnisse. Eine neue Aufstellung wird nicht darübergespeichert.');
 const result=copy(t), gs=keys(t), dg=[...new Set(draw.map(x=>x.groupIndex))].sort((a,b)=>a-b);
 if(gs.length!==dg.length||dg.some((n,i)=>n!==i))throw Error('Die Anzahl der Gruppen passt nicht zum angelegten Cupturnier.');
 const assignment=[];
 gs.forEach((g,i)=>{
  const src=draw.filter(x=>x.groupIndex===i), dst=result.groups[g].teams;
  if(!Array.isArray(dst)||dst.length!==src.length)throw Error(`Mannschaftsanzahl in ${t.groups[g].name||g} passt nicht. Bitte Turnier und Auslosung gleich einrichten.`);
  dst.forEach((team,j)=>{
   const s=src[j];team.name=s.name.trim();team.players=copy(s.members);team.captain=s.captain||null;team.moar=s.moar||null;
   assignment.push({group:t.groups[g].name||g,slot:j+1,old:t.groups[g].teams[j].name,name:team.name,players:team.players});
  });
 });
 result.drawImportedAt=new Date().toISOString();
 result.history ||= [];result.history.unshift({time:new Date().toLocaleString('de-DE'),text:'Aufstellung aus der Turnierauslosung übernommen (Mannschaften und Spieler).'});
 return {result,assignment};
}
window.ecwDrawCupRules={apply,validate,played,fingerprint};
window.ecwDrawCupBridge={
 list(){return Object.entries(tournaments).filter(([,t])=>!played(t)).map(([id,t])=>({id,name:t.name,groups:keys(t).length,teams:keys(t).reduce((s,g)=>s+(t.groups[g].teams||[]).length,0),started:played(t)}));},
 preview(id,draw){const t=tournaments[id];if(!t)throw Error('Bitte ein vorhandenes Cupturnier auswählen.');const expected=fingerprint(t);return {...apply(t,draw,expected),expected};},
 async save(id,draw,expected){
  if(window.getEffectiveRole?.()!=='admin'||!window.currentFirebaseUser)throw Error('Für die Übernahme in die Cupauswertung bitte als Administrator anmelden.');
  if(!window.ecwCupDrawTransaction)throw Error('Firebase ist noch nicht bereit. Bitte kurz warten.');
  await cupSaveQueue;
  // Der Serverstand wird innerhalb einer Transaktion erneut geprüft. Kein lokales Vorab-Speichern.
  const result=await window.ecwCupDrawTransaction(id,t=>apply(t,draw,expected).result);
  tournaments[id]=result;renderMainButtons();return true;
 }
};
})();
