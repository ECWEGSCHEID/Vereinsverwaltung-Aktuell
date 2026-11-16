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
    const gapMs=1000;
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
  const clock=document.getElementById('ecwRibbonClock');
  const calendar=document.getElementById('ecwRibbonCalendar');
  if(clock&&calendar){
    const monthLabel=document.getElementById('ecwCalendarMonth');
    const days=calendar.querySelector('tbody');
    const monthFormat=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'});
    let month;

    function renderMonth(){
      const today=new Date();
      const year=month.getFullYear();
      const index=month.getMonth();
      const offset=(month.getDay()+6)%7;
      const count=new Date(year,index+1,0).getDate();
      monthLabel.textContent=monthFormat.format(month);
      days.replaceChildren();
      for(let week=0;week<offset+count;week+=7){
        const row=days.insertRow();
        for(let weekday=0;weekday<7;weekday++){
          const cell=row.insertCell();
          const day=week+weekday-offset+1;
          if(day<1||day>count)continue;
          cell.textContent=day;
          if(year===today.getFullYear()&&index===today.getMonth()&&day===today.getDate()){
            cell.setAttribute('aria-current','date');
          }
        }
      }
    }
    function moveMonth(delta){
      month=new Date(month.getFullYear(),month.getMonth()+delta,1);
      renderMonth();
    }
    clock.addEventListener('click',()=>{
      const now=new Date();
      month=new Date(now.getFullYear(),now.getMonth(),1);
      renderMonth();
      calendar.showModal();
    });
    document.getElementById('ecwCalendarPrev').addEventListener('click',()=>moveMonth(-1));
    document.getElementById('ecwCalendarNext').addEventListener('click',()=>moveMonth(1));
    calendar.addEventListener('close',()=>clock.focus());
  }

  const login=document.getElementById('shUserLogin');
  if(login){
    const whiteboard=()=>typeof isWhiteboardUser==='function'&&isWhiteboardUser();
    const openLogin=()=>{if(typeof switchUserLogin==='function')switchUserLogin();};
    let timer;
    let gesture;
    function cancelHold(){
      clearTimeout(timer);
      gesture=undefined;
    }
    function startHold(input){
      gesture=input;
      timer=setTimeout(()=>{
        cancelHold();
        if(whiteboard()&&login.getClientRects().length)openLogin();
      },5000);
    }
    login.addEventListener('click',event=>{
      if(!whiteboard())openLogin();
      else event.preventDefault();
    });
    login.addEventListener('pointerdown',event=>{
      if(whiteboard()&&event.isPrimary&&event.button===0&&!gesture){
        startHold({pointerId:event.pointerId});
      }
    });
    for(const type of ['pointerup','pointercancel','pointerleave','lostpointercapture']){
      login.addEventListener(type,event=>{
        if(gesture?.pointerId===event.pointerId)cancelHold();
      });
    }
    login.addEventListener('pointermove',event=>{
      if(gesture?.pointerId===event.pointerId&&!login.contains(document.elementFromPoint(event.clientX,event.clientY))){
        cancelHold();
      }
    });
    login.addEventListener('contextmenu',event=>{if(whiteboard())event.preventDefault();});
    login.addEventListener('keydown',event=>{
      if(!whiteboard()||(event.code!=='Enter'&&event.code!=='Space'))return;
      event.preventDefault();
      if(!event.repeat&&!gesture)startHold({key:event.code});
    });
    login.addEventListener('keyup',event=>{
      if(gesture?.key===event.code){event.preventDefault();cancelHold();}
    });
    login.addEventListener('blur',cancelHold);
    window.addEventListener('blur',cancelHold);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelHold();});
  }
  tickClock();
  setInterval(tickClock,15000);
})();
