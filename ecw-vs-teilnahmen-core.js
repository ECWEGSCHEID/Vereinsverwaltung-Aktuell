/* Gemeinsame, nebenwirkungsfreie Auswertung der ausgewählten Terminplaner-Einträge. */
(() => {
'use strict';
const clean=v=>String(v??'').normalize('NFC').replace(/\s+/g,' ').trim();
function date(value){
 const s=String(value||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);let y,mo,d;
 if(m)[,y,mo,d]=m;else {m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);if(!m)return '';[,d,mo,y]=m;}
 const dt=new Date(Date.UTC(+y,+mo-1,+d));if(dt.getUTCFullYear()!==+y||dt.getUTCMonth()!==+mo-1||dt.getUTCDate()!==+d)return '';
 return String(y).padStart(4,'0')+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function cancelled(x){return x.cancelled===true||x.canceled===true||x.deleted===true||x.cancelledAt||['abgesagt','storniert','cancelled','canceled','deleted','entfallen'].includes(clean(x.status).toLowerCase())||/\b(abgesagt|storniert|entfällt|entfallen)\b/i.test(clean(x.name));}
function resolve(raw,aliases){let n=clean(raw),seen=new Set();while(aliases[n]&&!seen.has(n)){seen.add(n);n=clean(aliases[n]);}return n;}
function project(events,aliases,today){
 const records=[],warnings=[],seen=new Set();let excluded=0;
 events.forEach((x,i)=>{
  if(!x)return;const type=clean(x.effectiveType||x.type).toLowerCase();if(!['turnier','meisterschaft'].includes(type))return;
  const d=date(x.date);if(!d){warnings.push('Ungültiges/fehlendes Datum: '+(clean(x.name)||'Termin ohne Namen'));return;}
  if(cancelled(x)||d>=today){excluded++;return;}
  const names=new Map();for(const raw of Array.isArray(x.players)?x.players:[]){const n=resolve(raw,aliases||{});if(!n||/^(x|[-–—]|offen|frei|freiplatz|n\/?a|unbekannt)$/i.test(n))continue;names.set(n.toLocaleLowerCase('de'),n);}
  const r={key:'row_'+i,id:clean(x.id),date:d,name:clean(x.name)||'Ohne Bezeichnung',type:type==='turnier'?'Turnier':'Meisterschaft',location:clean(x.location),players:[...names.values()]};
  const signature=JSON.stringify([r.id,r.date,r.name,r.type,r.location,[...r.players].sort()]);
  if(seen.has(signature)){warnings.push('Doppelter Datensatz nur einmal berücksichtigt: '+r.name+' ('+r.date+')');return;}seen.add(signature);records.push(r);
 });
 records.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'de'));
 return {records,warnings,excluded,today};
}
function summarize(records,year){
 if(!Number.isInteger(+year)||+year<1900||+year>2200)throw Error('Bitte ein gültiges Jahr wählen.');
 const selected=records.filter(x=>x.date.startsWith(year+'-')),players=new Map();let tournaments=0,championships=0,withoutPlayers=0;
 for(const e of selected){const k=e.type==='Turnier'?'tournaments':'championships';if(k==='tournaments')tournaments++;else championships++;if(!e.players.length)withoutPlayers++;
  const seen=new Set();for(const name of e.players){const key=clean(name).toLocaleLowerCase('de');if(seen.has(key))continue;seen.add(key);if(!players.has(key))players.set(key,{name,tournaments:0,championships:0,total:0});const p=players.get(key);p[k]++;p.total++;}
 }
 return {year:+year,tournaments,championships,total:selected.length,withoutPlayers,records:selected,players:[...players.values()].sort((a,b)=>b.tournaments-a.tournaments||b.championships-a.championships||a.name.localeCompare(b.name,'de'))};
}
function report(summary){
 const s=summary,lines=[`Ausgewertetes Vereinsjahr: ${s.year}`,`• Turnierteilnahmen (Mannschaftsmeldungen): ${s.tournaments}`,`• Meisterschaftsteilnahmen (Mannschaftsmeldungen): ${s.championships}`,`• Teilnahmen insgesamt: ${s.total}`,'','Turnier- und Meisterschaftsteilnahmen je Spieler'];
 if(!s.players.length)lines.push('• Keine Spielernamen in den ausgewählten Einträgen erfasst.');
 s.players.forEach((p,i)=>lines.push(`• ${i+1}. ${p.name}: ${p.tournaments} Turniere, ${p.championships} Meisterschaften – ${p.total} Teilnahmen gesamt`));


 return {title:`Sportlicher Rückblick ${s.year} – Turniere und Meisterschaften`,desc:lines.join('\n')};
}
window.ecwParticipationCore={date,project,summarize,report};
})();
