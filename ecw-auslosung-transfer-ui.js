(() => {
'use strict';
const $=id=>document.getElementById(id);
const api=()=>window.parent!==window?window.parent.ecwDrawCupBridge:null;
let preview=null,skmr=null,filename='',fileHandle=null,busy=false;
function status(message){$('transfer-status').textContent=message;}
window.ecwDrawLabel=team=>$('transfer-name-mode')?.value==='names'&&team.members?.length?team.members.join(' und '):team.name;
window.ecwDrawLabelHtml=team=>window.ecwDrawLabel(team).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function draw(){
 if(!Array.isArray(savedDrawResultTeams)||!savedDrawResultTeams.length)throw Error('Bitte zuerst die Auslosung abschließen.');
 const result=JSON.parse(JSON.stringify(savedDrawResultTeams));
 const inputs=$('transfer-teams').querySelectorAll('input[data-team-name]');
 result.forEach((t,i)=>{
  if(inputs[i])t.name=inputs[i].value.trim();
  if($('transfer-name-mode').value==='names')t.name=window.ecwDrawLabel(t);
  t.skmrPlayers=t.members.map((n,j)=>({firstName:$(`transfer-first-${i}-${j}`)?.value||'',lastName:$(`transfer-last-${i}-${j}`)?.value||''}));
 });
 const names=result.map(t=>t.name.toLocaleLowerCase('de'));
 if(names.some(n=>!n)||new Set(names).size!==names.length)throw Error('Bitte eindeutige Mannschaftsnamen eingeben.');
 return result;
}
function invalidate(){preview=null;$('transfer-cup-save').disabled=true;$('transfer-preview').replaceChildren();}
function renderMapping(rows){
 const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse';
 rows.forEach(r=>{const tr=table.insertRow();[`${r.group} · ${r.slot}`,r.old+' → '+r.name,(r.players||[]).join(' und ')].forEach(v=>{const td=tr.insertCell();td.textContent=v;td.style.cssText='padding:8px;border-bottom:1px solid #cbd5e1;vertical-align:top';});});
 $('transfer-preview').replaceChildren(table);
}
function refresh(){
 invalidate();const select=$('transfer-cup'),old=select.value;select.replaceChildren(new Option('Vorhandenes Cupturnier auswählen …',''));
 try{const list=(api()?.list()||[]).filter(t=>!t.started);list.forEach(t=>{const o=new Option(`${t.name} · ${t.teams} Mannschaften / ${t.groups} Gruppen`,t.id);o.disabled=t.started;select.add(o);});select.value=old;if(!list.length)status('Noch kein Cupturnier verfügbar. Bitte zuerst in der Cupauswertung anlegen.');}
 catch(e){status(e.message);}
}
function sync(){
 invalidate();$('transfer-teams').replaceChildren();refresh();
 if(!savedDrawResultTeams?.length){status('Die Übernahme steht nach abgeschlossener Auslosung zur Verfügung.');return;}
 savedDrawResultTeams.forEach((t,i)=>{
  const label=document.createElement('label');label.style.cssText='display:block;margin:10px 0';
  const span=document.createElement('span');span.textContent=`Gruppe ${t.group} · Mannschaft ${i+1}: `;
  const input=document.createElement('input');input.dataset.teamName='1';input.value=window.ecwDrawLabel(t);input.readOnly=$('transfer-name-mode').value==='names';input.maxLength=1000;input.style.cssText='max-width:100%;width:280px';input.addEventListener('input',invalidate);
  const desc=document.createElement('small');desc.textContent=t.members.join(' und ');desc.style.display='block';
  label.append(span,input,desc);$('transfer-teams').append(label);
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Vor- und Nachnamen für SKMR prüfen';details.append(summary);
  t.members.forEach((n,j)=>{
   const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:8px 0';
   const original=document.createElement('span');original.textContent=n;original.style.cssText='flex-basis:100%;font-weight:600';row.append(original);
   const parts=n.trim().split(/\s+/),first=parts.length>1?parts.pop():'';
   [['first',first,'Vorname'],['last',parts.join(' '),'Nachname']].forEach(([key,value,title])=>{
    const field=document.createElement('input');field.id=`transfer-${key}-${i}-${j}`;field.value=value;field.maxLength=120;field.setAttribute('aria-label',title+' für '+n);field.placeholder=title;field.style.cssText='max-width:100%;width:240px';field.addEventListener('input',invalidate);
    const l=document.createElement('label');l.textContent=title+' ';l.append(field);row.append(l);
   });details.append(row);
  });$('transfer-teams').append(details);
 });refresh();status('Auslosung bereit. Mannschaftsnamen können vor der Übernahme angepasst werden.');
}
const panel=document.createElement('section');panel.className='section';panel.id='draw-transfer-panel';panel.style.cssText='background:white;color:#172033;padding:20px;margin:20px auto;max-width:1100px;border-radius:12px;box-sizing:border-box';
panel.innerHTML=`<h2>4. Auslosung übernehmen</h2>
<p>Mannschaften und Spieler in ein bereits angelegtes Cupturnier übernehmen oder eine vorhandene SKMR-Vorlage befüllen.</p>
<label for="transfer-name-mode">Anzeige / Mannschaftsbezeichnung:</label>
<select id="transfer-name-mode" style="padding:10px;max-width:100%"><option value="number">Mannschaft 1, Mannschaft 2, …</option><option value="names">Gezogene Namen mit „und“</option></select>
<p>Die Auswahl gilt für die Auslosungsanzeige, die Druckliste sowie die Übernahme in Cup und SKMR.</p>
<div id="transfer-teams"></div>
<h3>Cupauswertung</h3><select id="transfer-cup" style="max-width:100%;padding:10px"></select>
<button type="button" id="transfer-refresh" class="btn btn-secondary">Turnierliste aktualisieren</button>
<button type="button" id="transfer-cup-preview" class="btn btn-primary">Übernahme prüfen</button>
<button type="button" id="transfer-cup-save" class="btn btn-success" disabled>In Cup / Firebase übernehmen</button>
<h3>Vorhandene SKMR-Datei</h3>
<p>Vorlage mit gleicher Gruppen- und Mannschaftsanzahl wählen. Die Zuordnung erfolgt je Gruppe nach Startnummer. Spielplan und Einstellungen bleiben erhalten.</p>
<input id="transfer-skmr" type="file" accept=".skmr">
<label style="display:block;margin:12px 0"><input type="checkbox" id="transfer-only-names"> Nur Mannschaftsnamen ändern; vorhandene Spielerfelder unverändert lassen</label>
<p id="transfer-skmr-info">Die Spielernamen werden in die SKMR-Felder für Vor- und Nachname geschrieben. Die vorgeschlagene Trennung bitte oben prüfen (Anmeldeliste: Nachname Vorname).</p>
<button type="button" id="transfer-skmr-preview" class="btn btn-primary">SKMR-Vorschau</button>
<button type="button" id="transfer-skmr-save" class="btn btn-success">Befüllte SKMR speichern</button>
<button type="button" id="transfer-onedrive-save" class="btn btn-info">SKMR direkt in OneDrive speichern</button>
<p id="transfer-status" role="status" aria-live="polite"></p><div id="transfer-preview" style="overflow-x:auto"></div>`;
(document.querySelector('.container')||document.body).append(panel);
$('transfer-refresh').onclick=refresh;
$('transfer-name-mode').onchange=()=>{sync();if(savedDrawResultTeams?.length)renderOverlayGroups(savedDrawResultTeams,null,null,null,null);};
$('transfer-cup').onchange=()=>{
 invalidate();
 const t=api()?.list().find(t=>t.id===$('transfer-cup').value);
 if(t&&!savedDrawResultTeams?.length){
  $('num-teams').value=String(t.teams);$('num-groups').value=String(t.groups);
  if(typeof handleGroupCountChange==='function')handleGroupCountChange();
  status('Gruppen- und Mannschaftsanzahl aus dem ausgewählten Cupturnier eingestellt.');
 }
};
$('transfer-cup-preview').onclick=()=>{try{if(!api())throw Error('Bitte die Auslosung aus der Cupauswertung öffnen.');const data=draw(),id=$('transfer-cup').value,p=api().preview(id,data);preview={...p,id,draw:data};renderMapping(p.assignment);$('transfer-cup-save').disabled=false;status('Vorschau geprüft. Nur das ausgewählte Turnier wird geändert. Speichern erfolgt erst mit „In Cup / Firebase übernehmen“.');}catch(e){invalidate();status(e.message);}};
$('transfer-cup-save').onclick=async()=>{
 if(busy||!preview)return;
 const p=preview;
 if(!confirm('Diese Aufstellung in das ausgewählte Cupturnier übernehmen und in Firebase speichern?'))return;
 busy=true;$('transfer-cup-save').disabled=true;
 try{status('Cupübernahme wird in Firebase gespeichert …');await api().save(p.id,p.draw,p.expected);status('Mannschaften und Spielernamen wurden in das Cupturnier übernommen und in Firebase bestätigt.');preview=null;}
 catch(e){status('Nicht übernommen: '+e.message);preview=null;}
 finally{busy=false;}
};
$('transfer-skmr').onchange=async e=>{
 skmr=null;fileHandle=null;invalidate();const f=e.target.files?.[0];if(!f)return;
 try{if(f.size>12*1024*1024)throw Error('Die Datei ist zu groß (maximal 12 MB).');const source=await f.text(),p=window.ecwSkmrTransfer.read(source);skmr=source;filename=f.name;$('transfer-skmr-info').textContent=`${f.name}: ${p.groups.map(g=>g.name+' ('+g.teams.length+')').join(', ')}. `+'Spielerformat erkannt. Vor- und Nachnamen bitte vor dem Speichern prüfen.';status('SKMR-Datei lokal geladen. Es wurde nichts hochgeladen oder gespeichert.');}catch(err){status(err.message);}
};
$('transfer-only-names').onchange=invalidate;
function skmrResult(){if(!skmr)throw Error('Bitte eine vorhandene SKMR-Datei auswählen.');return window.ecwSkmrTransfer.fill(skmr,draw(),!$('transfer-only-names').checked);}
$('transfer-skmr-preview').onclick=()=>{try{const r=skmrResult();renderMapping(r.mapping);status(r.withPlayers?'SKMR-Vorschau einschließlich Spielernamen.':'SKMR-Vorschau: Nur Mannschaftsnamen werden geändert. Spielernamen werden NICHT übernommen.');}catch(e){invalidate();status(e.message);}};
$('transfer-skmr-save').onclick=async()=>{
 if(busy)return;
 try{
  const r=skmrResult();renderMapping(r.mapping);
  if(!confirm(r.withPlayers?'Mannschafts- und Spielernamen in der SKMR-Datei speichern?':'Nur Mannschaftsnamen speichern? Die Spielernamen aus der Auslosung werden dabei NICHT in die SKMR-Datei übernommen.'))return;
  busy=true;const blob=new Blob([r.xml],{type:'application/xml;charset=utf-8'});
  const suggested=filename.replace(/\.skmr$/i,'')+'_Auslosung.skmr';
  if(window.showSaveFilePicker){
   fileHandle=await window.showSaveFilePicker({suggestedName:suggested,types:[{description:'SKMR Turnierdatei',accept:{'application/xml':['.skmr']}}]});
   const stream=await fileHandle.createWritable();try{await stream.write(blob);await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}
   status('SKMR-Datei gespeichert.');
  }else{
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=suggested;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Der Download der befüllten SKMR-Datei wurde gestartet. Die ursprüngliche Datei bleibt erhalten.');
  }
 }catch(e){if(e.name!=='AbortError')status('Nicht gespeichert: '+e.message);}finally{busy=false;}
};
$('transfer-onedrive-save').onclick=async()=>{
 if(busy)return;
 let tab=null;
 try{
  const r=skmrResult();renderMapping(r.mapping);
  if(!window.ecwOneDriveStore)throw Error('Die OneDrive-Dateiübergabe konnte nicht geladen werden. Bitte alle Update-Dateien hochladen und die Seite neu laden.');
  if(!confirm(r.withPlayers?'Die befüllte SKMR-Datei für OneDrive bereitstellen? Im neuen Tab anmelden und dort das Speichern bestätigen.':'Nur Mannschaftsnamen für OneDrive bereitstellen? Die Spielernamen werden nicht übernommen.'))return;
  tab=window.open('about:blank','_blank');
  if(!tab)throw Error('Bitte neue Tabs / Pop-ups für die Vereinsverwaltung erlauben und den OneDrive-Button erneut antippen.');
  tab.document.title='EC Wegscheid – OneDrive';tab.document.body.textContent='SKMR-Datei wird für OneDrive vorbereitet …';
  busy=true;$('transfer-onedrive-save').disabled=true;
  const id=await window.ecwOneDriveStore.put(r.xml,filename.replace(/\.skmr$/i,'')+'_Auslosung.skmr');
  const target=new URL('ecw-onedrive.html',document.baseURI);target.hash='job='+id;
  tab.opener=null;tab.location.replace(target.href);
  status('OneDrive-Seite geöffnet. Dort einmalig die Microsoft-App einrichten, anmelden und die Speicherung bestätigen. Bis dahin wurde nichts in OneDrive gespeichert.');
 }catch(e){if(tab&&!tab.closed)tab.close();status('OneDrive nicht gestartet: '+e.message);}
 finally{busy=false;$('transfer-onedrive-save').disabled=false;}
};
const finish=finishDrawProcessWithDelay;
finishDrawProcessWithDelay=async function(...args){sync();return finish.apply(this,args);};
// Die ursprünglichen Löschfunktionen werden nicht ersetzt; ein Wechsel des Ergebnisses wird geprüft.
let last=savedDrawResultTeams;
setInterval(()=>{if(savedDrawResultTeams!==last){last=savedDrawResultTeams;sync();}},1200);
sync();
})();
