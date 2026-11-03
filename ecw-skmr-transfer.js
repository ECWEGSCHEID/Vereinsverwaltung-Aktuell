/* SKMR bleibt lokal. Nur Namen werden geändert, Spielplan und Wertungen bleiben erhalten. */
(() => {
'use strict';
const children=(n,name)=>[...n.children].filter(x=>x.localName===name);
const child=(n,name)=>children(n,name)[0];
const text=(n,name)=>child(n,name)?.textContent||'';
function read(source){
 if(typeof source!=='string'||source.length>12*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('Die SKMR-Datei ist zu groß oder enthält eine nicht unterstützte XML-Deklaration.');
 const doc=new DOMParser().parseFromString(source,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement.localName!=='Turnier')throw Error('Keine gültige SKMR-Turnierdatei.');
 const groups=[...doc.getElementsByTagName('Teambewerb')].map((g,i)=>({node:g,name:text(g,'Gruppenname')||`Gruppe ${i+1}`,teams:children(child(g,'Mannschaften')||g,'Mannschaft')})).filter(g=>g.teams.length);
 if(!groups.length)throw Error('Die Datei enthält keine Mannschaften.');
 // Durch eine echte SKMR-Datei bestätigtes Schema: Spieler/Spieler/FirstName,LastName,LicenseNumber.
 const containers=groups.flatMap(g=>g.teams.map(t=>child(t,'Spieler')).filter(Boolean));
 const entries=containers.flatMap(p=>[...p.children]);
 const structured=entries.every(p=>p.localName==='Spieler'&&child(p,'FirstName')&&child(p,'LastName')&&[...p.children].every(x=>['FirstName','LastName','LicenseNumber'].includes(x.localName)));
 const strings=entries.length>0&&entries.every(p=>p.localName==='string'&&!p.children.length);
 if(!structured&&!strings)throw Error('Diese SKMR-Datei verwendet ein noch nicht unterstütztes Spielerformat.');
 return {doc,groups,playerFormat:structured?'structured':'strings'};
}
function fill(source,draw,withPlayers=true){
 const parsed=read(source),{doc,groups}=parsed;
 if(!Array.isArray(draw)||!draw.length)throw Error('Bitte zuerst die Auslosung abschließen.');
 const indices=[...new Set(draw.map(t=>t.groupIndex))].sort((a,b)=>a-b);
 if(groups.length!==indices.length)throw Error('Die Gruppenanzahl der SKMR-Datei passt nicht zur Auslosung.');
 const mapping=[];
 groups.forEach((g,i)=>{
  const src=draw.filter(t=>t.groupIndex===indices[i]);
  const teams=[...g.teams].sort((a,b)=>Number(text(a,'StartNumber'))-Number(text(b,'StartNumber')));
  const starts=teams.map(t=>Number(text(t,'StartNumber')));
  if(starts.some(n=>!Number.isInteger(n)||n<1)||new Set(starts).size!==starts.length)throw Error('Die Startnummern in der SKMR-Datei sind nicht eindeutig.');
  if(teams.length!==src.length)throw Error(`In ${g.name} stehen ${teams.length} Mannschaften, in der Auslosung ${src.length}. Bitte passende Vorlage wählen.`);
  // Keine bereits ausgewertete Datei versehentlich mit neuen Mannschaften beschriften.
  const scored=[...g.node.getElementsByTagName('Spielstand')].some(s=>['A','B'].some(k=>Number(text(s,k))!==0)||[...s.querySelectorAll('PunkteTeamA,PunkteTeamB')].some(x=>Number(x.textContent)!==0));
  const pre=teams.some(t=>['StrafSpielpunkte','VorergebnisSpielpunktePlus','VorergebnisSpielpunkteMinus','VorergebnisStockpunktePlus','VorergebnisStockpunkteMinus'].some(k=>Number(text(t,k))!==0));
  if(scored||pre)throw Error('Diese SKMR-Datei enthält bereits Wertungen. Bitte eine unbespielte Turniervorlage verwenden.');
  teams.forEach((team,j)=>{
   const name=child(team,'TeamName');if(!name)throw Error('In der SKMR-Datei fehlt ein Mannschaftsname.');
   const d=src[j];if(typeof d.name!=='string'||!d.name.trim())throw Error('Ein Mannschaftsname fehlt.');
   mapping.push({group:g.name,slot:starts[j],old:name.textContent,name:d.name.trim(),players:[...d.members]});
   name.textContent=d.name.trim();
   if(withPlayers){
    const p=child(team,'Spieler');if(!p)throw Error('Spielerfeld fehlt in der SKMR-Vorlage.');
    p.replaceChildren();d.members.forEach((n,k)=>{
     const create=tag=>doc.createElementNS(doc.documentElement.namespaceURI,tag);
     if(parsed.playerFormat==='strings'){const el=create('string');el.textContent=n;p.appendChild(el);return;}
     const parts=d.skmrPlayers?.[k];
     if(!parts||typeof parts.firstName!=='string'||typeof parts.lastName!=='string'||!parts.lastName.trim())throw Error('Bitte Vor- und Nachnamen für den SKMR-Export prüfen.');
     const el=create('Spieler');
     [['FirstName',parts.firstName.trim()],['LastName',parts.lastName.trim()],['LicenseNumber','']].forEach(([tag,value])=>{const field=create(tag);field.textContent=value;el.appendChild(field);});p.appendChild(el);
    });
   }
  });
 });
 let xml=new XMLSerializer().serializeToString(doc);
 xml=xml.replace(/^<\?xml[^?]*\?>\s*/,'');
 return {xml:'<?xml version="1.0" encoding="utf-8"?>\n'+xml,mapping,withPlayers};
}
window.ecwSkmrTransfer={read,fill};
})();
