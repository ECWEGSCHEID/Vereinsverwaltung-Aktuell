(() => {
'use strict';
function mount(target,host,prefix){
const targetApi=target==='secretary'?window.secretaryApi:window.msApi;if(!targetApi)return;
const core=window.ecwParticipationCore,$=id=>document.getElementById(id.startsWith('msParticipation')?id.replace('msParticipation',prefix):id);
let snapshot=null,sourceSignature='',state=null,current=null;
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function status(s){$('msParticipationStatus').textContent=s;}
function read(){if(window.parent===window||!window.parent.ecwMeetingParticipation)throw Error('Bitte aus der angemeldeten Vereinsverwaltung öffnen. Die Verbindung zur Teilnahmeauswertung fehlt.');return window.parent.ecwMeetingParticipation.read(window);}
function signature(s){return JSON.stringify({events:s.events,aliases:s.aliases});}
function setPreview(){
 current=null;$('msParticipationApply').disabled=true;
 if(!snapshot)return;
 const year=+$('msParticipationYear').value,keys=new Set([...$('msParticipationEntries').querySelectorAll('input:checked')].map(x=>x.value));
 const selected=snapshot.records.filter(x=>keys.has(x.key));current=core.summarize(selected,year);
 state=targetApi.participationState(year);
 $('msParticipationText').textContent=core.report(current).desc;
 $('msParticipationApply').disabled=state.archived||current.total===0;
 status(state.archived?'Diese Sitzung ist freigegeben und gesperrt.':`${current.tournaments} Turnierteilnahmen und ${current.championships} Meisterschaftsteilnahmen ausgewählt. ${state.existing?'Der bereits übernommene Jahrespunkt wird beim Bestätigen ersetzt.':'Es wird ein eigener Rückblick-Punkt angelegt.'}`);
}
function renderEntries(){
 $('msParticipationEntries').replaceChildren();if(!snapshot)return;
 const year=+$('msParticipationYear').value,records=snapshot.records.filter(x=>x.date.startsWith(year+'-'));
 records.forEach(r=>{
  const label=document.createElement('label');label.style.cssText='display:flex;gap:10px;align-items:flex-start;padding:9px;border-bottom:1px solid #cbd5e1';
  const input=document.createElement('input');input.type='checkbox';input.checked=true;input.value=r.key;input.style.cssText='width:auto;flex:0 0 auto;margin-top:4px';input.addEventListener('change',setPreview);
  const text=document.createElement('span');text.textContent=`${r.date.split('-').reverse().join('.')} · ${r.type} · ${r.name}${r.location?' · '+r.location:''}\n${r.players.length?r.players.join(', '):'Keine Spieler erfasst'}`;text.style.whiteSpace='pre-line';label.append(input,text);$('msParticipationEntries').append(label);
 });
 if(!records.length){$('msParticipationEntries').textContent='Keine vergangenen Turniere oder Meisterschaften für dieses Jahr erfasst. Fehlende Einträge bedeuten nicht automatisch null tatsächliche Teilnahmen.';}
 $('msParticipationWarnings').textContent=snapshot.warnings.join('\n')+(snapshot.excluded?`\n${snapshot.excluded} zukünftige/heutige oder abgesagte Einträge wurden ausgeschlossen.`:'');setPreview();
}
function refresh(){
 try{
  const raw=read();sourceSignature=signature(raw);snapshot=core.project(raw.events,raw.aliases,today());
  const prior=$('msParticipationYear').value,years=new Set(snapshot.records.map(x=>x.date.slice(0,4)));
  const d=$('ms_meetingDate')?.value||today(),y=+d.slice(0,4),preferred=+d.slice(5,7)<=3?y-1:y;
  years.add(String(preferred));years.add(today().slice(0,4));
  $('msParticipationYear').replaceChildren();[...years].sort((a,b)=>+b-+a).forEach(y=>$('msParticipationYear').add(new Option(y,y)));
  $('msParticipationYear').value=years.has(prior)?prior:String(preferred);renderEntries();
 }catch(e){snapshot=null;current=null;$('msParticipationApply').disabled=true;status(e.message);}
}
const panel=document.createElement('div');panel.className='panel no-print';panel.id='msParticipationPanel';panel.innerHTML=`<h3>Turnier- und Meisterschaftsteilnahmen übernehmen</h3>
<p>Auswertung der vergangenen externen Turniere und Meisterschaften aus dem bereits geladenen Terminplaner. Zukünftige/heutige Termine, ausdrücklich abgesagte Einträge, interne Turniere und eigene Ausrichtungen werden nicht mitgezählt.</p>
<button type="button" id="msParticipationLoad" class="btn">Aus Vereinsverwaltung laden / Vorschau</button>
<label style="display:inline-block;margin:8px">Vereinsjahr <select id="msParticipationYear" aria-label="Vereinsjahr"></select></label>
<p id="msParticipationStatus" class="small" role="status" aria-live="polite">Die Zahlen werden erst nach Laden, Prüfen und Bestätigen eingefügt.</p>
<details><summary>Einträge prüfen und bei Bedarf abwählen</summary><p>Ein vergangener Termin ist kein automatischer Anwesenheitsnachweis. Bitte nur tatsächlich bestrittene Teilnahmen ausgewählt lassen. Ein Terminplanereintrag entspricht einer Mannschaftsteilnahme, nicht zwingend einem eigenen Turnier.</p><div id="msParticipationEntries" style="max-height:380px;overflow:auto"></div></details>
<pre id="msParticipationWarnings" style="white-space:pre-wrap;font:inherit"></pre>
<details open><summary>Textvorschau für die Mannschaftssitzung</summary><pre id="msParticipationText" style="white-space:pre-wrap;font:inherit"></pre></details>
<button type="button" id="msParticipationApply" class="btn red" disabled>Als Rückblick-Punkt übernehmen</button>
<p class="small">Die Übernahme speichert im Browser. Für die geräteübergreifende Speicherung anschließend wie gewohnt „In Firebase speichern“ benutzen. Bereits archivierte Sitzungen werden nicht geändert.</p>`;
panel.innerHTML=panel.innerHTML.replaceAll('msParticipation',prefix);host.prepend(panel);
if(target==='secretary'){$('msParticipationApply').textContent='Unter Jahresbericht übernehmen';}
$('msParticipationLoad').onclick=refresh;$('msParticipationYear').onchange=renderEntries;
$('msParticipationApply').onclick=()=>{
 try{
  if(!current||!current.total||!state)throw Error('Bitte zuerst die Vorschau laden und die Einträge prüfen.');
  if(signature(read())!==sourceSignature)throw Error('Die Terminplanerdaten wurden inzwischen geändert. Bitte die Vorschau neu laden.');
  if(!confirm(`${current.total} ausgewählte Mannschaftsteilnahmen für ${current.year} übernehmen?${state.existing?' Der bestehende automatisch übernommene Punkt einschließlich seiner Textänderungen wird ersetzt. Andere Sitzungspunkte bleiben erhalten.':''}`))return;
  const report=core.report(current);
  targetApi.importParticipation({year:current.year,...report,expected:state.expected,selection:current.records.map(r=>({id:r.id,date:r.date,name:r.name,type:r.type,players:r.players})),});
  state=targetApi.participationState(current.year);status('Als bearbeitbarer Rückblick-Punkt im Browser gespeichert. Für die Sicherung auf anderen Geräten bitte „In Firebase speichern“ wählen.');
 }catch(e){status(e.message);}
};
}
const meeting=document.getElementById('ms_meeting');if(meeting)mount('team',meeting,'msParticipation');
const dialog=document.createElement('dialog');dialog.style.cssText='width:min(1000px,96vw);max-height:92vh;overflow:auto;padding:18px';const close=document.createElement('button');close.textContent='Schließen';close.className='btn';close.onclick=()=>dialog.close();dialog.append(close);const host=document.createElement('div');dialog.append(host);document.body.append(dialog);mount('secretary',host,'secretaryParticipation');window.ecwOpenSecretaryParticipation=()=>dialog.showModal();
})();
