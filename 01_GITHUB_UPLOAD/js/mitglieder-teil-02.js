
const initial=[];const passInitial=[]
const defaults=[];
var S=JSON.parse(localStorage.getItem("ecw_state")||"null")||{members:initial,passes:passInitial,users:defaults,bank:false,sponsors:[],settings:{},dataVersion:5};
window.S=S;
S.settings=S.settings||{};
S.settings=S.settings||{};
// Zahlungsart: Bankeinzug ist Standard. Fehlen Bankdaten, wird automatisch Barzahlung verwendet.
function normalizePaymentMethod(m){
  if(!m) return;
  const hasBankData=["accountHolder","iban","bic","bank"].some(k=>String(m[k]??"").trim()!=="");
  if(!hasBankData) m.paymentMethod="cash";
  else if(m.paymentMethod!=="cash" && m.paymentMethod!=="directDebit") m.paymentMethod="directDebit";
}
(S.members||[]).forEach(normalizePaymentMethod);

Object.assign(S.settings,{roundAge:S.settings.roundAge??50,fee:S.settings.fee??16,ageU14Max:S.settings.ageU14Max??13,ageU16Max:S.settings.ageU16Max??15,ageU19Max:S.settings.ageU19Max??18,ageU23Max:S.settings.ageU23Max??22,ageSeniorMin:S.settings.ageSeniorMin??19,ageCutoff:S.settings.ageCutoff??"01-01",exportMembers:S.settings.exportMembers??true,importBank:S.settings.importBank??true,importMembers:S.settings.importMembers??false,showAZ:S.settings.showAZ??true,showMemberSince:S.settings.showMemberSince??true,showAddress:S.settings.showAddress??true,showCountryCode:S.settings.showCountryCode??true,showContact:S.settings.showContact??true,showBirthDate:S.settings.showBirthDate??true,showBirthdayFilters:S.settings.showBirthdayFilters??true,showBankButton:S.settings.showBankButton??true,displayOrder:S.settings.displayOrder??["birthDate","memberSince","address","countryCode","zip","city","phoneMobile","email"],birthdayUpcomingMonths:S.settings.birthdayUpcomingMonths??1,roundBirthdayMode:S.settings.roundBirthdayMode??"future",sponsorVatRate:S.settings.sponsorVatRate??19,sponsorTaxOffice:S.settings.sponsorTaxOffice??"",sponsorTaxNumber:S.settings.sponsorTaxNumber??"",sponsorExemptionDate:S.settings.sponsorExemptionDate??"",sponsorAssessmentYear:S.settings.sponsorAssessmentYear??"",sponsor60aOffice:S.settings.sponsor60aOffice??"",sponsor60aTaxNumber:S.settings.sponsor60aTaxNumber??"",sponsor60aDate:S.settings.sponsor60aDate??"",sponsorPurpose:S.settings.sponsorPurpose??"",sponsorLegalName:S.settings.sponsorLegalName??"EC Wegscheid",emailjsPublicKey:S.settings.emailjsPublicKey??"",emailjsServiceId:S.settings.emailjsServiceId??"",emailjsTemplateId:S.settings.emailjsTemplateId??""});
if(!Array.isArray(S.settings.displayOrder))S.settings.displayOrder=["birthDate","memberSince","address","countryCode","zip","city","phoneMobile","email"]; if(!S.settings.displayOrder.includes("countryCode")){const zi=S.settings.displayOrder.indexOf("zip"); if(zi>=0)S.settings.displayOrder.splice(zi,0,"countryCode"); else S.settings.displayOrder.push("countryCode");}
if(!Array.isArray(S.passes))S.passes=passInitial;
// Versionswechsel erhalten vorhandene Mitglieder und Spielerpässe.
if((S.dataVersion||0)<4){S.dataVersion=5;}

S.members=Array.isArray(S.members)?S.members:initial.slice();
S.sponsors=Array.isArray(S.sponsors)?S.sponsors:[];
// Falls ein älterer lokaler Zustand keine Mitglieder enthält, werden die eingebetteten Vereinsdaten wieder übernommen.
if(!S.members.length && initial.length){ S.members=initial.slice(); S.dataVersion=5; try{localStorage.setItem("ecw_state",JSON.stringify(S))}catch(e){} }
// Leere Import-/Excel-Zeilen entfernen; eine Mitgliedsnummer allein zählt nicht als Datensatz.
S.members=S.members.filter(m=>m&&[m.lastName,m.firstName,m.birthDate,m.memberSince,m.address,m.zip,m.city,m.phoneMobile,m.phoneFixed,m.email,m.accountHolder,m.iban,m.bic,m.bank,m.notes].some(v=>String(v??"").trim()!==""));
S.users=Array.isArray(S.users)?S.users:defaults.slice(); S.users.forEach(u=>{if(u.mustChangePassword===undefined)u.mustChangePassword=false;});
S.settings=S.settings||{};
Object.assign(S.settings,{
 roundAge:S.settings.roundAge??50,fee:S.settings.fee??16,
 ageU14Max:S.settings.ageU14Max??13,ageU16Max:S.settings.ageU16Max??15,ageU19Max:S.settings.ageU19Max??18,ageU23Max:S.settings.ageU23Max??22,ageSeniorMin:S.settings.ageSeniorMin??19,ageCutoff:S.settings.ageCutoff??"01-01",
 exportMembers:S.settings.exportMembers??true,importBank:S.settings.importBank??true,importMembers:S.settings.importMembers??false,
 showAZ:S.settings.showAZ??true,showMemberSince:S.settings.showMemberSince??true,showAddress:S.settings.showAddress??true,showCountryCode:S.settings.showCountryCode??true,showContact:S.settings.showContact??true,showBirthDate:S.settings.showBirthDate??true,showBirthdayFilters:S.settings.showBirthdayFilters??true,
 showBankButton:S.settings.showBankButton??true,birthdayUpcomingMonths:S.settings.birthdayUpcomingMonths??1,roundBirthdayMode:S.settings.roundBirthdayMode??"future",sponsorVatRate:S.settings.sponsorVatRate??19,sponsorTaxOffice:S.settings.sponsorTaxOffice??"",sponsorTaxNumber:S.settings.sponsorTaxNumber??"",sponsorExemptionDate:S.settings.sponsorExemptionDate??"",sponsorAssessmentYear:S.settings.sponsorAssessmentYear??"",sponsor60aOffice:S.settings.sponsor60aOffice??"",sponsor60aTaxNumber:S.settings.sponsor60aTaxNumber??"",sponsor60aDate:S.settings.sponsor60aDate??"",sponsorPurpose:S.settings.sponsorPurpose??"",sponsorLegalName:S.settings.sponsorLegalName??"EC Wegscheid",emailjsPublicKey:S.settings.emailjsPublicKey??"",emailjsServiceId:S.settings.emailjsServiceId??"",emailjsTemplateId:S.settings.emailjsTemplateId??""
});

// Ältere gespeicherte Stichtage werden einmalig in das neue Format MM-TT umgewandelt.
try{if(/^\d{4}-\d{2}-\d{2}$/.test(S.settings.ageCutoff||"")){let z=S.settings.ageCutoff.split("-");S.settings.ageCutoff=z[1]+"-"+z[2]}}catch(e){}
let U={id:"viewer",name:"Öffentlicher Zugriff",password:"",admin:false,view:true,edit:false,bank:false,export:false},eid=null,passEditId=null;
try{
 const parentUser=window.parent.firebaseAuthUser;
 const editMode=window.parent.hasAppPermission('mv');
 U={id:parentUser?.uid||'viewer',name:parentUser?.email||'Ansicht',admin:!!editMode,view:true,edit:!!editMode,bank:!!editMode,export:!!editMode};
}catch(e){}

function canManageMemberUsers(){return window.parent?.appPermissions?.admin===true;}
function canEditMemberData(){
 try{return window.parent.hasAppPermission('mv')===true;}catch(e){return false;}
}
const $=id=>document.getElementById(id), save=()=>{try{localStorage.setItem("ecw_state",JSON.stringify(S))}catch(e){console.warn("Lokales Speichern fehlgeschlagen:",e)};try{window.ecwFirebaseSave?.(S)}catch(e){console.error("Firebase-Speichern konnte nicht gestartet werden:",e)}};
function populateLoginUsers(){let sel=$("loginUser");if(!sel)return;sel.innerHTML=S.users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.id)})</option>`).join("");if(S.users.some(u=>u.id==="admin"))sel.value="admin";}
async function login(){
 const parentAuth=window.parent?.firebaseAuth; const parentUser=window.parent?.firebaseAuthUser;
 if(!parentAuth||!parentUser){$("le").textContent="Bitte zuerst in der zentralen Verwaltung anmelden.";return;}
 const perms=window.parent?.appPermissions||{};
 const editMode=window.parent.hasAppPermission('mv');
 // Dieselben Bereichsrechte wie bei der Initialisierung verwenden. Ein Mitglieder-
 // Bearbeiter benötigt keine globale Administratorrolle und darf keine neue Anmeldung auslösen.
 U={id:parentUser.uid,name:parentUser.email||parentUser.uid,password:"",admin:!!editMode,view:true,edit:!!editMode,bank:!!editMode,export:!!editMode};
 if(!editMode){rights();dashboard();updateWhiteboardNavigation();return;}
 $("adminLogin").style.display="none";if($("logoutBtn"))$("logoutBtn").style.display="inline-block";$("who").textContent=parentUser.email||parentUser.uid;rights();page(window.frameElement?.id==='mvAdminFrame'?"admin":"dashboard");
}
async function openAdminLogin(){
 if(window.parent&&window.parent!==window){window.parent.openAdminFromHome();return;}
 alert('Bitte die zentrale Benutzeranmeldung verwenden.');
}
function closeAdminLogin(){$("adminLogin").style.display="none";$("loginPass").value="";$("le").textContent=""}
function changeAdminPasswordFromSettings(){if(!canManageMemberUsers())return;let a=$("adminNewPw1").value,b=$("adminNewPw2").value;if(!U?.admin)return;if(!a||a.length<4)return alert("Das Kennwort muss mindestens 4 Zeichen haben.");if(a!==b)return alert("Die Kennwörter stimmen nicht überein.");let u=S.users.find(x=>x.id===U.id);if(!u)return;u.password=a;u.mustChangePassword=false;U=u;save();$("adminNewPw1").value="";$("adminNewPw2").value="";alert("Admin-Kennwort wurde geändert.")}
function changeOwnPassword(){if(!canManageMemberUsers())return;let a=$("newPass1").value,b=$("newPass2").value;if(!U?.admin)return;if(!a||a.length<4)return $("cpe").textContent="Das Kennwort muss mindestens 4 Zeichen haben.";if(a!==b)return $("cpe").textContent="Die Kennwörter stimmen nicht überein.";let u=S.users.find(x=>x.id===U.id);if(!u)return;u.password=a;u.mustChangePassword=false;U=u;save();$("changePasswordModal").style.display="none";page("admin");admin();alert("Kennwort wurde geändert.")}
function logout(){
 window.memberEditMode=false;
 U={id:"viewer",name:"Öffentlicher Zugriff",password:"",admin:false,view:true,edit:false,bank:false,export:false};
 $("who").textContent="";
 rights();
 if($("logoutBtn"))$("logoutBtn").style.display="none";
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 $("dashboard")?.classList.add("active");
 {const mb=$("mainMenuBtn");if(mb)mb.style.display="none";}
 document.querySelectorAll("[data-p]").forEach(x=>x.classList.toggle("primary",x.dataset.p==="dashboard"));
 dashboard();
 updateWhiteboardNavigation();
 updateAdminAuthButton();
 window.scrollTo({top:0,behavior:"smooth"});
}
function rights(){$('admin').style.display='';if($("logoutBtn"))$("logoutBtn").style.display=U?.admin?"inline-block":"none"};updateWhiteboardNavigation()
function ensureAdmin(){
 if(!canEditMemberData()){alert('Für diesen Benutzer ist die Mitgliederbearbeitung nicht freigegeben.');return false;}
 U.admin=true;U.edit=true;U.bank=true;U.export=true;
 return true;
}

function updateAdminAuthButton(){
 const btn=document.getElementById("adminAuthBtn"),lo=document.getElementById("logoutBtn");
 if(btn)btn.style.setProperty('display','none','important');
 if(lo)lo.style.setProperty('display','none','important');
}

function toggleAdminLogin(){
 if(typeof openAdminLogin==="function") return openAdminLogin();
 alert("Die Admin-Anmeldung ist in dieser Version nicht verfügbar.");
}
function toggleAdminLogout(){
 logout();
}

function updateWhiteboardNavigation(){
 const admin=!!U?.admin;
 document.querySelectorAll('[data-p="passes"],[data-p="admin"],[data-p="serial"]').forEach(el=>el.style.display=admin?'':'none');
 const active=document.querySelector('.page.active')?.id;
 if(!admin && ['passes','admin','serial'].includes(active)){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active')); $('dashboard')?.classList.add('active'); const mb=$('mainMenuBtn'); if(mb)mb.style.display='none';}
 updateAdminAuthButton();
}

function page(p){
 // Beim erneuten Oeffnen der Spielerpass-Uebersicht keine alten Suchfilter uebernehmen.
 // Kein Reset waehrend der Eingabe und keine Datenbank-Aenderung.
 if(p==="membersPasses"){
   const search=document.getElementById('mpq');if(search){search.value='';search.setAttribute('readonly','');search.setAttribute('autocomplete','off');}
   const group=document.getElementById('mpg');if(group)group.value='';
   window.mpLetter='';
 }
 checkExpiredNonRenewalPasses();
 updateWhiteboardNavigation();
 if(["admin","passes","serial"].includes(p)&&!U?.admin){openAdminLogin();return}
 {const mb=$("mainMenuBtn");if(mb)mb.style.display=(p==="dashboard")?"none":"";}
 // Seitenwechsel darf niemals auf Firebase warten. Zuerst die gewünschte Seite anzeigen,
 // danach wird der aktuelle Firebase-Stand im Hintergrund geladen und die Seite aktualisiert.
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 $(p)?.classList.add("active");
 document.querySelectorAll("[data-p]").forEach(x=>x.classList.toggle("primary",x.dataset.p===p));
 renderCurrentPage(p);
 window.scrollTo({top:0,behavior:"smooth"});
 if(window.ecwFirebaseRefresh){
   Promise.resolve(window.ecwFirebaseRefresh()).then(ok=>{
     if(ok){
       renderCurrentPage(p);
       window.scrollTo({top:0,behavior:"smooth"});
     }
   }).catch(e=>console.warn("Firebase-Aktualisierung beim Seitenwechsel fehlgeschlagen:",e));
 }
}
function renderCurrentPage(p){
 all();
 if(p==="members")renderM();
 if(p==="membersPasses")renderMembersPasses();
 if(p==="passes")renderPasses();
 if(p==="birthdays")calendar();
 if(p==="admin")admin();
 if(p==="serial")renderSerialMembers();
}
function all(){if(!Array.isArray(S.sponsors))S.sponsors=[];S.members=S.members.filter(m=>m&&[m.lastName,m.firstName,m.birthDate,m.memberSince,m.address,m.zip,m.city,m.phoneMobile,m.phoneFixed,m.email,m.accountHolder,m.iban,m.bic,m.bank,m.notes].some(v=>String(v??"").trim()!==""));dashboard();renderM();renderMembersPasses();renderPasses();calendar();if(U?.admin)admin()}
function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function fmtDate(d){return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear()}
function fd(s){if(!s)return "";const d=new Date(s+"T00:00:00");return isNaN(d)?String(s):fmtDate(d)}
// ===== Datumsfelder: Eingabe und Anzeige als TT/MM/JJJJ =====
function isoToDisp(v){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||"");return m?m[3]+"/"+m[2]+"/"+m[1]:""}
function dispToIso(t){
 const m=/^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\s*$/.exec(String(t||""));
 if(!m)return "";
 const d=+m[1],mo=+m[2],y=+m[3],dt=new Date(y,mo-1,d);
 if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return "";
 return y+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0");
}
function enhanceDateInput(inp){
 if(!inp||inp.dataset.ecwDate)return;
 inp.dataset.ecwDate="1";
 try{
  const desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
  const rawGet=()=>desc.get.call(inp),rawSet=v=>desc.set.call(inp,v);
  const wrap=document.createElement("span");
  wrap.style.cssText="display:flex;gap:6px;align-items:center;position:relative";
  const txt=document.createElement("input");
  txt.type="text";txt.inputMode="numeric";txt.maxLength=10;txt.placeholder="TT/MM/JJJJ";txt.autocomplete="off";
  txt.className=inp.className;txt.style.cssText="flex:1 1 auto;min-width:0";
  if(inp.disabled)txt.disabled=true;
  if(inp.readOnly)txt.readOnly=true;
  const btn=document.createElement("button");
  btn.type="button";btn.className="btn";btn.textContent="📅";btn.title="Kalender öffnen";btn.style.cssText="padding:6px 8px;flex:0 0 auto";
  inp.parentNode.insertBefore(wrap,inp);
  wrap.append(txt,btn,inp);
  inp.style.cssText="position:absolute;left:0;bottom:0;width:100%;height:0;opacity:0;pointer-events:none;border:0;padding:0;margin:0";
  inp.tabIndex=-1;inp.setAttribute("aria-hidden","true");
  let busy=false;
  const show=()=>{txt.value=isoToDisp(rawGet());txt.style.outline="";txt.title=""};
  Object.defineProperty(inp,"value",{configurable:true,get:rawGet,set(v){rawSet(v);show()}});
  show();
  txt.addEventListener("input",()=>{
   let t=txt.value;const full=dispToIso(t);
   if(full)t=isoToDisp(full);
   else{const d=t.replace(/\D/g,"").slice(0,8);t=d.slice(0,2)+(d.length>2?"/"+d.slice(2,4):"")+(d.length>4?"/"+d.slice(4):"")}
   if(t!==txt.value)txt.value=t;
   const v=t.length===10?dispToIso(t):"";
   rawSet(v);
   txt.style.outline=(t.length===10&&!v)?"2px solid #d00000":"";
   busy=true;
   try{inp.dispatchEvent(new Event("input",{bubbles:true}));inp.dispatchEvent(new Event("change",{bubbles:true}))}finally{busy=false}
  });
  txt.addEventListener("blur",()=>{if(txt.value&&!rawGet()){txt.style.outline="2px solid #d00000";txt.title="Bitte ein gültiges Datum im Format TT/MM/JJJJ eingeben."}});
  inp.addEventListener("change",()=>{if(!busy)show()});
  btn.addEventListener("click",()=>{try{if(inp.showPicker)inp.showPicker();else inp.click()}catch(e){}});
 }catch(e){console.warn("Datumsfeld konnte nicht umgestellt werden:",e)}
}
function enhanceAllDateInputs(){
 try{document.querySelectorAll('input[type="date"]:not([data-ecw-date])').forEach(enhanceDateInput)}catch(e){}
}
try{new MutationObserver(enhanceAllDateInputs).observe(document.documentElement,{childList:true,subtree:true})}catch(e){}
window.addEventListener("load",enhanceAllDateInputs);
enhanceAllDateInputs();
function age(s,y=new Date().getFullYear()){if(!s)return null;return y-new Date(s+"T00:00:00").getFullYear()}
function round(m,y){let a=age(m.birthDate,y),start=+S.settings.roundAge||50;return a&&a>=start&&a%10===0}
function next(s){let d=new Date(s+"T00:00:00"),n=new Date(),x=new Date(n.getFullYear(),d.getMonth(),d.getDate());if(x<new Date(n.getFullYear(),n.getMonth(),n.getDate()))x.setFullYear(x.getFullYear()+1);return x}
function contributionExempt(m,y=new Date().getFullYear()){
 const limit=Math.max(0,+S.settings?.contributionFreeAge||18);
 if(!m?.birthDate)return false;
 const b=new Date(m.birthDate+"T00:00:00"),cutoff=new Date(y,0,1);
 let a=y-b.getFullYear();
 if(cutoff.getMonth()<b.getMonth() || (cutoff.getMonth()===b.getMonth() && cutoff.getDate()<b.getDate())) a--;
 return a<limit;
}
function contributionExemptUntil(m){
 // Letzter Tag der Beitragsbefreiung (31.12. des letzten befreiten Jahres) laut Regel in contributionExempt()
 if(!m?.birthDate)return "";
 const y0=new Date().getFullYear();
 if(!contributionExempt(m,y0))return "";
 let y=y0;
 while(y<y0+100&&contributionExempt(m,y+1))y++;
 return y+"-12-31";
}
function dashboard(){
 let y=new Date().getFullYear(),now=new Date(),active=S.members.filter(m=>m.exitType!=="departed"&&m.exitType!=="deceased");
 let a=active.filter(m=>m.birthDate).map(m=>({...m,n:next(m.birthDate)})).sort((a,b)=>a.n-b.n);
 let yearStart=y+"-01-01",yearEnd=(y+1)+"-01-01";
 if($("yearDeparted"))$("yearDeparted").textContent=y;if($("yearDeceased"))$("yearDeceased").textContent=y;$("s1").textContent=active.length;
 $("sPay").textContent=active.filter(m=>!contributionExempt(m,y)).length;
 $("s2").textContent=(active.filter(m=>{let key=`${(m.lastName||"").toLowerCase()}|${(m.firstName||"").toLowerCase()}`;return (S.passes||[]).some(p=>`${(p.lastName||"").toLowerCase()}|${(p.firstName||"").toLowerCase()}`===key);}).length);
 $("s3").textContent=active.filter(m=>round(m,y)).length;
 $("s4").textContent=active.filter(m=>+m.memberSince>=2020).length;$("s7").textContent=active.filter(m=>+m.memberSince>=2010).length;
 let upcomingMonths=Math.max(1,Math.min(12,+S.settings?.birthdayUpcomingMonths||1));
 let upcomingEnd=new Date(now.getFullYear(),now.getMonth()+upcomingMonths,now.getDate(),23,59,59,999);
 let normal=active.filter(m=>m.birthDate).map(m=>({...m,n:next(m.birthDate)})).filter(m=>!round(m,m.n.getFullYear())&&m.n>=now&&m.n<=upcomingEnd).sort((a,b)=>a.n-b.n);
 let currentYearBirthdays=active.filter(m=>m.birthDate).map(m=>({...m,n:next(m.birthDate),bd:new Date(y,+m.birthDate.slice(5,7)-1,+m.birthDate.slice(8,10))})).filter(m=>m.bd.getFullYear()===y);
 currentYearBirthdays.sort((a,b)=>a.bd-b.bd);
 let runde=currentYearBirthdays.filter(m=>round(m,y));
 if(S.settings?.roundBirthdayMode==='next6'){
   const nextYearBirthdays=active.filter(m=>m.birthDate).map(m=>({...m,bd:new Date(y+1,+m.birthDate.slice(5,7)-1,+m.birthDate.slice(8,10))})).filter(m=>round(m,y+1));
   runde=runde.concat(nextYearBirthdays);
 }
 runde=memberFilterRoundBirthdays(runde,now,S.settings).sort((a,b)=>a.bd-b.bd);
 $("birthdayUpcomingInfo").textContent=`Angezeigt werden die nächsten ${upcomingMonths} ${upcomingMonths===1?"Monat":"Monate"}.`;
 $("next").innerHTML=normal.map(m=>`<div class="birthdayRow"><b>${esc(m.firstName)} ${esc(m.lastName)}</b> <span class="muted">${fd(m.birthDate)} · ${age(m.birthDate,m.n.getFullYear())} Jahre</span></div>`).join("")||"Keine Geburtstage im gewählten Zeitraum.";
 $("roundNext").innerHTML=runde.map(m=>`<div class="birthdayRow"><b>${esc(m.firstName)} ${esc(m.lastName)} 🎉</b> <span class="muted">${fd(m.birthDate)} · ${age(m.birthDate,m.bd.getFullYear())} Jahre</span></div>`).join("")||"Keine runden Geburtstage eingetragen.";
 $("s5").textContent=S.members.filter(m=>m.exitType==="departed"&&m.exitDate>=yearStart&&m.exitDate<yearEnd).length;
 $("s6").textContent=S.members.filter(m=>m.exitType==="deceased"&&m.exitDate>=yearStart&&m.exitDate<yearEnd).length;
}
function ageAtDate(birthDate,cutoff,year){if(!birthDate)return null;let b=new Date(birthDate+"T00:00:00"),now=new Date(),y=year||now.getFullYear(),raw=String(cutoff||"01-01");let mm,dd;if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){let z=raw.split("-");mm=+z[1];dd=+z[2]}else if(/^\d{2}-\d{2}$/.test(raw)){let z=raw.split("-");mm=+z[0];dd=+z[1]}else{let z=raw.match(/^(\d{1,2})[.\/-](\d{1,2})/);mm=z?+z[2]:1;dd=z?+z[1]:1}let c=new Date(y,mm-1,dd);let a=y-b.getFullYear();if(c<new Date(y,b.getMonth(),b.getDate()))a--;return a}
const PASS_GROUPS=["U14","U16","U19","U23","Herren","Damen","Senioren"];
function passGroups(p){
 let a=Array.isArray(p?.passportGroups)?p.passportGroups.slice():String(p?.passportGroup||"").split(/[,;|]+/).map(x=>x.trim()).filter(Boolean);
 a=a.map(x=>x.replace(/^Jugend\s+/i,"")).filter(x=>PASS_GROUPS.includes(x));
 return [...new Set(a)];
}
function setPassGroups(p,a){let g=[...new Set((a||[]).filter(x=>PASS_GROUPS.includes(x)))]; if(g.includes("U14")&&g.includes("Herren")) throw new Error("U14 und Herren dürfen nicht gleichzeitig ausgewählt werden."); p.passportGroups=g; p.passportGroup=g.join(", ");}
// Saisonen: Sommersaison 01.04.–30.09., Wintersaison 01.10.–31.03.
// Bezugsjahr für die Altersberechnung (Stichtag laut Einstellung) = Jahr, in dem die Saison endet.
function seasonInfo(d=new Date()){
 const y=d.getFullYear(),m=d.getMonth()+1;
 if(m>=4&&m<=9)return {type:"Sommer",start:new Date(y,3,1),end:new Date(y,8,30),refYear:y};
 if(m>=10)return {type:"Winter",start:new Date(y,9,1),end:new Date(y+1,2,31),refYear:y+1};
 return {type:"Winter",start:new Date(y-1,9,1),end:new Date(y,2,31),refYear:y};
}
function nextSeasonInfo(s=seasonInfo()){
 const d=new Date(s.end.getFullYear(),s.end.getMonth(),s.end.getDate()+1);
 return seasonInfo(d);
}
function seasonLabel(s){
 const f=fmtDate;
 return (s.type==="Sommer"?"Sommersaison ":"Wintersaison ")+f(s.start)+" – "+f(s.end);
}
function calculatedPassGroups(p,year){
 let a=ageAtDate(p.birthDate,S.settings.ageCutoff,year);
 if(a===null)return [];
 // Die aktuelle Passliste enthält zuerst die Herren und danach die Damen.
 // Für diese eingebettete Vereinsliste sind die Datensätze 68–86 Damen.
 const female=Number(p.id)>=68 && Number(p.id)<=86;
 let g=[];
 if(a<=S.settings.ageU14Max){
   g=["U14","U16","U19","U23"];
 }else if(a<=S.settings.ageU16Max){
   g=["U16","U19","U23"];
 }else if(a<=S.settings.ageU19Max){
   g=["U19","U23"];
 }else if(a<=S.settings.ageU23Max){
   g=["U23"];
 }
 if(a>=16)g.push(female?"Damen":"Herren");
 if(!female && a>50)g.push("Senioren");
 return [...new Set(g)];
}
function repairPassGroups(){
 if((S.passGroupDataVersion||0)>=2)return false;
 let changed=false;
 (S.passes||[]).forEach(p=>{
   let g=calculatedPassGroups(p);
   if(!g.length)return;
   let value=g.join(", ");
   if(p.passportGroup!==value || !Array.isArray(p.passportGroups) || p.passportGroups.join(", ")!==value){
     p.passportGroups=g;
     p.passportGroup=value;
     changed=true;
   }
 });
 S.passGroupDataVersion=2;
 try{localStorage.setItem("ecw_state",JSON.stringify(S))}catch(e){}
 if(changed)try{window.ecwFirebaseSave?.(S)}catch(e){}
 return changed;
}
window.ecwRepairPassGroups=repairPassGroups;

function refreshPassGroupsByAgeSettings(){
 let changed=false;
 (S.passes||[]).forEach(p=>{
   let g=calculatedPassGroups(p); if(!g.length)return;
   let value=g.join(', ');
   if(p.passportGroup!==value||!Array.isArray(p.passportGroups)||p.passportGroups.join(', ')!==value){p.passportGroups=g;p.passportGroup=value;changed=true;}
 });
 const nameSync=syncAllPassNames();
 changed=changed||nameSync.changed>0;
 if(changed){try{localStorage.setItem('ecw_state',JSON.stringify(S))}catch(e){};try{window.ecwFirebaseSave?.(S)}catch(e){console.warn('Firebase-Speicherung der Spielerpässe fehlgeschlagen:',e)}}
 renderPasses();renderMembersPasses();dashboard();
 return {changed,nameSync};
}
function updatePassesNow(){
 if(!ensureAdmin())return;
 if(!U?.admin)return alert('Keine Admin-Berechtigung.');
 const result=refreshPassGroupsByAgeSettings();
 const n=result?.nameSync||{changed:0,linked:0,ambiguous:0};
 alert('Spielerpässe aktualisiert.\n\nNamens-/Mitgliedszuordnungen geändert: '+n.changed+'\nNeu verknüpft: '+n.linked+'\nMehrdeutige Zuordnungen: '+n.ambiguous+'\n\nDie Änderungen wurden in Firebase gespeichert.');
}
window.ecwRefreshPassGroupsByAgeSettings=refreshPassGroupsByAgeSettings;

repairPassGroups();
checkExpiredNonRenewalPasses();

function passGroupMatches(p,g){return !g||passGroups(p).includes(g);}
function passGroupFor(p){let a=ageAtDate(p.birthDate,S.settings.ageCutoff);if(a===null)return "";if(a<=S.settings.ageU14Max)return "U14";if(a<=S.settings.ageU16Max)return "U16";if(a<=S.settings.ageU19Max)return "U19";if(a<=S.settings.ageU23Max)return "U23";return "";}
function passportClass(p){if(!p||!p.passportExpiry)return "";let d=new Date(p.passportExpiry+"T00:00:00"),t=new Date(),six=new Date(t.getFullYear(),t.getMonth()+6,t.getDate());return d<t?"expired":d<=six?"warn":"passok"}
function memberCountryCode(v){const x=String(v||"").trim().toLowerCase();if(x==="deutschland"||x==="germany"||x==="d")return "D";if(x==="österreich"||x==="oesterreich"||x==="austria"||x==="a")return "A";return String(v||"").trim();}
function renderM(){
 let a=(S.members||[]).slice(),q=($("q")?.value||"").toLowerCase(),f=+$("sf")?.value||0,t=+$("st")?.value||9999,b=$("bf")?.value||"";
 a=a.filter(m=>(!q||[m.firstName,m.lastName,m.city,m.email,m.id].join(" ").toLowerCase().includes(q))&&(+m.memberSince||0)>=f&&(+m.memberSince||9999)<=t);
 if(b==="round")a=a.filter(m=>round(m,new Date().getFullYear()));
 if(b==="10")a=a.filter(m=>(age(m.birthDate)||0)%10===0);
 if(b==="18")a=a.filter(m=>(age(m.birthDate)||0)>=18);
 if(b==="exempt")a=a.filter(m=>contributionExempt(m,new Date().getFullYear()));
 a.sort((x,y)=>(x.lastName||"").localeCompare(y.lastName||"","de"));
 const has=k=>a.some(m=>String((k==='countryCode'?m.country:m[k])??"").trim()!=="");
 const labels=memberDisplayLabels();
 const cols=[["Nr.","id"]];
 const hasStatus=a.some(m=>m.exitType==="departed"||m.exitType==="deceased");
 if(hasStatus)cols.push(["Status","exitStatus"]);
 const order=memberDisplayOrder();
 order.forEach(k=>{if(labels[k]&&memberFieldVisible(k)&&has(k)&&(!memberSensitiveFields.has(k)||U?.bank))cols.push([labels[k],k]);});
 if(a.some(m=>!m.exitType&&contributionExemptUntil(m)))cols.push(["Beitragsbefreit bis","exemptUntil"]);
 const canEditMembers=canEditMemberData();
 if(canEditMembers)cols.unshift(["Bearbeiten","act"]);
 $("memberTableArea").innerHTML=`<div style="display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:7px;align-items:start"><div class="tablewrap" style="margin-top:10px"><table class="table memberTableStrong"><thead id="mh"></thead><tbody id="mb"></tbody></table></div><div id="letters" style="position:sticky;top:90px;display:flex;flex-direction:column;gap:2px"></div></div>`;
 $("mh").innerHTML="<tr>"+cols.map(x=>`<th>${x[0]}</th>`).join("")+"</tr>";
 $("mb").innerHTML=a.map(m=>"<tr>"+cols.map(x=>{
   if(x[1]==="exitStatus")return `<td>${m.exitType==="deceased"?"Verstorben":m.exitType==="departed"?"Ausgetreten – auf eigenen Wunsch":"Aktiv"}${m.exitDate?`<br><span class="muted">${fd(m.exitDate)}</span>`:""}</td>`;
   if(x[1]==="exemptUntil")return `<td>${m.exitType?"":esc(fd(contributionExemptUntil(m)))}</td>`;
   if(x[1]==="act")return `<td><button class="btn" onclick="editM(${esc(JSON.stringify(m.id))})">Bearbeiten</button></td>`;
   let cellValue=x[1]==="birthDate"?fd(m[x[1]]):m[x[1]]; if(x[1]==="countryCode")cellValue=memberCountryCode(m.country);if(["birthDate","exitDate","exemptUntil"].includes(x[1]))cellValue=fd(m[x[1]]); return `<td>${esc(cellValue)}</td>`;
 }).join("")+"</tr>").join("")||`<tr><td colspan="${cols.length}">Keine Treffer</td></tr>`;
 let tools="";
 if(S.settings.showBankButton&&U?.bank)tools+='<button class="btn" onclick="toggleBank()">Bankdaten ein-/ausblenden</button> ';
 tools+='<button class="btn" onclick="printMembers()">Gesamtliste drucken</button> <button class="btn" onclick="printRound()">Runde Geburtstage drucken</button>';
 $("memberTools").innerHTML=tools+` <span class="muted"> · ${a.length} Treffer</span>`;
 $("birthdayFilterBox").style.display=S.settings.showBirthdayFilters?"":"none";
 {const t=$("membersTitle"),nb=$("newMemberBtn");if(t)t.textContent=canEditMembers?"Mitglieder bearbeiten":"Mitglieder";if(nb)nb.style.display=canEditMembers?"":"none";}
 $("letters").style.display=S.settings.showAZ?"flex":"none";
 if(S.settings.showAZ)$("letters").innerHTML="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l=>`<button class="btn" style="padding:2px 5px" onclick="jumpLetter('${l}')">${l}</button>`).join("");
}
function jumpLetter(l){let r=[...document.querySelectorAll("#mb tr")].find(x=>(x.children[1]?.textContent||"").trim().toUpperCase().startsWith(l));if(r)r.scrollIntoView({behavior:"smooth",block:"center"})}
function renderMembersPasses(){
 // Defensive, read-only pass overview: render records even when a derived
 // group/date calculation fails. Never mutate S or write to Firebase.
 const target=document.getElementById('mpb');
 const count=document.getElementById('memberPassCount');
 if(!target)return;
 const passes=Array.isArray(S?.passes)?S.passes:[];
 const members=Array.isArray(S?.members)?S.members:[];
 const searchField=document.getElementById('mpq');
 // Schutz gegen versehentliche Browser-Autovervollstaendigung mit dem Kiosk-Login.
 if(searchField&&String(searchField.value||'').trim().toLocaleLowerCase('de-DE')==='informationssystem@ec-wegscheid.de')searchField.value='';
 const search=String(searchField?.value||'').trim().toLocaleLowerCase('de-DE');
 const group=String(document.getElementById('mpg')?.value||'');
 const letter=String(window.mpLetter||'');
 const safe=(v)=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const memberIds=new Map(members.filter(m=>m&&m.id!=null).map(m=>[String(m.id),m]));
 const memberNames=new Map();
 for(const m of members){
   if(!m)continue;
   const k=(String(m.lastName||'').trim()+'|'+String(m.firstName||'').trim()).toLocaleLowerCase('de-DE');
   if(!memberNames.has(k))memberNames.set(k,[]);
   memberNames.get(k).push(m);
 }
 const letterBox=document.getElementById('mpLetters');
 if(letterBox){
   letterBox.style.display='flex';
   letterBox.innerHTML=['Alle',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(l=>'<button type="button" class="btn" style="padding:2px 5px;font-size:11px;line-height:1.15" onclick="filterPassMembersLetter(\''+(l==='Alle'?'':l)+'\')">'+l+'</button>').join('');
 }
 let seasonNow=null,seasonNext=null;
 try{
   seasonNow=seasonInfo();seasonNext=nextSeasonInfo(seasonNow);
   const th1=document.getElementById('mpThCur'),th2=document.getElementById('mpThNext');
   if(th1)th1.textContent='Passgruppe diese Saison ('+seasonLabel(seasonNow)+')';
   if(th2)th2.textContent='Passgruppe nächste Saison ('+seasonLabel(seasonNext)+')';
 }catch(e){console.warn('Spielerpass-Saisonberechnung:',e);}
 let unlinked=0,groupErrors=0;
 const rows=[];
 for(const p of passes){
   if(!p)continue;
   let m=p.memberId!=null?memberIds.get(String(p.memberId)):null;
   if(!m&&p.memberNo!=null)m=memberIds.get(String(p.memberNo));
   if(!m){
     const k=(String(p.lastName||'').trim()+'|'+String(p.firstName||'').trim()).toLocaleLowerCase('de-DE');
     const matches=memberNames.get(k)||[];
     if(matches.length===1)m=matches[0];
   }
   if(!m)unlinked++;
   const last=String(m?.lastName||p.lastName||'');
   const first=String(m?.firstName||p.firstName||'');
   if(search&&!((first+' '+last+' '+String(p.passportNo||'')).toLocaleLowerCase('de-DE').includes(search)))continue;
   if(letter&&!last.toLocaleUpperCase('de-DE').startsWith(letter))continue;
   let current=String(p.passportGroup||'');
   if(!current&&Array.isArray(p.passportGroups))current=p.passportGroups.join(', ');
   let next='';
   try{
     if(seasonNow&&seasonNext){
       const pp={...p,birthDate:p.birthDate||m?.birthDate};
       const cur=calculatedPassGroups(pp,seasonNow.refYear);
       const nxt=calculatedPassGroups(pp,seasonNext.refYear);
       if(cur?.length)current=cur.join(', ');
       if(nxt?.length)next=nxt.join(', ');
     }
   }catch(e){groupErrors++;console.warn('Spielerpass-Gruppenberechnung, Datensatz-ID:',p.id,e);}
   if(group&&!current.split(',').map(v=>v.trim()).includes(group)&&!next.split(',').map(v=>v.trim()).includes(group))continue;
   let expiry=String(p.passportExpiry||'');
   try{if(expiry)expiry=fd(expiry)}catch(e){}
   let status=expiry?'Gültig':'Kein Ablaufdatum';
   let passCss='';
   try{const cls=passportClass(p);passCss=cls;if(cls==='expired')status='Abgelaufen';else if(cls==='warn')status='Läuft bald ab'}catch(e){}
   rows.push({last,first,current,next,number:String(p.passportNo||''),expiry,status,passCss});
 }
 rows.sort((a,b)=>a.last.localeCompare(b.last,'de-DE')||a.first.localeCompare(b.first,'de-DE'));
 if(count)count.textContent=rows.length+' von '+passes.length+' Spielerpässen'+(unlinked?' · '+unlinked+' ohne eindeutige Mitgliedszuordnung':'')+(groupErrors?' · '+groupErrors+' Berechnungsfehler':'');
 target.innerHTML=rows.map(r=>'<tr class="'+safe(r.passCss)+'"><td>'+safe(r.last)+'</td><td>'+safe(r.first)+'</td><td>'+safe(r.current||'–')+'</td><td>'+safe(r.next||'–')+'</td><td>'+safe(r.number||'–')+'</td><td>'+safe(r.expiry||'–')+'</td><td>'+safe(r.status)+'</td></tr>').join('')||'<tr><td colspan="7">Keine Spielerpässe nach aktuellen Filtern. Bitte Suche, Passgruppe und Buchstabenfilter zurücksetzen.</td></tr>';
}

function filterPassMembersLetter(letter){
 window.mpLetter=letter||"";
 renderMembersPasses();
}
function renderPasses(){
 let a=(S.passes||[]).slice(),q=($("pq")?.value||"").toLowerCase(),g=$("pg")?.value||"",s=$("ps")?.value||"";
 a=a.filter(p=>(!q||[p.firstName,p.lastName,p.passportNo,passGroups(p).join(" ")].join(" ").toLowerCase().includes(q))&&passGroupMatches(p,g));
 a=a.filter(p=>{let cl=passportClass(p);return !s||(s==="valid"&&cl==="passok")||(s==="warn"&&cl==="warn")||(s==="expired"&&cl==="expired")||(s==="missing"&&!p.passportExpiry)});
 const pat=$("passAdminTools"); if(pat)pat.style.display=U?.admin?"block":"none"; if(pat&&U?.admin)pat.innerHTML='<button class="btn primary" type="button" onclick="updatePassesNow()">Spielerpässe aktualisieren</button> <span class="smallnote">Passgruppen und Zuordnungen aktualisieren</span>';
 let cols=[["Nr.","id"],["Name","name"],["Passgruppe","passportGroup"],["Pass-Nr.","passportNo"],["Gültig bis","passportExpiry"],["Status","status"],["","act"]];
 $("ph").innerHTML="<tr>"+cols.map(x=>`<th>${x[0]}</th>`).join("")+"</tr>";
 $("pb").innerHTML=a.map(p=>{let cl=passportClass(p),status=cl==="expired"?"Abgelaufen":cl==="warn"?"Läuft in 6 Monaten ab":cl==="passok"?"Gültig":"Kein Ablaufdatum";return "<tr>"+cols.map(x=>{
   if(x[1]==="name"){let m=p.memberId!=null?(S.members||[]).find(x=>String(x.id)===String(p.memberId)):null;return `<td><b>${esc(m?.lastName||p.lastName||"")}, ${esc(m?.firstName||p.firstName||"")}</b></td>`;}
   if(x[1]==="passportExpiry")return `<td class="${cl}">${esc(fd(p.passportExpiry))}${cl==="warn"?" ⚠":""}${cl==="expired"?" ✕":""}</td>`;
   if(x[1]==="status")return `<td class="${cl}">${status}</td>`;
   if(x[1]==="act")return `<td><button class="btn" onclick="editPass(${p.id})">Bearbeiten</button></td>`;
   return `<td>${esc(x[1]==="passportGroup"?passGroups(p).join(", "):p[x[1]])}</td>`;
 }).join("")+"</tr>"}).join("")||'<tr><td colspan="7">Keine Spielerpässe gefunden.</td></tr>';
 $("passCount").textContent=" · "+a.length+" Pässe";
}
function jumpLetter(l){let r=[...document.querySelectorAll("#mb tr")].find(x=>(x.children[1]?.textContent||"").trim().toUpperCase().startsWith(l));if(r)r.scrollIntoView({behavior:"smooth",block:"center"})}
function checkExpiredNonRenewalPasses(){
 const today=new Date(); today.setHours(0,0,0,0);
 const expired=(S.passes||[]).filter(p=>p&&p.passNotRenewed&&p.passportExpiry&&!p._expiryPrompted&&new Date(p.passportExpiry+"T00:00:00")<=today);
 expired.forEach(p=>{
   p._expiryPrompted=true;
   const name=(p.lastName||"")+", "+(p.firstName||"");
   setTimeout(()=>{
     if(confirm("Spielerpass von "+name+" ist abgelaufen und wurde als 'wird nicht verlängert' markiert.\n\nSpielerpass löschen?")){
       const i=(S.passes||[]).findIndex(x=>String(x.id)===String(p.id));
       if(i>=0){S.passes.splice(i,1);save();renderPasses();renderMembersPasses();dashboard();}
     }else{save();}
   },150);
 });
}
function populatePassMemberSelect(selectedId){
 const el=$("pxMember"); if(!el)return;
 const members=(S.members||[]).filter(m=>m&&String(m.lastName||"").trim()||String(m.firstName||"").trim()).slice().sort((a,b)=>normName(a.lastName).localeCompare(normName(b.lastName),"de-DE")||normName(a.firstName).localeCompare(normName(b.firstName),"de-DE"));
 el.innerHTML='<option value="">— Mitglied auswählen —</option>'+members.map(m=>`<option value="${esc(String(m.id))}">${esc(m.lastName||"")}, ${esc(m.firstName||"")}${m.birthDate?` · ${esc(fd(m.birthDate))}`:""}</option>`).join("");
 if(selectedId!=null)el.value=String(selectedId);
}
function passMemberChanged(){
 const el=$("pxMember"),m=el&&el.value?(S.members||[]).find(x=>String(x.id)===String(el.value)):null;
 if(m)$('pxName').textContent=(m.lastName||"")+(m.firstName?", "+m.firstName:"");
}
function editPass(id){
 if(!ensureAdmin())return;
 if(!U?.admin)return alert("Keine Admin-Berechtigung.");
 let p=(S.passes||[]).find(x=>String(x.id)===String(id)); if(!p)return;
 passEditId=id;$('passModal').style.display="";$('passModal').classList.add('show');
 let gs=passGroups(p); if(!gs.length){let auto=passGroupFor(p);if(auto)gs=[auto];}
 document.querySelectorAll('#passGroupChecks input').forEach(x=>x.checked=gs.includes(x.value));
 let selected=p.memberId!=null?String(p.memberId):"";
 if(!selected && p.memberNo!=null && (S.members||[]).some(m=>String(m.id)===String(p.memberNo)))selected=String(p.memberNo);
 if(!selected){
   const matches=(S.members||[]).filter(m=>normName(m.lastName)===normName(p.lastName)&&normName(m.firstName)===normName(p.firstName));
   if(matches.length===1)selected=String(matches[0].id);
 }
 populatePassMemberSelect(selected);
 if(selected)passMemberChanged();else $('pxName').textContent=(p.lastName||"")+(p.firstName?", "+p.firstName:"");
 $('pxNo').value=p.passportNo||"";$('pxExpiry').value=p.passportExpiry||"";$('pxNotRenewed').checked=!!p.passNotRenewed;
}
function closePass(){$('passModal').classList.remove('show');passEditId=null;}
function savePass(){
 if(!ensureAdmin())return;
 let p=(S.passes||[]).find(x=>String(x.id)===String(passEditId));if(!p)return;
 let gs=[...document.querySelectorAll('#passGroupChecks input:checked')].map(x=>x.value);
 if(gs.includes('U14')&&gs.includes('Herren'))return alert('U14 und Herren dürfen nicht gleichzeitig ausgewählt werden.');
 const memberEl=$('pxMember');
 const member=memberEl&&memberEl.value?(S.members||[]).find(m=>String(m.id)===String(memberEl.value)):null;
 if(member){
   p.memberId=member.id;
   p.lastName=member.lastName||"";
   p.firstName=member.firstName||"";
   if(member.birthDate && !p.birthDate)p.birthDate=member.birthDate;
 }
 setPassGroups(p,gs);p.passportNo=$('pxNo').value;p.passportExpiry=$('pxExpiry').value;p.passNotRenewed=$('pxNotRenewed').checked;
 save();closePass();renderPasses();renderMembersPasses();dashboard();
}
function toggleBank(){if(!ensureAdmin())return;if(!U.bank)return alert("Keine Berechtigung für Bankdaten.");S.bank=!S.bank;save();renderM()}
function newM(){
 if(!ensureAdmin())return;
 if(!U.edit)return alert("Keine Bearbeitungsberechtigung.");
 eid=null;$("mt").textContent="Neues Mitglied";$("memberEditStatus").textContent="";formM({});
 $("memberExitArea").innerHTML="";$("memberDangerArea").innerHTML="";
 $("modal").classList.add("show");
}
function editM(id){
 if(!ensureAdmin())return;
 if(!U.edit)return alert("Keine Bearbeitungsberechtigung.");
 eid=id;let m=S.members.find(x=>String(x.id)===String(id));
 if(!m)return alert("Mitglied nicht gefunden. Bitte die Liste aktualisieren.");
 eid=m.id;
 $("mt").textContent="Mitglied bearbeiten";$("memberEditStatus").textContent="";formM(m);
 $("memberExitArea").innerHTML=`
 <div class="card" style="margin-top:12px">
   <h3>Status / Austritt</h3>
   <div class="formgrid">
    <div class="field"><label>Status</label><select id="x_exitType" onchange="toggleExitDate()">
      <option value="" ${!m.exitType?"selected":""}>Aktiv</option>
      <option value="departed" ${m.exitType==="departed"?"selected":""}>Ausgetreten – auf eigenen Wunsch</option>
      <option value="deceased" ${m.exitType==="deceased"?"selected":""}>Verstorben</option>
    </select></div>
    <div class="field" id="exitDateField"><label>Datum</label><input id="x_exitDate" type="date" value="${esc(m.exitDate||"")}"></div>
   </div>
   <div class="smallnote">Bei „Ausgetreten“ wird zusätzlich „Auf eigenen Wunsch“ hinterlegt. Das Datum wird in der Übersicht gezählt und bleibt beim Mitglied gespeichert.</div>
 </div>`;
 $("memberDangerArea").innerHTML=`<button class="btn danger" onclick="deleteM(${esc(JSON.stringify(m.id))})">Löschen</button>`;
 toggleExitDate();
 $("modal").classList.add("show");
}
function toggleExitDate(){
 let s=$("x_exitType"),f=$("exitDateField");if(s&&f)f.style.display=s.value?"":"none";
}
function deleteM(id){
 if(!ensureAdmin())return;
 if(!U.edit)return alert("Keine Bearbeitungsberechtigung.");
 let m=S.members.find(x=>String(x.id)===String(id));if(!m)return;
 if(!confirm(`Mitglied ${m.lastName || ""} ${m.firstName || ""} wirklich endgültig löschen?`))return;
 S.members=S.members.filter(x=>String(x.id)!==String(id));save();closeM();all(); populateLoginUsers();
}
function closeM(){$("modal").classList.remove("show")}
function formM(m){
 normalizePaymentMethod(m);
 let f=[["Nachname","lastName"],["Vorname","firstName"],["Geburtsdatum","birthDate","date"],["Mitglied seit","memberSince","number"],["Adresse","address"],["Land","country"],["PLZ","zip"],["Ort","city"],["Mobil","phoneMobile"],["Festnetz","phoneFixed"],["E-Mail","email"],["Kontoinhaber","accountHolder"],["IBAN","iban"],["BIC","bic"],["Kreditinstitut","bank"],["Notizen","notes","textarea"]];
 $("mf").innerHTML=f.map(x=>`<div class="field ${x[1]==="notes"?"full":""}"><label>${x[0]}</label>${x[2]==="textarea"?`<textarea id="x_${x[1]}">${esc(m[x[1]]||"")}</textarea>`:`<input id="x_${x[1]}" type="${x[2]||"text"}" value="${esc(m[x[1]]||"")}">`}</div>`).join("");
 $("mf").insertAdjacentHTML("beforeend",`<div class="field full"><label>Zahlungsart</label><select id="x_paymentMethod"><option value="directDebit" ${m.paymentMethod==="directDebit"?"selected":""}>Automatischer Bankeinzug</option><option value="cash" ${m.paymentMethod==="cash"?"selected":""}>Barzahler</option></select><div class="smallnote">Ohne Bankdaten wird automatisch „Barzahler“ eingestellt.</div></div>`);
}
function normName(v){return String(v??"").trim().toLocaleLowerCase("de-DE").replace(/\s+/g," ");}
function syncPassNamesForMember(member, oldMember){
  if(!member || !Array.isArray(S.passes)) return 0;
  let changed=0;
  const mid=String(member.id);
  const oldLast=normName(oldMember?.lastName), oldFirst=normName(oldMember?.firstName);
  for(const p of S.passes){
    const linked = p.memberId!=null && String(p.memberId)===mid;
    const oldName = oldMember && normName(p.lastName)===oldLast && normName(p.firstName)===oldFirst;
    const memberNo = p.memberNo!=null && String(p.memberNo)===mid;
    if(linked || oldName || memberNo){
      if(String(p.memberId??"")!==mid){p.memberId=member.id;changed++;}
      if(String(p.lastName||"")!==String(member.lastName||"")){p.lastName=member.lastName||"";changed++;}
      if(String(p.firstName||"")!==String(member.firstName||"")){p.firstName=member.firstName||"";changed++;}
    }
  }
  return changed;
}
function syncAllPassNames(){
  if(!Array.isArray(S.passes)||!Array.isArray(S.members)) return {changed:0,linked:0,ambiguous:0};
  let changed=0,linked=0,ambiguous=0;
  const byId=new Map(S.members.map(m=>[String(m.id),m]));
  const exact=new Map(), births=new Map();
  for(const m of S.members){
    const k=normName(m.lastName)+'|'+normName(m.firstName);
    if(!exact.has(k))exact.set(k,[]); exact.get(k).push(m);
    if(m.birthDate){if(!births.has(m.birthDate))births.set(m.birthDate,[]);births.get(m.birthDate).push(m);}
  }
  for(const p of S.passes){
    let m=null;
    if(p.memberId!=null)m=byId.get(String(p.memberId));
    if(!m&&p.memberNo!=null)m=byId.get(String(p.memberNo));
    if(!m&&p.birthDate){const b=births.get(p.birthDate)||[];if(b.length===1)m=b[0];else if(b.length>1)ambiguous++;}
    if(!m){const matches=exact.get(normName(p.lastName)+'|'+normName(p.firstName))||[];if(matches.length===1)m=matches[0];else if(matches.length>1)ambiguous++;}
    if(m){
      const wasLinked=String(p.memberId??'')===String(m.id);
      if(!wasLinked){p.memberId=m.id;changed++;linked++;}
      if(String(p.lastName||'')!==String(m.lastName||'')){p.lastName=m.lastName||'';changed++;}
      if(String(p.firstName||'')!==String(m.firstName||'')){p.firstName=m.firstName||'';changed++;}
      if(m.birthDate&&String(p.birthDate||'')!==String(m.birthDate)){p.birthDate=m.birthDate;changed++;}
    }
  }
  return {changed,linked,ambiguous};
}
window.ecwSyncAllPassNames=syncAllPassNames;

async function saveM(){
 if(!ensureAdmin())return;
 if(!U.edit)return alert("Keine Bearbeitungsberechtigung.");
 let ks=["lastName","firstName","birthDate","memberSince","address","country","zip","city","phoneMobile","phoneFixed","email","accountHolder","iban","bic","bank","notes"],m={};
 ks.forEach(k=>m[k]=$("x_"+k).value);
 m.paymentMethod=$("x_paymentMethod")?.value||"directDebit";
 // Ohne hinterlegte Bankdaten ist ein automatischer Bankeinzug nicht möglich.
 normalizePaymentMethod(m);
 if(!m.lastName&&!m.firstName)return alert("Bitte Name eingeben.");
 let old=null;
 if(eid===null){
   m.id=Math.max(0,...S.members.map(x=>Number(x.id)||0))+1;
   m.exitType="";m.exitDate="";
   S.members.push(m);
 }else{
   old=S.members.find(x=>String(x.id)===String(eid))||null;
   m={...old,...m,id:eid};
   const exitTypeEl=$("x_exitType");
   const exitDateEl=$("x_exitDate");
   // Leere Werte sind bewusst gültig: damit kann „Verstorben“ wieder
   // auf „Aktiv“ gesetzt und ein falsches Austrittsdatum gelöscht werden.
   m.exitType=exitTypeEl ? exitTypeEl.value : (old?.exitType ?? "");
   m.exitDate=exitDateEl ? exitDateEl.value : (old?.exitDate ?? "");
   const idx=S.members.findIndex(x=>String(x.id)===String(eid));
   if(idx>=0)S.members[idx]=m;
 }
 // Entscheidend: der bisherige Datensatz wird vor der Namensänderung an die
 // Synchronisierung übergeben. Dadurch funktionieren auch Änderungen wie
 // „Dobretzberger“ → „Dobretsberger“ und „Schaubschläger“ → „Hirz“.
 syncPassNamesForMember(m, old);
 const status=$("memberEditStatus");
 if(status)status.textContent='Änderungen werden in Firebase gespeichert …';
 try{
   if(typeof window.ecwFirebaseSave!=='function')throw new Error('Firebase wird noch geladen. Bitte kurz warten.');
   const ok=await window.ecwFirebaseSave(S);
   if(!ok)throw window.ecwFirebaseError||new Error('Speichern fehlgeschlagen.');
   try{localStorage.setItem('ecw_state',JSON.stringify(S));}catch(e){}
   if(status)status.textContent='';closeM();all();
 }catch(e){if(status)status.textContent='Speichern fehlgeschlagen: '+e.message;}
}
function calendar(){
 const base=new Date();base.setDate(1);
 let out="";
 for(let k=0;k<12;k++){
   let st=new Date(base.getFullYear(),base.getMonth()+k,1),y=st.getFullYear(),mo=st.getMonth(),days=new Date(y,mo+1,0).getDate();
   let title=st.toLocaleDateString("de-DE",{month:"long",year:"numeric"});
   out+=`<div class="calendarMonth" id="calmonth-${k}"><h3>${title}</h3><div class="calendarGrid">`;
   ["So","Mo","Di","Mi","Do","Fr","Sa"].forEach(x=>out+=`<div class="day"><b>${x}</b></div>`);
   for(let i=0;i<st.getDay();i++)out+=`<div class="day"></div>`;
   for(let d=1;d<=days;d++){
     let md=String(mo+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
     let hits=S.members.filter(m=>!m.exitType&&m.birthDate?.slice(5)===md);
     out+=`<div class="day"><b>${String(d).padStart(2,"0")}.${String(mo+1).padStart(2,"0")}.</b>${hits.map(m=>`<span class="birthday">${esc(m.firstName)} ${esc(m.lastName)}${round(m,y)?" 🎉":""}<br>${age(m.birthDate,y)} Jahre<br><button class="btn" onclick="msg(${m.id})">Nachricht</button></span>`).join("")}</div>`;
   }
   out+="</div></div>";
 }
 $("cal").innerHTML=out;
 setTimeout(()=>{$("calmonth-0")?.scrollIntoView({behavior:"smooth",block:"start"})},0);
}
function closeProgram(){try{window.open("","_self");window.close()}catch(e){}setTimeout(()=>{document.body.innerHTML='<div style="font-family:Arial;padding:40px;text-align:center"><h2>EC Wegscheid</h2><p>Das Programm wurde beendet. Dieses Fenster kann jetzt geschlossen werden.</p></div>'},100)}
function backToStartPage(){
 // Eingebettet in das Vereins-Informationssystem: zurück zur Startseite (1. Ebene) der Elternseite
 if(window.parent&&window.parent!==window){window.parent.postMessage("ecw-home","*");return;}
 // Programm beenden: Fenster/Tab schließen, damit man wieder dort landet, von wo die Datei gestartet wurde (z. B. Windows-Explorer)
 var b='https://ecwegscheid.github.io/Informationsverwaltung/';try{b=(localStorage.getItem('verein_base_url')||'').trim()||b}catch(e){}
 location.href=b.split('#')[0]+'#startseite';
}
function currentCalendar(){$("calmonth-0")?.scrollIntoView({behavior:"smooth",block:"start"});}
function msg(id){let m=S.members.find(x=>x.id===id),text=`Hallo ${m.firstName}, der EC Wegscheid wünscht dir alles Gute zum Geburtstag! 🎉`,html="";if(m.phoneMobile){let p=m.phoneMobile.replace(/[^0-9+]/g,"");html+=`<a class="btn primary" target="_blank" href="https://wa.me/${encodeURIComponent(p)}?text=${encodeURIComponent(text)}">WhatsApp</a> `}if(m.email)html+=`<a class="btn" href="mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Geburtstagsgrüße vom EC Wegscheid")}&body=${encodeURIComponent(text)}">E-Mail</a>`;if(!html)html="Keine Mobilnummer/E-Mail hinterlegt.";let d=document.createElement("div");d.className="modal show";d.innerHTML=`<div class="modalbox"><h3>Geburtstagsnachricht</h3><p>${esc(text)}</p>${html}<br><br><button class="btn" onclick="this.closest('.modal').remove()">Schließen</button></div>`;document.body.appendChild(d)}
// Aufnahmeantrag V2.9.8: Die hochgeladene Original-PDF ist die einzige Druckvorlage.
// Kein Nachbau des Formulars im Browser: Logo, SEPA-Text und Layout bleiben unverändert.
function application(){
 const frame=document.getElementById('ecwMitgliedsantragVorschau');
 if(frame && !frame.getAttribute('src')) frame.setAttribute('src','assets/Mitgliedsantrag.pdf#view=FitH');
}
function renderRoundPages(){let y=new Date().getFullYear(),today=new Date(y,new Date().getMonth(),new Date().getDate()),base=S.members.filter(m=>!m.exitType&&m.birthDate);let all=base.map(m=>({...m,bd:new Date(y,m.birthDate.slice(5,7)-1,m.birthDate.slice(8,10))})).filter(m=>round(m,y)).sort((a,b)=>a.bd-b.bd);let upcoming=all.filter(m=>m.bd>=today);let row=m=>`<div style="padding:8px;border-bottom:1px solid #ffffff22"><b>${esc(m.firstName)} ${esc(m.lastName)} 🎉</b> <span class="muted">${fd(m.birthDate)} · ${age(m.birthDate,y)} Jahre</span></div>`;if($("roundThisYearList"))$("roundThisYearList").innerHTML=all.map(row).join("")||"Keine runden Geburtstage eingetragen.";if($("roundUpcomingList"))$("roundUpcomingList").innerHTML=upcoming.map(row).join("")||"Keine anstehenden runden Geburtstage eingetragen.";}
function renderAdminPasses(){
 let a=(S.passes||[]).slice().sort((x,y)=>{let mx=(x.memberId!=null?(S.members||[]).find(m=>String(m.id)===String(x.memberId)):null),my=(y.memberId!=null?(S.members||[]).find(m=>String(m.id)===String(y.memberId)):null);return normName(mx?.lastName||x.lastName).localeCompare(normName(my?.lastName||y.lastName),'de-DE')||normName(mx?.firstName||x.firstName).localeCompare(normName(my?.firstName||y.firstName),'de-DE')});
 let el=$("adminPassBody"); if(!el)return;
 el.innerHTML=a.map(p=>{let m=p.memberId!=null?(S.members||[]).find(x=>String(x.id)===String(p.memberId)):null;let ln=m?.lastName||p.lastName||"",fn=m?.firstName||p.firstName||"";return `<tr><td><b>${esc(fn)} ${esc(ln)}</b></td><td>${esc(passGroups(p).join(', ')||passGroupFor(p)||'–')}</td><td>${esc(p.passportNo||'–')}</td><td>${esc(fd(p.passportExpiry)||'–')}</td><td><button class="btn" type="button" data-pass-edit="${p.id}">Bearbeiten</button></td></tr>`}).join('')||'<tr><td colspan="5">Keine Spielerpässe vorhanden.</td></tr>';
}
function admin(){
 if(!U?.admin)return;
 const activeEmbeddedPage=($("members")?.classList.contains("active")&&window.memberEditMode)?"members":($("passes")?.classList.contains("active")?"passes":"");
 const selectedSection=document.querySelector('[data-at].primary')?.dataset.at;
 let c=S.settings;
 $("adm").innerHTML=`
 <div class="adminTabs" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px">
  ${canManageMemberUsers()?`<button class="btn primary" data-at="users" onclick="adminSection('users')">Benutzer & Rechte</button>`:''}
  <button class="btn" data-at="settings" onclick="adminSection('settings')">Altersgrenzen & Beitrag</button>
  <button class="btn" data-at="import" onclick="adminSection('import')">Import & Export</button>
  <button class="btn" data-at="display" onclick="adminSection('display')">Anzeige</button>
  <button class="btn" data-at="application" onclick="adminSection('application')">Aufnahmeantrag</button>
  <button class="btn" data-at="serial" onclick="adminSection('serial')">Serienbrief</button>
  <button class="btn" data-at="sponsors" onclick="adminSection('sponsors')">Sponsoren</button>
  <button class="btn" data-at="members" onclick="adminEmbed('members')">Mitglieder bearbeiten</button>
  <button class="btn" data-at="passes" onclick="adminEmbed('passes')">Spielerpässe bearbeiten</button>
 </div>
 <div id="adminSectionUsers" class="adminSection"></div>
 <div id="adminSectionSettings" class="adminSection" style="display:none"></div>
 <div id="adminSectionImport" class="adminSection" style="display:none"></div>
 <div id="adminSectionDisplay" class="adminSection" style="display:none"></div>
 <div id="adminSectionApplication" class="adminSection" style="display:none"></div>
 <div id="adminSectionSerial" class="adminSection" style="display:none"></div>
 <div id="adminSectionSponsors" class="adminSection" style="display:none"></div>`;
 const uhtml=`<div class="card"><h3>Benutzer & Rechte – zentrale Firebase-Anmeldung</h3><p>Die Anmeldung erfolgt mit <b>E-Mail-Adresse und Kennwort</b> über Firebase Authentication. „Anzeigename“ ist die sichtbare Bezeichnung des Kontos.</p><p class="smallnote">Die ältere lokale Benutzer-/Kennwortverwaltung der Mitgliederverwaltung wird hier nicht mehr angeboten. Bereits vorhandene Einträge bleiben erhalten und werden nicht gelöscht.</p><button class="btn primary" onclick="memberOpenCentralUsers()">Zentrale Benutzer & Rechte öffnen</button><p class="smallnote">Neue Anmeldekonten werden in Firebase Authentication eingerichtet; die Zugriffsrechte anschließend in der zentralen Benutzerverwaltung vergeben.</p></div>`;
 $("adminSectionUsers").innerHTML=canManageMemberUsers()?uhtml:"";
 $("adminSectionUsers").style.display=canManageMemberUsers()?"":"none";
 $("adminSectionSettings").innerHTML=`<div class="card"><h3>Altersgrenzen & Beitrag</h3><div class="settings-grid"><div class="field"><label>U14 bis einschließlich</label><input id="ageU14Max" type="number" value="${c.ageU14Max}"></div><div class="field"><label>U16 bis einschließlich</label><input id="ageU16Max" type="number" value="${c.ageU16Max}"></div><div class="field"><label>U19 bis einschließlich</label><input id="ageU19Max" type="number" value="${c.ageU19Max}"></div><div class="field"><label>U23 bis einschließlich</label><input id="ageU23Max" type="number" value="${c.ageU23Max}"></div><div class="field"><label>Senioren ab Alter</label><input id="ageSeniorMin" type="number" value="${c.ageSeniorMin}"></div><div class="field"><label>Stichtag</label><input id="ageCutoff" type="text" inputmode="numeric" maxlength="5" placeholder="TT/MM" value="${(c.ageCutoff||"01-01").replace(/^(\d{4})-(\d{2})-(\d{2})$/,"$3/$2").replace(/^(\d{2})-(\d{2})$/,"$2/$1")}"><span class="smallnote">Nur Tag und Monat; Jahr automatisch aktuell.</span></div><div class="field"><label>Runder Geburtstag ab Alter</label><input id="roundAge" type="number" value="${c.roundAge}"></div><div class="field"><label>Mitgliedsbeitrag (€)</label><input id="fee" type="number" min="0" step="0.01" value="${c.fee}"></div><div class="field"><label>Beitragsbefreiung bis Alter</label><input id="contributionFreeAge" type="number" min="0" max="99" value="${c.contributionFreeAge??18}"><span class="smallnote">Stichtag: 01/01 des jeweiligen Jahres.</span></div></div><div class="card" style="margin-top:12px"><h3>Geburtstagsanzeige der Übersicht</h3><div class="settings-grid"><div class="field"><label>Bevorstehende Geburtstage anzeigen</label><select id="birthdayUpcomingMonths"><option value="1" ${(+c.birthdayUpcomingMonths||1)===1?"selected":""}>1 Monat</option><option value="2" ${(+c.birthdayUpcomingMonths||1)===2?"selected":""}>2 Monate</option><option value="3" ${(+c.birthdayUpcomingMonths||1)===3?"selected":""}>3 Monate</option><option value="6" ${(+c.birthdayUpcomingMonths||1)===6?"selected":""}>6 Monate</option><option value="12" ${(+c.birthdayUpcomingMonths||1)===12?"selected":""}>12 Monate</option></select></div><div class="field"><label>Runde Geburtstage dieses Jahr</label><select id="roundBirthdayMode"><option value="future" ${(c.roundBirthdayMode||"future")==="future"?"selected":""}>Nur zukünftig liegende anzeigen</option><option value="all" ${(c.roundBirthdayMode||"future")==="all"?"selected":""}>Alle dieses Jahr anzeigen</option><option value="next6" ${c.roundBirthdayMode==="next6"?"selected":""}>Nächste 6 Monate</option><option value="firstHalf" ${c.roundBirthdayMode==="firstHalf"?"selected":""}>Januar bis Juni</option><option value="secondHalf" ${c.roundBirthdayMode==="secondHalf"?"selected":""}>Juli bis Dezember</option></select></div></div><p class="smallnote">Diese Einstellungen gelten für die beiden Geburtstagsbereiche auf der Übersichtsseite. Auf der Übersichtsseite selbst gibt es keine Auswahlfelder mehr.</p></div><button class="btn primary" style="margin-top:10px" onclick="saveSettings()">Einstellungen speichern</button></div>`;
 $("adminSectionImport").innerHTML=`<div class="card"><h3>Import & Export</h3><div class="checkline"><input id="exportMembers" type="checkbox" ${c.exportMembers?"checked":""}><label for="exportMembers">Mitglieder-CSV-Export erlauben</label></div><div class="checkline"><input id="importMembers" type="checkbox" ${c.importMembers?"checked":""}><label for="importMembers">Mitglieder-CSV-Import anzeigen</label></div><div class="checkline"><input id="importBank" type="checkbox" ${c.importBank?"checked":""}><label for="importBank">Bankdaten-Datei-Import anzeigen</label></div><div id="importAdminTools" style="margin-top:12px"></div><hr><h3>Beitrags-Exporte</h3><p class="smallnote">Die Exporte enthalten nur aktive Mitglieder. Beim Bankeinzug werden Mitgliedsname, Adresse und Bankdaten ausgegeben. Barzahler werden separat als CSV exportiert.</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><button class="btn primary" onclick="exportDirectDebit()">Bankeinzug – Bankdaten exportieren</button><button class="btn" onclick="exportCashPayers()">Barzahler – CSV exportieren</button><button class="btn" onclick="exportContributionExempt()">Beitragsbefreite – CSV exportieren</button></div></div>`;
 $("adminSectionDisplay").innerHTML=`<div class="card"><h3>Anzeigeeinstellungen</h3><p class="smallnote">Reihenfolge mit ▲/▼ ändern. Leere Spalten werden automatisch ausgeblendet. Mitgliedsnummer bleibt sichtbar; Vorname und Nachname können separat ein- oder ausgeblendet werden.</p><div id="displayOrder"></div><button class="btn primary" style="margin-top:10px" onclick="saveSettings()">Anzeige-Einstellungen speichern</button></div>`;
 $("adminSectionApplication").innerHTML=`<div class="card"><h3>Aufnahmeantrag EC Wegscheid</h3><p class="smallnote">Der Beitrag wird automatisch aus „Altersgrenzen & Beitrag“ übernommen. Der aktuelle PDF-Ausdruck wird aus der Originalvorlage des Vereins erstellt.</p><p><b>Aktueller Jahresbeitrag:</b> ${memberFeeEuro()}</p><div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 16px"><button class="btn primary" onclick="memberApplicationOpen()">PDF öffnen / drucken</button><button class="btn" onclick="memberApplicationDownload()">PDF herunterladen</button><button class="btn" onclick="memberApplicationRefresh()">Vorschau aktualisieren</button></div><p id="memberApplicationStatus" role="status" class="smallnote">Vorschau wird erstellt …</p><div style="border:1px solid #ffffff33;border-radius:10px;overflow:hidden;background:#fff"><iframe id="ecwMitgliedsantragVorschau" title="Aufnahmeantrag EC Wegscheid mit aktuellem Mitgliedsbeitrag" style="display:block;width:100%;height:76vh;min-height:540px;border:0"></iframe></div></div>`;
 $("adminSectionSerial").innerHTML=`<div class="card"><h3>Serienbrief</h3><p>Word- oder PDF-Dokumente mit den Adressdaten ausgewählter Mitglieder kombinieren.</p><button class="btn primary" onclick="serialOpen()">Serienbrief öffnen</button></div>`;
 const sponsorSection=`
 <div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h3 style="margin:0">Sponsoren</h3><p class="smallnote" style="margin:4px 0 0">Sponsoren werden ausschließlich im Admin-Bereich verwaltet. Bankdaten sind nur für Admins sichtbar.</p></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn primary" onclick="sponsorNew()">+ Sponsor</button><button class="btn" onclick="document.getElementById('sponsorXlsx').click()">Excel importieren</button><button class="btn" onclick="exportSponsorsCsv()">Excel/CSV exportieren</button><input id="sponsorXlsx" type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="importSponsorsFile(this.files[0])"></div></div>
  <div class="toolbar" style="margin-top:10px"><div class="field" style="min-width:260px;flex:1"><label>Suche</label><input id="sponsorSearch" oninput="renderSponsors()" placeholder="Firma, Ansprechpartner, Ort, E-Mail …"></div><div class="field"><label>Status</label><select id="sponsorStatusFilter" onchange="renderSponsors()"><option value="">Alle</option><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></div></div>
  <div class="tablewrap" style="margin-top:10px"><table class="table"><thead><tr><th>Sponsor</th><th>Kontakt</th><th>E-Mail</th><th>Zweck</th><th>Netto</th><th>MwSt.</th><th>Brutto</th><th>Zahlung</th><th>Wünsche</th><th>Aktionen</th></tr></thead><tbody id="sponsorBody"></tbody></table></div>
 </div>
 <div class="card" style="margin-top:12px"><h3>Angaben für Spendenbestätigungen</h3><div class="formgrid"><div class="field"><label>Name der steuerbegünstigten Einrichtung</label><input id="sponsorLegalName" value="${esc(c.sponsorLegalName||"EC Wegscheid")}"></div><div class="field"><label>Finanzamt</label><input id="sponsorTaxOffice" value="${esc(c.sponsorTaxOffice||"")}"></div><div class="field"><label>Steuernummer</label><input id="sponsorTaxNumber" value="${esc(c.sponsorTaxNumber||"")}"></div><div class="field"><label>Freistellungsbescheid vom</label><input id="sponsorExemptionDate" type="date" value="${esc(c.sponsorExemptionDate||"")}"></div><div class="field"><label>Letzter Veranlagungszeitraum</label><input id="sponsorAssessmentYear" value="${esc(c.sponsorAssessmentYear||"")}"></div><div class="field"><label>Finanzamt §60a AO</label><input id="sponsor60aOffice" value="${esc(c.sponsor60aOffice||"")}"></div><div class="field"><label>Steuernummer §60a AO</label><input id="sponsor60aTaxNumber" value="${esc(c.sponsor60aTaxNumber||"")}"></div><div class="field"><label>Bescheid nach §60a AO vom</label><input id="sponsor60aDate" type="date" value="${esc(c.sponsor60aDate||"")}"></div><div class="field" style="grid-column:1/-1"><label>Satzungsmäßiger begünstigter Zweck</label><input id="sponsorPurpose" value="${esc(c.sponsorPurpose||"")}"></div></div><p class="smallnote">Die Vorlage enthält alternative Nachweiswege. Im Ausdruck wird nur der ausgefüllte Nachweisweg verwendet, damit keine doppelten Angaben entstehen.</p><button class="btn primary" style="margin-top:10px" onclick="saveSponsorSettings()">Angaben speichern</button></div><div class="card" style="margin-top:12px"><h3>Direkter E-Mail-Versand</h3><p class="smallnote">Für den echten Direktversand kann ein EmailJS-Konto hinterlegt werden. Ohne diese Angaben öffnet die Schaltfläche das lokale E-Mail-Programm mit einer vorbereiteten Nachricht.</p><div class="formgrid"><div class="field"><label>EmailJS Public Key</label><input id="emailjsPublicKey" value="${esc(c.emailjsPublicKey||'')}"></div><div class="field"><label>EmailJS Service ID</label><input id="emailjsServiceId" value="${esc(c.emailjsServiceId||'')}"></div><div class="field"><label>EmailJS Template ID</label><input id="emailjsTemplateId" value="${esc(c.emailjsTemplateId||'')}"></div><div class="field"><label>Standard-MwSt. für neue Sponsoren (%)</label><input id="sponsorVatRate" type="number" min="0" max="100" step="0.01" value="${Number(c.sponsorVatRate??19)}"></div></div><button class="btn primary" style="margin-top:10px" onclick="saveSponsorSettings()">Sponsor-Einstellungen speichern</button><p class="smallnote" style="margin-top:8px">EmailJS-Vorlage sollte die Variablen <b>{{to_email}}</b>, <b>{{to_name}}</b>, <b>{{subject}}</b> und <b>{{message}}</b> verwenden.</p></div>`;
 $("adminSectionSponsors").innerHTML=sponsorSection;
 renderSponsors();
 application();
 const labels=memberDisplayLabels();let order=memberDisplayOrder();$("displayOrder").innerHTML=order.filter(k=>!memberSensitiveFields.has(k)||U?.bank).map(k=>`<div class="checkline" style="border-bottom:1px solid #ffffff22"><input id="sh_${k}" type="checkbox" ${memberFieldVisible(k)?"checked":""} onchange="memberDisplayToggle('${k}',this.checked)"><label for="sh_${k}" style="flex:1">${labels[k]}</label><button class="btn" onclick="moveDisplay('${k}',-1)">▲</button><button class="btn" onclick="moveDisplay('${k}',1)">▼</button></div>`).join(""); let it=$("importAdminTools"),z=""; if(c.importBank)z+='<button class="btn" onclick="document.getElementById("bankFileAdmin").click()">Bankdaten-Datei importieren</button><input id="bankFileAdmin" type="file" accept=".csv,.txt" style="display:none" onchange="importBankFile(this.files[0])"> '; if(c.importMembers)z+='<button class="btn" onclick="document.getElementById("memberFileAdmin").click()">Mitglieder-CSV importieren</button><input id="memberFileAdmin" type="file" accept=".csv,.txt" style="display:none" onchange="importMemberFile(this.files[0])"> '; if(c.exportMembers&&U.export)z+='<button class="btn" onclick="csv()">Mitglieder-CSV exportieren</button>'; it.innerHTML=z||'<span class="muted">Keine Import-/Export-Funktion aktiviert.</span>';
 // Tabellenansicht bei Neuzeichnen erhalten: adminSection entfernt sonst ihre active-Klasse.
 if(!activeEmbeddedPage){
   const section=selectedSection&&!['members','passes'].includes(selectedSection)&&!(selectedSection==='users'&&!canManageMemberUsers())?selectedSection:(canManageMemberUsers()?'users':'settings');
   adminSection(section,true);
 }
 applyAdminEmbed();
}
// "Mitglieder bearbeiten" / "Spielerpässe bearbeiten" erscheinen als Abschnitt direkt unter der Admin-Reiterzeile
function adminEmbed(name){
 if(!U?.admin)return;
 window.memberEditMode=(name==="members");
 page(name);
}
function applyAdminEmbed(){
 if(!U?.admin)return;
 const name=($("members")?.classList.contains("active")&&window.memberEditMode)?"members":($("passes")?.classList.contains("active")?"passes":"");
 if(!name)return;
 $("admin")?.classList.add("active");
 document.querySelectorAll(".adminSection").forEach(x=>x.style.display="none");
 document.querySelectorAll("[data-at]").forEach(x=>x.classList.toggle("primary",x.dataset.at===name));
 document.querySelectorAll("[data-p]").forEach(x=>x.classList.toggle("primary",x.dataset.p==="admin"));
}
function adminSection(name,preservePages=false){ if(!U?.admin||(name==="users"&&!canManageMemberUsers()))return; if(!preservePages){$("members")?.classList.remove("active"); $("passes")?.classList.remove("active");} document.querySelectorAll('.adminSection').forEach(x=>x.style.display='none'); document.querySelectorAll('[data-at]').forEach(x=>x.classList.toggle('primary',x.dataset.at===name)); const el=$("adminSection"+name.charAt(0).toUpperCase()+name.slice(1)); if(el)el.style.display='block'; if(name==='application')memberApplicationRefresh(); }

function perm(id,k,v){if(!canManageMemberUsers())return;let u=S.users.find(x=>x.id===id);if(id==="admin"&&k==="admin"&&!v)return alert("Der Hauptadministrator bleibt Admin.");u[k]=v;save();if(U.id===id)U=u;admin()}
function addU(){if(!canManageMemberUsers())return;let id=$("nu").value.trim(),name=$("nn").value.trim(),pw=$("np").value;if(!id||!name||!pw)return alert("Bitte alle Felder ausfüllen.");if(S.users.some(x=>x.id===id))return alert("Benutzername existiert.");S.users.push({id,name,password:pw,admin:$("na")?.checked||false,view:true,edit:false,bank:false,export:false,mustChangePassword:true});save();populateLoginUsers();admin()}
function resetUserPassword(id){if(!canManageMemberUsers())return;if(!U?.admin)return;let u=S.users.find(x=>x.id===id);if(!u)return;let temp=prompt("Temporäres Kennwort für "+u.name+" eingeben:","");if(temp===null)return;if(temp.length<4)return alert("Das Kennwort muss mindestens 4 Zeichen haben.");u.password=temp;u.mustChangePassword=true;save();populateLoginUsers();admin();alert("Kennwort zurückgesetzt. Beim nächsten Login muss ein neues Kennwort vergeben werden.")}
function moveDisplay(k,dir){let o=memberDisplayOrder(),i=o.indexOf(k),j=i+dir;if(i<0||j<0||j>=o.length)return;[o[i],o[j]]=[o[j],o[i]];S.settings.displayOrder=o;save();admin();}
function saveSettings(){
 let c=S.settings;
 c.roundAge=Math.max(1,+$("roundAge").value||50);c.fee=Math.max(0,+$("fee").value||0);c.contributionFreeAge=Math.max(0,Math.min(99,+$("contributionFreeAge").value||18));
 c.ageU14Max=Math.max(1,+$("ageU14Max").value||13);c.ageU16Max=Math.max(c.ageU14Max+1,+$("ageU16Max").value||15);
 c.ageU19Max=Math.max(c.ageU16Max+1,+$("ageU19Max").value||18);c.ageU23Max=Math.max(c.ageU19Max+1,+$("ageU23Max").value||22);c.ageSeniorMin=Math.max(c.ageU19Max+1,+$("ageSeniorMin").value||19);let cutoffRaw=$("ageCutoff").value.trim();let cm=cutoffRaw.match(/^(\d{1,2})[.\/-](\d{1,2})\.?$/);if(!cm)return alert("Bitte den Stichtag als TT/MM eingeben, z. B. 01/10.");let cd=String(+cm[1]).padStart(2,"0"),cmo=String(+cm[2]).padStart(2,"0");let test=new Date(new Date().getFullYear(),+cm[2]-1,+cm[1]);if(test.getMonth()!==+cm[2]-1||test.getDate()!==+cm[1])return alert("Der Stichtag ist ungültig. Bitte einen gültigen Tag und Monat eingeben.");c.ageCutoff=cmo+"-"+cd;
 c.exportMembers=$("exportMembers").checked;c.importMembers=$("importMembers").checked;c.importBank=$("importBank").checked;
 // Einzelne Spalten werden über displayVisible gespeichert; alte Sammelschalter nicht mehr überschreiben.
 c.showAZ=c.showAZ;c.showBirthdayFilters=c.showBirthdayFilters;c.showBankButton=c.showBankButton;c.birthdayUpcomingMonths=Math.max(1,Math.min(12,+$("birthdayUpcomingMonths")?.value||1));c.roundBirthdayMode=["all","future","next6","firstHalf","secondHalf"].includes($("roundBirthdayMode")?.value)?$("roundBirthdayMode").value:"future";
 c.displayOrder=memberDisplayOrder();

 save();
try{refreshPassGroupsByAgeSettings();}catch(e){console.error("Spielerpässe konnten nach der Einstellungsänderung nicht aktualisiert werden:",e)}
all();admin();alert("Admin-Einstellungen gespeichert und Spielerpässe aktualisiert.");
}

function currentCalendar(){let y=new Date().getFullYear();$("cy").value=y;calendar();}
function importMemberFile(file){
 if(!file||!S.settings.importMembers)return;
 let r=new FileReader();r.onload=()=>{
  let lines=r.result.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)return alert("Keine Daten gefunden.");
  let sep=lines[0].includes(";")?";":",";let h=lines[0].split(sep).map(x=>x.replace(/^"|"$/g,"").trim().toLowerCase());
  let val=(p,names)=>{for(let n of names){let i=h.indexOf(n);if(i>=0)return p[i]?.replace(/^"|"$/g,"").trim()||""}return""};
  let added=0,updated=0;
  lines.slice(1).forEach(line=>{let p=line.split(sep),nr=val(p,["id","nr","mitgliedsnummer"]),last=val(p,["nachname","name"]),first=val(p,["vorname"]);
   if(!last&&!first&&!nr) return;
   let m=S.members.find(x=>nr&&String(x.id)===String(nr)||(last&&first&&String(x.lastName||"").toLowerCase()===last.toLowerCase()&&String(x.firstName||"").toLowerCase()===first.toLowerCase()));
   if(!m){m={id:Math.max(0,...S.members.map(x=>+x.id))+1};S.members.push(m);added++}else updated++;
   m.lastName=last||m.lastName||"";m.firstName=first||m.firstName||"";m.birthDate=val(p,["geburtsdatum","birthdate"])||m.birthDate||"";m.memberSince=val(p,["mitglied seit","mitgliedseit","membersince"])||m.memberSince||"";m.address=val(p,["adresse"])||m.address||"";m.country=val(p,["land"])||m.country||"";m.zip=val(p,["plz"])||m.zip||"";m.city=val(p,["ort","stadt"])||m.city||"";m.phoneMobile=val(p,["mobil","handy"])||m.phoneMobile||"";m.phoneFixed=val(p,["festnetz"])||m.phoneFixed||"";m.email=val(p,["email","e-mail"])||m.email||"";});
  S.members=S.members.filter(m=>m&&[m.lastName,m.firstName,m.birthDate,m.memberSince,m.address,m.zip,m.city,m.phoneMobile,m.phoneFixed,m.email,m.accountHolder,m.iban,m.bic,m.bank,m.notes].some(v=>String(v??"").trim()!==""));
  S.members.forEach(normalizePaymentMethod);
  save();renderM();dashboard();alert(`${added} neue Mitglieder, ${updated} vorhandene Mitglieder aktualisiert.`);
 };r.readAsText(file,"utf-8");
}
function importBankFile(file){if(!file||!S.settings.importBank)return;if(!U.bank)return alert("Keine Berechtigung für Bankdaten.");let r=new FileReader();r.onload=()=>{let lines=r.result.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)return alert("Keine Daten gefunden.");let sep=lines[0].includes(";")?";":",";let h=lines[0].split(sep).map(x=>x.replace(/^"|"$/g,"").trim().toLowerCase()),idx=n=>h.indexOf(n);let changed=0;lines.slice(1).forEach(line=>{let p=line.split(sep).map(x=>x.replace(/^"|"$/g,"").trim()),nr=p[idx("nr")]||p[idx("id")]||p[idx("mitgliedsnummer")],last=p[idx("nachname")]||p[idx("name")],first=p[idx("vorname")],m=S.members.find(x=>String(x.id)===String(nr)||(last&&first&&x.lastName.toLowerCase()===last.toLowerCase()&&x.firstName.toLowerCase()===first.toLowerCase()));if(m){let val=(names)=>{for(let n of names){let i=idx(n);if(i>=0&&p[i])return p[i]}return""};m.accountHolder=val(["kontoinhaber"])||m.accountHolder;m.iban=val(["iban"])||m.iban;m.bic=val(["bic"])||m.bic;m.bank=val(["bank","kreditinstitut"])||m.bank;normalizePaymentMethod(m);changed++}});save();renderM();alert(changed+" Mitglieder aktualisiert.")};r.readAsText(file,"utf-8")}

// ==================== Sponsoren 2.5.2 ====================
function ensureSponsors(){ if(!Array.isArray(S.sponsors)) S.sponsors=[]; return S.sponsors; }
function sponsorNextId(){ return Math.max(0,...ensureSponsors().map(x=>+x.id||0))+1; }
function sponsorDefault(){ return {id:sponsorNextId(),company:"",contact:"",address:"",zip:"",city:"",country:"Deutschland",phone:"",email:"",email2:"",accountHolder:"",iban:"",bic:"",bank:"",sepaMandate:"",mandateDate:"",debitDay:"",amountNet:"",vatRate:+(S.settings.sponsorVatRate??19),amountGross:"",paymentMethod:"directDebit",contractDate:"",invoiceDate:"",invoiceNo:"",invoiceText:"Sponsoring EC Wegscheid",receiptType:"invoice",purposeType:"Spende",wishes:[],wishOther:"",notes:"",active:true}; }
function sponsorLabel(s){return [s.company,s.contact].filter(Boolean).join(" – ")||"Ohne Namen";}
function sponsorMoney(v){let n=Number(String(v??"").replace(',','.'));return Number.isFinite(n)?n:0;}
function sponsorEuro(v){return sponsorMoney(v).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";}
function sponsorWishes(s){return Array.isArray(s.wishes)?s.wishes:[];}
function renderSponsors(){
 if(!U?.admin)return; ensureSponsors();
 let q=String($("sponsorSearch")?.value||"").trim().toLocaleLowerCase("de-DE"),f=$("sponsorStatusFilter")?.value||"";
 let a=S.sponsors.filter(s=>{if(f==="active"&&!s.active)return false;if(f==="inactive"&&s.active)return false;let t=[s.company,s.contact,s.city,s.email,s.phone,s.iban].map(x=>String(x||"").toLocaleLowerCase("de-DE")).join(" ");return !q||t.includes(q)}).sort((x,y)=>String(x.company||"").localeCompare(String(y.company||""),'de-DE'));
 let body=$("sponsorBody");if(!body)return;
 body.innerHTML=a.map(s=>{let wishes=sponsorWishes(s).join(", ")+(s.wishOther?(s.wishes?.length?", ":"")+s.wishOther:"");let pay=s.paymentMethod==="directDebit"?"Bankeinzug":"Überweisung/sonstig";return `<tr><td><b>${esc(s.company||"–")}</b>${s.active?"":"<br><span class='muted'>inaktiv</span>"}<br><span class='smallnote'>${esc(s.address||"")} ${esc([s.zip,s.city].filter(Boolean).join(" "))}</span></td><td>${esc(s.contact||"–")}<br>${esc(s.phone||"")}</td><td>${esc([s.email,s.email2].filter(Boolean).join(", ")||"–")}</td><td><span class="badge">${esc(s.purposeType||"Spende")}</span></td><td>${sponsorEuro(s.amountNet)}</td><td>${esc(s.vatRate??0)}%</td><td>${sponsorEuro(s.amountGross)}</td><td>${esc(pay)}${s.iban?`<br><span class='smallnote'>${esc(s.iban)}</span>`:""}</td><td>${esc(wishes||"–")}</td><td><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn" onclick="sponsorEdit(${s.id})">Bearbeiten</button><button class="btn" onclick="printSponsorInvoice(${s.id})">Rechnung</button><button class="btn" onclick="printSponsorReceipt(${s.id})">Spendenbestätigung</button><button class="btn" onclick="sponsorSendEmail(${s.id})">E-Mail</button><button class="btn danger" onclick="sponsorDelete(${s.id})">Löschen</button></div></td></tr>`}).join("")||'<tr><td colspan="10">Keine Sponsoren vorhanden.</td></tr>';
}
function sponsorNew(){if(!ensureAdmin())return;let s=sponsorDefault();S.sponsors.push(s);save();sponsorEdit(s.id);}
function sponsorEdit(id){if(!ensureAdmin())return;let s=S.sponsors.find(x=>+x.id===+id);if(!s)return;window.sponsorEditId=+id;let wishes=new Set(sponsorWishes(s));let opts=["Bandenwerbung","Website","Social Media","Veranstaltungsnennung","Plakat/Werbematerial","Logo auf Vereinsmaterial","Sonstiger Werbewunsch"];let html=`<div class="modal" id="sponsorModal" style="display:flex"><div class="modalbox" style="max-width:1050px;width:min(1050px,96vw);max-height:92vh;overflow:auto"><div class="modalhead"><h2>Sponsor bearbeiten</h2><button class="btn" onclick="closeSponsorModal()">Schließen</button></div><div class="formgrid"><div class="field"><label>Firma / Sponsor</label><input id="spCompany" value="${esc(s.company||"")}"></div><div class="field"><label>Ansprechpartner</label><input id="spContact" value="${esc(s.contact||"")}"></div><div class="field"><label>Straße / Hausnummer</label><input id="spAddress" value="${esc(s.address||"")}"></div><div class="field"><label>PLZ</label><input id="spZip" value="${esc(s.zip||"")}"></div><div class="field"><label>Ort</label><input id="spCity" value="${esc(s.city||"")}"></div><div class="field"><label>Land</label><input id="spCountry" value="${esc(s.country||"Deutschland")}"></div><div class="field"><label>Telefon</label><input id="spPhone" value="${esc(s.phone||"")}"></div><div class="field"><label>E-Mail</label><input id="spEmail" type="email" value="${esc(s.email||"")}"></div><div class="field"><label>Weitere E-Mail</label><input id="spEmail2" type="email" value="${esc(s.email2||"")}"></div><div class="field"><label>Status</label><select id="spActive"><option value="1" ${s.active!==false?'selected':''}>Aktiv</option><option value="0" ${s.active===false?'selected':''}>Inaktiv</option></select></div></div><h3 style="margin-top:16px">Bankdaten / Bankeinzug</h3><div class="formgrid"><div class="field"><label>Kontoinhaber</label><input id="spAccountHolder" value="${esc(s.accountHolder||"")}"></div><div class="field"><label>IBAN</label><input id="spIban" value="${esc(s.iban||"")}"></div><div class="field"><label>BIC</label><input id="spBic" value="${esc(s.bic||"")}"></div><div class="field"><label>Kreditinstitut</label><input id="spBank" value="${esc(s.bank||"")}"></div><div class="field"><label>SEPA-Mandatsreferenz</label><input id="spMandate" value="${esc(s.sepaMandate||"")}"></div><div class="field"><label>Mandat erteilt am</label><input id="spMandateDate" type="date" value="${esc(s.mandateDate||"")}"></div><div class="field"><label>Gewünschter Abbuchungstag</label><input id="spDebitDay" type="number" min="1" max="28" value="${esc(s.debitDay||"")}" placeholder="z. B. 5"></div><div class="checkline"><input id="spDirectDebit" type="checkbox" ${s.paymentMethod==='directDebit'?'checked':''}><label for="spDirectDebit">Sponsorgeld per Bankeinzug abbuchen</label></div></div><p class="smallnote">Die App speichert die Bankdaten und zeigt sie nur innerhalb des Admin-Bereichs. Für einen rechtssicheren SEPA-Einzug müssen die erforderlichen Mandatsunterlagen separat vorliegen.</p><h3>Summen</h3><div class="formgrid"><div class="field"><label>Summe ohne MwSt. / Netto (€)</label><input id="spNet" type="number" min="0" step="0.01" value="${esc(s.amountNet??"")}" oninput="sponsorCalcGross()"></div><div class="field"><label>MwSt. (%)</label><input id="spVat" type="number" min="0" max="100" step="0.01" value="${esc(s.vatRate??S.settings.sponsorVatRate??19)}" oninput="sponsorCalcGross()"></div><div class="field"><label>Summe mit MwSt. / Brutto (€)</label><input id="spGross" type="number" min="0" step="0.01" value="${esc(s.amountGross??"")}"></div><div class="field"><label>Rechnungsdatum</label><input id="spInvoiceDate" type="date" value="${esc(s.invoiceDate||"")}"></div><div class="field"><label>Rechnungsnummer (optional)</label><input id="spInvoiceNo" value="${esc(s.invoiceNo||"")}" placeholder="wird sonst automatisch vergeben"></div><div class="field"><label>Rechnungstext</label><input id="spInvoiceText" value="${esc(s.invoiceText||"Sponsoring EC Wegscheid")}"></div><div class="field"><label>Begünstigter Zweck</label><select id="spPurposeType"><option value="Zweck Geldzuwendung" ${s.purposeType==="Zweck Geldzuwendung"?"selected":""}>Zweck Geldzuwendung</option><option value="Bandenwerbung" ${s.purposeType==="Bandenwerbung"?"selected":""}>Bandenwerbung</option><option value="Spende" ${(!s.purposeType||s.purposeType==="Spende")?"selected":""}>Spende</option></select></div><div class="field"><label>Dokumentart</label><select id="spReceiptType"><option value="invoice" ${s.receiptType!=='donation'?'selected':''}>Rechnung / Sponsoring</option><option value="donation" ${s.receiptType==='donation'?'selected':''}>Spende</option></select></div></div><h3>Wünsche des Sponsors</h3><div class="checkgrid">${opts.map(x=>`<label><input type="checkbox" class="spWish" value="${esc(x)}" ${wishes.has(x)?'checked':''}> ${esc(x)}</label>`).join("")}</div><div class="field" style="margin-top:8px"><label>Weitere Wünsche / Vereinbarungen</label><textarea id="spWishOther" rows="3">${esc(s.wishOther||"")}</textarea></div><div class="field" style="margin-top:8px"><label>Interne Notizen</label><textarea id="spNotes" rows="3">${esc(s.notes||"")}</textarea></div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px"><button class="btn" onclick="closeSponsorModal()">Abbrechen</button><button class="btn primary" onclick="saveSponsorFromModal()">Sponsor speichern</button></div></div></div>`;document.body.insertAdjacentHTML('beforeend',html);}
function sponsorCalcGross(){let n=sponsorMoney($("spNet")?.value),v=sponsorMoney($("spVat")?.value);if($("spGross"))$("spGross").value=(n*(1+v/100)).toFixed(2);}
function saveSponsorFromModal(){if(!ensureAdmin())return;let s=S.sponsors.find(x=>+x.id===+window.sponsorEditId);if(!s)return;Object.assign(s,{company:$('spCompany').value.trim(),contact:$('spContact').value.trim(),address:$('spAddress').value.trim(),zip:$('spZip').value.trim(),city:$('spCity').value.trim(),country:$('spCountry').value.trim(),phone:$('spPhone').value.trim(),email:$('spEmail').value.trim(),email2:$('spEmail2').value.trim(),active:$('spActive').value==='1',accountHolder:$('spAccountHolder').value.trim(),iban:$('spIban').value.trim().replace(/\s+/g,''),bic:$('spBic').value.trim(),bank:$('spBank').value.trim(),sepaMandate:$('spMandate').value.trim(),mandateDate:$('spMandateDate').value,debitDay:$('spDebitDay').value,amountNet:$('spNet').value,vatRate:sponsorMoney($('spVat').value),amountGross:$('spGross').value,invoiceDate:$('spInvoiceDate').value,invoiceNo:$('spInvoiceNo').value.trim(),invoiceText:$('spInvoiceText').value.trim(),purposeType:$('spPurposeType').value,receiptType:$('spReceiptType').value,wishes:[...document.querySelectorAll('.spWish:checked')].map(x=>x.value),wishOther:$('spWishOther').value.trim(),notes:$('spNotes').value.trim(),paymentMethod:$('spDirectDebit').checked?'directDebit':'transfer'});save();closeSponsorModal();renderSponsors();alert('Sponsor gespeichert.');}
function closeSponsorModal(){document.getElementById('sponsorModal')?.remove();window.sponsorEditId=null;}
function sponsorDelete(id){if(!ensureAdmin())return;let s=S.sponsors.find(x=>+x.id===+id);if(!s)return;if(!confirm(`Sponsor „${s.company||'ohne Namen'}“ wirklich löschen?`))return;S.sponsors=S.sponsors.filter(x=>+x.id!==+id);save();renderSponsors();}
function saveSponsorSettings(){if(!ensureAdmin())return;S.settings.emailjsPublicKey=$("emailjsPublicKey")?.value.trim()||"";S.settings.emailjsServiceId=$("emailjsServiceId")?.value.trim()||"";S.settings.emailjsTemplateId=$("emailjsTemplateId")?.value.trim()||"";S.settings.sponsorVatRate=sponsorMoney($("sponsorVatRate")?.value);S.settings.sponsorTaxOffice=$("sponsorTaxOffice")?.value.trim()||"";S.settings.sponsorTaxNumber=$("sponsorTaxNumber")?.value.trim()||"";S.settings.sponsorExemptionDate=$("sponsorExemptionDate")?.value||"";S.settings.sponsorAssessmentYear=$("sponsorAssessmentYear")?.value.trim()||"";S.settings.sponsor60aOffice=$("sponsor60aOffice")?.value.trim()||"";S.settings.sponsor60aTaxNumber=$("sponsor60aTaxNumber")?.value.trim()||"";S.settings.sponsor60aDate=$("sponsor60aDate")?.value||"";S.settings.sponsorPurpose=$("sponsorPurpose")?.value.trim()||"";S.settings.sponsorLegalName=$("sponsorLegalName")?.value.trim()||"EC Wegscheid";save();alert('Sponsor-Einstellungen gespeichert.');}
function importSponsorsFile(file){if(!ensureAdmin()||!file)return;let ext=(file.name||'').toLowerCase().split('.').pop();let reader=new FileReader();reader.onload=e=>{try{let rows=[];if(ext==='xlsx'||ext==='xls'){if(!window.XLSX)throw new Error('Excel-Bibliothek konnte nicht geladen werden.');let wb=XLSX.read(e.target.result,{type:'array'});let ws=wb.Sheets[wb.SheetNames[0]];rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});}else{let text=String(e.target.result||'').replace(/^\uFEFF/,'');let lines=text.split(/\r?\n/).filter(x=>x.trim());let sep=lines[0].includes(';')?';':',';let h=lines[0].split(sep).map(x=>x.replace(/^"|"$/g,'').trim());rows=lines.slice(1).map(line=>{let p=line.split(sep);let o={};h.forEach((k,i)=>o[k]=p[i]??'');return o});}if(!rows.length)return alert('Keine Sponsordaten gefunden.');let norm=x=>String(x??'').trim().toLocaleLowerCase('de-DE').replace(/[ä]/g,'ae').replace(/[ö]/g,'oe').replace(/[ü]/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'');let get=(r,names)=>{let keys=Object.keys(r),map={};keys.forEach(k=>map[norm(k)]=r[k]);for(let n of names){let v=map[norm(n)];if(v!==undefined&&String(v).trim()!=='')return String(v).trim();}return '';};let added=0,updated=0;for(let r of rows){let company=get(r,['Firma','Sponsor','Unternehmen','Name']);if(!company)continue;let email=get(r,['Email','E-Mail','E-Mail-Adresse']);let iban=get(r,['IBAN']);let s=S.sponsors.find(x=>String(x.company||'').trim().toLocaleLowerCase('de-DE')===company.toLocaleLowerCase('de-DE') && (!email || String(x.email||'').trim().toLocaleLowerCase('de-DE')===email.toLocaleLowerCase('de-DE')));if(!s){s=sponsorDefault();S.sponsors.push(s);added++;}else updated++;Object.assign(s,{company,contact:get(r,['Ansprechpartner','Kontakt']),address:get(r,['Strasse','Straße','Adresse']),zip:get(r,['PLZ','Postleitzahl']),city:get(r,['Ort','Stadt']),country:get(r,['Land'])||'Deutschland',phone:get(r,['Telefon','Tel']),email,email2:get(r,['Email2','Weitere E-Mail','Weitere Email']),accountHolder:get(r,['Kontoinhaber']),iban:iban.replace(/\s+/g,''),bic:get(r,['BIC']),bank:get(r,['Bank','Kreditinstitut']),sepaMandate:get(r,['SEPA-Mandatsreferenz','Mandatsreferenz']),mandateDate:get(r,['Mandat erteilt am','Mandatsdatum']),debitDay:get(r,['Abbuchungstag']),amountNet:get(r,['Netto','Summe netto','Betrag netto','Summe ohne MwSt','Summe ohne MwSt.']),vatRate:sponsorMoney(get(r,['MwSt','MwSt %','USt','Steuersatz']))||sponsorMoney(S.settings.sponsorVatRate)||19,amountGross:get(r,['Brutto','Summe brutto','Betrag brutto','Summe mit MwSt','Summe mit MwSt.']),invoiceDate:get(r,['Rechnungsdatum']),invoiceNo:get(r,['Rechnungsnummer','Rechnung Nr']),invoiceText:get(r,['Rechnungstext','Leistung'])||'Sponsoring EC Wegscheid',purposeType:get(r,['Beguenstigter Zweck','Begünstigter Zweck','Zweck','Zweckart'])||'Spende',wishOther:get(r,['Wünsche','Wuensche','Sonstige Wünsche']),notes:get(r,['Notizen','Bemerkung']),active:String(get(r,['Aktiv','Status'])||'aktiv').toLocaleLowerCase().startsWith('a'),paymentMethod:String(get(r,['Zahlungsart','Zahlweise'])).toLocaleLowerCase().includes('einzug')?'directDebit':'transfer'});}save();renderSponsors();alert(`${added} neue Sponsoren importiert, ${updated} vorhandene Sponsoren aktualisiert.`);}catch(err){console.error(err);alert('Excel-Import fehlgeschlagen: '+(err?.message||err));}};if(ext==='xlsx'||ext==='xls')reader.readAsArrayBuffer(file);else reader.readAsText(file,'utf-8');}
function exportSponsorsCsv(){if(!ensureAdmin())return;let h=['ID','Firma','Ansprechpartner','Adresse','PLZ','Ort','Land','Telefon','E-Mail','Weitere E-Mail','Kontoinhaber','IBAN','BIC','Bank','SEPA-Mandatsreferenz','Mandat erteilt am','Abbuchungstag','Netto','MwSt %','Brutto','Rechnungsdatum','Rechnungsnummer','Rechnungstext','Zahlungsart','Wünsche','Weitere Wünsche','Notizen','Aktiv'];let rows=S.sponsors.map(s=>[s.id,s.company,s.contact,s.address,s.zip,s.city,s.country,s.phone,s.email,s.email2,s.accountHolder,s.iban,s.bic,s.bank,s.sepaMandate,s.mandateDate,s.debitDay,s.amountNet,s.vatRate,s.amountGross,s.invoiceDate,s.invoiceNo,s.invoiceText,s.paymentMethod,sponsorWishes(s).join(', '),s.wishOther,s.notes,s.active?'Ja':'Nein']);downloadCsv('EC_Wegscheid_Sponsoren.csv',h,rows);}
function sponsorIssuer(){return {name:'EC Wegscheid',address:'Bahnhofstraße 27',zip:'94110',city:'Wegscheid',bank:'Sparkasse Wegscheid',bic:'BYLADEM1PAS',iban:'DE96740500000000311548'};}
function printSponsorInvoice(id){if(!ensureAdmin())return;let s=S.sponsors.find(x=>+x.id===+id);if(!s)return;let iss=sponsorIssuer(),d=s.invoiceDate||new Date().toISOString().slice(0,10),date=fd(d),no=s.invoiceNo||`SP-${new Date(d+'T00:00:00').getFullYear()}-${String(s.id).padStart(4,'0')}`,net=sponsorMoney(s.amountNet),vat=sponsorMoney(s.vatRate),gross=s.amountGross!==''?sponsorMoney(s.amountGross):net*(1+vat/100),tax=gross-net,desc=s.invoiceText||'Sponsoring EC Wegscheid';let w=window.open('','_blank');if(!w)return alert('Druckfenster konnte nicht geöffnet werden. Bitte Popups erlauben.');w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Rechnung ${esc(no)}</title><style>body{font-family:Arial,sans-serif;margin:25mm 20mm;color:#111}h1{text-align:center;margin:28px 0}.head{display:flex;justify-content:space-between;gap:30px}.box{margin-top:28px}.right{text-align:right}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{padding:8px;border-bottom:1px solid #bbb;text-align:left}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.sum{width:50%;margin-left:auto;margin-top:15px}.sum div{display:flex;justify-content:space-between;padding:5px}.total{font-size:18px;font-weight:bold;border-top:2px solid #111;margin-top:5px;padding-top:9px}.bank{margin-top:45px;font-size:13px}.print{position:fixed;right:15px;bottom:15px;padding:10px 16px}@media print{.print{display:none}body{margin:15mm}}</style></head><body><div class="head"><div><b>${esc(iss.name)}</b><br>${esc(iss.address)}<br>${esc(iss.zip)} ${esc(iss.city)}</div><div class="right"><b>Rechnungsdatum:</b><br>${esc(date)}<br><br><b>Rechnungs-Nr.:</b><br>${esc(no)}</div></div><h1>Rechnung</h1><div class="box"><b>An</b><br>${esc(s.company||'')}<br>${esc(s.address||'')}<br>${esc([s.zip,s.city].filter(Boolean).join(' '))}<br>${esc(s.contact||'')}</div><table><tr><th>Pos.</th><th>Leistung</th><th>Summe excl. MwSt.</th></tr><tr><td>1</td><td style="text-align:left">${esc(desc)}</td><td>${sponsorEuro(net)}</td></tr></table><div class="sum"><div><span>Rechnungsbetrag</span><span>${sponsorEuro(net)}</span></div><div><span>+ MwSt. ${esc(vat)}%</span><span>${sponsorEuro(tax)}</span></div><div class="total"><span>Gesamtbetrag</span><span>${sponsorEuro(gross)}</span></div></div><div class="bank"><b>Bankverbindung</b><br>${esc(iss.bank)} &nbsp; BIC ${esc(iss.bic)} &nbsp; IBAN ${esc(iss.iban)}<br><br>Bitte überweisen Sie den Rechnungsbetrag auf das oben genannte Konto.</div><button class="print" onclick="print()">Drucken</button><script>window.onload=()=>setTimeout(()=>print(),250)<\/script></body></html>`);w.document.close();}
function sponsorReceiptWarning(s){if(sponsorMoney(s.vatRate)>0||s.receiptType==='invoice')return confirm('Hinweis: Bei Sponsoring mit Gegenleistung und/oder Umsatzsteuer ist nicht automatisch eine Spendenbestätigung zulässig. Möchten Sie die Spendenbestätigung trotzdem als Entwurf ausdrucken?');return true;}
function printSponsorReceipt(id){if(!ensureAdmin())return;let s=S.sponsors.find(x=>+x.id===+id);if(!s)return;if(!sponsorReceiptWarning(s))return;let iss=sponsorIssuer(),d=s.invoiceDate||new Date().toISOString().slice(0,10),amount=sponsorMoney(s.amountGross)||sponsorMoney(s.amountNet),words='';try{words=numberToGermanWords(amount)}catch(e){}let cfg=S.settings||{},purpose=(cfg.sponsorPurpose||s.purposeType||'').trim(),w=window.open('','_blank');if(!w)return alert('Druckfenster konnte nicht geöffnet werden. Bitte Popups erlauben.');let taxLine=(cfg.sponsorTaxOffice||cfg.sponsorTaxNumber)?`Finanzamt: ${esc(cfg.sponsorTaxOffice||'')} &nbsp;&nbsp; Steuernummer: ${esc(cfg.sponsorTaxNumber||'')}`:'';let exemption=(cfg.sponsorExemptionDate||cfg.sponsorAssessmentYear)?`Freistellungsbescheid vom ${esc(fd(cfg.sponsorExemptionDate)||'')} &nbsp;&nbsp; Veranlagungszeitraum: ${esc(cfg.sponsorAssessmentYear||'')}`:'';let sixty=(cfg.sponsor60aOffice||cfg.sponsor60aTaxNumber||cfg.sponsor60aDate)?`Feststellung nach § 60a AO: ${esc(cfg.sponsor60aOffice||'')} &nbsp;&nbsp; StNr. ${esc(cfg.sponsor60aTaxNumber||'')} &nbsp;&nbsp; Bescheid vom ${esc(fd(cfg.sponsor60aDate)||'')}`:'';let proof=exemption?`<p><b>Steuerliche Voraussetzungen</b><br>${exemption}<br>${taxLine}</p>`:(sixty?`<p><b>Steuerliche Voraussetzungen</b><br>${sixty}</p>`:`<p class="notice"><b>Hinweis:</b> Steuerliche Angaben bitte vor Ausstellung ergänzen.</p>`);w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Spendenbestätigung</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#111;font-size:10.5pt;line-height:1.28;margin:0}h1{text-align:center;font-size:19pt;margin:8mm 0 5mm}.issuer{font-size:9.5pt}.box{border:1px solid #777;border-radius:4px;padding:7px;margin:5mm 0}.amount{font-size:20pt;font-weight:800;text-align:center;border:2px solid #111;padding:8px;margin:4mm 0}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.section{margin-top:4mm}.legal{font-size:8.2pt}.notice{background:#fff4d6;padding:7px;border:1px solid #d8b24a}.sign{margin-top:8mm}.print{position:fixed;right:15px;bottom:15px;padding:10px 16px}@media print{.print{display:none}}</style></head><body><div class="issuer"><b>Aussteller</b><br>${esc(cfg.sponsorLegalName||iss.name)}<br>${esc(iss.address)}<br>${esc(iss.zip)} ${esc(iss.city)}</div><h1>Bestätigung über Geldzuwendungen</h1><div class="box"><b>Name und Anschrift des Zuwendenden</b><br>${esc(s.company)}<br>${esc(s.address)}<br>${esc([s.zip,s.city].filter(Boolean).join(' '))}</div><div class="meta"><div><b>Tag der Zuwendung</b><br>${esc(fd(d))}</div><div><b>Begünstigter Zweck</b><br>${esc(purpose||'—')}</div></div><div class="amount">${esc(sponsorEuro(amount))}</div><div style="text-align:center;font-size:9pt">in Worten: ${esc(words)}</div>${proof}<div class="section"><b>Verzicht auf Erstattung von Aufwendungen</b><br>☐ Ja &nbsp;&nbsp; ☐ Nein</div><div class="section"><b>Verwendung der Zuwendung</b><br>Es wird bestätigt, dass die Zuwendung nur zur Förderung des oben angegebenen begünstigten Zwecks verwendet wird.</div><div class="section"><b>Mitgliedsbeitrag</b><br>Es wird bestätigt, dass es sich nicht um einen Mitgliedsbeitrag handelt, dessen Abzug nach § 10b Abs. 1 EStG ausgeschlossen ist.</div><div class="sign">${esc(iss.city)}, ${esc(fd(d))}<br><br>________________________________________<br>Ort, Datum und Unterschrift des Zuwendungsempfängers</div><p class="legal"><b>Hinweis:</b> Wer vorsätzlich oder grob fahrlässig eine unrichtige Zuwendungsbestätigung erstellt oder veranlasst, dass Zuwendungen nicht zu den in der Zuwendungsbestätigung angegebenen steuerbegünstigten Zwecken verwendet werden, haftet für die entgangene Steuer (§ 10b Abs. 4 EStG, § 9 Abs. 3 KStG, § 9 Nr. 5 GewStG).</p><p class="legal">Diese Bestätigung wird nicht als Nachweis für die steuerliche Berücksichtigung der Zuwendung anerkannt, wenn das Datum des Freistellungsbescheides länger als 5 Jahre bzw. das Datum der Feststellung der Einhaltung der satzungsmäßigen Voraussetzungen nach § 60a Abs. 1 AO länger als 3 Jahre seit Ausstellung des Bescheides zurückliegt (§ 63 Abs. 5 AO).</p><button class="print" onclick="print()">Drucken</button><script>window.onload=()=>setTimeout(()=>print(),250)<\\/script></body></html>`);w.document.close();}
function numberToGermanWords(n){let x=Math.round(Number(n)*100)/100,whole=Math.floor(x),cent=Math.round((x-whole)*100),ones=['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun'],teens=['zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'],tens=['','','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig','achtzig','neunzig'];function under100(n){if(n<10)return ones[n];if(n<20)return teens[n-10];let t=Math.floor(n/10),o=n%10;return (o?ones[o]+'und':'')+tens[t];}function under1000(n){if(n<100)return under100(n);let h=Math.floor(n/100),r=n%100;return (h===1?'ein':ones[h])+'hundert'+(r?under100(r):'');}function group(n,word,singular){if(!n)return '';return under1000(n)+(n===1?singular:word);}let parts=[];if(whole>=1000000){let m=Math.floor(whole/1000000);parts.push(group(m,'millionen','million'));whole%=1000000;}if(whole>=1000){let t=Math.floor(whole/1000);parts.push(group(t,'tausend','tausend'));whole%=1000;}if(whole||!parts.length)parts.push(under1000(whole));return parts.join(' ')+` Euro und ${String(cent).padStart(2,'0')} Cent`;}
function sponsorEmailText(s){let gross=sponsorMoney(s.amountGross)||sponsorMoney(s.amountNet),date=s.invoiceDate?fd(s.invoiceDate):fd(new Date().toISOString().slice(0,10));return `Guten Tag ${s.contact||s.company||''},\n\nanbei/zu Ihrer Information erhalten Sie die Unterlagen zum Sponsoring beim EC Wegscheid.\n\nBetrag: ${sponsorEuro(gross)}\nDatum: ${date}\n\nVielen Dank für Ihre Unterstützung.\n\nEC Wegscheid`}
function sponsorSendEmail(id){
 if(!ensureAdmin())return;const sponsor=S.sponsors.find(x=>+x.id===+id);if(!sponsor)return;
 const to=String(sponsor.email||'').trim();if(!to)return alert('Für diesen Sponsor ist keine E-Mail-Adresse hinterlegt.');
 const modal=$('sponsorMailDialog');if(!modal)return alert('Mailformular nicht verfügbar.');
 $('sponsorMailId').value=String(id);$('sponsorMailTo').value=to;
 $('sponsorMailSubject').value='EC Wegscheid – Sponsoring '+new Date().getFullYear();
 $('sponsorMailBody').value=sponsorEmailText(sponsor);$('sponsorMailFile').value='';
 $('sponsorMailStatus').textContent='Google-Anmeldung erforderlich. Dieselbe OAuth-Client-ID wie in Turnierverwaltung → Einladung senden wird verwendet.';
 modal.style.display='flex';
}


// ==================== Serienbrief 2.5.2 ====================
let serialFileData=null;
let serialFileType="";
let serialSelected=new Set();
function serialActiveMembers(){return (Array.isArray(S.members)?S.members:[]).filter(m=>m&&!m.exitType);}
function serialMemberKey(m){
 if(m&&m.id!=null&&String(m.id).trim()!=="")return String(m.id);
 if(m&&m.memberNo!=null&&String(m.memberNo).trim()!=="")return "no:"+String(m.memberNo);
 return "k:"+[m?.lastName,m?.firstName,m?.birthDate,m?.address,m?.zip,m?.city].map(x=>String(x??"").trim().toLocaleLowerCase("de-DE")).join("|");
}
function serialFamilyKey(m){
 return [m?.lastName,m?.address,m?.zip,m?.city,m?.country].map(x=>String(x??"").trim().toLocaleLowerCase("de-DE")).join("|");
}
function serialFamilyMembers(m){
 const key=serialFamilyKey(m);
 return serialActiveMembers().filter(x=>serialFamilyKey(x)===key);
}
function serialDisplayName(m){
 const fam=serialFamilyMembers(m);
 const firsts=[...new Set(fam.map(x=>String(x?.firstName||"").trim()).filter(Boolean))];
 return fam.length>1 ? `${String(m?.lastName||"").trim()} ${firsts.join(" + ")}`.trim() : `${String(m?.lastName||"").trim()} ${String(m?.firstName||"").trim()}`.trim() || "Ohne Namen";
}
let serialLoadGeneration=0;
function serialClearFile(){
 serialLoadGeneration++;
 serialFileData=null;serialFileType="";
 const input=$("serialFile");if(input)input.value="";
 const info=$("serialFileInfo");if(info)info.textContent="Noch kein Dokument ausgewählt.";
 const preview=$("serialPreview");if(preview)preview.style.display="none";
 const pages=$("serialPreviewPages");if(pages)pages.innerHTML="";
 const button=$("serialRemoveFile");if(button)button.disabled=true;
}
async function serialLoadFile(file){
 if(!file){
  serialClearFile();return;
 }
 const generation=++serialLoadGeneration;
 serialFileData=file;
 serialFileType=file.name.toLowerCase().endsWith(".pdf")?"pdf":"docx";
 $("serialRemoveFile").disabled=false;
 $("serialFileInfo").textContent=`Ausgewählt: ${file.name} (${Math.round(file.size/1024)} KB)`;
 $("serialPreview").style.display="block";
 $("serialPreviewPages").innerHTML='<div class="smallnote">Dokument wird geladen …</div>';
 try{
  let pages=await serialDocumentPages(file);
  if(generation!==serialLoadGeneration)return;
  let preview=$("serialPreviewPages");preview.innerHTML="";
  pages.forEach(pg=>{
   let box=document.createElement("div");box.className="serialPreviewPage";
   let content=pg.cloneNode(true);
   content.classList.remove("serialPage");
   box.appendChild(content);
   preview.appendChild(box);
  });
 }catch(e){
  if(generation!==serialLoadGeneration)return;
  $("serialPreviewPages").innerHTML=`<div class="notice">Dokument konnte nicht angezeigt werden: ${esc(e?.message||e)}</div>`;
 }
}
function renderSerialMembers(){
 if(!U?.admin)return;
 let q=String($("serialSearch")?.value||"").trim().toLowerCase();
 let active=serialActiveMembers();
 let list=active.filter(m=>{let t=[m.lastName,m.firstName,m.address,m.zip,m.city,m.email].map(x=>String(x||"").toLowerCase()).join(" ");return !q||t.includes(q)});
 let allKeys=new Set(active.map(serialMemberKey));
 serialSelected.forEach(k=>{if(!allKeys.has(k))serialSelected.delete(k)});
 $("serialMembers").innerHTML=list.map(m=>{
   let key=serialMemberKey(m),name=`${m.lastName || ""} ${m.firstName || ""}`.trim()||"Ohne Namen",addr=[m.address,m.zip,m.city].filter(Boolean).join(", ");
   return `<label class="serialMemberRow"><input type="checkbox" data-serial-key="${encodeURIComponent(key)}" ${serialSelected.has(key)?"checked":""}><span><b>${esc(name)}</b><br><span class="serialMeta">${esc(addr||"Keine Adresse hinterlegt")}</span></span></label>`
 }).join("")||'<div class="smallnote" style="padding:12px">Keine passenden aktiven Mitglieder gefunden.</div>';
 $("serialCount").textContent=`${serialSelected.size} Mitglieder ausgewählt.`;
 $("serialMembers")?.querySelectorAll("input[data-serial-key]").forEach(cb=>{
   cb.addEventListener("change",()=>serialToggleMember(decodeURIComponent(cb.getAttribute("data-serial-key")||""),cb.checked));
 });
}
function escJs(x){return String(x??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\n/g,"\\n").replace(/\r/g,"\\r")}
function serialToggleMember(key,checked){
 let m=serialActiveMembers().find(x=>serialMemberKey(x)===String(key));
 let familyMode=!!$("serialFamilyMode")?.checked;
 if(familyMode && m){
   serialActiveMembers().filter(x=>serialFamilyKey(x)===serialFamilyKey(m)).forEach(x=>{
     let k=serialMemberKey(x); if(checked)serialSelected.add(k); else serialSelected.delete(k);
   });
 }else{
   if(checked)serialSelected.add(String(key));else serialSelected.delete(String(key));
 }
 renderSerialMembers();
}
function serialSelectAll(on){serialSelected=on?new Set(serialActiveMembers().map(serialMemberKey)):new Set();renderSerialMembers()}
function serialOpen(){if(!ensureAdmin())return;serialSelected=new Set();$("serialSearch").value="";page("serial")}
async function serialPdfPages(file){
 if(!window.pdfjsLib)throw new Error("PDF-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.");
 window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
 let pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,pages=[];
 for(let i=1;i<=pdf.numPages;i++){
  let pg=await pdf.getPage(i),base=pg.getViewport({scale:1}),scale=794/base.width*1.35,view=pg.getViewport({scale});
  let canvas=document.createElement("canvas");canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
  await pg.render({canvasContext:canvas.getContext("2d"),viewport:view}).promise;
  let img=document.createElement("img");img.src=canvas.toDataURL("image/png");img.alt=`Dokumentseite ${i}`;img.style.width="210mm";img.style.height="297mm";img.style.display="block";
  let page=document.createElement("div");page.className="serialPage serialDocumentPage";page.appendChild(img);pages.push(page);
 }
 return pages;
}
async function serialDocxPages(file){
 if(!window.docx||!window.docx.renderAsync)throw new Error("Word-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.");
 let holder=document.createElement("div");holder.className="docx-wrapper";holder.style.display="none";document.body.appendChild(holder);
 await window.docx.renderAsync(file,holder,null,{breakPages:true,ignoreLastRenderedPageBreak:false,experimental:true});
 let secs=[...holder.querySelectorAll(":scope > section")];
 if(!secs.length)secs=[...holder.children];
 let pages=secs.map(sec=>{
  let page=document.createElement("div");page.className="serialPage serialDocumentPage";
  let clone=sec.cloneNode(true);page.appendChild(clone);return page
 });
 if(!pages.length){
  let page=document.createElement("div");page.className="serialPage serialDocumentPage";
  let clone=holder.cloneNode(true);clone.style.display="block";page.appendChild(clone);pages=[page]
 }
 holder.remove();return pages;
}
async function serialDocumentPages(file){return serialFileType==="pdf"?serialPdfPages(file):serialDocxPages(file)}

function serialCountryCode(v){
 const x=String(v||"").trim().toLowerCase();
 if(!x)return "";
 if(x==="deutschland"||x==="germany"||x==="d")return "D";
 if(x==="österreich"||x==="oesterreich"||x==="austria"||x==="a")return "A";
 return String(v).trim();
}
function serialAddressPage(m){
 let p=document.createElement("div");p.className="serialPage serialAddressPage";
 let name=serialDisplayName(m);
 let cc=serialCountryCode(m.country);
 let zipCity=m.zip&&m.city?`${cc?cc+" ":""}${m.zip} ${m.city}`:(m.zip?`${cc?cc+" ":""}${m.zip}`:(m.city||""));
 let lines=[m.address,zipCity];
 p.innerHTML=`<div class="serialFold one"></div><div class="serialFold two"></div><div class="serialAddressBlock"><div class="serialAddressName">${esc(name)}</div>${lines.filter(Boolean).map(x=>`<div>${esc(x)}</div>`).join("")}</div>`;
 return p;
}
async function serialPrint(){
 if(!U?.admin)return alert("Bitte zuerst als Admin anmelden.");
 if(!serialFileData)return alert("Bitte zuerst ein Word- oder PDF-Dokument auswählen.");
 let chosen=serialActiveMembers().filter(m=>serialSelected.has(serialMemberKey(m)));
 if(!chosen.length)return alert("Bitte mindestens ein Mitglied auswählen.");
 if($("serialFamilyMode")?.checked){
   const seen=new Set(), grouped=[];
   chosen.forEach(m=>{const k=serialFamilyKey(m); if(seen.has(k))return; seen.add(k); grouped.push(m);});
   chosen=grouped;
 }
 let old=document.getElementById("serialPrint");if(old)old.remove();
 let root=document.createElement("div");root.id="serialPrint";document.body.appendChild(root);
 try{
  let templatePages=await serialDocumentPages(serialFileData);
  if(!templatePages.length)throw new Error("Das Dokument enthält keine druckbaren Seiten.");
  for(let m of chosen){
   // Seite 1 des Schreibens
   root.appendChild(templatePages[0].cloneNode(true));
   // Seite 2: nur Anschrift und Faltlinien, ohne zusätzliche Kopfzeile/Beschriftung
   root.appendChild(serialAddressPage(m));
   // Weitere Seiten des ursprünglichen Dokuments unverändert danach
   for(let i=1;i<templatePages.length;i++)root.appendChild(templatePages[i].cloneNode(true));
  }
  document.body.classList.add("serialPrinting");
  let cleanup=()=>{document.body.classList.remove("serialPrinting");window.removeEventListener("afterprint",cleanup);setTimeout(()=>root.remove(),100)};
  window.addEventListener("afterprint",cleanup);setTimeout(()=>window.print(),300);
 }catch(e){root.remove();document.body.classList.remove("serialPrinting");alert("Serienbrief konnte nicht vorbereitet werden: "+(e?.message||e));console.error(e)}
}
function printMembers(){
 let cols=[["Nr.","id"]];if(S.settings.showBirthDate)cols.push(["Geburtsdatum","birthDate"]);cols.push(["Nachname","lastName"],["Vorname","firstName"]);if(S.settings.showMemberSince)cols.push(["Mitglied seit","memberSince"]);if(S.settings.showAddress)cols.push(["Adresse","address"],["PLZ","zip"],["Ort","city"]);if(S.settings.showContact)cols.push(["Mobil","phoneMobile"],["E-Mail","email"]);
 let rows=S.members.slice().sort((a,b)=>a.lastName.localeCompare(b.lastName)).map(m=>"<tr>"+cols.map(x=>`<td>${esc(x[1]==="birthDate"?fd(m[x[1]]):m[x[1]])}</td>`).join("")+"</tr>").join("");
 let w=window.open("","_blank");w.document.write(`<html><head><title>Gesamtliste</title><style>body{font-family:Arial}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #999;padding:4px;text-align:left}@media(max-width:1050px){.navTabs{gap:2px;margin-left:4px}.navTabs button{padding:5px 5px;font-size:11px}} @media(max-width:820px){.navTabs{flex-wrap:wrap;overflow:visible}.navTabs button{font-size:11px}} </style></head><body><h1>EC Wegscheid – Gesamtliste Mitglieder</h1><table><tr>${cols.map(x=>`<th>${x[0]}</th>`).join("")}</tr>${rows}</table><div id="mainMenuBox" style="position:fixed;right:18px;bottom:18px;z-index:25;display:flex;flex-direction:column;align-items:stretch;gap:8px"><button id="mainMenuBtn" class="btn primary" onclick="page('dashboard');window.scrollTo({top:0,behavior:'smooth'});" style="box-shadow:0 4px 14px #0008">Zurück zum Hauptmenü</button><button id="startPageBtn" class="btn primary" onclick="try{window.opener.focus()}catch(e){}window.close()" style="box-shadow:0 4px 14px #0008">Zurück zur Startseite</button></div>
<script>window.addEventListener("load",()=>{const v=document.getElementById("versionLabel");if(v)v.textContent="2.5.2";setTimeout(()=>window.ecwFirebaseRefresh?.(),300);});<\/script></body></html>`);w.document.close();w.print();
}
function printRound(){let y=new Date().getFullYear(),a=S.members.filter(m=>round(m,y)).sort((x,z)=>age(x.birthDate,y)-age(z.birthDate,y)),rows=a.map(m=>`<tr><td>${esc(m.firstName)} ${esc(m.lastName)}</td><td>${esc(fd(m.birthDate))}</td><td>${esc(age(m.birthDate,y))}</td><td>${esc(m.phoneMobile)}</td><td>${esc(m.email)}</td></tr>`).join(""),w=window.open("","_blank");w.document.write(`<html><head><title>Runde Geburtstage</title><style>body{font-family:Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px;text-align:left}@media(max-width:1050px){.navTabs{gap:2px;margin-left:4px}.navTabs button{padding:5px 5px;font-size:11px}} @media(max-width:820px){.navTabs{flex-wrap:wrap;overflow:visible}.navTabs button{font-size:11px}} 
/* Eigene Turniere: Live-Startlisten-Kachel in Größe einer Einladung */
.own-live-startlist-tile{
  border:0!important;
  padding:0!important;
  margin:0!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  cursor:pointer;
  overflow:hidden;
  background:linear-gradient(160deg,#7b0000 0%,#a70000 55%,#4f0000 100%)!important;
  color:#fff!important;
  box-shadow:0 3px 12px rgba(0,0,0,.35);
}
.own-live-startlist-tile:hover{filter:brightness(1.08)}
.own-live-startlist-inner{
  width:100%;height:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;
  border:3px solid rgba(255,255,255,.72);box-sizing:border-box;
  padding:8%;
}
.own-live-startlist-icon{font-size:clamp(32px,5vw,82px);line-height:1;margin-bottom:8%}
.own-live-startlist-title{font-size:clamp(18px,2.2vw,36px);font-weight:900;letter-spacing:.02em}
.own-live-startlist-sub{margin-top:6%;font-size:clamp(12px,1.2vw,20px);font-weight:800;letter-spacing:.22em;opacity:.9}

/* Eigene Turniere: Platzhalter in Einladungsgröße mit Turnierauswahl */
.own-live-startlist-tile{
  width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
  margin:0!important;padding:0!important;overflow:hidden!important;
  background:linear-gradient(160deg,#171a1f 0%,#22272e 70%,#15171b 100%)!important;
  border:1px solid rgba(255,255,255,.18)!important;
  box-shadow:0 3px 12px rgba(0,0,0,.35);
}
.own-live-startlist-inner{
  box-sizing:border-box;width:100%;height:100%;padding:6%;
  display:flex;flex-direction:column;gap:5%;
}
.own-live-startlist-head{
  flex:0 0 auto;text-align:center;color:#fff;font-weight:900;
  font-size:clamp(13px,1.6vw,25px);letter-spacing:.02em;
  padding-bottom:5%;border-bottom:2px solid #b51f2b;
}
.own-live-startlist-buttons{
  flex:1;min-height:0;display:flex;flex-direction:column;gap:4%;overflow-y:auto;
}
.own-live-turnier-btn{
  width:100%;min-height:0;flex:1 1 auto;
  display:flex;flex-direction:column;justify-content:center;align-items:center;
  padding:4% 5%!important;margin:0!important;
  border:1px solid rgba(255,255,255,.25)!important;border-radius:7px!important;
  background:#b51f2b!important;color:#fff!important;
  font-weight:800!important;font-size:clamp(10px,1.05vw,17px)!important;
  line-height:1.15!important;text-align:center!important;
}
.own-live-turnier-btn:hover{background:#86141d!important}
.own-live-date{display:block;font-size:.78em;font-weight:600;opacity:.9;margin-top:3px}
.own-live-empty{
  flex:1;display:flex;align-items:center;justify-content:center;
  color:#aeb5bf;text-align:center;font-size:clamp(10px,1vw,16px)
}
</style></head><body><h1>EC Wegscheid – Runde Geburtstage ${y}</h1><p>Ab ${S.settings.roundAge}. Geburtstag, in 10er-Schritten.</p><table><tr><th>Name</th><th>Geburtsdatum</th><th>Alter</th><th>Mobil</th><th>E-Mail</th></tr>${rows}</table><div id="mainMenuBox" style="position:fixed;right:18px;bottom:18px;z-index:25;display:flex;flex-direction:column;align-items:stretch;gap:8px"><button id="mainMenuBtn" class="btn primary" onclick="page('dashboard');window.scrollTo({top:0,behavior:'smooth'});" style="box-shadow:0 4px 14px #0008">Zurück zum Hauptmenü</button><button id="startPageBtn" class="btn primary" onclick="try{window.opener.focus()}catch(e){}window.close()" style="box-shadow:0 4px 14px #0008">Zurück zur Startseite</button></div>
<script>window.addEventListener("load",()=>{setTimeout(()=>window.ecwFirebaseRefresh?.(),300);});<\/script></body></html>`);w.document.close();w.print()}
function csvCell(v){return `"${String(v??"").replaceAll('"','""')}"`}
function downloadCsv(name,headers,rows){
  let now=new Date();
  let year=now.getFullYear();
  let exportDate=fmtDate(now);
  let csv=[
    [`Kalenderjahr ${year}`],
    [`Exportdatum: ${exportDate}`],
    [],
    headers,
    ...rows
  ].map(r=>r.map(csvCell).join(";")).join("\r\n");
  let a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
  a.download=name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function exportDirectDebit(){
  if(!ensureAdmin()||!U.export)return alert("Keine Export-Berechtigung.");
  let a=activeMembersForPayment().filter(m=>m.paymentMethod==="directDebit" && [m.accountHolder,m.iban,m.bic,m.bank].some(v=>String(v??"").trim()!==""));
  if(!a.length)return alert("Keine aktiven Mitglieder mit automatischem Bankeinzug und Bankdaten gefunden.");
  let headers=["Mitgliedsname","Adresse","PLZ","Ort","Kontoinhaber","IBAN","BIC","Kreditinstitut"];
  let rows=a.map(m=>[`${m.firstName||""} ${m.lastName||""}`.trim(),m.address,m.zip,m.city,m.accountHolder,m.iban,m.bic,m.bank]);
  downloadCsv("EC_Wegscheid_Bankeinzug_Bankdaten.csv",headers,rows);
}
function exportCashPayers(){
  if(!ensureAdmin()||!U.export)return alert("Keine Export-Berechtigung.");
  let a=activeMembersForPayment().filter(m=>m.paymentMethod==="cash" || ![m.accountHolder,m.iban,m.bic,m.bank].some(v=>String(v??"").trim()!==""));
  if(!a.length)return alert("Keine Barzahler gefunden.");
  let headers=["Mitgliedsname","Adresse","PLZ","Ort"];
  let rows=a.map(m=>[`${m.firstName||""} ${m.lastName||""}`.trim(),m.address,m.zip,m.city]);
  downloadCsv("EC_Wegscheid_Barzahler.csv",headers,rows);
}
function exportContributionExempt(){
  if(!ensureAdmin()||!U.export)return alert("Keine Export-Berechtigung.");
  let y=new Date().getFullYear();
  let a=activeMembersForPayment().filter(m=>contributionExempt(m,y));
  if(!a.length)return alert("Keine beitragsbefreiten aktiven Mitglieder gefunden.");
  let headers=["Mitgliedsname","Adresse","PLZ","Ort","Geburtsdatum","Mitglied seit","Beitragsbefreit bis"];
  let rows=a.map(m=>[
    `${m.firstName||""} ${m.lastName||""}`.trim(),
    m.address,m.zip,m.city,m.birthDate,m.memberSince,fd(contributionExemptUntil(m))
  ]);
  downloadCsv("EC_Wegscheid_Beitragsbefreite_Mitglieder.csv",headers,rows);
}
function csv(){
  if(!U.export||!S.settings.exportMembers)return alert("Der Mitglieder-Export ist im Admin-Bereich deaktiviert.");
  let c=["id","lastName","firstName","birthDate","memberSince","address","country","zip","city","phoneMobile","phoneFixed","email","accountHolder","iban","bic","bank","notes","exitType","exitDate"];
  let now=new Date(),year=now.getFullYear(),exportDate=fmtDate(now);
  let rows=[[`Kalenderjahr ${year}`],[`Exportdatum: ${exportDate}`],[],c,...S.members.map(m=>c.map(k=>m[k]))];
  let csvText="\ufeff"+rows.map(r=>r.map(csvCell).join(";")).join("\r\n");
  let a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csvText],{type:"text/csv;charset=utf-8"}));
  a.download="EC_Wegscheid_Mitglieder.csv";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}


// === EC Wegscheid V2.9.9: Mitgliederverwaltung Sammelkorrekturen ===
const memberSensitiveFields=new Set(['accountHolder','iban','bic','bank','paymentMethod']);
function memberDisplayLabels(){return {lastName:'Nachname',firstName:'Vorname',birthDate:'Geburtsdatum',memberSince:'Mitglied seit',address:'Adresse',countryCode:'Länderkennung',country:'Land',zip:'PLZ',city:'Ort',phoneMobile:'Mobil',phoneFixed:'Festnetz',email:'E-Mail',notes:'Notizen',exitType:'Austrittsstatus',exitDate:'Austrittsdatum',accountHolder:'Kontoinhaber',iban:'IBAN',bic:'BIC',bank:'Kreditinstitut',paymentMethod:'Zahlungsart'};}
function memberDisplayOrder(){
 const labels=memberDisplayLabels();const existing=Array.isArray(S.settings.displayOrder)?S.settings.displayOrder:[];
 const out=[...new Set(['lastName','firstName',...existing].filter(k=>Object.prototype.hasOwnProperty.call(labels,k)))];
 Object.keys(labels).forEach(k=>{if(!out.includes(k))out.push(k)});
 return out;
}
function memberFieldVisible(k){
 const visible=S.settings.displayVisible||{};
 if(Object.prototype.hasOwnProperty.call(visible,k))return visible[k]===true;
 if(k==='lastName'||k==='firstName')return true;
 const legacy={birthDate:'showBirthDate',memberSince:'showMemberSince',address:'showAddress',countryCode:'showCountryCode',zip:'showAddress',city:'showAddress',phoneMobile:'showContact',email:'showContact'};
 return !!legacy[k] && S.settings[legacy[k]]!==false && (S.settings.displayOrder||[]).includes(k);
}
function memberDisplayToggle(k,checked){
 if(!U?.admin)return;
 S.settings.displayVisible={...(S.settings.displayVisible||{}),[k]:!!checked};
 save();renderM();
}
function memberFilterRoundBirthdays(rows,now,settings){
 const mode=settings?.roundBirthdayMode||'future';
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 if(mode==='all')return rows;
 if(mode==='firstHalf')return rows.filter(m=>m.bd.getMonth()<6);
 if(mode==='secondHalf')return rows.filter(m=>m.bd.getMonth()>=6);
 
 if(mode==='next6'){
   const end=new Date(start.getFullYear(),start.getMonth()+6,start.getDate());
   return rows.filter(m=>m.bd>=start&&m.bd<=end);
 }
 return rows.filter(m=>m.bd>=start);
}
function memberOpenCentralUsers(){
 try{
  if(window.parent&&window.parent!==window&&window.parent.appPermissions?.admin===true&&typeof window.parent.openUserRightsAdmin==='function'){
   window.parent.openUserRightsAdmin();return;
  }
 }catch(e){console.error(e)}
 alert('Bitte in der zentralen Vereinsverwaltung „Benutzer & Rechte“ öffnen. Dort werden die Firebase-Berechtigungen verwaltet.');
}
function memberFeeEuro(){return (Math.max(0,Number(S.settings?.fee)||0)).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';}
let memberApplicationPdfUrl='',memberApplicationBusy=null,memberApplicationLastFee=null;
function memberApplicationStatus(text){const el=$('memberApplicationStatus');if(el)el.textContent=text;}
function memberApplicationPdfFromJpeg(jpegBytes,w,h){
 // Minimaler, valider einseitiger PDF-Container mit JPEG-Bild (A4).
 const enc=new TextEncoder();const chunks=[];let length=0;const offsets=[0];
 function put(v){const b=typeof v==='string'?enc.encode(v):v;chunks.push(b);length+=b.length;}
 function obj(id,body){offsets[id]=length;put(id+' 0 obj\n'+body+'\nendobj\n');}
 put('%PDF-1.4\n');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.32 841.92] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
 offsets[4]=length;put('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpegBytes.length+' >>\nstream\n');put(jpegBytes);put('\nendstream\nendobj\n');
 const content='q 595.32 0 0 841.92 0 0 cm /Im0 Do Q\n';
 obj(5,'<< /Length '+enc.encode(content).length+' >>\nstream\n'+content+'endstream');
 const xref=length;put('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)put(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 put('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 return new Blob(chunks,{type:'application/pdf'});
}
async function memberApplicationGenerate(){
 const img=new Image();img.src='assets/mitgliedsantrag_basis.png';await img.decode();
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 const factor=canvas.width/595.32;
 // Das Original-PDF hatte die Beitragsangabe bei x=411 / y=272 (Koordinaten vom oberen Rand).
 ctx.fillStyle='#111';ctx.textBaseline='top';ctx.font='bold '+Math.round(17*factor)+'px Arial,sans-serif';
 ctx.fillText(memberFeeEuro(),411*factor,271*factor);
 ctx.font=Math.round(9*factor)+'px Arial,sans-serif';
 ctx.fillText('Aktueller Mitgliedsbeitrag',310*factor,302*factor);
 const data=canvas.toDataURL('image/jpeg',0.94).split(',')[1];const bin=atob(data);const bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return memberApplicationPdfFromJpeg(bytes,canvas.width,canvas.height);
}
async function memberApplicationRefresh(){
 const frame=$('ecwMitgliedsantragVorschau');if(!frame)return;
 if(memberApplicationBusy)return memberApplicationBusy;
 memberApplicationBusy=(async()=>{
  memberApplicationStatus('PDF mit aktuellem Mitgliedsbeitrag wird erstellt …');
  try{
   const blob=await memberApplicationGenerate();
   const url=URL.createObjectURL(blob);const previous=memberApplicationPdfUrl;
   memberApplicationPdfUrl=url;memberApplicationLastFee=memberFeeEuro();frame.src=url+'#view=FitH';
   if(previous)setTimeout(()=>URL.revokeObjectURL(previous),3000);
   memberApplicationStatus('PDF mit '+memberFeeEuro()+' erstellt. Vorschau, Druck und Download verwenden denselben Betrag.');
  }catch(e){console.error(e);memberApplicationStatus('PDF-Erstellung fehlgeschlagen: '+(e?.message||e));}
 })();try{await memberApplicationBusy;}finally{memberApplicationBusy=null;}
}
async function memberApplicationOpen(){if(!memberApplicationPdfUrl||memberApplicationLastFee!==memberFeeEuro())await memberApplicationRefresh();if(!memberApplicationPdfUrl)return;window.open(memberApplicationPdfUrl,'_blank','noopener');}
async function memberApplicationDownload(){if(!memberApplicationPdfUrl||memberApplicationLastFee!==memberFeeEuro())await memberApplicationRefresh();if(!memberApplicationPdfUrl)return;const a=document.createElement('a');a.href=memberApplicationPdfUrl;a.download='Mitgliedsantrag_EC_Wegscheid_Aktuell.pdf';document.body.appendChild(a);a.click();a.remove();}
