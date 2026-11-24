// Tests der Server-Funktion mit nachgebauter Datenbank (ohne Google Cloud).
// Aufruf: node functions/test/run.js
const D=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()+10+n);return d.toISOString().slice(0,10)};
const Module=require('module'),assert=require('assert'),path=require('path');
const store=new Map();
const ref=p=>({path:p,id:p.split('/').pop()});
const snap=p=>({exists:store.has(p),id:p.split('/').pop(),data:()=>store.has(p)?JSON.parse(JSON.stringify(store.get(p))):undefined});
const db={doc:p=>ref(p),collection:c=>({doc:id=>ref(c+'/'+id),where:(f,op,v)=>({limit:()=>({__q:{c,f,v}})})}),
 getAll:async(...r)=>r.map(x=>snap(x.path)),
 runTransaction:async fn=>{const writes=[];const t={getAll:async(...r)=>r.map(x=>snap(x.path)),
   get:async q=>{const docs=[...store.keys()].filter(k=>k.startsWith(q.__q.c+'/')&&store.get(k)[q.__q.f]===q.__q.v).map(k=>snap(k));return {size:docs.length,docs}},
   set:(r,d,o)=>writes.push([r.path,d])};const res=await fn(t);for(const [p,d] of writes)store.set(p,{...(store.get(p)||{}),...d});return res;}};
class HttpsError extends Error{constructor(code,msg){super(msg);this.code=code}}
let handler;
const mocks={'firebase-admin/app':{initializeApp(){}},'firebase-admin/firestore':{getFirestore:()=>db},
 'firebase-functions/v2/https':{HttpsError,onCall:(o,f)=>{handler=f;return f}},
};
const orig=Module._load;Module._load=function(r,...a){return mocks[r]??orig.call(this,r,...a)};
require(path.join(__dirname,'..','index.js'));
const call=(uid,data,email)=>handler({auth:{uid,token:{email}},data});
store.set('users/ADMIN',{admin:true});store.set('users/MEMBER',{admin:false});
store.set('appSettings/playerList',{players:['Stadler Martin','Resch Michael','Freund Heiner']});
store.set('reservierungMigration/buchungen_20261112',{list:[{date:D(1),resource:'Bahn 1',timeFrom:'18:00',timeTo:'20:00',bookedBy:'Freund Heiner',mode:'Duo Cup',homeTeam:['Freund Heiner'],guestTeam:[]}]});
const live={id:'a'.repeat(64),date:D(1),resource:'Bahn 2',timeFrom:'18:00',timeTo:'20:00',ownerUid:'OTHER',bookedBy:'Resch Michael',mode:'Freies Training (Standard)',homeTeam:[],guestTeam:[]};
store.set('reservierungBuchungstage/'+D(1),{list:[live]});
(async()=>{
 // Admin sieht alles mit own + Kennung
 let r=await call('ADMIN',{action:'list',date:D(1),view:'whiteboard'});
 assert.strictEqual(r.admin,true);assert(r.bookings.every(b=>b.own===true));
 const key=r.bookings.find(b=>b.legacyKey).legacyKey;assert(/^[a-f0-9]{64}$/.test(key));
 // Mitglied ohne Admin: keine fremden own
 store.set('smartphoneFreigaben/MEMBER',{reservierungenLesen:true});
 r=await call('MEMBER',{action:'list',date:D(1),view:'whiteboard'});
 assert(r.bookings.every(b=>!b.own&&!b.legacyKey));
 // Mitglied darf fremde nicht stornieren
 store.set('reservierungZugaenge/MEMBER',{reservieren:true,spielerName:'Stadler Martin'});
 await assert.rejects(call('MEMBER',{action:'cancel',date:D(1),id:live.id}),e=>e.code==='permission-denied');
 await assert.rejects(call('MEMBER',{action:'cancelImported',date:D(1),key}),e=>e.code==='permission-denied');
 // Admin ändert übernommene Buchung (anderes Feld)
 const rid='11111111-2222-3333-4444-555555555555';
 r=await call('ADMIN',{action:'adminReplace',date:D(1),key,requestId:rid,booking:{date:D(1),resource:'Bahn 3',timeFrom:'18:00',timeTo:'19:00',bookedBy:'Freund Heiner',mode:'Duo Cup',homeTeam:['Freund Heiner'],guestTeam:[]}});
 assert.strictEqual(store.get('reservierungMigration/buchungen_20261112').list.length,0);
 assert.strictEqual(store.get('reservierungBuchungstage/'+D(1)).list.length,2);
 // Admin verschiebt Live-Buchung auf anderen Tag; Kollision wird erkannt
 await assert.rejects(call('ADMIN',{action:'adminReplace',date:D(1),id:live.id,requestId:'21111111-2222-3333-4444-555555555555',booking:{date:D(1),resource:'Bahn 3',timeFrom:'18:30',timeTo:'19:30',bookedBy:'Resch Michael',mode:'Freies Training (Standard)',homeTeam:[],guestTeam:[]}}),e=>e.code==='already-exists');
 await call('ADMIN',{action:'adminReplace',date:D(1),id:live.id,requestId:'31111111-2222-3333-4444-555555555555',booking:{date:D(2),resource:'Bahn 2',timeFrom:'18:00',timeTo:'20:00',bookedBy:'Resch Michael',mode:'Freies Training (Standard)',homeTeam:[],guestTeam:[]}});
 assert.strictEqual(store.get('reservierungBuchungstage/'+D(1)).list.length,1);
 const moved=store.get('reservierungBuchungstage/'+D(2)).list[0];assert.strictEqual(moved.ownerUid,'OTHER');
 // Admin löscht
 await call('ADMIN',{action:'cancel',date:D(2),id:moved.id});
 assert.strictEqual(store.get('reservierungBuchungstage/'+D(2)).list.length,0);
 // Normales Buchen weiter möglich (Mitglied)
 await call('MEMBER',{action:'book',date:D(3),resource:'Bahn 1',timeFrom:'10:00',timeTo:'11:00',requestId:'41111111-2222-3333-4444-555555555555',mode:'Freies Training (Standard)'});
 assert.strictEqual(store.get('reservierungBuchungstage/'+D(3)).list[0].bookedBy,'Stadler Martin');
 for (const [m,ok] of [['Geburtstagsfeier',true],['Gremlins Heimspiel',true],['Duo Cup',false]]) { const p=call('MEMBER',{action:'book',date:D(4),resource:'Vereinsheim',timeFrom:ok?'1'+(m.length%9)+':00':'08:00',timeTo:ok?'1'+(m.length%9)+':30':'08:30',requestId:(m.length+'1111111-2222-3333-4444-555555555555').slice(-36),mode:m}); if(ok) await p; else await assert.rejects(p,e=>e.code==='invalid-argument'); }
 await call('MEMBER',{action:'book',date:D(5),resource:'Vereinsheim',timeFrom:'18:00',timeTo:'23:00',requestId:'91111111-2222-3333-4444-555555555555',mode:'Geburtstagsfeier',note:'  Mustermann '});
 const l=await call('MEMBER',{action:'list',date:D(5),view:'reservierungen'}); assert.strictEqual(l.bookings[0].note,'Mustermann');
 const w=await call('ADMIN',{action:'list',date:D(5),view:'whiteboard'}); assert.strictEqual(w.bookings[0].note,'Mustermann');
 await call('MEMBER',{action:'book',date:D(6),resource:'Bahn 1',timeFrom:'18:00',timeTo:'19:00',requestId:'a1111111-2222-3333-4444-555555555555',mode:'Freies Training (Standard)',note:'x'}); assert(!('note' in store.get('reservierungBuchungstage/'+D(6)).list[0]));
 await assert.rejects(call('MEMBER',{action:'book',date:D(7),resource:'Vereinsheim',timeFrom:'18:00',timeTo:'19:00',requestId:'b1111111-2222-3333-4444-555555555555',mode:'Turnier',note:'y'.repeat(61)}),e=>e.code==='invalid-argument');
 console.log('SERVER TESTS OK');
})().catch(e=>{console.error(e);process.exit(1)});
