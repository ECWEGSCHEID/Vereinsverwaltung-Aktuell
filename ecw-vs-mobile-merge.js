/* Fügt nur neue mobile Punkte in eine Kopie des aktuellen SERVER-Stands ein. */
(() => {
'use strict';
const BOARD='ecw_versammlungen_demo_v1',WORK='ecw_work_v1',copy=x=>JSON.parse(JSON.stringify(x));
function identity(s){const m=s.meeting||{};return JSON.stringify([m.date||'',m.time||'',m.place||'',m.placeOther||'']);}
function merge(backup,entries,now=Date.now()){
 if(!backup||backup.format!=='ecw-versammlungen-backup'||backup.schemaVersion!==1||!backup.localStorage)throw Error('Kein gültiger gemeinsamer Versammlungsstand vorhanden.');
 const result=copy(backup),added=[],ack=[],blocked=[];let changed=false;
 let board=null,work=null,boardChanged=false,workChanged=false;
 for(const e of entries){
  if(!e||!['board','work'].includes(e.kind)||typeof e.id!=='string'||typeof e.title!=='string'||!e.title.trim()||e.title.length>160||typeof e.desc!=='string'||e.desc.length>10000){blocked.push({id:e?.id,reason:'Ungültiger mobiler Punkt.'});continue;}
  if(e.kind==='board'){
   if(!board){try{board=JSON.parse(result.localStorage[BOARD]||'null');}catch{throw Error('Vorstandssitzungsdaten im Firebase-Stand sind ungültig.');}}
   if(!board||!Array.isArray(board.items)){blocked.push({id:e.id,reason:'Vorstandssitzung wurde noch nicht eingerichtet.'});continue;}
   if(board.items.some(x=>x.mobileId===e.id)){ack.push(e);added.push({entry:e,identity:identity(board),existing:true});continue;}
   if(board.archived){blocked.push({id:e.id,reason:'Vorstandssitzung ist gesperrt. Punkt bleibt sicher in Firebase für die nächste offene Sitzung.'});continue;}
   const id=Math.max(now,...board.items.map(x=>Number(x.id)||0))+1;
   board.items.push({id,title:e.title,desc:e.desc,section:'agenda',status:'Offen',mobileId:e.id});boardChanged=true;ack.push(e);added.push({entry:e,identity:identity(board)});
  }else{
   if(!work){try{work=JSON.parse(result.localStorage[WORK]||'null');}catch{throw Error('Arbeitseinsatzdaten im Firebase-Stand sind ungültig.');}}
   if(!work)work={events:[],active:null};if(!Array.isArray(work.events))throw Error('Ungültige Arbeitseinsatzliste.');
   const existing=work.events.find(w=>Array.isArray(w.items)&&w.items.some(x=>x.mobileId===e.id));
   if(existing){ack.push(e);added.push({entry:e,target:existing.id,definition:{...copy(existing),items:[]},existing:true});continue;}
   let target=work.events.find(w=>w.id===work.active&&!w.done)||work.events.find(w=>!w.done);
   if(!target){target={id:'mobile_'+e.id,title:'Mobile Arbeitspunkte',date:'',time:'',place:'',helpers:[],items:[],done:false};work.events.unshift(target);work.active=target.id;}
   if(!Array.isArray(target.items))throw Error('Arbeitsliste ist ungültig.');
   work.active=target.id;target.items.push({title:e.title,desc:e.desc,status:'Offen',helpers:[],mobileId:e.id});workChanged=true;ack.push(e);added.push({entry:e,target:target.id,definition:{...copy(target),items:[]}});
  }
 }
 if(boardChanged){result.localStorage[BOARD]=JSON.stringify(board);changed=true;}
 if(workChanged){result.localStorage[WORK]=JSON.stringify(work);changed=true;}
 return {backup:result,changed,added,ack,blocked};
}
window.ecwMobilePointMerge={merge,identity};
})();
