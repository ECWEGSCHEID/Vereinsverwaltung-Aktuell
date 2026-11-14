/* Validation and additive restoration of private tournament history. No club data. */
(function(root){'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
function text(x,max,label,required=false){if(typeof x!=='string'||x.length>max||required&&!x.trim())throw Error('Ungültiges Feld: '+label);return x.trim()}
function normalize(input){
 if(!input||input.format!=='ecw-tournament-history'||input.schemaVersion!==1||!Array.isArray(input.records)||input.records.length>5000||!Array.isArray(input.clubs)||input.clubs.length>2000)throw Error('Bitte eine gültige private Teilnahmehistorie auswählen.');
 const ids=new Set(),records=input.records.map(r=>{
  if(!r||typeof r!=='object')throw Error('Ungültiger Historieneintrag.');
  const id=text(r.id,150,'Kennung',true);if(!/^[a-zA-Z0-9_-]+$/.test(id)||ids.has(id))throw Error('Doppelte oder ungültige Eingangskennung.');ids.add(id);
  const datum=text(r.datum,10,'Datum',true),m=datum.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(!m)throw Error('Ungültiges Datum in der Historie.');
  const date=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));if(+m[3]<1900||+m[3]>2100||date.getUTCFullYear()!==+m[3]||date.getUTCMonth()!==+m[2]-1||date.getUTCDate()!==+m[1])throw Error('Ungültiger Kalendertag.');
  if(!['Herren','Damen','Mixed'].includes(r.kategorie)||!Number.isInteger(r.mannschaften)||r.mannschaften<1||r.mannschaften>100)throw Error('Ungültige Kategorie oder Mannschaftszahl.');
  return {id,verein:text(r.verein,200,'Verein',true),turnierId:text(r.turnierId||'',150,'Turnierkennung'),datum,turnierart:text(r.turnierart||'Turnier',300,'Turnierart',true),kategorie:r.kategorie,mannschaften:r.mannschaften,schreibweisen:text(r.schreibweisen||'',1000,'Schreibweisen')};
 });
 const names=new Set(),clubs=input.clubs.map(c=>{const name=text(c.name,200,'Vereinsname',true);if(names.has(name))throw Error('Doppelter Verein in der Importdatei.');names.add(name);if(!Array.isArray(c.aliases)||c.aliases.length>50)throw Error('Ungültige Vereinsschreibweisen.');return {name,aliases:[...new Set(c.aliases.map(a=>text(a,200,'Alias',true)))]}});
 return {schemaVersion:1,stand:text(input.stand||'',10,'Stand'),records,clubs};
}
function merge(existing,incoming){
 const next=normalize(incoming),current=existing?normalize({format:'ecw-tournament-history',...existing}):{schemaVersion:1,stand:'',records:[],clubs:[]};
 const records=new Map(current.records.map(r=>[r.id,r]));let added=0;
 for(const row of next.records){const old=records.get(row.id);if(old&&JSON.stringify(old)!==JSON.stringify(row))throw Error('Eine vorhandene Historienkennung enthält andere Werte. Der bestehende Stand wurde nicht ersetzt.');if(!old){records.set(row.id,row);added++}}
 const clubs=new Map(current.clubs.map(c=>[c.name,c]));let aliasesAdded=0;
 for(const c of next.clubs){const old=clubs.get(c.name);if(old){const aliases=[...new Set([...old.aliases,...c.aliases])];aliasesAdded+=aliases.length-old.aliases.length;clubs.set(c.name,{name:c.name,aliases})}else{clubs.set(c.name,copy(c));aliasesAdded++}}
 const value={schemaVersion:1,stand:[current.stand,next.stand].sort().pop(),records:[...records.values()],clubs:[...clubs.values()]};
 if(new TextEncoder().encode(JSON.stringify(value)).length>850000)throw Error('Historie überschreitet die Größe eines Firebase-Dokuments. Es wurde nichts ersetzt.');
 return {value,added,changed:added>0||aliasesAdded>0||value.stand!==current.stand};
}
const api={normalize,merge};root.ECWHistoryCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
