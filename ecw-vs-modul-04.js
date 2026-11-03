
let gvRange=null;
document.addEventListener('selectionchange',()=>{const sel=getSelection();if(sel.rangeCount&&document.getElementById('gvEditor').contains(sel.anchorNode))gvRange=sel.getRangeAt(0).cloneRange()});
function gvRestore(){const e=document.getElementById('gvEditor');e.focus();if(gvRange&&e.contains(gvRange.commonAncestorContainer)){const sel=getSelection();sel.removeAllRanges();sel.addRange(gvRange)}}
function gvFormat(cmd){gvRestore();document.execCommand(cmd,false,null);gvSave(true)}
function gvFormatSize(size){gvRestore();document.execCommand('fontSize',false,'7');document.querySelectorAll('#gvEditor font[size="7"]').forEach(e=>{e.removeAttribute('size');e.style.fontSize=size+'pt'});gvSave(true)}
document.getElementById('gvEditor').addEventListener('input',()=>{gvSave(true);document.getElementById('gvStatus').textContent='Entwurf automatisch lokal gespeichert.'});
window.addEventListener('beforeunload',()=>gvSave(true));
