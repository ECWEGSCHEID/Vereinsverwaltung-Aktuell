/* ECW12: eigene sekundäre Firebase-App; verändert die Haupt-App nicht. */
(function(){
 'use strict';
 window.ecwTechnikDb = null;
 window.ecwTechnikFehler = '';
 try {
   const cfg=window.ECW_TECHNIK_FIREBASE_CONFIG;
   if (!cfg || !cfg.apiKey || cfg.apiKey.startsWith('HIER_') || !cfg.appId || cfg.appId.startsWith('HIER_')) {
     window.ecwTechnikFehler='ECW Technik: Web-App-Konfiguration fehlt';
     return;
   }
   const app=firebase.apps.find(a=>a.name==='ecw-technik') || firebase.initializeApp(cfg,'ecw-technik');
   window.ecwTechnikDb=app.firestore();
 } catch(error) {
   window.ecwTechnikFehler='ECW Technik: Firebase-Verbindung fehlgeschlagen';
   console.warn(window.ecwTechnikFehler,error);
 }
})();
