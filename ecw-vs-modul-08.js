
function gvDocx(source){
const xe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const root=document.createElement('div');root.innerHTML=source;const paragraphs=[];
function twips(v){const n=parseFloat(v);if(!Number.isFinite(n))return 0;return Math.round(n*(String(v).endsWith('mm')?1440/25.4:String(v).endsWith('px')?15:20))}
function inherit(node,style={}){const st={...style};if(['B','STRONG'].includes(node.tagName)||node.style.fontWeight==='bold')st.bold=true;if(['I','EM'].includes(node.tagName)||node.style.fontStyle==='italic')st.italic=true;if(node.tagName==='U'||(node.style.textDecoration||'').includes('underline'))st.underline=true;const family=node.style.fontFamily||'';if(/Arial|Helvetica/i.test(family))st.font='Arial';else if(/Times/i.test(family))st.font='Times New Roman';if(node.style.fontSize)st.size=Math.round(parseFloat(node.style.fontSize)*(node.style.fontSize.endsWith('px')?1.5:2));return st}
function runs(node,style={}){
 if(node.nodeType===3)return node.textContent.split('\n').map((text,i)=>(i?'<w:r><w:br/></w:r>':'')+'<w:r><w:rPr><w:rFonts w:ascii="'+xe(style.font||'Times New Roman')+'" w:hAnsi="'+xe(style.font||'Times New Roman')+'"/><w:sz w:val="'+(style.size||36)+'"/>'+(style.bold?'<w:b/>':'')+(style.italic?'<w:i/>':'')+(style.underline?'<w:u w:val="single"/>':'')+'</w:rPr><w:t xml:space="preserve">'+xe(text)+'</w:t></w:r>').join('');
 if(node.nodeType!==1)return '';if(node.tagName==='BR')return '<w:r><w:br/></w:r>';const st=inherit(node,style);return Array.from(node.childNodes).map(n=>runs(n,st)).join('');
}
function paragraph(node,left,style,marker=''){
 const after=node.style.marginBottom?twips(node.style.marginBottom):marker?120:180;
 const markerRun=marker?'<w:r><w:rPr><w:rFonts w:ascii="'+xe(style.font||'Times New Roman')+'"/><w:sz w:val="'+(style.size||36)+'"/></w:rPr><w:t xml:space="preserve">'+xe(marker)+'</w:t></w:r>':'';
 paragraphs.push('<w:p><w:pPr><w:ind w:left="'+(left+(marker?420:0))+'"'+(marker?' w:hanging="300"':'')+'/><w:spacing w:after="'+after+'" w:line="288" w:lineRule="auto"/></w:pPr>'+markerRun+runs(node,style)+'</w:p>');
}
function walk(node,indent=0,style={}){
 if(node.nodeType!==1)return;const left=indent+twips(node.style.marginLeft||''),st=inherit(node,style);
 if(['UL','OL'].includes(node.tagName)){Array.from(node.children).forEach((li,i)=>{const copy=li.cloneNode(true);Array.from(copy.children).filter(n=>['UL','OL'].includes(n.tagName)).forEach(n=>n.remove());paragraph(copy,left,inherit(li,st),node.tagName==='OL'?(i+1)+'. ':'• ');Array.from(li.children).filter(n=>['UL','OL'].includes(n.tagName)).forEach(n=>walk(n,left+420,st))});return}
 if(['P','H1','H2','H3'].includes(node.tagName)){paragraph(node,left,st);return}Array.from(node.children).forEach(n=>walk(n,left,st));
}
Array.from(root.children).forEach(node=>walk(node));

const files={
'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
'_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs.join('')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>'};
const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};
const header=(size,values)=>{const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);for(const [at,value,width] of values)width===2?view.setUint16(at,value,true):view.setUint32(at,value,true);return bytes};
for(const [path,text] of Object.entries(files)){const name=enc.encode(path),data=enc.encode(text),sum=crc(data);const local=header(30,[[0,0x04034b50,4],[4,20,2],[14,sum,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);chunks.push(local,name,data);central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[16,sum,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]),name);offset+=local.length+name.length+data.length}
const centralSize=central.reduce((n,x)=>n+x.length,0);return new Blob([...chunks,...central,header(22,[[0,0x06054b50,4],[8,3,2],[10,3,2],[12,centralSize,4],[16,offset,4]])],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
}
