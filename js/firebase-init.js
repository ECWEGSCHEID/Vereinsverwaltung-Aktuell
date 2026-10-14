
const firebaseConfig = {
  apiKey: "AIzaSyDmK54G30_JK8ma8tJ7YWyza-OrdrUC24I",
  authDomain: "ec-wegscheid-verwaltung-neu.firebaseapp.com",
  projectId: "ec-wegscheid-verwaltung-neu",
  storageBucket: "ec-wegscheid-verwaltung-neu.firebasestorage.app",
  messagingSenderId: "558472054725",
  appId: "1:558472054725:web:10145e2d8d6f168b056dac"
};
let firebaseReady=false, firestoreDb=null, firebaseAuth=null, firebaseAuthUser=null;
let loginPurpose='admin';
let appPermissions={};

// V2.5.2: Öffentlicher Whiteboard-Anzeigemodus ohne Firebase-Anmeldung.
// Nur Lesen. Schreib-/Adminfunktionen bleiben weiterhin authentifiziert.
const ECW_PUBLIC_WHITEBOARD=(function(){
  try{
    const u=new URL(location.href);

    // Expliziter Login/Admin-Aufruf: normaler Auth-Modus.
    if(u.searchParams.get('login')==='1' || u.searchParams.get('admin')==='1')return false;

    if(String(u.hash||'').toLowerCase()==='#whiteboard'){
      u.searchParams.set('whiteboard','1');
      u.hash='';
      history.replaceState(null,'',u.pathname+u.search);
      return true;
    }

    if(u.searchParams.get('whiteboard')==='1')return true;

    // Das veröffentlichte Informationssystem startet grundsätzlich ohne Anmeldung.
    // Admin-/Benutzeranmeldung wird nur noch bewusst über "Benutzer anmelden" gestartet.
    if(/^https?:$/.test(u.protocol)
       && u.hostname==='ecwegscheid.github.io'
       && /^\/Vereinsverwaltung-Aktuell\/(?:index\.html)?$/i.test(u.pathname)){
      return true;
    }

    return false;
  }catch(e){return false}
})();
function isPublicWhiteboardMode(){return ECW_PUBLIC_WHITEBOARD===true;}
const APP_PERMISSIONS={tp:'Turnierplaner bearbeiten',tv:'Turnierverwaltung bearbeiten',jm:'Ziel Jahresmeisterschaft – Mobil eingeben',tw:'Turnierwirtschaftlichkeit bearbeiten',t:'Turniereinladungen bearbeiten',o:'Eigene Turniere bearbeiten',n:'Vereinsnachrichten bearbeiten',p:'Fotos Verein bearbeiten',sp:'Sponsoren bearbeiten',mv:'Mitgliederverwaltung',m:'Mannschaften bearbeiten',lk:'Links bearbeiten',sh:'Startseite bearbeiten',shView:'Startseite ansehen',tpView:'Turnierplaner ansehen',tView:'Turniereinladungen ansehen',oView:'Eigene Turniere ansehen',nView:'Vereinsnachrichten ansehen',pView:'Fotos Verein ansehen',spView:'Sponsoren ansehen',mView:'Mannschaften ansehen',lkView:'Links ansehen',mvView:'Mitglieder und Geburtstage ansehen'};
const PRESENTATION_PERMISSIONS=['sh','tp','t','o','n','p','sp','m','lk','mv'];
window.appPermissions=appPermissions;
try{
  firebase.initializeApp(firebaseConfig);
  firestoreDb=firebase.firestore(); window.firestoreDb=firestoreDb;
  firebaseReady=true;
  firebaseAuth=firebase.auth(); window.firebaseAuth=firebaseAuth;
  // V2.5.2: Dauerhafte Anmeldung initialisieren und beim Start abwarten.
  window.__ecwPersistenceReady=firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(()=>true)
    .catch(e=>{console.warn('Firebase Persistenz:',e);return false;});
  window.__ecwAuthInitialResolved=false;
  window.__ecwAuthInitialUser=null;
}catch(e){console.error("Firebase Initialisierung:",e);}
