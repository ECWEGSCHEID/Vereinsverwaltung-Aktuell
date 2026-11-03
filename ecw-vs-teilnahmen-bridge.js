/* Liest ausschließlich den bereits geladenen Terminplaner der angemeldeten Verwaltung. */
(() => {
'use strict';
window.ecwMeetingParticipation={
 read(requester){
  const frame=document.getElementById('vsAdminFrame');
  if(!frame||requester!==frame.contentWindow||!window.ecwCanUseVersammlungen?.())throw Error('Bitte die Mannschaftssitzung mit berechtigter Anmeldung aus der Vereinsverwaltung öffnen.');
  if(typeof data==='undefined'||!Array.isArray(data.tournamentPlanner))throw Error('Der Terminplaner ist noch nicht geladen. Bitte die Vereinsverwaltung öffnen und erneut versuchen.');
  const events=data.tournamentPlanner.map(x=>x?{id:x.id,name:x.name,date:typeof tpEventDateStr==='function'?tpEventDateStr(x):x.date,location:x.location,players:Array.isArray(x.players)?x.players:[],effectiveType:typeof tpEffectiveType==='function'?tpEffectiveType(x):x.type,status:x.status,cancelled:x.cancelled,canceled:x.canceled,deleted:x.deleted,cancelledAt:x.cancelledAt}:null);
  // Kopie ohne weitere Verwaltungsdaten; keine zusätzlichen Firebase-Lesevorgänge.
  return JSON.parse(JSON.stringify({events,aliases:data.tournamentPlannerPlayerAliases||{},generatedAt:new Date().toISOString()}));
 }
};
})();
