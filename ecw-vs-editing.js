/* Shared editing tools. Data is kept in the existing report/meeting stores. */
(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function moveIndex(items,index,delta){if(![1,-1].includes(delta)||!Number.isInteger(index)||index<0||index>=items.length||index+delta<0||index+delta>=items.length)return false;[items[index],items[index+delta]]=[items[index+delta],items[index]];return true}
function moveSection(items,id,delta){if(![1,-1].includes(delta))return false;const index=items.findIndex(x=>String(x.id)===String(id));if(index<0)return false;const positions=items.map((x,i)=>x.section===items[index].section?i:-1).filter(i=>i>=0),at=positions.indexOf(index),to=positions[at+delta];if(to===undefined)return false;[items[index],items[to]]=[items[to],items[index]];return true}
function buttons(items,id,action,locked){const item=items.find(x=>String(x.id)===String(id));if(!item||locked)return '';const peers=items.filter(x=>x.section===item.section),at=peers.indexOf(item);return [-1,1].map(d=>'<button type="button" class="btn order-button" aria-label="Punkt nach '+(d<0?'oben':'unten')+' verschieben" '+((at+d<0||at+d>=peers.length)?'disabled ':'')+'onclick="'+action+'('+esc(JSON.stringify(id))+','+d+')">'+(d<0?'↑':'↓')+'</button>').join('')}
function clean(source){
 const root=document.createElement('div');root.innerHTML=String(source||'');const out=document.createElement('div');
 function visit(node,parent){if(node.nodeType===3){parent.append(document.createTextNode(node.textContent));return}if(node.nodeType!==1)return;
  if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG','SVG','MATH','INPUT','BUTTON'].includes(node.tagName))return;
  const allowed=['P','DIV','UL','OL','LI','SPAN','B','STRONG','I','EM','U','BR','BLOCKQUOTE','FONT'];let tag=node.tagName.toLowerCase();
  if(!allowed.includes(node.tagName)){for(const child of node.childNodes)visit(child,parent);return}
  if(tag==='font')tag='span';if(tag==='blockquote')tag='div';const el=document.createElement(tag),st=node.style;
  const family=String(st.fontFamily||node.getAttribute('face')||'').replace(/["']/g,'');if(/Arial|Helvetica/i.test(family))el.style.fontFamily='Arial, sans-serif';else if(/Times/i.test(family))el.style.fontFamily='"Times New Roman", serif';
  let size=parseFloat(st.fontSize);if((st.fontSize||'').endsWith('px'))size*=.75;if(!size&&node.tagName==='FONT')size=({1:8,2:10,3:12,4:14,5:18,6:24,7:36})[node.getAttribute('size')];if(size>=8&&size<=48)el.style.fontSize=size+'pt';
  if(st.fontWeight==='bold'||Number(st.fontWeight)>=600)el.style.fontWeight='bold';if(st.fontStyle==='italic')el.style.fontStyle='italic';if((st.textDecoration||'').includes('underline'))el.style.textDecoration='underline';
  for(const key of ['marginLeft','marginBottom']){let value=parseFloat(st[key]);if(st[key].endsWith('px'))value*=.75;if(node.tagName==='BLOCKQUOTE'&&key==='marginLeft')value=30;if(value>=0&&value<=180)el.style[key]=value+'pt'}
  if(['P','DIV','LI'].includes(node.tagName))el.style.whiteSpace='pre-wrap';for(const child of node.childNodes)visit(child,el);parent.append(el);
 }
 for(const node of root.childNodes)visit(node,out);
 // Browsers create DIV paragraphs on Enter; make every such text block exportable.
 for(const div of [...out.querySelectorAll('div')].reverse()){
  const blocks=[...div.children].some(n=>['P','DIV','UL','OL'].includes(n.tagName));
  if(!blocks){const p=document.createElement('p');p.setAttribute('style',div.getAttribute('style')||'');while(div.firstChild)p.append(div.firstChild);div.replaceWith(p)}
  else{let p=null;for(const node of [...div.childNodes]){if(node.nodeType===1&&['P','DIV','UL','OL'].includes(node.tagName)){p=null;continue}if(!p){p=document.createElement('p');div.insertBefore(p,node)}p.append(node)}}
 }
 // Root text also forms a paragraph so Word and PDF can export it.
 const final=document.createElement('div');let paragraph=null;
 for(const node of [...out.childNodes]){const block=node.nodeType===1&&['P','DIV','UL','OL'].includes(node.tagName);if(block){paragraph=null;final.append(node)}else{if(!paragraph){paragraph=document.createElement('p');paragraph.style.whiteSpace='pre-wrap';final.append(paragraph)}paragraph.append(node)}}
 return final.innerHTML;
}
function plain(source){const box=document.createElement('div');box.innerHTML=source;let out='';function visit(n){if(n.nodeType===3){out+=n.textContent;return}if(n.nodeType!==1)return;if(n.tagName==='BR'){out+='\n';return}const block=['P','DIV','LI'].includes(n.tagName);if(block&&out&&!out.endsWith('\n'))out+='\n';for(const child of n.childNodes)visit(child);if(block)out+='\n'}for(const child of box.childNodes)visit(child);return out.trimEnd()}
function mount(container,api){
 const holder=document.getElementById(container);if(!holder)return;holder.querySelectorAll('.board-entry textarea').forEach(area=>{
  const handler=area.getAttribute('oninput')||'',match=handler.match(/(?:boardApi|secretaryApi)\.edit\((\d+),(\d+),/);if(!match)return;const i=+match[1],j=+match[2],item=api.getSections()[i].items[j];
  const entry=area.closest('.board-entry'),oldSelect=entry?.querySelector('select[aria-label="Aufzählungszeichen"]');if(oldSelect){if(oldSelect.previousElementSibling?.tagName==='LABEL')oldSelect.previousElementSibling.remove();oldSelect.remove()}if(area.previousElementSibling?.tagName==='LABEL')area.previousElementSibling.textContent='Text und Formatierung';
  const wrap=document.createElement('div');wrap.className='ecw-rich-editor-wrap';const toolbar=document.createElement('div');toolbar.className='ecw-rich-toolbar';toolbar.setAttribute('aria-label','Text formatieren');
  const editor=document.createElement('div');editor.className='ecw-rich-editor';editor.contentEditable='true';editor.setAttribute('contenteditable','true');editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.setAttribute('aria-label','Berichtstext');editor.innerHTML=item.richHTML?clean(item.html):item.listStyle==='bullet'||item.listStyle==='number'?'<'+(item.listStyle==='number'?'ol':'ul')+'>'+String(item.text||'').split(/\r?\n/).map(line=>'<li style="white-space:pre-wrap">'+(esc(line)||'<br>')+'</li>').join('')+'</'+(item.listStyle==='number'?'ol':'ul')+'>':'<p style="white-space:pre-wrap">'+esc(item.text||'').replace(/\r?\n/g,'<br>')+'</p>';
  let range=null;const remember=()=>{const s=getSelection();if(s.rangeCount&&editor.contains(s.anchorNode))range=s.getRangeAt(0).cloneRange()};
  const restore=()=>{editor.focus();if(range&&editor.contains(range.commonAncestorContainer)){const s=getSelection();s.removeAllRanges();s.addRange(range)}};
  // A font choice without a text selection applies to the complete point.
  function styleText(key,value){
   restore();const selected=range&&!range.collapsed&&editor.contains(range.commonAncestorContainer);
   if(selected){const span=document.createElement('span');span.style[key]=value;span.append(range.extractContents());span.querySelectorAll('*').forEach(n=>n.style.removeProperty(key==='fontFamily'?'font-family':'font-size'));range.insertNode(span);range.selectNodeContents(span);const selection=getSelection();selection.removeAllRanges();selection.addRange(range)}
   else{editor.querySelectorAll('*').forEach(n=>{n.style.removeProperty(key==='fontFamily'?'font-family':'font-size');if(key==='fontFamily')n.removeAttribute('face');else n.removeAttribute('size')});for(const node of [...editor.childNodes]){if(node.nodeType===1)node.style[key]=value;else{const span=document.createElement('span');span.style[key]=value;node.replaceWith(span);span.append(node)}}range=null}
  }
  function listText(tag){
   restore();let blocks=[...editor.children];const selected=range&&!range.collapsed&&editor.contains(range.commonAncestorContainer);
   if(selected){const matched=blocks.filter(n=>range.intersectsNode(n));if(matched.length)blocks=matched}
   if(!blocks.length){const p=document.createElement('p');while(editor.firstChild)p.append(editor.firstChild);if(!p.firstChild)p.append(document.createElement('br'));editor.append(p);blocks=[p]}
   if(blocks.length===1&&blocks[0].tagName===tag.toUpperCase()){
    const list=blocks[0];for(const li of [...list.children]){const p=document.createElement('p');while(li.firstChild)p.append(li.firstChild);list.before(p)}list.remove();
   }else{const list=document.createElement(tag);blocks[0].before(list);for(const block of blocks){if(['UL','OL'].includes(block.tagName)){while(block.firstChild)list.append(block.firstChild);block.remove()}else{const li=document.createElement('li');if(block.tagName==='P'||block.tagName==='DIV'){while(block.firstChild)li.append(block.firstChild);block.remove()}else li.append(block);list.append(li)}}}
   range=null;
  }
  const save=()=>{remember();const html=clean(editor.innerHTML);api.rich(i,j,html,plain(html))};
  function action(label,title,cmd,apply){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onmousedown=e=>e.preventDefault();b.onclick=()=>{restore();if(apply)apply();else document.execCommand(cmd,false,null);save()};toolbar.append(b)}
  function select(label,values,apply){const box=document.createElement('label');box.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);values.forEach(([v,t])=>select.add(new Option(t,v)));select.onpointerdown=remember;select.onmousedown=remember;select.onchange=()=>{const value=select.value;restore();apply(value);save()};box.append(select);toolbar.append(box);return select}
  const fontSelect=select('Schriftart',[['Times New Roman','Times New Roman'],['Arial','Arial']],v=>styleText('fontFamily',v));
  const size=select('Schriftgröße',[[10,'10 pt'],[12,'12 pt'],[14,'14 pt'],[16,'16 pt'],[18,'18 pt'],[20,'20 pt'],[24,'24 pt'],[28,'28 pt']],v=>styleText('fontSize',v+'pt'));size.value='18';
  action('F','Fett','bold');action('K','Kursiv','italic');action('U','Unterstrichen','underline');action('• Liste','Aufzählungszeichen',null,()=>listText('ul'));action('1. Liste','Nummerierte Liste',null,()=>listText('ol'));action('⇥','Einzug vergrößern','indent');action('⇤','Einzug verkleinern','outdent');
  select('Absatzabstand',[[0,'0 pt'],[6,'6 pt'],[12,'12 pt'],[18,'18 pt']],v=>{let nodes=[...editor.querySelectorAll('p,div,li')].filter(n=>range&&range.intersectsNode(n));if(!nodes.length){document.execCommand('formatBlock',false,'p');remember();nodes=[...editor.querySelectorAll('p,div,li')].filter(n=>range&&range.intersectsNode(n))}nodes.forEach(n=>n.style.marginBottom=v+'pt')});
  editor.addEventListener('input',save);for(const event of ['mouseup','keyup','touchend','focusout'])editor.addEventListener(event,remember);
  editor.addEventListener('paste',event=>{event.preventDefault();const source=event.clipboardData.getData('text/html'),text=event.clipboardData.getData('text/plain');document.execCommand('insertHTML',false,source?clean(source):esc(text).replace(/\r?\n/g,'<br>'));save()});
  wrap.append(toolbar,editor);area.replaceWith(wrap);
 });
}
window.ecwToggleUtilityRail=function(force){const open=typeof force==='boolean'?force:!document.body.classList.contains('utility-rail-open');document.body.classList.toggle('utility-rail-open',open);const b=document.getElementById('utilityRailToggle');if(b){b.setAttribute('aria-expanded',String(open));b.textContent=open?'Verwaltung schließen':'Verwaltung & Speichern'}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')window.ecwToggleUtilityRail(false)});
function updateRail(){const active=document.querySelector('main > nav [data-tab].active')?.dataset.tab;document.querySelectorAll('[data-utility-for]').forEach(e=>{e.hidden=e.dataset.utilityFor==='mannschaft'?active!=='mannschaft':!['meeting','collection','tasks','archive'].includes(active)})}
document.addEventListener('DOMContentLoaded',updateRail);document.addEventListener('click',e=>{if(e.target.closest?.('main > nav [data-tab]'))Promise.resolve().then(updateRail)});
window.ecwEditing={moveIndex,moveSection,buttons};window.ecwRichText={clean,mount};
})();
