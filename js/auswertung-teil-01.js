
    import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getFirestore, doc, getDoc, setDoc, onSnapshot, getDocs, collection, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
    import {
      getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
      setPersistence, browserLocalPersistence
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
    import {
      getDatabase as getLegacyDatabase,
      ref as legacyRef,
      get as legacyGet
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

    const firebaseConfig = {
      apiKey: "AIzaSyDmK54G30_JK8ma8tJ7YWyza-OrdrUC24I",
      authDomain: "ec-wegscheid-verwaltung-neu.firebaseapp.com",
      projectId: "ec-wegscheid-verwaltung-neu",
      storageBucket: "ec-wegscheid-verwaltung-neu.firebasestorage.app",
      messagingSenderId: "558472054725",
      appId: "1:558472054725:web:10145e2d8d6f168b056dac"
    };

    const urlParams = new URLSearchParams(location.search);
    const ECW_EMBEDDED_ADMIN = urlParams.get('mode') === 'admin-embedded';
    const ECW_WHITEBOARD_REQUESTED =
      urlParams.get('whiteboard') === '1' || urlParams.get('mode') === 'whiteboard';
    // URL-Parameter alleine vergeben keine Rechte. Der zentrale Eltern-Frame
    // muss dieselbe Origin, eine echte Firebase-Sitzung und die zuvor
    // in Firestore gepruefte Whiteboard-Berechtigung besitzen.
    function verifiedCentralWhiteboard(){
      if(!ECW_WHITEBOARD_REQUESTED || window.parent===window)return false;
      try{
        const p=window.parent;
        return p.location.origin===location.origin && !!p.firebaseAuthUser &&
          p.__ecwVerifiedResultUid===p.firebaseAuthUser.uid &&
          p.__ecwVerifiedWhiteboardUid===p.firebaseAuthUser.uid;
      }catch(e){return false;}
    }
    const ECW_FORCED_WHITEBOARD=verifiedCentralWhiteboard();

    function getCentralParent(){
      if(window.parent===window)return null;
      try{
        const p=window.parent;
        if(p.location.origin!==location.origin || !p.firebaseAuthUser || !p.firestoreDb)return null;
        // Admin und Whiteboard getrennt pruefen. Ein URL-Parameter alleine
        // reicht nicht aus, um eine der beiden Rollen zu erhalten.
        if(ECW_EMBEDDED_ADMIN && p.appPermissions?.admin===true)return p;
        if(ECW_FORCED_WHITEBOARD &&
           p.__ecwVerifiedResultUid===p.firebaseAuthUser.uid &&
           p.__ecwVerifiedWhiteboardUid===p.firebaseAuthUser.uid)return p;
      }catch(e){}
      return null;
    }

    const CENTRAL_PARENT = getCentralParent();
    const CENTRAL_ADMIN_PARENT=!!(CENTRAL_PARENT && ECW_EMBEDDED_ADMIN);
    const CENTRAL_WHITEBOARD_PARENT=!!(CENTRAL_PARENT && ECW_FORCED_WHITEBOARD && !CENTRAL_ADMIN_PARENT);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    window.db = db;
    window.firebaseAuth = auth;
    window.ECW_EMBEDDED_ADMIN = ECW_EMBEDDED_ADMIN;
    window.ECW_ADMIN_OVERRIDE = false;

    if (ECW_EMBEDDED_ADMIN) document.documentElement.classList.add('embedded-admin');

    window.ecwReadAuthenticatedRole=async function(user){
      if(!user)return 'guest';
      try{
        const s=await getDoc(doc(db,'users',user.uid));
        const p=s.exists()?(s.data()||{}):null;
        window.currentFirebaseUser=user;
        window.currentUserProfile=p;
        window.currentRole=roleFromCentralProfile(p);
        return window.currentRole;
      }catch(e){console.error('Benutzerprofil laden:',e);return 'guest';}
    };
    function roleFromCentralProfile(p){
      if(!p || typeof p!=='object') return 'guest';
      if(p.admin === true) return 'admin';
      // Das Whiteboard ist ein eigenes, eingeschraenktes Firebase-Profil.
      // Die Hauptverwaltung erkennt es anhand von `whiteboard` (und bei
      // historischen Profilen anhand von shView + tp ohne Admin-Rechte).
      // Dieselbe Erkennung muss in der separaten Turnierauswertung gelten.
      if(p.whiteboard === true || String(p.role||'').trim().toLowerCase()==='whiteboard')
        return 'whiteboard';
      if(!Object.prototype.hasOwnProperty.call(p,'whiteboard')
         && p.shView===true && p.tp===true
         && !['tv','jm','t','o','n','p','sp','mv','m','lk','sh'].some(k=>p[k]===true))
        return 'whiteboard';
      return 'user';
    }

    window.getEffectiveRole = function(){
      if (CENTRAL_ADMIN_PARENT) return 'admin';
      if (CENTRAL_WHITEBOARD_PARENT && !window.ECW_ADMIN_OVERRIDE) return 'whiteboard';
      return String(window.currentRole || 'guest').trim().toLowerCase();
    };

    window.isForcedWhiteboardView = function(){
      return CENTRAL_WHITEBOARD_PARENT && !window.ECW_ADMIN_OVERRIDE;
    };

    function centralUid(){
      try{
        return CENTRAL_PARENT?.firebaseAuthUser?.uid || auth.currentUser?.uid || null;
      }catch(e){ return auth.currentUser?.uid || null; }
    }

    const ECW_NESTED_ARRAY_MARKER='__ecwNestedArrayV1';

    function firestoreEncode(value,insideArray=false){
      if(Array.isArray(value)){
        const encoded=value.map(v=>firestoreEncode(v,true));
        // Firestore erlaubt Arrays, aber keine Arrays direkt innerhalb eines Arrays.
        // Solche Unter-Arrays werden deshalb reversibel in ein Marker-Objekt verpackt.
        return insideArray ? {[ECW_NESTED_ARRAY_MARKER]:encoded} : encoded;
      }
      if(value && typeof value==='object'){
        const out={};
        for(const [k,v] of Object.entries(value)){
          if(v!==undefined)out[k]=firestoreEncode(v,false);
        }
        return out;
      }
      return value;
    }

    function firestoreDecode(value){
      if(Array.isArray(value))return value.map(firestoreDecode);
      if(value && typeof value==='object'){
        if(
          Object.prototype.hasOwnProperty.call(value,ECW_NESTED_ARRAY_MARKER) &&
          Object.keys(value).length===1 &&
          Array.isArray(value[ECW_NESTED_ARRAY_MARKER])
        ){
          return value[ECW_NESTED_ARRAY_MARKER].map(firestoreDecode);
        }
        const out={};
        for(const [k,v] of Object.entries(value))out[k]=firestoreDecode(v);
        return out;
      }
      return value;
    }

    function parentRealmJson(value){
      // Firestore COMPAT im Elternfenster akzeptiert keine Objekte, die im
      // iframe erzeugt wurden. JSON.parse im Elternfenster erzeugt Plain Objects
      // im richtigen Browser-Realm.
      if(!CENTRAL_PARENT)return value;
      const raw=JSON.stringify(value===undefined?null:value);
      return CENTRAL_PARENT.JSON.parse(raw);
    }

    async function readTaDocument(id){
      if(CENTRAL_PARENT){
        const s=await CENTRAL_PARENT.firestoreDb.collection('turnierauswertung').doc(id).get();
        return s.exists ? firestoreDecode(s.data()||{}) : null;
      }
      const s=await getDoc(doc(db,'turnierauswertung',id));
      return s.exists() ? firestoreDecode(s.data()||{}) : null;
    }

    async function writeTaDocument(id,data,merge=true){
      const encoded=firestoreEncode(data||{});
      // Fuer Feldersetzung mergeFields statt merge:true verwenden: 
      // verschachtelte Map-Schluessel geloeschter Cups duerfen nicht erhalten bleiben.
      const writeOptions = (merge && typeof merge==='object') ? merge : {merge:!!merge};
      if(CENTRAL_PARENT){
        const cleanData=parentRealmJson(encoded);
        const cleanOptions=parentRealmJson(writeOptions);
        return CENTRAL_PARENT.firestoreDb
          .collection('turnierauswertung')
          .doc(id)
          .set(cleanData,cleanOptions);
      }
      return setDoc(doc(db,'turnierauswertung',id), encoded, writeOptions);
    }

    function watchTaDocument(id,success,error){
      if(CENTRAL_PARENT){
        return CENTRAL_PARENT.firestoreDb.collection('turnierauswertung').doc(id)
          .onSnapshot(s=>success(s.exists?firestoreDecode(s.data()||{}):null),error);
      }
      return onSnapshot(
        doc(db,'turnierauswertung',id),
        s=>success(s.exists()?firestoreDecode(s.data()||{}):null),
        error
      );
    }

    // Doppel KO: jedes Turnier in einem eigenen Firestore-Dokument.
    // Kein ungesicherter öffentlicher Schreibzugriff vom Whiteboard.
    const DKO_COLLECTION='doppelKoTurniere';
    function dkoUser(){return CENTRAL_PARENT?.firebaseAuthUser || auth.currentUser || null;}
    function dkoRequireUser(){
      const u=dkoUser();
      if(!u)throw new Error('Für Firebase bitte am Whiteboard mit dem freigegebenen Benutzerkonto anmelden. Die lokale Bedienung bleibt möglich.');
      return u;
    }
    function dkoCheckId(id){
      if(!/^[a-zA-Z0-9_-]{8,80}$/.test(String(id||'')))throw new Error('Ungültige Turnierkennung');
      return String(id);
    }
    function dkoDoc(id){return doc(db,DKO_COLLECTION,dkoCheckId(id));}
    function dkoCompat(id){return CENTRAL_PARENT?.firestoreDb?.collection(DKO_COLLECTION).doc(dkoCheckId(id))||null;}
    window.ECW_DKO_API={
      ready:()=>!!dkoUser(),
      async login(email,password){
        if(CENTRAL_PARENT)throw new Error('Bereits über die Vereinsverwaltung angemeldet.');
        const credential=await signInWithEmailAndPassword(auth,String(email||'').trim(),String(password||''));
        const u=credential.user;
        const snap=await getDoc(doc(db,'users',u.uid));
        const profile=snap.exists()?snap.data():null;
        if(!profile||(profile.admin!==true&&profile.whiteboard!==true&&profile.doppelKoEdit!==true)){
          await signOut(auth);throw new Error('Dieses Benutzerkonto ist nicht für Doppel KO freigegeben.');
        }
        return true;
      },
      user:()=>dkoUser()?.uid||null,
      async list(){
        dkoRequireUser();
        const snap=CENTRAL_PARENT?await CENTRAL_PARENT.firestoreDb.collection(DKO_COLLECTION).get():await getDocs(collection(db,DKO_COLLECTION));
        return snap.docs.map(d=>{const x=d.data();return {id:d.id,name:x.name,date:x.date,archived:x.archived,updatedAt:x.updatedAt,revision:x.revision,playerCount:x.state?.players?.length||0}}).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
      },
      async get(id){dkoRequireUser();const snap=CENTRAL_PARENT?await dkoCompat(id).get():await getDoc(dkoDoc(id));return (typeof snap.exists==='function'?snap.exists():snap.exists)?{id:snap.id,...snap.data()}:null},
      async save(id,content,expectedRevision){
        const user=dkoRequireUser();const ref=CENTRAL_PARENT?dkoCompat(id):dkoDoc(id);
        const input=JSON.parse(JSON.stringify(content));
        if(!input.state||!Array.isArray(input.state.players)||!input.state.results)throw new Error('Ungültige Turnierdaten');
        const saveFn=async tx=>{
          const existing=await tx.get(ref);
          const present=typeof existing.exists==='function'?existing.exists():existing.exists;
          const current=present?Number(existing.data().revision||0):0;
          if(current!==Number(expectedRevision||0))throw new Error('KONFLIKT: Dieses Turnier wurde auf einem anderen Gerät geändert. Bitte den Firebase-Stand erneut laden.');
          const revision=current+1;
          tx.set(ref,{...input,revision,updatedAt:new Date().toISOString(),updatedBy:user.uid});
          return revision;
        };
        return CENTRAL_PARENT?CENTRAL_PARENT.firestoreDb.runTransaction(saveFn):runTransaction(db,saveFn);
      },
      async remove(id){dkoRequireUser();return CENTRAL_PARENT?dkoCompat(id).delete():deleteDoc(dkoDoc(id))},
      watch(id,onData,onError){dkoRequireUser();return CENTRAL_PARENT?dkoCompat(id).onSnapshot(s=>onData(s.exists?{id:s.id,...s.data()}:null),onError):onSnapshot(dkoDoc(id),s=>onData(s.exists()?{id:s.id,...s.data()}:null),onError)}
    };

    // Zentral authentifizierte Admin- ODER Whiteboard-Sitzung uebernehmen.
    // Firebase im iFrame darf keinen zweiten Login erzwingen.
    if(CENTRAL_PARENT){
      window.currentFirebaseUser=CENTRAL_PARENT.firebaseAuthUser;
      window.currentUserProfile=CENTRAL_ADMIN_PARENT
        ? {admin:true,name:'Administrator'}
        : {whiteboard:true,name:'Whiteboard'};
      window.currentRole=CENTRAL_ADMIN_PARENT?'admin':'whiteboard';
      window.firebaseLogin=async()=>{ throw new Error('Bereits ueber die Vereinsverwaltung angemeldet.'); };
      window.firebaseLogout=async()=>{};
    }else{
      await setPersistence(auth, browserLocalPersistence);
      window.firebaseLogin = async (email,password)=>signInWithEmailAndPassword(auth,email,password);
      window.firebaseLogout = async ()=>signOut(auth);
    }

    function pseudoRef(_db,path){ return {path:String(path||'')}; }
    function snapWrap(v){ return {val:()=>v}; }

    function targetFor(path){
      path=String(path||'').replace(/^\/+/,'');
      if(path==='cup/public/tournaments') return {id:'cup',field:'tournaments'};
      if(path==='jahresmeisterschaft/results/current') return {id:'jahresmeisterschaft'};
      if(path==='stockdart/state') return {id:'stockdart'};
      if(path==='auslosung') return {id:'auslosung'};
      if(path.startsWith('users/')) return {userId:path.slice(6),userProfile:true};
      throw new Error('Unbekannter Datenpfad: '+path);
    }

    async function readTarget(t){
      if(t.userProfile){
        if(CENTRAL_PARENT){
          const p=CENTRAL_ADMIN_PARENT
            ? {admin:true,name:CENTRAL_PARENT.firebaseAuthUser?.email||'Administrator'}
            : CENTRAL_WHITEBOARD_PARENT
              ? {whiteboard:true,name:CENTRAL_PARENT.firebaseAuthUser?.email||'Whiteboard'}
              : null;
          return p ? {...p,active:true,role:CENTRAL_ADMIN_PARENT?'admin':'whiteboard'} : null;
        }
        const s=await getDoc(doc(db,'users',t.userId));
        if(!s.exists())return null;
        const data=s.data()||{};
        return {...data,active:true,role:roleFromCentralProfile(data),name:data.name||data.email||''};
      }
      const data=await readTaDocument(t.id);
      if(!data)return null;
      return t.field ? (data[t.field] ?? null) : data;
    }

    window.fbRef = pseudoRef;
    window.fbGet = async refObj=>{
      const t=targetFor(refObj.path);
      return snapWrap(await readTarget(t));
    };
    window.fbSet = async (refObj,value)=>{
      const t=targetFor(refObj.path);
      if(t.userProfile) throw new Error('Benutzerprofile werden hier nicht geschrieben.');
      if(t.field){
        // WICHTIG: merge:true wuerde die Map tournaments rekursiv vereinigen.
        // Dadurch blieben geloeschte Cups in Firestore erhalten.
        // mergeFields ersetzt exakt diese drei Top-Level-Felder und laesst
        // andere Felder im Dokument unangetastet.
        const payload={
          [t.field]:value,
          updatedAt:new Date().toISOString(),
          updatedBy:centralUid() || (window.isForcedWhiteboardView?.() ? 'whiteboard-public' : null)
        };
        return writeTaDocument(t.id,payload,{mergeFields:[t.field,'updatedAt','updatedBy']});
      }
      return writeTaDocument(t.id,value||{},true);
    };
    window.fbOnValue = (refObj,success,error)=>{
      const t=targetFor(refObj.path);
      if(t.userProfile){
        let stopped=false;
        readTarget(t).then(v=>{if(!stopped)success(snapWrap(v))}).catch(error||(()=>{}));
        return ()=>{stopped=true};
      }
      return watchTaDocument(t.id,data=>{
        const value=t.field && data ? (data[t.field] ?? null) : data;
        success(snapWrap(value));
      },error);
    };

    window.firebaseSaveJahresmeisterschaft = async function(data){
      const r=window.getEffectiveRole?window.getEffectiveRole():(window.currentRole||'guest');
      if(r!=='admin')throw new Error('Keine Schreibberechtigung für Jahresmeisterschaft.');
      if(!data)return;
      await writeTaDocument('jahresmeisterschaft',{
        state:data,
        updatedAt:new Date().toISOString(),
        updatedBy:centralUid()
      },true);
    };

    window.firebaseLoadJahresmeisterschaft = async function(){
      return readTaDocument('jahresmeisterschaft');
    };

    window.firebaseSaveStockdart = async function(data){
      const r=window.getEffectiveRole?window.getEffectiveRole():(window.currentRole||'guest');
      if(r!=='admin')throw new Error('Nur ADMIN darf StockDart speichern.');
      await writeTaDocument('stockdart',{
        data:data||{},
        updatedAt:new Date().toISOString(),
        updatedBy:centralUid()
      },true);
    };

    window.firebaseLoadStockdart = async function(){
      return readTaDocument('stockdart');
    };

    // Einmalige Migration aus dem bisherigen Projekt turnierauswertung-a36fe.
    // Die ZIELSEITE nutzt dabei immer die bereits angemeldete zentrale
    // Vereinsverwaltung. Nur wenn das ALTE Firebase-Projekt keine bestehende
    // Sitzung mehr hat, werden einmalig die alten Zugangsdaten benötigt.
    window.migrateLegacyTurnierauswertung = async function(email,password,progress){
      const say = msg => { try{ if(typeof progress==='function')progress(msg); }catch(e){} };

      if((window.getEffectiveRole?.()||window.currentRole||'guest')!=='admin')
        throw new Error('Nur der zentrale Administrator darf die Datenübernahme durchführen.');

      const oldConfig={
        apiKey:"AIzaSyDPUnrB_wzWcfsCU6x0LMjqcvhwLRZ8_S8",
        authDomain:"turnierauswertung-a36fe.firebaseapp.com",
        databaseURL:"https://turnierauswertung-a36fe-default-rtdb.europe-west1.firebasedatabase.app/",
        projectId:"turnierauswertung-a36fe",
        storageBucket:"turnierauswertung-a36fe.firebasestorage.app",
        messagingSenderId:"820964288396",
        appId:"1:820964288396:web:dc78cfb2cae9263fb018a9"
      };

      function timeout(promise,ms,label){
        return Promise.race([
          promise,
          new Promise((_,reject)=>setTimeout(
            ()=>reject(new Error(label+' – Zeitüberschreitung nach '+Math.round(ms/1000)+' Sekunden.')),
            ms
          ))
        ]);
      }

      async function restRead(path,token){
        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),15000);
        try{
          const url=oldConfig.databaseURL.replace(/\/$/,'')+
            '/'+path.replace(/^\/+/,'')+'.json?auth='+encodeURIComponent(token);
          const res=await fetch(url,{cache:'no-store',signal:ctrl.signal});
          const txt=await res.text();
          let body=null;
          try{body=txt?JSON.parse(txt):null}catch(e){body=txt}
          if(!res.ok){
            const detail=(body&&body.error)?body.error:
              (typeof body==='string'?body:('HTTP '+res.status));
            throw new Error('Alte Firebase-Daten konnten nicht gelesen werden: '+detail);
          }
          return body;
        }catch(e){
          if(e?.name==='AbortError')
            throw new Error('Lesen aus dem alten Firebase-Projekt dauerte zu lange.');
          throw e;
        }finally{
          clearTimeout(timer);
        }
      }

      say('Altes Firebase-Projekt wird vorbereitet …');
      let oldApp=getApps().find(a=>a.name==='legacyTurnierauswertungMigration');
      if(!oldApp)oldApp=initializeApp(oldConfig,'legacyTurnierauswertungMigration');

      const oldAuth=getAuth(oldApp);
      await timeout(
        setPersistence(oldAuth,browserLocalPersistence),
        10000,
        'Alte Anmeldung konnte nicht vorbereitet werden'
      );

      if(!oldAuth.currentUser){
        say('Gespeicherte alte Anmeldung wird geprüft …');
        await new Promise(resolve=>{
          let done=false;
          const unsub=onAuthStateChanged(oldAuth,()=>{
            if(done)return;
            done=true;
            try{unsub()}catch(e){}
            resolve();
          });
          setTimeout(()=>{
            if(done)return;
            done=true;
            try{unsub()}catch(e){}
            resolve();
          },900);
        });
      }

      let signedInHere=false;

      if(!oldAuth.currentUser){
        if(!email||!password)
          throw new Error('Bitte E-Mail-Adresse und Passwort der bisherigen Turnierauswertung eingeben.');

        say('Alte Zugangsdaten werden geprüft …');

        try{
          await timeout(
            signInWithEmailAndPassword(oldAuth,email,password),
            15000,
            'Anmeldung am alten Firebase-Projekt'
          );
          signedInHere=true;
        }catch(e){
          const c=String(e?.code||'');
          if(
            c.includes('invalid-credential') ||
            c.includes('wrong-password') ||
            c.includes('user-not-found') ||
            c.includes('invalid-login-credentials')
          ){
            throw new Error('E-Mail oder Passwort der bisherigen Turnierauswertung ist nicht korrekt.');
          }
          throw e;
        }
      }

      if(!oldAuth.currentUser)
        throw new Error('Am alten Firebase-Projekt konnte keine Anmeldung hergestellt werden.');

      say('Anmeldung erfolgreich. Zugriff wird vorbereitet …');

      const token=await timeout(
        oldAuth.currentUser.getIdToken(true),
        15000,
        'Firebase-Zugriffstoken'
      );

      say('Cupdaten werden gelesen …');
      const cup=await restRead('cup/public/tournaments',token) || {};

      say('Jahresmeisterschaft wird gelesen …');
      const jm=await restRead('jahresmeisterschaft/results/current',token);

      say('StockDart wird gelesen …');
      const sd=await restRead('stockdart/state',token);

      say('Auslosungsdaten werden gelesen …');
      let draw=null;
      try{
        draw=await restRead('auslosung',token);
      }catch(e){
        say('Alter Ersatzpfad für Auslosungsdaten wird geprüft …');
        try{
          draw=await restRead('draw',token);
        }catch(_){
          draw=null;
        }
      }

      const migratedAt=new Date().toISOString();

      say('Sicherungsdatei der bisherigen Daten wird erstellt …');

      const backup={
        sourceProject:'turnierauswertung-a36fe',
        exportedAt:migratedAt,
        cup:{public:{tournaments:cup}},
        jahresmeisterschaft:{results:{current:jm||null}},
        stockdart:{state:sd||null},
        auslosung:draw||null
      };

      const blob=new Blob(
        [JSON.stringify(backup,null,2)],
        {type:'application/json'}
      );

      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='Turnierauswertung_Altdaten_Sicherung_'+migratedAt.slice(0,10)+'.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href),1500);

      say('Cupdaten werden in die Vereinsverwaltung übertragen …');

      await timeout(
        writeTaDocument('cup',{
          tournaments:cup,
          migratedAt,
          migratedFrom:'turnierauswertung-a36fe',
          updatedAt:migratedAt,
          updatedBy:centralUid()
        },true),
        20000,
        'Cupdaten konnten nicht zentral gespeichert werden'
      );

      if(jm){
        say('Jahresmeisterschaft wird übertragen (verschachtelte Daten werden Firestore-kompatibel kodiert) …');
        await timeout(
          writeTaDocument('jahresmeisterschaft',{
            ...jm,
            migratedAt,
            migratedFrom:'turnierauswertung-a36fe'
          },true),
          20000,
          'Jahresmeisterschaft konnte nicht zentral gespeichert werden'
        );
      }

      if(sd){
        say('StockDart wird übertragen (Firestore-kompatibel kodiert) …');
        await timeout(
          writeTaDocument('stockdart',{
            ...sd,
            migratedAt,
            migratedFrom:'turnierauswertung-a36fe'
          },true),
          20000,
          'StockDart konnte nicht zentral gespeichert werden'
        );
      }

      if(draw){
        say('Auslosungsdaten werden übertragen (Firestore-kompatibel kodiert) …');
        await timeout(
          writeTaDocument('auslosung',{
            data:draw,
            migratedAt,
            migratedFrom:'turnierauswertung-a36fe'
          },true),
          20000,
          'Auslosungsdaten konnten nicht zentral gespeichert werden'
        );
      }

      say('Übertragung wird kontrolliert …');

      const verify=await timeout(
        readTaDocument('cup'),
        15000,
        'Kontrolle der übertragenen Cupdaten'
      );

      const verifyCount=Object.keys(verify?.tournaments||{}).length;
      const sourceCount=Object.keys(cup||{}).length;

      if(verifyCount!==sourceCount){
        throw new Error(
          'Kontrolle fehlgeschlagen: Im alten Projekt wurden '+
          sourceCount+' Cup-Turniere gelesen, zentral sind aber '+
          verifyCount+' gespeichert.'
        );
      }

      if(signedInHere){
        try{await signOut(oldAuth)}catch(e){}
      }

      say('Übernahme erfolgreich abgeschlossen.');

      return {
        cupTurniere:sourceCount,
        jahresmeisterschaft:!!jm,
        stockdart:!!sd,
        auslosung:!!draw
      };
    };

    window.migrateOldCupData = async function(){
      throw new Error('Bitte die Funktion „Bisherige Turnierauswertung übernehmen“ verwenden.');
    };

    if(CENTRAL_PARENT){
      // Bereits gepruefte zentrale Anmeldung ohne zweite Passwortabfrage.
      const activateCentralSession=()=>{
        window.currentFirebaseUser=CENTRAL_PARENT.firebaseAuthUser;
        window.currentUserProfile=CENTRAL_ADMIN_PARENT
          ? {admin:true,name:CENTRAL_PARENT.firebaseAuthUser?.email||'Administrator'}
          : {whiteboard:true,name:'Whiteboard'};
        window.currentRole=CENTRAL_ADMIN_PARENT?'admin':'whiteboard';

        const ov=document.getElementById('loginOverlay');
        if(ov)ov.style.display='none';

        try{window.applyFirebaseRole?.()}catch(e){console.error(e)}
        try{window.initFirebaseSync?.()}catch(e){console.error(e)}

        const target=(urlParams.get('seite')||'home').toLowerCase();
        if(target && target!=='home'){
          setTimeout(()=>window.openWhiteboardTarget?.(),80);
        }

        if(urlParams.get('migration')==='1'){
          setTimeout(()=>window.showLegacyMigration?.(),120);
        }
      };

      if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded',activateCentralSession,{once:true});
      }else{
        activateCentralSession();
      }
    }else{
      onAuthStateChanged(auth,async user=>{
        window.currentFirebaseUser=user||null;
        window.currentRole='guest';
        window.currentUserProfile=null;

        if(user){
          try{
            const s=await getDoc(doc(db,'users',user.uid));
            const p=s.exists()?(s.data()||{}):null;
            window.currentUserProfile=p;
            window.currentRole=roleFromCentralProfile(p);
          }catch(e){
            console.error('Zentrale Benutzerrolle konnte nicht geladen werden:',e);
          }
        }

        if(window.applyFirebaseRole)window.applyFirebaseRole();
        if(window.initFirebaseSync && (
          (user&&window.currentRole!=='guest') ||
          window.isForcedWhiteboardView?.()
        )) window.initFirebaseSync();
      });
    }
