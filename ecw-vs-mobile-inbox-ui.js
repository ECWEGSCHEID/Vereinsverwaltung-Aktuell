(() => {
'use strict';
const panel=document.createElement('section');panel.className='panel no-print';panel.innerHTML='<h3>Mobile Punkte</h3><p>Mobile Eingaben sind bereits in Firebase gespeichert und erscheinen hier automatisch. Es ist kein gesondertes Übernehmen nötig.</p><button type="button" class="btn">Anzeige aktualisieren</button><p role="status" aria-live="polite"></p>';
const group=document.createElement('details');group.className='utility-group no-print';const heading=document.createElement('summary');heading.textContent='Mobile Punkte';group.append(heading,panel);document.getElementById('meetingUtilityRail').prepend(group);
const status=panel.querySelector('[role]'),button=panel.querySelector('button');let busy=false,waiting=false,lastRun=0,rerun=false;let locallyApplied=new Set();
async function apply(rows){const messages=[];while(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable||document.activeElement?.closest('.ecw-rich-editor-wrap')){status.textContent='Mobile Punkte sind in Firebase gespeichert. Die Anzeige wird nach Abschluss deiner laufenden Eingabe aktualisiert.';await new Promise(resolve=>document.addEventListener('focusout',()=>setTimeout(resolve,0),{once:true}));}for(const r of rows){try{if(r.entry.kind==='board')window.ecwBoardMobileImport(r.entry,r.identity);else window.ecwWorkMobile.import(r.entry,r.target,r.definition);locallyApplied.add(r.entry.id);}catch(e){messages.push(e.message);}}return messages;}
async function refresh(){
 if(busy){rerun=true;return;}
 if(!window.ecwMeetingCloud?.synchronizeMobile){status.textContent='Die neue Speicherfunktion fehlt. Bitte alle Update-Dateien hochladen und neu laden.';return;}
 if(window.ecwMeetingCloud.isBusy()){waiting=true;status.textContent='Mobile Punkte werden nach der laufenden Firebase-Prüfung automatisch angezeigt …';return;}
 waiting=false;busy=true;locallyApplied=new Set();button.disabled=true;lastRun=Date.now();status.textContent='Mobile Punkte werden automatisch abgeglichen …';
 try{
  const result=await window.ecwMeetingCloud.synchronizeMobile(()=>{
   if(window.parent===window||!window.parent.ecwMobileMeetingInbox)throw Error('Bitte aus der angemeldeten Vereinsverwaltung öffnen.');return window.parent.ecwMobileMeetingInbox.synchronize(window);
  },apply);
  if(result.ackIds?.length){const ack=await window.parent.ecwMobileMeetingInbox.acknowledge(window,[...locallyApplied]);result.unconfirmed=ack.failed+result.ackIds.filter(id=>!locallyApplied.has(id)).length;}
  const messages=[result.count?result.count+' mobile Punkte im Firebase-Versammlungsstand bestätigt gespeichert.':(result.blocked?.length?'Mobile Punkte sind gesichert und warten auf einen offenen Zielbereich.':'Keine neuen mobilen Punkte.')];
  for(const b of result.blocked||[])messages.push(b.reason);
  for(const m of result.localMessages||[])messages.push(m);
  if(result.unconfirmed)messages.push('Punkte sind bereits gespeichert. Die Eingangsbestätigung wird beim nächsten Öffnen wiederholt; es entstehen keine Dubletten.');
  if(result.more)messages.push('Weitere Punkte werden beim nächsten Aktualisieren verarbeitet.');
  status.textContent=[...new Set(messages)].join('\n');status.style.whiteSpace='pre-line';
 }catch(e){if(e.code==='mobile/busy'){waiting=true;status.textContent='Firebase läuft noch. Die Anzeige wird danach automatisch aktualisiert.';}else status.textContent='Mobile Punkte bleiben in Firebase erhalten. Die Anzeige konnte noch nicht aktualisiert werden: '+e.message;}
 finally{busy=false;button.disabled=false;if(rerun){rerun=false;setTimeout(refresh,0);}}
}
button.onclick=refresh;
window.addEventListener('ecw-meetings-idle',()=>{if(waiting&&!busy){waiting=false;refresh();}});
window.addEventListener('focus',()=>{if(Date.now()-lastRun>60000&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))refresh();});
try{
 const parent=window.parent;
 if(parent!==window&&parent.ecwMobileMeetingInbox?.watch){
  const stop=parent.ecwMobileMeetingInbox.watch(window,refresh,error=>{status.textContent='Automatische Anzeige derzeit nicht erreichbar: '+error.message;});
  window.addEventListener('pagehide',stop,{once:true});
 }
}catch(error){status.textContent=error.message;}
refresh();
})();
