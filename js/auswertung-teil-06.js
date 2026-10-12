

    function roleName(r){
      return ({admin:'ADMIN',whiteboard:'WHITEBOARD',turnierauswertung:'TURNIERAUSWERTUNG',user:'BENUTZER',guest:'Nicht angemeldet'})[r] || r;
    }
    function showLegacyMigration(){
      if((window.getEffectiveRole?.()||window.currentRole||'guest')!=='admin'){
        alert('Die Datenübernahme ist nur für den zentralen Administrator freigegeben.');
        return;
      }

      const ov=document.getElementById('legacyMigrationOverlay');
      const st=document.getElementById('legacyMigrationStatus');
      const em=document.getElementById('legacyMigrationEmail');
      const wrap=document.getElementById('legacyMigrationProgressWrap');
      const log=document.getElementById('legacyMigrationLog');
      const bar=document.getElementById('legacyMigrationProgressBar');
      const pct=document.getElementById('legacyMigrationPercent');
      const step=document.getElementById('legacyMigrationCurrentStep');

      if(em && !em.value){
        try{
          em.value=window.parent?.firebaseAuthUser?.email||window.currentFirebaseUser?.email||'';
        }catch(e){}
      }

      if(st){
        st.style.color='#fff';
        st.textContent='Bereit. Nach dem Start sollte innerhalb weniger Sekunden die erste Fortschrittsmeldung erscheinen.';
      }
      if(wrap)wrap.style.display='none';
      if(log)log.innerHTML='';
      if(bar)bar.style.width='0%';
      if(pct)pct.textContent='0 %';
      if(step)step.textContent='Vorbereitung …';

      if(ov)ov.style.display='flex';
      setTimeout(bindLegacyMigrationButton,0);
    }
    function closeLegacyMigration(){
      const ov=document.getElementById('legacyMigrationOverlay');if(ov)ov.style.display='none';
    }
    async function runLegacyMigration(){
      const btn=document.getElementById('legacyMigrationRunBtn');
      const cancel=document.getElementById('legacyMigrationCancelBtn');
      const st=document.getElementById('legacyMigrationStatus');
      const wrap=document.getElementById('legacyMigrationProgressWrap');
      const step=document.getElementById('legacyMigrationCurrentStep');
      const bar=document.getElementById('legacyMigrationProgressBar');
      const pct=document.getElementById('legacyMigrationPercent');
      const log=document.getElementById('legacyMigrationLog');
      const email=document.getElementById('legacyMigrationEmail')?.value.trim()||'';
      const password=document.getElementById('legacyMigrationPassword')?.value||'';

      // Sofortige Rückmeldung – kein Browser-confirm innerhalb des eingebetteten Frames.
      if(wrap)wrap.style.display='block';
      if(st){
        st.style.color='#fff';
        st.textContent='Datenübernahme wird gestartet …';
      }
      if(step)step.textContent='Datenübernahme wird gestartet …';
      if(bar)bar.style.width='3%';
      if(pct)pct.textContent='3 %';
      if(btn){btn.disabled=true;btn.textContent='Übernahme läuft …';}
      if(cancel)cancel.disabled=true;

      const steps=[
        'Datenübernahme wird gestartet …',
        'Altes Firebase-Projekt wird vorbereitet …',
        'Alte Zugangsdaten werden geprüft …',
        'Cupdaten werden gelesen …',
        'Jahresmeisterschaft wird gelesen …',
        'StockDart wird gelesen …',
        'Auslosungsdaten werden gelesen …',
        'Sicherungsdatei der bisherigen Daten wird erstellt …',
        'Cupdaten werden in die Vereinsverwaltung übertragen …',
        'Jahresmeisterschaft wird übertragen …',
        'StockDart wird übertragen …',
        'Auslosungsdaten werden übertragen …',
        'Übertragung wird kontrolliert …',
        'Übernahme erfolgreich abgeschlossen.'
      ];

      let lastIndex=0;
      const stamp=()=>{
        const d=new Date();
        return String(d.getHours()).padStart(2,'0')+':'+
               String(d.getMinutes()).padStart(2,'0')+':'+
               String(d.getSeconds()).padStart(2,'0');
      };

      const progress=msg=>{
        if(!msg)return;
        let idx=steps.findIndex(s=>msg.startsWith(s.replace(' …','')));
        if(idx<0)idx=Math.min(lastIndex+1,steps.length-1);
        lastIndex=Math.max(lastIndex,idx);

        const percent=Math.max(3,Math.round(((lastIndex+1)/steps.length)*100));

        if(step)step.textContent=msg;
        if(bar)bar.style.width=percent+'%';
        if(pct)pct.textContent=percent+' %';

        if(log){
          const line=document.createElement('div');
          line.textContent='['+stamp()+'] '+msg;
          log.appendChild(line);
          log.scrollTop=log.scrollHeight;
        }

        if(st){
          st.style.color='#fff';
          st.textContent=msg;
        }
      };

      progress('Datenübernahme wird gestartet …');

      try{
        const r=await window.migrateLegacyTurnierauswertung(email,password,progress);

        if(bar)bar.style.width='100%';
        if(pct)pct.textContent='100 %';
        if(step)step.textContent='Übernahme erfolgreich abgeschlossen.';

        if(st){
          st.style.color='#b9f6ca';
          st.textContent='✓ Übernahme erfolgreich: '+
            r.cupTurniere+' Cup-Turnier(e)'+
            (r.jahresmeisterschaft?' · Jahresmeisterschaft':'')+
            (r.stockdart?' · StockDart':'')+
            (r.auslosung?' · Auslosungsdaten':'')+'.';
        }

        if(log){
          const line=document.createElement('div');
          line.style.color='#b9f6ca';
          line.textContent='['+stamp()+'] ✓ Übernahme vollständig abgeschlossen.';
          log.appendChild(line);
          log.scrollTop=log.scrollHeight;
        }

        const pw=document.getElementById('legacyMigrationPassword');
        if(pw)pw.value='';

        try{window.initFirebaseSync?.();}catch(e){}
      }catch(e){
        console.error('Migration:',e);

        if(step)step.textContent='Übernahme fehlgeschlagen.';
        if(st){
          st.style.color='#fecaca';
          st.textContent='✗ Übernahme fehlgeschlagen: '+(e?.message||e);
        }
        if(log){
          const line=document.createElement('div');
          line.style.color='#fecaca';
          line.textContent='['+stamp()+'] ✗ '+(e?.message||e);
          log.appendChild(line);
          log.scrollTop=log.scrollHeight;
        }
      }finally{
        if(btn){btn.disabled=false;btn.textContent='Daten jetzt übernehmen';}
        if(cancel)cancel.disabled=false;
      }
    }
    window.showLegacyMigration=showLegacyMigration;
    window.closeLegacyMigration=closeLegacyMigration;
    window.runLegacyMigration=runLegacyMigration;

    function bindLegacyMigrationButton(){
      const b=document.getElementById('legacyMigrationRunBtn');
      if(!b || b.dataset.bound==='1')return;
      b.dataset.bound='1';
      b.addEventListener('click',()=>{
        const st=document.getElementById('legacyMigrationStatus');
        if(st){
          st.style.color='#fff';
          st.textContent='Button erkannt – Datenübernahme wird gestartet …';
        }
        window.runLegacyMigration().catch(e=>{
          console.error('Migration Button:',e);
          if(st){
            st.style.color='#fecaca';
            st.textContent='✗ Startfehler: '+(e?.message||e);
          }
        });
      });
    }
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',bindLegacyMigrationButton,{once:true});
    }else{
      bindLegacyMigrationButton();
    }
    function showLogin(){
      if(window.ECW_EMBEDDED_ADMIN){
        const ov=document.getElementById('loginOverlay');if(ov)ov.style.display='none';
        return;
      }
      document.getElementById('loginOverlay').style.display='flex';
      document.getElementById('loginError').textContent='';
      setTimeout(()=>document.getElementById('loginEmail')?.focus(),50);
    }
    function showSwitchUser(){
      window.ECW_ADMIN_OVERRIDE=true;
      resetJahresmeisterschaftForRole();
      const ov=document.getElementById('loginOverlay');
      const cancel=document.getElementById('loginCancelBtn');
      const err=document.getElementById('loginError');
      if(err) err.textContent='';
      document.getElementById('loginEmail').value='';
      document.getElementById('loginPassword').value='';
      if(cancel) cancel.style.display='';
      if(ov) ov.style.display='flex';
      setTimeout(()=>document.getElementById('loginEmail')?.focus(),50);
    }
    function cancelSwitchUser(){
      window.ECW_ADMIN_OVERRIDE=false;
      resetJahresmeisterschaftForRole();
      const cancel=document.getElementById('loginCancelBtn');
      if(cancel) cancel.style.display='none';
      const ov=document.getElementById('loginOverlay');
      if(window.currentFirebaseUser && ov) ov.style.display='none';
      try{window.applyFirebaseRole?.();}catch(e){}
      try{window.openWhiteboardTarget?.();}catch(e){}
    }

    async function doLogin(){
      const emailEl=document.getElementById('loginEmail');
      const passEl=document.getElementById('loginPassword');
      const err=document.getElementById('loginError');
      const e=emailEl.value.trim();
      const p=passEl.value;
      if(!e||!p){err.textContent='Bitte E-Mail-Adresse und Passwort eingeben.';return;}
      err.textContent='Anmeldung wird geprüft …';
      try{
        const cred=await window.firebaseLogin(e,p);
        const user=cred?.user||window.firebaseAuth?.currentUser||null;
        if(user && window.db && window.fbGet && window.fbRef){
          const snap=await window.fbGet(window.fbRef(window.db,'users/'+user.uid));
          const prof=snap.val();
          window.currentFirebaseUser=user;
          if(prof && prof.active===true){
            window.currentUserProfile=prof;
            window.currentRole=String(prof.role||'user').trim().toLowerCase();
          }else{
            window.currentUserProfile=null;
            window.currentRole='guest';
          }
        }
        const r=window.getEffectiveRole?window.getEffectiveRole():(window.currentRole||'guest');
        if(r==='admin'||r==='turnierauswertung'){
          err.textContent='';
          passEl.value='';
          const ov=document.getElementById('loginOverlay');if(ov)ov.style.display='none';
          const cancel=document.getElementById('loginCancelBtn');if(cancel)cancel.style.display='none';

          // Ein zuvor als Whiteboard geladenes JM-iframe enthält inline ausgeblendete
          // Adminfunktionen. Deshalb bei Rollenwechsel vollständig neu aufbauen.
          resetJahresmeisterschaftForRole();

          window.applyFirebaseRole?.();
          const target=(new URLSearchParams(location.search).get('seite')||'').toLowerCase();
          if(target==='jahresmeisterschaft'||target==='zielschiessen'||target==='zielschießen'){
            openJahresmeisterschaft();
          }else{
            showHome();
          }
          return;
        }
        if(r==='guest'){
          err.textContent='Benutzer ist nicht für die Turnierauswertung freigegeben.';
        }else{
          err.textContent='Dieses Benutzerkonto besitzt keine Admin-Berechtigung.';
        }
      }catch(x){
        err.textContent='Anmeldung fehlgeschlagen. E-Mail/Passwort prüfen.';
        console.error(x);
      }
    }
    document.getElementById('loginPassword')?.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();doLogin();}
    });
    document.getElementById('loginEmail')?.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();document.getElementById('loginPassword')?.focus();}
    });

    async function backupAndUploadStockdart(){
      if((window.currentRole||'guest')!=='admin'){alert('Nur ADMIN darf StockDart sichern.');return;}
      const f=document.getElementById('stockdartFrame');
      if(!f || !f.dataset.loaded){alert('StockDart zuerst öffnen, damit die vorhandenen Daten geladen werden können.');return;}
      const data=f.contentWindow?.ECW_SD_EXPORT_STATE?.();
      if(!data){alert('StockDart-Daten konnten nicht gelesen werden.');return;}
      const d=new Date(),datum=String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+d.getFullYear();
      const blob=new Blob([JSON.stringify({stockdart:data},null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='StockDart_Sicherung_'+datum+'.json';
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      try{await window.firebaseSaveStockdart(data);alert('StockDart wurde gesichert und nach Firebase übertragen.')}
      catch(e){console.error(e);alert('StockDart Firebase-Sicherung fehlgeschlagen: '+(e.message||e));}
    }

    async function backupCupFirebase(){
      const r=window.currentRole||'guest';
      if(r!=='admin' && r!=='turnierauswertung'){alert('Keine Berechtigung.');return;}
      try{
        const snap=await window.fbGet(window.fbRef(window.db,'cup/public/tournaments'));
        const data=snap.val(); if(!data){alert('Keine Cupdaten in Firebase gefunden.');return;}
        const d=new Date(), datum=String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+d.getFullYear();
        const blob=new Blob([JSON.stringify({tournaments:data},null,2)],{type:'application/json'});
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
        a.download='Cupauswertung_Sicherung_'+datum+'.json'; document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      }catch(e){console.error(e);alert('Cup-Sicherung fehlgeschlagen: '+(e.message||e));}
    }

    async function doMigrateOldCup(){
      if((window.currentRole||'guest')!=='admin'){alert('Nur ADMIN darf die alten Cupdaten übernehmen.');return;}
      if(!confirm('Alte Cupdaten aus dem bisherigen Firebase-Projekt sichern und in das neue Projekt Turnierauswertung übernehmen?'))return;
      const b=document.getElementById('migrateCupBtn');
      const old=b.textContent;b.disabled=true;b.textContent='Übernahme läuft…';
      try{
        const n=await window.migrateOldCupData();
        alert('Cupdaten erfolgreich übernommen. Sicherungsdatei wurde zusätzlich heruntergeladen. Gefundene Turniere: '+n);
      }catch(e){
        console.error(e);
        alert('Übernahme der alten Cupdaten nicht möglich: '+(e.message||e));
      }finally{b.disabled=false;b.textContent=old}
    }
    function openCentralBackup(){
      const r=window.currentRole||'guest';
      if(r!=='admin' && r!=='turnierauswertung'){alert('Keine Berechtigung für die Datensicherung.');return;}
      const ov=document.getElementById('centralBackupOverlay');
      const sd=document.getElementById('centralStockdartBackupBtn');
      const info=document.getElementById('centralBackupInfo');
      if(sd) sd.style.display=(r==='admin')?'':'none';
      if(info) info.textContent=(r==='admin')
        ? 'ADMIN: Cupauswertung, Jahresmeisterschaft und StockDart.'
        : 'TURNIERAUSWERTUNG: Cupauswertung und Jahresmeisterschaft. StockDart ist für dieses Benutzerkonto nicht freigegeben.';
      if(ov) ov.style.display='block';
    }
    function closeCentralBackup(){
      const ov=document.getElementById('centralBackupOverlay');
      if(ov) ov.style.display='none';
    }
    async function centralBackupJM(){
      const f=document.getElementById('jahresmeisterschaftFrame');
      if(!f || !f.dataset.loaded){
        alert('Bitte Zielschießen Jahresmeisterschaft zuerst einmal öffnen. Danach kann der aktuelle Datenstand zentral gesichert werden.');
        return;
      }
      await backupAndUploadJahresmeisterschaft();
    }
    async function centralBackupStockdart(){
      if((window.currentRole||'guest')!=='admin'){alert('StockDart ist nur für ADMIN freigegeben.');return;}
      const f=document.getElementById('stockdartFrame');
      if(!f || !f.dataset.loaded){
        alert('Bitte StockDart zuerst einmal öffnen. Danach kann der aktuelle Datenstand zentral gesichert werden.');
        return;
      }
      await backupAndUploadStockdart();
    }


    window.openCentralBackup = openCentralBackup;
    window.closeCentralBackup = closeCentralBackup;
    window.centralBackupJM = centralBackupJM;
    window.centralBackupStockdart = centralBackupStockdart;
    window.backupCupFirebase = backupCupFirebase;
    window.backupAndUploadJahresmeisterschaft = backupAndUploadJahresmeisterschaft;
    window.backupAndUploadStockdart = backupAndUploadStockdart;

    function getWhiteboardTarget(){
      const params=new URLSearchParams(location.search);
      const q=(params.get('seite')||'').trim().toLowerCase();
      const h=(location.hash||'').replace(/^#/,'').trim().toLowerCase();
      return q || h;
    }

    function openWhiteboardTarget(){
      const target=getWhiteboardTarget();
      const r=window.getEffectiveRole ? window.getEffectiveRole() : String(window.currentRole||'guest').trim().toLowerCase();
      if(!target) return false;
      if(!window.isForcedWhiteboardView?.() && (!window.currentFirebaseUser || r==='guest')) return false;

      if(target==='cup' || target==='cupauswertung'){
        openCup();
        return true;
      }

      if(target==='jahresmeisterschaft' || target==='zielschiessen' || target==='zielschießen'){
        openJahresmeisterschaft();
        return true;
      }

      if(target==='auslosung' || target==='turnierauslosung'){
        openAuslosung();
        return true;
      }

      if(target==='stockdart' || target==='stockdartauswertung'){
        // StockDart bleibt laut Rechteverteilung nur für ADMIN freigegeben.
        openStockdart();
        return true;
      }

      return false;
    }

    window.openWhiteboardTarget=openWhiteboardTarget;
    window.addEventListener('hashchange',()=>{
      window._ecwOpenedTarget='';
      const er=window.getEffectiveRole?window.getEffectiveRole():(window.currentRole||'guest');
      if(window.isForcedWhiteboardView?.() || (window.currentFirebaseUser && er!=='guest')) openWhiteboardTarget();
    });
    async function doLogout(){
      try{
        window.ECW_ADMIN_OVERRIDE=false;
        resetJahresmeisterschaftForRole();
        await window.firebaseLogout();
        showHome();
        setTimeout(()=>window.openWhiteboardTarget?.(),50);
      }catch(e){console.error(e);}
    }
    function requireRole(allowed, label){
      const r=window.getEffectiveRole ? window.getEffectiveRole() : (window.currentRole||'guest');
      if(!window.isForcedWhiteboardView?.() && !window.currentFirebaseUser){ showLogin(); return false; }
      if(!allowed.includes(r)){ alert(label+' ist für dieses Benutzerkonto nicht freigegeben.'); return false; }
      return true;
    }
    function applyIframeRole(frame, kind){
      if(!frame || !frame.contentDocument) return;
      const r=window.getEffectiveRole ? window.getEffectiveRole() : (window.currentRole||'guest');
      try{
        const d=frame.contentDocument;
        try {
          frame.contentWindow.ECW_PARENT_ROLE = r;
        } catch(e) {}
        if(kind==='jahresmeisterschaft' && r==='whiteboard'){
          // WHITEBOARD: reiner Anzeigemodus.
          // Erlaubt: Rangliste, Bestleistungen, Regeln.
          // Gesperrt: Punktekarten, Startgeld sowie sämtliche Admin-/Bearbeitungsfunktionen.
          ['admBtn','aSave','aReset','aPw','aTitle','aAdd','aOut',
           'kPrint','rEditBtn','rSave','rCancel','rDef',
           'prBtn','sgFeeBtn','sgPlBtn'].forEach(id=>{
            const el=d.getElementById(id);
            if(el) el.style.display='none';
          });

          const allowedTabs=['rang','best','regeln'];
          d.querySelectorAll('nav[role="tablist"] button[data-t]').forEach(b=>{
            const key=b.getAttribute('data-t');
            const allowed=allowedTabs.includes(key);
            b.style.display=allowed?'':'none';
            b.disabled=!allowed;
            if(!allowed)b.setAttribute('aria-disabled','true');
            else b.removeAttribute('aria-disabled');
          });

          // Gesperrte Bereiche im Whiteboard vollständig ausblenden.
          ['karten','start'].forEach(id=>{
            const sec=d.getElementById(id);
            if(sec){sec.hidden=true;sec.style.display='none';}
          });

          // Beim Öffnen im Whiteboardmodus immer auf Rangliste starten.
          const tabs=[...d.querySelectorAll('nav[role="tablist"] button[data-t]')];
          tabs.forEach(b=>b.setAttribute('aria-selected', b.getAttribute('data-t')==='rang' ? 'true':'false'));
          d.querySelectorAll('section[id]').forEach(sec=>{
            const id=sec.id;
            if(['rang','best','karten','regeln','start'].includes(id)){
              sec.hidden = id!=='rang';
            }
          });

          // Falls der Benutzer auf einer erlaubten Seite navigiert, gesperrte Seiten bleiben unerreichbar.
          tabs.forEach(b=>{
            if(!allowedTabs.includes(b.getAttribute('data-t'))) return;
            b.addEventListener('click',()=>{
              const key=b.getAttribute('data-t');
              tabs.forEach(x=>x.setAttribute('aria-selected', x===b?'true':'false'));
              ['rang','best','karten','regeln','start'].forEach(id=>{
                const sec=d.getElementById(id);
                if(sec) sec.hidden = id!==key;
              });
            });
          });
          d.querySelectorAll('button').forEach(b=>{
            const t=(b.textContent||'').toLowerCase();
            if(t.includes('admin') || t.includes('bearbeiten') || t.includes('löschen') || t.includes('speichern') || t.includes('eingeben')){
              b.style.display='none';
            }
          });
          d.querySelectorAll('.adm,.adm-only,.pen').forEach(el=>el.style.display='none');
        }
      }catch(e){ console.warn('Iframe-Rolle:',e); }
    }
    window.applyFirebaseRole=function(){
      const r=window.getEffectiveRole ? window.getEffectiveRole() : String(window.currentRole||'guest').trim().toLowerCase(), u=window.currentFirebaseUser;
      const wb=!!window.isForcedWhiteboardView?.();
      const embedded=!!window.ECW_EMBEDDED_ADMIN;
      const access=!!u||wb||embedded;
      const status=document.getElementById('authStatus');
      const login=document.getElementById('loginBtn'), logout=document.getElementById('logoutBtn');
      const switchUser=document.getElementById('switchUserBtn');
      if(status) status.textContent=embedded?'Zentrale Admin-Anmeldung':(wb?'Whiteboardmodus':(u?((window.currentUserProfile?.name||u.email)+' · '+roleName(r)):'Nicht angemeldet'));
      if(login) login.style.display=(window.ECW_EMBEDDED_ADMIN||window.isForcedWhiteboardView?.()||u)?'none':'';
      if(logout) logout.style.display=(!window.ECW_EMBEDDED_ADMIN && !window.isForcedWhiteboardView?.() && u && r!=='whiteboard')?'':'none';
      if(switchUser) switchUser.style.display=(!window.ECW_EMBEDDED_ADMIN && u && r==='whiteboard')?'':'none';
      const cb=document.getElementById('centralBackupBtn');
      if(cb) cb.style.display=(u && (r==='admin'||r==='turnierauswertung'))?'':'none';
const map={
        homeCupBtn:['admin','whiteboard','turnierauswertung'],
        homeStockdartBtn:['admin'],
        homeJmBtn:['admin','whiteboard','turnierauswertung']
      };
      Object.entries(map).forEach(([id,roles])=>{
        const el=document.getElementById(id); if(!el)return;
        el.classList.toggle('role-denied', !access || !roles.includes(r));
      });
      // Turnierauslosung bleibt technisch immer klickbar.
      // Die eigentliche Berechtigungsprüfung erfolgt erst in openAuslosung().
      const drawBtn=document.getElementById('homeDrawBtn');
      if(drawBtn){
        drawBtn.title='Turnierauslosung · Rolle: '+r;
        drawBtn.classList.remove('role-denied');
        drawBtn.disabled=false;
        drawBtn.removeAttribute('disabled');
        drawBtn.removeAttribute('aria-disabled');
        drawBtn.style.pointerEvents='auto';
        drawBtn.style.opacity='1';
        drawBtn.style.filter='none';
      }
      const ab=document.getElementById('adminCornerBtn');
      if(ab) ab.style.display=(r==='admin'||r==='turnierauswertung')?'':'none';

      if(embedded||wb){
        const ov=document.getElementById('loginOverlay');
        if(ov)ov.style.display='none';
      }else if(!u){
        showLogin();
      }else if(r==='guest'){
        const ov=document.getElementById('loginOverlay');
        if(ov)ov.style.display='flex';
      }else{
        const ov=document.getElementById('loginOverlay');
        if(ov)ov.style.display='none';
        const cancel=document.getElementById('loginCancelBtn');
        if(cancel)cancel.style.display='none';
      }

      applyIframeRole(document.getElementById('jahresmeisterschaftFrame'),'jahresmeisterschaft');

      if(access && r==='admin' && (new URLSearchParams(location.search)).get('migration')==='1' && !window.__legacyMigrationShown){
        window.__legacyMigrationShown=true;
        setTimeout(()=>showLegacyMigration(),120);
      }

      // Deep-Link erst NACH erfolgreicher Firebase- und Rollenprüfung öffnen.
      if(access && r!=='guest'){
        const target=getWhiteboardTarget();
        if(target && window._ecwOpenedTarget!==target){
          window._ecwOpenedTarget=target;
          setTimeout(()=>openWhiteboardTarget(),120);
        }
      }
    };

    /* ===== Navigation 1. Ebene: Turnierauswertung ===== */
    function updateHeader(id) {
      const t = document.getElementById('headerTitle'), a = document.getElementById('adminCornerBtn');
      let title = 'EC Wegscheid Cupauswertung', admin = true;
      if (id === 'view-home') { title = 'EC Wegscheid Turnierauswertung'; admin = false; }
      else if (id === 'view-stockdart') { title = 'Stockdartauswertung'; admin = false; }
      else if (id === 'view-auslosung') { title = 'Turnierauslosung'; admin = false; }
      else if (id === 'view-jahresmeisterschaft') { title = 'Zielschießen Jahresmeisterschaft'; admin = false; }
      else if (id === 'view-soon') { title = (document.getElementById('soonTitle') || {}).textContent || 'Turnierauswertung'; admin = false; }
      if (t) t.textContent = title;
      if (a) { const r=window.getEffectiveRole?window.getEffectiveRole():(window.currentRole||'guest'); a.style.display = (admin && (r==='admin'||r==='turnierauswertung')) ? '' : 'none'; }
    }
    function showHome() { const af = document.getElementById('auslosungFrame'); if (af) af.classList.remove('full'); showView('view-home'); }
    function openCup() { if(!requireRole(['admin','whiteboard','turnierauswertung'],'Cupauswertung')) return; goToMainMenu(); }
    function openStockdart() {
      if(!requireRole(['admin'],'Stockdartauswertung')) return;
      const f = document.getElementById('stockdartFrame');
      if (f && !f.dataset.loaded) { f.srcdoc = STOCKDART_HTML; f.dataset.loaded = '1'; }
      showView('view-stockdart');
    }
    function resetJahresmeisterschaftForRole(){
      const f=document.getElementById('jahresmeisterschaftFrame');
      if(!f)return;
      try{
        f.removeAttribute('src');
        f.srcdoc='';
        delete f.dataset.loaded;
      }catch(e){}
    }

    function openJahresmeisterschaft() {
      if(!requireRole(['admin','whiteboard','turnierauswertung'],'Jahresmeisterschaft')) return;
      const f = document.getElementById('jahresmeisterschaftFrame');
      if (!f) {
        alert('Jahresmeisterschaft konnte nicht geöffnet werden.');
        return;
      }
      if (!f.dataset.loaded) {
        f.srcdoc = JAHRESMEISTERSCHAFT_HTML;
        f.dataset.loaded = '1';
        f.addEventListener('load',async()=>{
          applyIframeRole(f,'jahresmeisterschaft');
          await loadJahresmeisterschaftFromFirebase(false);
          applyIframeRole(f,'jahresmeisterschaft');
          const er=window.getEffectiveRole?window.getEffectiveRole():(window.currentRole||'guest');
          if(er==='admin'||er==='turnierauswertung'){
            try{f.contentWindow.enterFirebaseAdmin?.();}catch(e){console.warn('JM Adminmodus:',e);}
          }
        },{once:true});
      }
      showView('view-jahresmeisterschaft');
    }
    function openAuslosung() {
      const r=window.getEffectiveRole?window.getEffectiveRole():String(window.currentRole||'guest').trim().toLowerCase();
      if(!window.isForcedWhiteboardView?.() && !window.currentFirebaseUser){ showLogin(); return; }
      if(!['admin','whiteboard'].includes(r)){
        alert('Turnierauslosung ist für dieses Benutzerkonto nicht freigegeben. Aktuelle Rolle: '+r);
        return;
      }
      const btn=document.getElementById('homeDrawBtn');
      if(btn){
        btn.classList.remove('role-denied');
        btn.disabled=false;
        btn.style.pointerEvents='auto';
      }
      const f = document.getElementById('auslosungFrame');
      if (f && !f.dataset.loaded) {
        f.srcdoc = AUSLOSUNG_HTML;
        f.dataset.loaded = '1';
      }
      if (f) f.classList.remove('full');
      document.body.style.overflow = '';
      showView('view-auslosung');
    }
    window.openAuslosung = openAuslosung;
    // Die Live-Auslosung meldet, wenn ihr Auslosungsfenster geöffnet/geschlossen wird

    window.addEventListener('message', async e => {
      const f=document.getElementById('jahresmeisterschaftFrame');
      if(!f || e.source!==f.contentWindow || !e.data || e.data.type!=='ecw-jm-save') return;
      try { await window.firebaseSaveJahresmeisterschaft(e.data.data); }
      catch(err){ console.error("Jahresmeisterschaft Firebase speichern:",err); }
    });

    async function loadJahresmeisterschaftFromFirebase(force=false){
      const f=document.getElementById('jahresmeisterschaftFrame');
      if(!f || !f.contentWindow) return;
      try{
        const pack=await window.firebaseLoadJahresmeisterschaft();
        if(pack && pack.state){
          f.contentWindow.ECW_JM_IMPORT_STATE?.(pack.state);
        } else if(force) {
          alert("In Firebase sind noch keine Jahresmeisterschaftsdaten gespeichert.");
        }
      }catch(e){ console.error(e); if(force) alert("Jahresmeisterschaft konnte nicht aus Firebase geladen werden."); }
    }

    async function backupAndUploadJahresmeisterschaft(){
      const r=window.currentRole||'guest';
      if(r!=='admin' && r!=='turnierauswertung'){alert('Keine Berechtigung.');return;}
      const f=document.getElementById('jahresmeisterschaftFrame');
      const state=f?.contentWindow?.ECW_JM_EXPORT_STATE?.();
      if(!state){alert('Jahresmeisterschaft zuerst öffnen, damit die vorhandenen Daten gelesen werden können.');return;}
      const blob=new Blob([JSON.stringify({jahresmeisterschaft:state},null,2)],{type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
      const now=new Date();
      const datum=String(now.getDate()).padStart(2,'0')+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+now.getFullYear();
      a.download='Jahresmeisterschaft_Sicherung_'+datum+'.json';
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      try{
        await window.firebaseSaveJahresmeisterschaft(state);
        alert('Jahresmeisterschaft wurde gesichert und nach Firebase übernommen.');
      }catch(e){console.error(e);alert('Firebase-Übernahme fehlgeschlagen: '+(e.message||e));}
    }

    window.addEventListener('message', e => {
      const f = document.getElementById('auslosungFrame');
      if (!f || e.source !== f.contentWindow || !e.data || e.data.type !== 'auslosung-overlay') return;
      f.classList.toggle('full', !!e.data.open);
      document.body.style.overflow = e.data.open ? 'hidden' : '';
    });
    function openSoon(name) {
      document.getElementById('soonTitle').textContent = name;
      showView('view-soon');
    }
  