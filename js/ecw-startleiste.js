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
  if(ticker){
    const home=document.getElementById('startseite');
    const gapMs=4000;
    const fallback='Willkommen beim EC Wegscheid';
    let nextTimer;
    let lastNews;
    let homeVisible=false;

    function playNext(){
      const news=typeof data!=='undefined'&&Array.isArray(data.news)?data.news:[];
      const items=news.filter(item=>item&&item.active!==false&&newsDateActive(item)&&String(item.text||'').trim());
      if(!items.length){
        lastNews=undefined;
        ticker.textContent=fallback;
        nextTimer=setTimeout(playNext,2000);
        return;
      }

      const previous=items.findIndex(item=>item===lastNews||(lastNews?.id!=null&&item.id===lastNews.id));
      const item=items[(previous+1)%items.length];
      lastNews=item;
      const heading=item.showTitle&&item.title?item.title+' – ':'';
      ticker.textContent=(heading+item.text).replace(/\s+/g,' ').trim();
      const distance=ticker.parentElement.clientWidth+ticker.offsetWidth;
      ticker.style.setProperty('--ecw-ticker-duration',Math.max(10,distance/85)+'s');
      ticker.classList.add('is-running');
    }

    ticker.addEventListener('animationend',event=>{
      if(event.animationName!=='ecw-home-ticker'||!homeVisible)return;
      ticker.classList.remove('is-running');
      ticker.textContent='';
      nextTimer=setTimeout(playNext,gapMs);
    });

    function syncTickerVisibility(){
      const visible=home.classList.contains('active');
      if(visible===homeVisible)return;
      homeVisible=visible;
      if(visible){
        playNext();
      }else{
        clearTimeout(nextTimer);
        ticker.classList.remove('is-running');
        lastNews=undefined;
      }
    }
    new MutationObserver(syncTickerVisibility).observe(home,{attributes:true,attributeFilter:['class']});
    syncTickerVisibility();
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
  tickClock();
  setInterval(tickClock,15000);
})();
