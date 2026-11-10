/* ECW13 – Lauftext aus vorhandenen Vereinsnachrichten; Uhrzeit und Whiteboard-Login */
(function(){
  'use strict';
  const ticker=document.getElementById('ecwHomeTickerText');
  const dateEl=document.getElementById('ecwHomeDate');
  const timeEl=document.getElementById('ecwHomeClock');
  function tickClock(){
    const d=new Date();
    if(dateEl)dateEl.textContent=d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
    if(timeEl)timeEl.textContent=d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  }
  function updateTicker(){
    if(!ticker)return;
    let items=[];
    try{
      if(typeof data!=='undefined'&&Array.isArray(data.news))items=data.news.filter(n=>n&&n.active!==false&&n.mode==='ticker'&&(typeof newsDateActive!=='function'||newsDateActive(n))&&String(n.text||'').trim());
    }catch(e){}
    const msg=items.length?items.map(n=>String((n.showTitle&&n.title?n.title+' – ':'')+n.text).trim()).join('     •     '):'Willkommen beim EC Wegscheid';
    if(ticker.dataset.message!==msg){
      ticker.dataset.message=msg;ticker.textContent=msg;
      ticker.style.animation='none';void ticker.offsetWidth;ticker.style.animation='';
      const sec=Math.max(17,Math.ceil(msg.length/11));
      ticker.style.animationDuration=sec+'s';
    }
  }
  let taps=[];
  window.ecwCornerLogin=function(event){
    const wb=(typeof isPublicWhiteboardMode==='function'&&isPublicWhiteboardMode())||(typeof isWhiteboardUser==='function'&&isWhiteboardUser());
    if(!wb){if(typeof switchUserLogin==='function')switchUserLogin();return;}
    // Whiteboard: erst nach 5 bewussten Berührungen innerhalb von 5 Sekunden öffnen.
    // Dies ist nur ein Schutz vor Fehlbedienung, KEINE zusätzliche Authentifizierung.
    const now=Date.now();taps=taps.filter(t=>now-t<5000);taps.push(now);
    if(taps.length>=5){taps=[];if(typeof switchUserLogin==='function')switchUserLogin();}
    if(event)event.preventDefault();
  };
  tickClock();updateTicker();
  setInterval(tickClock,15000);
  setInterval(updateTicker,8000);
})();
