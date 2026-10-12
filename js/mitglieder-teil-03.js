
// Mitgliederverwaltung verwendet dieselbe zentrale Firestore-Datenbank wie die Gesamtverwaltung.
const db = window.parent.firestoreDb;
const memberEditor=window.parent.hasAppPermission('mv');
const privateStateRef=db.collection("ecw").doc("state");
const publicStateRef=db.collection("ecw").doc("publicMembers");
const stateRef=memberEditor?privateStateRef:publicStateRef;
// Firestore stammt aus dem Hauptfenster. Daten und Optionen müssen deshalb
// dessen Object-Prototyp verwenden, statt den des srcdoc-Fensters.
function memberFirestoreValue(value){return window.parent.JSON.parse(JSON.stringify(value));}


// Einmalige Übernahme der vollständigen Mitgliederdaten, nur durch globale Administratoren.
const legacyMemberConfig={
  apiKey:"AIzaSyDVhrXgybScmRgfiE5waqDsTX-5wE85qZ4r",
  authDomain:"mitgliederverwaltung-72651.firebaseapp.com",
  projectId:"mitgliederverwaltung-72651",
  storageBucket:"mitgliederverwaltung-72651.firebasestorage.app",
  messagingSenderId:"607999480134",
  appId:"1:607999480134:web:ac49f3897ebee25ad31547"
};
let memberMigrationCandidate=null,memberMigrationBusy=false;
function memberMigrationAdmin(){return memberEditor&&window.parent.appPermissions?.admin===true;}
function memberMigrationStatus(message){const el=document.getElementById('memberMigrationStatus');if(el)el.textContent=message;}
function updateMemberMigrationControls(){
 const panel=document.getElementById('memberMigrationPanel');if(panel)panel.hidden=!memberMigrationAdmin();
 const commit=document.getElementById('memberMigrationCommit');if(commit)commit.disabled=!memberMigrationAdmin()||memberMigrationBusy||!memberMigrationCandidate;
 for(const id of ['memberMigrationLoad','memberMigrationFile']){const el=document.getElementById(id);if(el)el.disabled=memberMigrationBusy;}
}
function validateMemberMigration(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Array.isArray(raw.members)||!Array.isArray(raw.passes))throw new Error('Keine vollständige Mitglieder-Sicherung: members und passes müssen Listen sein.');
 const state=JSON.parse(JSON.stringify(raw));
 const members=state.members.filter(m=>m&&typeof m==='object'&&[m.firstName,m.lastName].some(v=>String(v??'').trim()));
 if(!members.length)throw new Error('Der geladene Bestand enthält keine Mitglieder. Eine leere Liste wird nicht übernommen.');
 if(members.length!==state.members.length)throw new Error('Die Mitgliederliste enthält unvollständige Einträge. Bitte zuerst die Sicherung prüfen.');
 const ids=new Set();for(const m of members){if(m.id==null||ids.has(String(m.id)))throw new Error('Mitgliedsnummer fehlt oder ist doppelt.');ids.add(String(m.id));}
 state.users=[];state.settings=state.settings&&typeof state.settings==='object'&&!Array.isArray(state.settings)?state.settings:{};
 state.sponsors=Array.isArray(state.sponsors)?state.sponsors:[];state.dataVersion=5;
 return state;
}
function stageMemberMigration(raw){
 memberMigrationCandidate=validateMemberMigration(raw);
 memberMigrationStatus('Geladen: '+memberMigrationCandidate.members.length+' Mitglieder, '+memberMigrationCandidate.passes.length+' Spielerpässe und '+memberMigrationCandidate.sponsors.length+' Sponsoren. Noch nicht in das neue Projekt übertragen.');
 updateMemberMigrationControls();
}
window.ecwLoadLegacyMembers=async function(){
 if(!memberMigrationAdmin()||memberMigrationBusy)return;
 memberMigrationBusy=true;memberMigrationCandidate=null;updateMemberMigrationControls();memberMigrationStatus('Bisherige Firebase-Daten werden geladen …');
 try{
   const sdk=window.parent.firebase;
   const legacyApp=sdk.apps.find(a=>a.name==='ecw-member-migration')||sdk.initializeApp(legacyMemberConfig,'ecw-member-migration');
   const snap=await legacyApp.firestore().collection('ecw').doc('state').get({source:'server'});
   if(!snap.exists)throw new Error('Im bisherigen Projekt wurde ecw/state nicht gefunden.');
   stageMemberMigration(snap.data());
 }catch(e){memberMigrationStatus('Laden fehlgeschlagen: '+e.message+' — alternativ eine JSON-Sicherung aus der bisherigen Verwaltung auswählen.');}
 finally{memberMigrationBusy=false;updateMemberMigrationControls();}
};
window.ecwReadMemberBackup=async function(file){
 if(!memberMigrationAdmin()||memberMigrationBusy||!file)return;
 memberMigrationCandidate=null;updateMemberMigrationControls();
 try{stageMemberMigration(JSON.parse(await file.text()));}catch(e){memberMigrationStatus('Sicherung konnte nicht geladen werden: '+e.message);}
};
async function createMissingMemberState(state){
 if(!memberMigrationAdmin())throw new Error('Die Datenübernahme ist nur für Administratoren freigegeben.');
 const checked=validateMemberMigration(state);
 await db.runTransaction(async tx=>{
   const existing=await tx.get(privateStateRef);
   if(existing.exists)throw new Error('ecw/state ist bereits vorhanden. Es wurden keine Daten überschrieben.');
   tx.set(privateStateRef,memberFirestoreValue(checked));
 });
 return checked;
}
window.ecwCommitMemberMigration=async function(){
 if(!memberMigrationAdmin()||memberMigrationBusy||!memberMigrationCandidate)return;
 memberMigrationBusy=true;updateMemberMigrationControls();
 try{
   const migrated=await createMissingMemberState(memberMigrationCandidate);
   memberMigrationCandidate=null;
   applyRemote(migrated);
   try{await publishPublicMembers(migrated);memberMigrationStatus('Übernahme erfolgreich: '+migrated.members.length+' Mitglieder und '+migrated.passes.length+' Spielerpässe. Die Whiteboardansicht ist ebenfalls aktualisiert.');}
   catch(e){memberMigrationStatus('Vollständige Mitgliederdaten übernommen. Whiteboardansicht konnte noch nicht aktualisiert werden: '+e.message);}
 }catch(e){memberMigrationStatus('Übernahme nicht durchgeführt: '+e.message);}
 finally{memberMigrationBusy=false;updateMemberMigrationControls();}
};
updateMemberMigrationControls();

function publicMembersState(state){
 const memberFields=['id','lastName','firstName','birthDate','memberSince','exitType','exitDate'];
 const passFields=['id','memberId','lastName','firstName','birthDate','passportGroup','passportNo','passportExpiry','passNotRenewed'];
 const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj[k]!==undefined).map(k=>[k,obj[k]]));
 const settings=pick(state.settings||{},['roundAge','ageU14Max','ageU16Max','ageU19Max','ageU23Max','ageSeniorMin','ageCutoff','birthdayUpcomingMonths','roundBirthdayMode']);
 Object.assign(settings,{showAddress:false,showContact:false,showBankButton:false,showMemberSince:true,showBirthDate:true,showAZ:true,displayOrder:['birthDate','memberSince']});
 return {members:(state.members||[]).map(m=>pick(m,memberFields)),passes:(state.passes||[]).map(p=>pick(p,passFields)),users:[],sponsors:[],settings,dataVersion:5};
}
async function publishPublicMembers(state){if(memberEditor)await publicStateRef.set(memberFirestoreValue(publicMembersState(state)));}

const getDoc = async ref => { const s=await ref.get(); return {exists:()=>s.exists,data:()=>s.data(),id:s.id}; };
const setDoc = (ref,data,opts) => opts===undefined?ref.set(memberFirestoreValue(data)):ref.set(memberFirestoreValue(data),memberFirestoreValue(opts));
const onSnapshot = (ref,ok,err) => ref.onSnapshot(ok,err);

window.ecwFirebaseLoaded = false;
window.ecwFirebaseError = null;
window.ecwFirebaseCounts = {members:0, passes:0, users:0};

function firebaseStatus(msg){
  const el=document.getElementById("firebaseStatus");
  if(el) el.textContent=msg;
  try { if(typeof window.setStatus==="function") window.setStatus(msg); } catch(e) {}
}

function errText(e){
  const c=e && e.code ? e.code : "";
  if(c==="permission-denied") return "Firebase FEHLER: Zugriff verweigert (Firestore-Regeln).";
  if(c==="failed-precondition") return "Firebase FEHLER: Firestore ist nicht korrekt eingerichtet.";
  if(c==="unavailable") return "Firebase FEHLER: Server/Internet nicht erreichbar.";
  if(c==="not-found") return "Firebase FEHLER: Datenbank oder Dokument nicht gefunden.";
  return "Firebase FEHLER: "+((e && e.message) ? e.message : String(e));
}

function ensureState(){
  if(!window.S || typeof window.S!=="object" || Array.isArray(window.S)){
    window.S={
      members:[],
      passes:[],
      users:[],
      bank:false,
      settings:{},
      dataVersion:5
    };
  }
  if(!Array.isArray(window.S.members)) window.S.members=[];
  if(!Array.isArray(window.S.sponsors)) window.S.sponsors=[];
  if(!Array.isArray(window.S.passes)) window.S.passes=[];
  if(!Array.isArray(window.S.users)) window.S.users=[];
  if(!window.S.settings || typeof window.S.settings!=="object" || Array.isArray(window.S.settings)) window.S.settings={};
  return window.S;
}

function ensureHoggerMembersAndPasses(){
  if(!Array.isArray(S.members)) S.members=[];
  if(!Array.isArray(S.passes)) S.passes=[];
  if(!S.settings || typeof S.settings!=="object") S.settings={};
  if(S.settings.hoggerMigration20260913) return false;
  let changed=false;
  const targets=[
    {firstName:"Madeleine",lastName:"Hogger",birthDate:"2013-06-01",passportNo:"02/81474 107",passportExpiry:"2035-02-14",groups:["U14"]},
    {firstName:"Luca",lastName:"Hogger",birthDate:"2014-06-24",passportNo:"02/80716 107",passportExpiry:"2034-04-18",groups:["U14","U16","U19","U23"]}
  ];
  for(const t of targets){
    let m=S.members.find(x=>normName(x.lastName)===normName(t.lastName)&&normName(x.firstName)===normName(t.firstName));
    if(!m){m={id:Math.max(0,...S.members.map(x=>+x.id||0))+1,lastName:t.lastName,firstName:t.firstName,birthDate:t.birthDate,memberSince:"",address:"",country:"",zip:"",city:"",phoneMobile:"",phoneFixed:"",email:"",accountHolder:"",iban:"",bic:"",bank:"",notes:"",exitType:"",exitDate:""};S.members.push(m);changed=true;}
    else if(!m.birthDate){m.birthDate=t.birthDate;changed=true;}
    let p=S.passes.find(x=>String(x.passportNo||"").trim()===t.passportNo || (normName(x.lastName)===normName(t.lastName)&&normName(x.firstName)===normName(t.firstName)));
    if(!p){p={id:Math.max(0,...S.passes.map(x=>+x.id||0))+1,memberId:m.id,lastName:t.lastName,firstName:t.firstName,birthDate:t.birthDate,passportNo:t.passportNo,passportExpiry:t.passportExpiry,passportGroup:t.groups.join(", "),passNotRenewed:false};S.passes.push(p);changed=true;}
    else {if(String(p.memberId??"")!==String(m.id)){p.memberId=m.id;changed=true;} if(p.lastName!==t.lastName){p.lastName=t.lastName;changed=true;} if(p.firstName!==t.firstName){p.firstName=t.firstName;changed=true;} if(!p.birthDate){p.birthDate=t.birthDate;changed=true;} if(!p.passportNo){p.passportNo=t.passportNo;changed=true;} if(!p.passportExpiry){p.passportExpiry=t.passportExpiry;changed=true;} if(!p.passportGroup){p.passportGroup=t.groups.join(", ");changed=true;}}
  }
  S.settings.hoggerMigration20260913=true;
  return changed;
}

function applyRemote(r){
  if(!r || typeof r!=="object" || Array.isArray(r)){
    throw new Error("Firebase-Dokument ecw/state enthält keine gültigen Daten.");
  }

  const s=ensureState();

  // Keine Object.assign-Verwendung: dadurch kann ein undefiniertes Ziel
  // keinen "Cannot convert undefined or null to object"-Fehler mehr auslösen.
  for(const key of Object.keys(r)){
    s[key]=r[key];
  }

  if(!Array.isArray(s.members)) s.members=[];
  if(!Array.isArray(s.passes)) s.passes=[];
  if(!Array.isArray(s.sponsors)) s.sponsors=[];
  // Laden zeigt vorhandene Vereinsdaten an und legt keine Mitglieder automatisch an.

  if(!Array.isArray(s.users)) s.users=[];
  if(!s.settings || typeof s.settings!=="object" || Array.isArray(s.settings)) s.settings={};

  window.S=s;
  window.ecwFirebaseCounts={
    members:s.members.length,
    passes:s.passes.length,
    users:s.users.length,sponsors:s.sponsors.length
  };
  window.ecwFirebaseLoaded=true;
  window.ecwFirebaseError=null;

  try{localStorage.setItem("ecw_state",JSON.stringify(s));}catch(e){}

  firebaseStatus(
    "Firebase OK ✓  Mitglieder: "+s.members.length+
    "  |  Spielerpässe: "+s.passes.length+
    "  |  Benutzer: "+s.users.length+
    "  |  Sponsoren: "+s.sponsors.length
  );

  try{if(typeof window.all==="function")window.all();}catch(e){console.error("all() nach Firebase-Laden:",e);}
  try{if(typeof window.dashboard==="function")window.dashboard();}catch(e){console.error("dashboard() nach Firebase-Laden:",e);}
  try{if(typeof window.populateLoginUsers==="function")window.populateLoginUsers();}catch(e){console.error("populateLoginUsers():",e);}
  try{if(typeof window.updateAdminAuthButton==="function")window.updateAdminAuthButton();}catch(e){}
}

async function loadFirebase(){
  firebaseStatus("Firebase: zentrale Mitgliederdaten werden geladen …");
  try{
    ensureState();
    const snap=await getDoc(stateRef);

    if(!snap.exists()){
      const e=new Error(memberEditor?"Kein Dokument ecw/state in Firebase gefunden.":"Mitgliederansicht noch nicht veröffentlicht. Administrator: Mitgliederverwaltung einmal öffnen.");
      window.ecwFirebaseError=e;
      window.ecwFirebaseLoaded=false;
      firebaseStatus("Firebase FEHLER: ecw/state existiert nicht.");
      return false;
    }

    applyRemote(snap.data());
    if(memberEditor)await publishPublicMembers(window.S);
    return true;
  }catch(e){
    window.ecwFirebaseError=e;
    window.ecwFirebaseLoaded=false;
    firebaseStatus(errText(e));
    console.error("Firebase Laden fehlgeschlagen:",e);
    return false;
  }
}

window.ecwFirebaseReadyPromise=loadFirebase();
window.ecwFirebaseReadyPromise.catch(()=>{});

window.ecwFirebaseRefresh=async function(){
  try{
    const snap=await getDoc(stateRef);

    if(!snap.exists()){
      const e=new Error(memberEditor?"Kein Dokument ecw/state in Firebase gefunden.":"Mitgliederansicht noch nicht veröffentlicht. Administrator: Mitgliederverwaltung einmal öffnen.");
      window.ecwFirebaseError=e;
      window.ecwFirebaseLoaded=false;
      firebaseStatus("Firebase FEHLER: ecw/state existiert nicht.");
      return false;
    }

    applyRemote(snap.data());
    if(memberEditor)await publishPublicMembers(window.S);
    return true;
  }catch(e){
    window.ecwFirebaseError=e;
    window.ecwFirebaseLoaded=false;
    firebaseStatus(errText(e));
    console.error("Firebase Refresh fehlgeschlagen:",e);
    return false;
  }
};

window.ecwFirebaseSave=async function(state){
  try{
    if(!memberEditor)return false;
    if(!window.ecwFirebaseLoaded)throw new Error('Mitgliederdaten noch nicht geladen. Ein Administrator muss zuerst den bisherigen Bestand übernehmen.');
    if(!state || typeof state!=="object") throw new Error("Ungültiger lokaler Datenstand.");
    await setDoc(stateRef,JSON.parse(JSON.stringify(state)),{merge:false});
    await publishPublicMembers(state);
    window.ecwFirebaseLoaded=true;
    window.ecwFirebaseError=null;
    firebaseStatus(
      "Firebase gespeichert ✓  Mitglieder: "+(Array.isArray(state.members)?state.members.length:0)+
      "  | Spielerpässe: "+(Array.isArray(state.passes)?state.passes.length:0)+
      "  | Sponsoren: "+(Array.isArray(state.sponsors)?state.sponsors.length:0)
    );
    return true;
  }catch(e){
    window.ecwFirebaseError=e;
    firebaseStatus(errText(e));
    console.error("Firebase Speichern fehlgeschlagen:",e);
    return false;
  }
};

onSnapshot(
  stateRef,
  snap=>{
    if(!snap.exists){
      window.ecwFirebaseLoaded=false;
      firebaseStatus("Firebase FEHLER: ecw/state existiert nicht.");
      return;
    }
    try{
      applyRemote(snap.data());
    }catch(e){
      window.ecwFirebaseError=e;
      window.ecwFirebaseLoaded=false;
      firebaseStatus("Firebase FEHLER: "+e.message);
      console.error("Firebase Echtzeitdaten ungültig:",e);
    }
  },
  e=>{
    window.ecwFirebaseError=e;
    window.ecwFirebaseLoaded=false;
    firebaseStatus(errText(e));
    console.error("Firebase Echtzeitverbindung fehlgeschlagen:",e);
  }
);
