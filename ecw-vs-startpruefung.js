(function(){
let issue='';
function display(text){issue=text;if(!document.body)return;let box=document.getElementById('meetingLoadError');if(!box){box=document.createElement('div');box.id='meetingLoadError';box.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483646;padding:16px;background:#802525;color:#fff;font:16px Arial';document.body.appendChild(box)}box.textContent='Modul V2.9.49 konnte nicht vollständig starten: '+text;}
window.addEventListener('error',function(e){const resource=e.target&&e.target.src;if(resource)display('Datei nicht geladen: '+resource.split('/').pop()+'. Bitte den vollständigen Programmordner übernehmen.');else if(e.message)display(e.message);},true);
window.addEventListener('load',()=>{if(issue)display(issue);else if(!window.boardApi||!window.secretaryApi||!window.yearApi)display('Die Berichtsmodule wurden nicht initialisiert. Bitte den vollständigen Programmordner übernehmen.')});
})();
