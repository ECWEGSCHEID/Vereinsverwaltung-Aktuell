
/* The local and GitHub-hosted reservation modules share the parent origin. */
(function(){
 if(window.self===window.top)return;
 try{
  const host=window.parent.document;
  if(host.getElementById('ecwReservationMobileLayout'))return;
  const style=host.createElement('style');style.id='ecwReservationMobileLayout';
  style.textContent=`@media(max-width:768px){
   #externalPage.ecw-reservation-embed.active{height:100vh!important;height:100dvh!important;min-height:0!important;overflow:hidden!important;padding:0!important;display:flex!important;flex-direction:column!important}
   #externalPage.ecw-reservation-embed .external-toolbar,#externalPage.ecw-reservation-embed .external-note,#externalPage.ecw-reservation-embed .menu-return,#externalPage.ecw-reservation-embed .external-bottom-space{display:none!important}
   #externalPage.ecw-reservation-embed #ecwExternalHomeBar{position:static!important;display:flex!important;flex:0 0 auto!important;width:100%!important;max-width:none!important;box-sizing:border-box!important;padding:6px!important;margin:0!important;border-radius:0!important;gap:8px!important}
   #externalPage.ecw-reservation-embed #ecwExternalHomeBar strong{display:none!important}
   #externalPage.ecw-reservation-embed #externalFrame{display:block!important;flex:1 1 0!important;height:0!important;min-height:0!important;width:100%!important}
   #ecwReservationAdminFrame{height:75vh!important;height:75dvh!important;min-height:480px!important}
  }`;
  host.head.appendChild(style);
 }catch(e){/* Cross-origin hosts retain their own layout. */}
})();
