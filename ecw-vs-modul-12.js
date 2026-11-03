
function printBoardProtocol(date){
 const article=document.getElementById('protocolPrint');
 let style=document.getElementById('boardPageFooterStyle');
 if(!style){style=document.createElement('style');style.id='boardPageFooterStyle';document.head.appendChild(style)}
 const displayDate=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date.split('-').reverse().join('.'):'';
 // Page-margin boxes belong to each physical page rather than the flowing article.
 style.textContent='@media print{#protocolPrint[data-board-print="true"]{page:boardProtocol}#protocolPrint[data-board-print="true"] .p-footer{display:none!important}}'+
 '@page boardProtocol{size:A4;margin:12mm 10mm 22mm;@bottom-left{content:"Erstellt: Schriftführer";font:12pt "Times New Roman",Times,serif;color:#000;vertical-align:middle}@bottom-right{content:'+JSON.stringify(displayDate)+';font:12pt "Times New Roman",Times,serif;color:#000;vertical-align:middle}}';
 article.setAttribute('data-board-print','true');
 window.print();
}
window.addEventListener('afterprint',()=>document.getElementById('protocolPrint').removeAttribute('data-board-print'));
