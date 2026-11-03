
  // Die Übersicht wird beim Start ausdrücklich mit den importierten Mitgliedsdaten befüllt.
  try { dashboard(); } catch (e) { console.error("Übersicht konnte nicht initialisiert werden:", e); }
window.addEventListener("load",()=>{ try{ if(window.parent?.firebaseAuthUser) login(); }catch(e){} rights();dashboard(); });
document.addEventListener("click",e=>{
 let b=e.target.closest("button[data-pass-edit]");
 if(b){e.preventDefault();e.stopPropagation();editPass(Number(b.dataset.passEdit));}
});

