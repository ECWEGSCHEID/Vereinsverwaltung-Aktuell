
(function(){
const key='ecw_board_structured_v27';const titles=['Überschrift','1. Begrüßung','2. Mitglieder','3. Dank','4. Rückblick','5. Vorhaben','Schlussworte'];
let sections;try{sections=JSON.parse(localStorage.getItem(key))}catch{}
const escape=gvEsc;
function seed(){return titles.map(title=>({title,items:[]}))}
if(!Array.isArray(sections)||sections.length!==7)sections=seed();
sections.forEach((g,i)=>g.items.forEach(x=>{if(!x.listStyle)x.listStyle=[1,2,3,4,5].includes(i)?'bullet':'plain'}));

// Repair historical import: a formatted subheading and its following paragraphs form one item.
function combineImportedPoints(){
 for(const index of [4,5]){const group=sections[index],result=[];let active=null;
 for(const item of group.items){
 if(item.title&&item.title.trim()){active=null;result.push(item);continue}
 const box=document.createElement('div');box.innerHTML=item.html||'';
 const children=Array.from(box.children);if(!children.length){if(active){active.text+='\n\n'+item.text;active.html+=item.html||''}else result.push(item);continue}
 let pending=[];
 const append=()=>{if(!pending.length)return;const holder=document.createElement('div');holder.innerHTML=pending.join('');const text=(holder.innerText||holder.textContent||'').trim();if(active){active.text+=(active.text?'\n\n':'')+text;active.html+=pending.join('')}else result.push({...item,text,html:pending.join('')});pending=[]};
 for(const node of children){const text=node.textContent.trim();const letters=Array.from(node.querySelectorAll('span,b,strong,u'));const marked=letters.filter(n=>n.textContent.trim()).length>0&&letters.filter(n=>n.textContent.trim()).every(n=>{const style=n.getAttribute('style')||'';return ((/font-weight:\s*bold/i.test(style)&&/text-decoration:\s*underline/i.test(style))||(n.tagName==='U'&&n.querySelector('b,strong'))) });
 if(text&&text.length<=120&&marked){append();active={title:text,date:item.date||'',text:'',html:''};result.push(active)}else pending.push(node.outerHTML)
 }append();
 }
 group.items=result;
 }
}
if(!localStorage.getItem('ecw_board_import_grouped_v27')){try{localStorage.setItem(key,JSON.stringify(sections));localStorage.setItem('ecw_board_import_grouped_v27','yes')}catch(e){alert('Zusammengefasste Punkte konnten nicht gespeichert werden: '+e.message)}}

function persist(){try{localStorage.setItem(key,JSON.stringify(sections));return true}catch(e){alert('Speichern fehlgeschlagen: '+e.message);return false}}
function itemBody(x){if(x.richHTML&&window.ecwRichText)return window.ecwRichText.clean(x.html);
const text=x.text||'';if(x.listStyle==='plain')return '<p style="white-space:pre-wrap">'+escape(text)+'</p>';
const tag=x.listStyle==='number'?'ol':'ul';let body='',blanks=0;
for(const line of text.replace(/\r\n?/g,'\n').split('\n')){if(!line.trim()){blanks++;continue}const clean=line.replace(/^\s*(?:[•◦▪●*-]|\d+[.)])\s+/,'');body+='<li style="white-space:pre-wrap;'+(blanks?'margin-top:'+(blanks*1.2)+'em;':'')+'">'+escape(clean)+'</li>';blanks=0}
return '<'+tag+' style="padding-left:1.4em;margin:0 0 12pt;list-style-type:'+(tag==='ol'?'decimal':'disc')+'">'+body+'</'+tag+'>'+(blanks?'<p style="height:'+(blanks*1.2)+'em;margin:0"></p>':'')
}
function output(){return sections.map((g,i)=>{const head=i===0?'':`<p style="font-size:20pt;font-weight:bold;text-decoration:underline">${escape(g.title)}</p>`;return head+`<div style="margin-left:12.7mm">`+g.items.map(x=>(x.title?`<p style="font-weight:bold;text-decoration:underline">${escape(x.title)}</p>`:'')+itemBody(x)).join('')+'</div>'}).join('')}

function sync(){document.getElementById('gvEditor').innerHTML=output();localStorage.setItem('ecw_gv15_html_vorstand',output());window.yearApi?.capture()}
function render(){document.getElementById('boardStructured').innerHTML='<p class="muted">Jeder Punkt enthält eine Überschrift und den zugehörigen Text. Aufzählungsart auswählen: Jede Textzeile wird ein Aufzählungspunkt. Leerzeilen erzeugen Abstand. ↑ ↓ verschiebt den gesamten Punkt.</p>'+sections.map((g,i)=>`<details class="panel" ${i===0?'open':''}><summary style="cursor:pointer;font-weight:bold;font-size:20px">${escape(g.title)} (${g.items.length})</summary><label>Überschrift</label><input aria-label="Bereichsüberschrift" value="${escape(g.title)}" oninput="boardApi.heading(${i},this.value)"><div class="row" style="margin:12px 0"><button class="btn red" onclick="boardApi.add(${i})">＋ Punkt hinzufügen</button></div>${g.items.map((x,j)=>`<div class="board-entry"><div class="row between"><b id="boardPointLabel_${i}_${j}">${escape(x.title||("Punkt "+(j+1)))}</b><div class="row"><button class="btn" ${j===0?'disabled':''} onclick="boardApi.move(${i},${j},-1)">↑</button><button class="btn" ${j===g.items.length-1?'disabled':''} onclick="boardApi.move(${i},${j},1)">↓</button><button class="btn" onclick="boardApi.remove(${i},${j})">Löschen</button></div></div><label>Überschrift des Punktes</label><input value="${escape(x.title)}" oninput="boardApi.edit(${i},${j},'title',this.value)" placeholder="z. B. Weihnachtsfeier"><label>Aufzählung</label><select aria-label="Aufzählungszeichen" onchange="boardApi.edit(${i},${j},'listStyle',this.value)"><option value="bullet" ${x.listStyle==='bullet'?'selected':''}>• Aufzählungszeichen</option><option value="number" ${x.listStyle==='number'?'selected':''}>1. Nummerierte Liste</option><option value="plain" ${x.listStyle==='plain'?'selected':''}>Fließtext ohne Zeichen</option></select><label>Text – ein Aufzählungspunkt pro Zeile</label><textarea oninput="boardApi.edit(${i},${j},'text',this.value)" placeholder="Text zum Punkt; Leerzeilen bleiben im Ausdruck erhalten">${escape(x.text)}</textarea></div>`).join('')}</details>`).join('');window.ecwRichText?.mount("boardStructured",window.boardApi)}

function show(){const board=gvActive==='vorstand';document.getElementById('boardStructured').classList.toggle('hidden',!board);document.getElementById('gvToolbar').style.display=board?'none':'';document.getElementById('gvEditor').contentEditable=board?'false':'true';if(board){render();sync();document.getElementById('gvStatus').textContent='Punkte oben bearbeiten · darunter Druckvorschau · automatisch lokal gespeichert.'}}
window.boardApi={rich(i,j,html,text){const x=sections[i]?.items[j];if(!x)return;x.html=window.ecwRichText.clean(html);x.text=text;x.richHTML=true;if(persist())sync()},getSections(){return JSON.parse(JSON.stringify(sections))},setSections(value){sections=JSON.parse(JSON.stringify(value));persist();render();if(gvActive==='vorstand')sync()},previewHtml:output,heading(i,value){sections[i].title=value;persist();const summary=document.querySelectorAll('#boardStructured details')[i].querySelector('summary');if(summary)summary.textContent=value+' ('+sections[i].items.length+')';sync()},add(i){sections[i].items.push({title:'',date:'',text:'',listStyle:'bullet',html:'<p style="white-space:pre-wrap"><br></p>'});persist();render();sync();const d=document.querySelectorAll('#boardStructured details')[i];d.open=true;d.querySelectorAll('[contenteditable=true]')[sections[i].items.length-1]?.focus()},edit(i,j,k,v){const x=sections[i].items[j];x[k]=v;if(k==='text')x.html='<p style="white-space:pre-wrap">'+escape(v.replace(/\r\n?/g,'\n'))+'</p>';if(k==='title'){const label=document.getElementById('boardPointLabel_'+i+'_'+j);if(label)label.textContent=v||('Punkt '+(j+1))}persist();sync()},move(i,j,n){const a=sections[i].items,k=j+n;if(k<0||k>=a.length)return;[a[j],a[k]]=[a[k],a[j]];persist();render();document.querySelectorAll('#boardStructured details')[i].open=true;sync()},sort(i){sections[i].items.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));persist();render();document.querySelectorAll('#boardStructured details')[i].open=true;sync()},remove(i,j){if(!confirm('Diesen Berichtspunkt löschen?'))return;sections[i].items.splice(j,1);persist();render();document.querySelectorAll('#boardStructured details')[i].open=true;sync()}};
const select=gvSelect;gvSelect=function(k){select(k);show()};
const save=gvSave;gvSave=function(silent=false){if(gvActive==='vorstand'){persist();sync();if(!silent)document.getElementById('gvStatus').textContent='Berichtspunkte lokal gespeichert.'}else save(silent)};
const reset=gvReset;gvReset=function(){if(gvActive!=='vorstand')return reset();if(!confirm('Alle Vorstand-Berichtspunkte auf die mitgelieferte Vorlage zurücksetzen?'))return;localStorage.removeItem('ecw_gv15_html_vorstand');sections=seed();persist();show()};
persist();show();
})();
