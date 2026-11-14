/* ECW Technik: bestehende Firebase-App derselben Projekt-ID wiederverwenden. */
(function(){
 'use strict';
 window.ecwTechnikDb=null;
 window.ecwTechnikFehler='';
 try {
   const cfg=window.ECW_TECHNIK_FIREBASE_CONFIG;
   if(!cfg || !cfg.projectId)throw Error('Firebase-Webkonfiguration fehlt');
   const matching=firebase.apps.find(a=>a.options.projectId===cfg.projectId);
   const app=matching || firebase.initializeApp(cfg,'ecw-technik-anzeige');
   window.ecwTechnikDb=app.firestore();
 }catch(error){
   window.ecwTechnikFehler='Firebase-Verbindung fehlgeschlagen';
   console.warn(window.ecwTechnikFehler,error);
 }
})();
