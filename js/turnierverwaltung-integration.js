
(function(){
try{

// Turnierverwaltung verwendet jetzt dieselbe Firebase-App, Authentifizierung und Firestore-Datenbank wie die Gesamtverwaltung.
const auth = window.firebaseAuth;
const db = window.firestoreDb;
const collection = (d, n) => d.collection(n);
const doc = (d, c, id) => d.collection(c).doc(id);
const addDoc = (ref, data) => ref.add(data);
const deleteDoc = (ref) => ref.delete();
const updateDoc = (ref, data) => ref.update(data);
const setDoc = (ref, data, opts) => ref.set(data, opts);
const getDoc = async (ref) => { const s = await ref.get(); return { id: s.id, exists: () => s.exists, data: () => s.data() }; };
const where = (f, op, v) => ({ t: "w", f, op, v });
const orderBy = (f, d) => ({ t: "o", f, d });
const query = (ref, ...cs) => cs.reduce((q, c) => c.t === "w" ? q.where(c.f, c.op, c.v) : q.orderBy(c.f, c.d), ref);
const onSnapshot = (q, cb, eb) => q.onSnapshot(cb, eb || ((e) => console.error("Turnierverwaltung:", e)));
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
const signInWithEmailAndPassword = (a, e, p) => a.signInWithEmailAndPassword(e, p);
const signOut = (a) => a.signOut();
const onAuthStateChanged = (a, cb) => a.onAuthStateChanged(cb);
const tvById = (id) => document.getElementById("tv_" + id);



// ---------- Auth ----------
let tvStarted = false;
const loginScreen = tvById("loginScreen");
const appScreen = tvById("app");

onAuthStateChanged(auth, (user) => {
  const allowed=!!(user && (window.parent===window ? hasAppPermission('tv') : true));
  if (user && allowed) {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    if (!tvStarted) { tvStarted = true; startListeners(); }
  } else {
    tvStarted = false;
    loginScreen.classList.add("hidden");
    appScreen.classList.add("hidden");
  }
});
if(tvById("loginBtn"))tvById("loginBtn").style.display="none";
if(tvById("logoutBtn"))tvById("logoutBtn").onclick=()=>window.logout?.();

// ---------- Navigation ----------
const navTurniere = tvById("navTurniere");
const navVereine = tvById("navVereine");
const viewTurniereListe = tvById("viewTurniereListe");
const viewTurnierDetail = tvById("viewTurnierDetail");
const viewVereine = tvById("viewVereine");
const viewVergangene = tvById("viewVergangene");

function showTurniereListe() {
  navTurniere.classList.add("active");
  navVereine.classList.remove("active");
  viewTurniereListe.classList.remove("hidden");
  viewTurnierDetail.classList.add("hidden");
  viewVereine.classList.add("hidden");
  viewVergangene.classList.add("hidden");
}
function showVergangene() {
  navTurniere.classList.add("active");
  navVereine.classList.remove("active");
  viewVergangene.classList.remove("hidden");
  viewTurniereListe.classList.add("hidden");
  viewTurnierDetail.classList.add("hidden");
  viewVereine.classList.add("hidden");
}
function showVereine() {
  navVereine.classList.add("active");
  navTurniere.classList.remove("active");
  viewVereine.classList.remove("hidden");
  viewTurniereListe.classList.add("hidden");
  viewTurnierDetail.classList.add("hidden");
  viewVergangene.classList.add("hidden");
}
function showTurnierDetail() {
  viewTurnierDetail.classList.remove("hidden");
  viewTurniereListe.classList.add("hidden");
  viewVereine.classList.add("hidden");
  viewVergangene.classList.add("hidden");
}

navTurniere.addEventListener("click", showTurniereListe);
navVereine.addEventListener("click", showVereine);
tvById("backToTurniere").addEventListener("click", () => {
  if (turnierAusArchiv) showVergangene(); else showTurniereListe();
});
tvById("vergangeneBtn").addEventListener("click", showVergangene);
tvById("backFromVergangene").addEventListener("click", showTurniereListe);

// ---------- Uhrzeit-Auswahl (halbstündlich) ----------
function buildZeitOptions(selectEl, placeholder) {
  let html = `<option value="">${placeholder}</option>`;
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      html += `<option value="${hh}:${mm}">${hh}:${mm}</option>`;
    }
  }
  selectEl.innerHTML = html;
}
buildZeitOptions(tvById("tUhrzeit"), "– Uhrzeit wählen –");
buildZeitOptions(tvById("tMeldeUhrzeit"), "– Uhrzeit wählen –");
buildZeitOptions(tvById("tdEditUhrzeit"), "– Uhrzeit wählen –");
buildZeitOptions(tvById("tdEditMeldeUhrzeit"), "– Uhrzeit wählen –");

// ---------- Mannschafts-Auswahl (maximale Anzahl) ----------
function buildMaxOptions(selectEl) {
  let html = '<option value="">– unbegrenzt –</option>';
  for (let n = 2; n <= 40; n++) {
    html += `<option value="${n}">${n}</option>`;
  }
  selectEl.innerHTML = html;
}
buildMaxOptions(tvById("tMax"));
buildMaxOptions(tvById("tdEditMax"));

// ---------- Daten-Caches ----------
let vereineCache = [];
let aktuellesTurnier = null;
let meldungenUnsub = null;
let turnierAusArchiv = false;

function startListeners() {
  listenTurniere();
  listenVereine();
  ladeImportFlags();
}

// ---------- Turniere ----------
tvById("tAddBtn").addEventListener("click", async () => {
  const name = tvById("tName").value.trim();
  const datum = tvById("tDatum").value;
  const uhrzeit = tvById("tUhrzeit").value;
  const ort = tvById("tOrt").value.trim();
  const meldeUhrzeit = tvById("tMeldeUhrzeit").value;
  const maxMannschaftenRaw = tvById("tMax").value;
  const maxMannschaften = maxMannschaftenRaw ? parseInt(maxMannschaftenRaw, 10) : null;
  if (!name) { alert("Bitte einen Turniernamen eingeben."); return; }
  await addDoc(collection(db, "turniere"), {
    name, datum, uhrzeit, ort, meldeUhrzeit, maxMannschaften, erstelltAm: serverTimestamp()
  });
  tvById("tName").value = "";
  tvById("tDatum").value = "";
  tvById("tUhrzeit").value = "";
  tvById("tOrt").value = "";
  tvById("tMeldeUhrzeit").value = "";
  tvById("tMax").value = "";
});

function turnierListItem(id, t, ausArchiv) {
  const item = document.createElement("div");
  item.className = "list-item";
  item.innerHTML = `
    <div>
      <div><strong>${escapeHtml(t.name)}</strong></div>
      <div class="meta">${t.datum ? formatDatum(t.datum) : ""}${t.uhrzeit ? ", " + escapeHtml(t.uhrzeit) + " Uhr" : ""} ${t.ort ? "· " + escapeHtml(t.ort) : ""}${t.maxMannschaften ? " · max. " + t.maxMannschaften + " Mannschaften" : ""}</div>
    </div>
    <div>&rsaquo;</div>
  `;
  item.addEventListener("click", () => openTurnier(id, t, ausArchiv));
  return item;
}

function listenTurniere() {
  const q = query(collection(db, "turniere"), orderBy("datum", "asc"));
  onSnapshot(q, (snap) => {
    const container = tvById("turniereListe");
    const archiv = tvById("vergangeneListe");
    container.innerHTML = "";
    archiv.innerHTML = "";
    const heute = tvHeute();
    const kommende = [], vergangene = [];
    snap.forEach((docSnap) => {
      const t = docSnap.data();
      // Turniere ohne Datum bleiben in der normalen Liste; vergangen = Datum liegt vor heute
      if (t.datum && t.datum < heute) vergangene.push({ id: docSnap.id, t });
      else kommende.push({ id: docSnap.id, t });
    });
    vergangene.reverse(); // neueste zuerst

    if (kommende.length === 0) {
      container.innerHTML = '<div class="meta">' + (snap.empty ? "Noch keine Turniere angelegt." : "Keine anstehenden Turniere.") + '</div>';
    } else {
      kommende.forEach((x) => container.appendChild(turnierListItem(x.id, x.t, false)));
    }
    if (vergangene.length === 0) {
      archiv.innerHTML = '<div class="meta">Noch keine vergangenen Turniere.</div>';
    } else {
      vergangene.forEach((x) => archiv.appendChild(turnierListItem(x.id, x.t, true)));
    }
    tvById("vergangeneBtn").textContent = "📁 Vergangene Turniere (" + vergangene.length + ")";
  });
}

function openTurnier(id, data, ausArchiv) {
  turnierAusArchiv = !!ausArchiv;
  aktuellesTurnier = { ...data, id };
  tvById("tdName").textContent = data.name;
  tvById("tdMeta").textContent =
    (data.datum ? formatDatum(data.datum) : "") +
    (data.uhrzeit ? ", " + data.uhrzeit + " Uhr" : "") +
    (data.ort ? " · " + data.ort : "") +
    (data.meldeUhrzeit ? " · Meldeschluss: " + data.meldeUhrzeit + " Uhr" : "") +
    (data.maxMannschaften ? " · max. " + data.maxMannschaften + " Mannschaften" : "");
  tvById("tdEditForm").classList.add("hidden");
  resetStartlisteEingabe();
  fillVereinSelect();
  showTurnierDetail();
  listenMeldungen(id);
}

// ---------- Turnier bearbeiten ----------
tvById("tdEditBtn").addEventListener("click", () => {
  if (!aktuellesTurnier) return;
  tvById("tdEditName").value = aktuellesTurnier.name || "";
  tvById("tdEditDatum").value = aktuellesTurnier.datum || "";
  tvById("tdEditUhrzeit").value = aktuellesTurnier.uhrzeit || "";
  tvById("tdEditOrt").value = aktuellesTurnier.ort || "";
  tvById("tdEditMeldeUhrzeit").value = aktuellesTurnier.meldeUhrzeit || "";
  tvById("tdEditMax").value = aktuellesTurnier.maxMannschaften ? String(aktuellesTurnier.maxMannschaften) : "";
  tvById("tdEditForm").classList.remove("hidden");
});
tvById("tdEditCancelBtn").addEventListener("click", () => {
  tvById("tdEditForm").classList.add("hidden");
});
tvById("tdEditSaveBtn").addEventListener("click", async () => {
  if (!aktuellesTurnier) return;
  const name = tvById("tdEditName").value.trim();
  const datum = tvById("tdEditDatum").value;
  const uhrzeit = tvById("tdEditUhrzeit").value;
  const ort = tvById("tdEditOrt").value.trim();
  const meldeUhrzeit = tvById("tdEditMeldeUhrzeit").value;
  const maxMannschaftenRaw = tvById("tdEditMax").value;
  const maxMannschaften = maxMannschaftenRaw ? parseInt(maxMannschaftenRaw, 10) : null;
  if (!name) { alert("Bitte einen Turniernamen eingeben."); return; }
  const updated = { name, datum, uhrzeit, ort, meldeUhrzeit, maxMannschaften };
  await updateDoc(doc(db, "turniere", aktuellesTurnier.id), updated);
  aktuellesTurnier = { ...aktuellesTurnier, ...updated };
  tvById("tdName").textContent = name;
  tvById("tdMeta").textContent =
    (datum ? formatDatum(datum) : "") +
    (uhrzeit ? ", " + uhrzeit + " Uhr" : "") +
    (ort ? " · " + ort : "") +
    (meldeUhrzeit ? " · Meldeschluss: " + meldeUhrzeit + " Uhr" : "") +
    (maxMannschaften ? " · max. " + maxMannschaften + " Mannschaften" : "");
  tvById("tdEditForm").classList.add("hidden");
  updateKapazitaetsAnzeige();
});

// ---------- Turnier löschen (V2.9.15: atomar und mit Fehleranzeige) ----------
tvById("tdDeleteBtn").addEventListener("click", async () => {
  if (!aktuellesTurnier) return;
  const t = aktuellesTurnier;
  const button = tvById("tdDeleteBtn");
  if(button.disabled)return;
  button.disabled=true;
  try {
    const snap = await db.collection("meldungen").where("turnierId", "==", t.id).get();
    if(snap.size>450){alert('Dieses Turnier hat mehr als 450 Meldungen. Bitte vor dem Löschen den Administrator kontaktieren.');return;}
    const question = 'Turnier „'+(t.name||'')+'“ wirklich endgültig löschen?'
      +(snap.size?'\n\nDabei werden auch alle '+snap.size+' Mannschaftsmeldungen gelöscht.':'')
      +'\n\nDas kann nicht rückgängig gemacht werden.';
    if(!confirm(question))return;
    if(!aktuellesTurnier||aktuellesTurnier.id!==t.id)return;
    const batch=db.batch();
    snap.forEach(item=>batch.delete(item.ref));
    batch.delete(db.collection('turniere').doc(t.id));
    await batch.commit();
    if(meldungenUnsub){meldungenUnsub();meldungenUnsub=null;}
    aktuellesTurnier=null;
    aktuelleMeldungenAnzahl=0;
    aktuelleMeldungenListe=[];
    if(turnierAusArchiv)showVergangene();else showTurniereListe();
  } catch(err) {
    console.error('Turnier löschen:',err);
    alert('Turnier nicht gelöscht: '+(err?.message||err)+'\nBitte die Berechtigungen der Turnierverwaltung prüfen.');
  } finally {button.disabled=false;}
});

// ---------- Dialoge: Mannschaft entfernen / Kontaktdaten ----------
function tvHeute() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function tvOpenModal(innerHtml) {
  const ov = document.createElement("div");
  ov.className = "tvm-overlay";
  ov.innerHTML = '<div class="tvm-dialog" role="dialog" aria-modal="true">' + innerHtml + '</div>';
  document.body.appendChild(ov);
  return ov;
}

// Auswahl: "Vom Verein wieder abgemeldet" (mit Datum) oder "Einfach löschen" (ohne Datum)
function tvMeldungEntfernenDialog(meldungId, vereinName) {
  const ov = tvOpenModal(
    '<h3>Mannschaft aus der Startliste entfernen</h3>' +
    '<p class="tvm-name">' + escapeHtml(vereinName) + '</p>' +
    '<label class="tvm-opt"><input type="radio" name="tvm_art" value="abgemeldet" checked>' +
    '<span><b>Vom Verein wieder abgemeldet</b><br><small>Bleibt mit Abmeldedatum in der Liste sichtbar, zählt aber nicht mehr zur Mannschaftszahl.</small></span></label>' +
    '<div class="tvm-datum"><label>Abgemeldet am</label><input type="date" id="tvm_datum" value="' + tvHeute() + '"></div>' +
    '<label class="tvm-opt"><input type="radio" name="tvm_art" value="loeschen">' +
    '<span><b>Einfach löschen</b><br><small>Für Eingabefehler – ohne Datum, die Meldung verschwindet komplett.</small></span></label>' +
    '<div class="tvm-err" id="tvm_err"></div>' +
    '<div class="tvm-btns"><button type="button" class="tvm-cancel">Abbrechen</button><button type="button" class="tvm-ok">Bestätigen</button></div>'
  );
  const q = (sel) => ov.querySelector(sel);
  const close = () => ov.remove();
  const art = () => ov.querySelector('input[name="tvm_art"]:checked').value;
  const sync = () => {
    const ab = art() === "abgemeldet";
    q(".tvm-datum").style.display = ab ? "" : "none";
    q(".tvm-ok").textContent = ab ? "Als abgemeldet eintragen" : "Endgültig löschen";
    q(".tvm-ok").classList.toggle("tvm-danger", !ab);
  };
  ov.querySelectorAll('input[name="tvm_art"]').forEach((r) => r.addEventListener("change", sync));
  sync();
  q(".tvm-cancel").addEventListener("click", close);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  q(".tvm-ok").addEventListener("click", async () => {
    const btn = q(".tvm-ok");
    const err = q("#tvm_err");
    err.textContent = "";
    try {
      if (art() === "abgemeldet") {
        const datum = q("#tvm_datum").value;
        if (!datum) { err.textContent = "Bitte das Abmeldedatum angeben."; return; }
        btn.disabled = true;
        await updateDoc(doc(db, "meldungen", meldungId), { status: "abgemeldet", abgemeldetAm: datum });
      } else {
        if (!confirm("„" + vereinName + "“ wirklich endgültig aus der Startliste löschen?\n\nDas kann nicht rückgängig gemacht werden.")) return;
        btn.disabled = true;
        await deleteDoc(doc(db, "meldungen", meldungId));
      }
      close();
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      err.textContent = "Das hat nicht geklappt: " + ((e && e.message) || e);
    }
  });
}

// Kontaktdaten bei manuell eingegebener Mannschaft. pflicht=true: alle Felder erforderlich
// (wenn die Mannschaft neu in die Vereinsliste übernommen wird). Ergebnis: Objekt oder null (abgebrochen).
function tvKontaktDialog(name, pflicht) {
  return new Promise((resolve) => {
    const stern = pflicht ? " *" : "";
    const ov = tvOpenModal(
      '<h3>Kontaktdaten der Mannschaft</h3>' +
      '<p class="tvm-name">' + escapeHtml(name) + '</p>' +
      '<p class="tvm-hint">' + (pflicht
        ? 'Pflichtfelder, weil die Mannschaft neu in die Vereinsliste übernommen wird.'
        : 'Optional – die Angaben werden bei der Meldung gespeichert.') + '</p>' +
      '<label>Ansprechpartner' + stern + '</label><input type="text" id="tvm_ap" autocomplete="off">' +
      '<label>Telefonnummer' + stern + '</label><input type="tel" id="tvm_tel" autocomplete="off">' +
      '<label>E-Mail-Adresse' + stern + '</label><input type="email" id="tvm_mail" autocomplete="off">' +
      '<div class="tvm-err" id="tvm_err"></div>' +
      '<div class="tvm-btns"><button type="button" class="tvm-cancel">Abbrechen</button><button type="button" class="tvm-ok">Übernehmen</button></div>'
    );
    const q = (sel) => ov.querySelector(sel);
    const close = (val) => { ov.remove(); resolve(val); };
    q(".tvm-cancel").addEventListener("click", () => close(null));
    ov.addEventListener("click", (e) => { if (e.target === ov) close(null); });
    q(".tvm-ok").addEventListener("click", () => {
      const ansprechpartner = q("#tvm_ap").value.trim();
      const telefon = q("#tvm_tel").value.trim();
      const email = q("#tvm_mail").value.trim();
      const err = q("#tvm_err");
      if (pflicht && !ansprechpartner) { err.textContent = "Bitte den Ansprechpartner eingeben."; return; }
      if (pflicht && !telefon) { err.textContent = "Bitte die Telefonnummer eingeben."; return; }
      if (pflicht && !email) { err.textContent = "Bitte die E-Mail-Adresse eingeben."; return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = "Die E-Mail-Adresse ist nicht gültig."; return; }
      close({ ansprechpartner, telefon, email });
    });
    setTimeout(() => q("#tvm_ap").focus(), 50);
  });
}

// ---------- Meldungen / Startliste ----------
function resetStartlisteEingabe() {
  tvById("tdVereinSelect").value = "";
  tvById("tdManuellName").value = "";
  tvById("tdManuellUebernehmen").checked = false;
  tvById("tdAnmeldedatum").value = "";
  tvById("tdAnmeldeart").value = "";
}

// Auswahl und manuelle Eingabe schließen sich gegenseitig aus
tvById("tdManuellName").addEventListener("input", (e) => {
  if (e.target.value.trim()) tvById("tdVereinSelect").value = "";
});
tvById("tdVereinSelect").addEventListener("change", (e) => {
  if (e.target.value) {
    tvById("tdManuellName").value = "";
    tvById("tdManuellUebernehmen").checked = false;
  }
});

tvById("tdAddMeldungBtn").addEventListener("click", async () => {
  if (!aktuellesTurnier) return;
  const auswahlId = tvById("tdVereinSelect").value;
  const manuellName = tvById("tdManuellName").value.trim();
  const uebernehmen = tvById("tdManuellUebernehmen").checked;
  const anmeldedatum = tvById("tdAnmeldedatum").value;
  const anmeldeart = tvById("tdAnmeldeart").value;
  if (!auswahlId && !manuellName) { alert("Bitte einen Verein auswählen oder eine Mannschaft manuell eingeben."); return; }
  if (!anmeldedatum) { alert("Bitte ein Anmeldedatum wählen."); return; }
  if (aktuellesTurnier.maxMannschaften && aktuelleMeldungenAnzahl >= aktuellesTurnier.maxMannschaften) {
    alert("Die maximale Anzahl an Mannschaften ist bereits erreicht.");
    return;
  }

  let vereinId = "";
  let vereinName = "";
  let kontakt = null;
  if (manuellName) {
    // Gibt es den Verein schon (gleicher Name), wird der bestehende verwendet – kein Duplikat
    const vorhanden = vereineCache.find((v) => (v.name || "").trim().toLowerCase() === manuellName.toLowerCase());
    if (vorhanden) {
      vereinId = vorhanden.id;
      vereinName = vorhanden.name;
    } else {
      vereinName = manuellName;
      // Zusatzfenster: Ansprechpartner, Telefonnummer, E-Mail (bei "Neu in die Vereinsliste übernehmen" Pflicht)
      kontakt = await tvKontaktDialog(manuellName, uebernehmen);
      if (!kontakt) return;
      if (uebernehmen) {
        const ref = await addDoc(collection(db, "vereine"), {
          name: manuellName, region: "", vorstand: "",
          ansprechpartner: kontakt.ansprechpartner, email: kontakt.email, telefon: kontakt.telefon,
          ansprechpartner2: "", email2: "", telefon2: "",
          einladungEmail1: !!kontakt.email, einladungEmail2: false,
          erstelltAm: serverTimestamp()
        });
        vereinId = ref.id;
      }
    }
  } else {
    const verein = vereineCache.find((v) => v.id === auswahlId);
    vereinId = auswahlId;
    vereinName = verein ? verein.name : "";
  }

  const meldung = {
    turnierId: aktuellesTurnier.id,
    vereinId,
    vereinName,
    anmeldedatum,
    anmeldeart,
    erstelltAm: serverTimestamp()
  };
  if (kontakt) {
    if (kontakt.ansprechpartner) meldung.kontaktAnsprechpartner = kontakt.ansprechpartner;
    if (kontakt.telefon) meldung.kontaktTelefon = kontakt.telefon;
    if (kontakt.email) meldung.kontaktEmail = kontakt.email;
  }
  try {
    await addDoc(collection(db, "meldungen"), meldung);
  } catch (err) {
    console.error(err);
    let gespeichert = false;
    if (anmeldeart) {
      try {
        const ohneArt = { ...meldung };
        delete ohneArt.anmeldeart;
        await addDoc(collection(db, "meldungen"), ohneArt);
        gespeichert = true;
        alert("Die Mannschaft wurde hinzugefügt, aber „Angemeldet per“ konnte nicht gespeichert werden.");
      } catch (err2) { console.error(err2); }
    }
    if (!gespeichert) {
      alert("Die Mannschaft konnte nicht zur Startliste hinzugefügt werden: " + ((err && err.message) || err));
      return;
    }
  }
  resetStartlisteEingabe();
  // Live-Startliste sicher aktualisieren (falls der Listener zwischenzeitlich beendet wurde)
  listenMeldungen(aktuellesTurnier.id);
});

let aktuelleMeldungenAnzahl = 0;
let aktuelleMeldungenListe = [];

function listenMeldungen(turnierId) {
  if (meldungenUnsub) { meldungenUnsub(); meldungenUnsub = null; }
  // Es wird nur nach Turnier gefiltert (dafür ist kein Firestore-Composite-Index nötig).
  // Die Sortierung nach Anmeldedatum passiert unten im Browser – so erscheinen neu
  // gemeldete Mannschaften zuverlässig und sofort in der Live-Startliste.
  const q = query(
    collection(db, "meldungen"),
    where("turnierId", "==", turnierId)
  );
  meldungenUnsub = onSnapshot(q, (snap) => {
    // Veraltete Antworten eines zuvor geöffneten Turniers ignorieren
    if (!aktuellesTurnier || aktuellesTurnier.id !== turnierId) return;
    const body = tvById("startlisteBody");
    const leer = tvById("startlisteLeer");
    body.innerHTML = "";
    leer.textContent = "Noch keine Meldungen für dieses Turnier.";
    aktuelleMeldungenListe = [];

    const docs = [];
    snap.forEach((d) => docs.push(d));
    const zeit = (m) => (m.erstelltAm && typeof m.erstelltAm.toMillis === "function")
      ? m.erstelltAm.toMillis()
      : Number.MAX_SAFE_INTEGER; // noch nicht vom Server bestätigt = ganz neu, kommt ans Ende
    docs.sort((a, b) => {
      const ma = a.data(), mb = b.data();
      const da = ma.anmeldedatum || "", dbb = mb.anmeldedatum || "";
      if (da !== dbb) return da < dbb ? -1 : 1;
      const za = zeit(ma), zb = zeit(mb);
      return za === zb ? 0 : (za < zb ? -1 : 1);
    });

    const aktive = docs.filter((d) => d.data().status !== "abgemeldet");
    const abgemeldete = docs.filter((d) => d.data().status === "abgemeldet").sort((a, b) => {
      const x = a.data().abgemeldetAm || "", y = b.data().abgemeldetAm || "";
      return x === y ? 0 : (x < y ? -1 : 1);
    });
    aktuelleMeldungenAnzahl = aktive.length; // abgemeldete Mannschaften zählen nicht mehr

    if (docs.length === 0) {
      leer.classList.remove("hidden");
    } else {
      leer.classList.add("hidden");
      let i = 1;
      aktive.forEach((docSnap) => {
        const m = docSnap.data();
        aktuelleMeldungenListe.push({ verein: m.vereinName || "", datum: m.anmeldedatum || "", art: m.anmeldeart || "" });
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${i++}</td>
          <td>${escapeHtml(m.vereinName || "")}</td>
          <td>${m.anmeldedatum ? formatDatum(m.anmeldedatum) : ""}</td>
          <td>${escapeHtml(m.anmeldeart || "")}</td>
          <td><button class="danger" data-id="${docSnap.id}">Entfernen</button></td>
        `;
        tr.querySelector("button").addEventListener("click", () => {
          tvMeldungEntfernenDialog(docSnap.id, m.vereinName || "");
        });
        body.appendChild(tr);
      });
      abgemeldete.forEach((docSnap) => {
        const m = docSnap.data();
        const tr = document.createElement("tr");
        tr.className = "tv-abgemeldet";
        tr.innerHTML = `
          <td>–</td>
          <td class="tv-abname">${escapeHtml(m.vereinName || "")}</td>
          <td>${m.anmeldedatum ? formatDatum(m.anmeldedatum) : ""}</td>
          <td>Abgemeldet${m.abgemeldetAm ? " am " + formatDatum(m.abgemeldetAm) : ""}</td>
          <td><button class="danger" data-id="${docSnap.id}">Löschen</button></td>
        `;
        tr.querySelector("button").addEventListener("click", async () => {
          if (confirm("Die abgemeldete Mannschaft endgültig aus der Liste löschen?")) {
            await deleteDoc(doc(db, "meldungen", docSnap.id));
          }
        });
        body.appendChild(tr);
      });
    }
    updateKapazitaetsAnzeige();
  }, (err) => {
    console.error("Startliste konnte nicht geladen werden:", err);
    const leer = tvById("startlisteLeer");
    leer.textContent = "Die Startliste konnte nicht geladen werden: " + ((err && err.message) || err);
    leer.classList.remove("hidden");
  });
}

function updateKapazitaetsAnzeige() {
  const kapEl = tvById("tdKapazitaet");
  const addBtn = tvById("tdAddMeldungBtn");
  const max = aktuellesTurnier ? aktuellesTurnier.maxMannschaften : null;
  if (max) {
    kapEl.textContent = `${aktuelleMeldungenAnzahl} / ${max} Mannschaften gemeldet`;
    kapEl.classList.remove("hidden");
    if (aktuelleMeldungenAnzahl >= max) {
      addBtn.disabled = true;
      addBtn.textContent = "Maximale Anzahl erreicht";
    } else {
      addBtn.disabled = false;
      addBtn.textContent = "Hinzufügen";
    }
  } else {
    kapEl.classList.add("hidden");
    addBtn.disabled = false;
    addBtn.textContent = "Hinzufügen";
  }
}

// ---------- Kreis 107 Import ----------
const KREIS107_VEREINE = [];

tvById("importKreis107Btn").addEventListener("click", async () => {
  const statusEl = tvById("importKreis107Status");
  const btn = tvById("importKreis107Btn");
  btn.disabled = true;
  statusEl.textContent = "Importiere …";
  const bestehendeNamen = new Set(vereineCache.map(v => (v.name || "").trim().toLowerCase()));
  let importiert = 0, uebersprungen = 0;
  for (const v of KREIS107_VEREINE) {
    if (bestehendeNamen.has(v.name.trim().toLowerCase())) { uebersprungen++; continue; }
    await addDoc(collection(db, "vereine"), {
      name: v.name, region: v.region, vorstand: v.vorstand || "",
      ansprechpartner: v.ansprechpartner || "", email: v.email || "", telefon: v.telefon || "",
      einladungEmail1: true, einladungEmail2: false,
      ansprechpartner2: "", email2: "", telefon2: "",
      erstelltAm: serverTimestamp()
    });
    importiert++;
  }
  statusEl.textContent = `Fertig: ${importiert} Verein(e) importiert, ${uebersprungen} übersprungen (bereits vorhanden).`;
  btn.disabled = false;
  await markiereImportErledigt("kreis107Import");
});

// ---------- Kreis 102 Import ----------
const KREIS102_VEREINE = [];

// ---------- Kontakte-Import (vCard) ----------
const KONTAKTE_VCARD_FULL = [];

async function importKontakteHandler() {
  const statusEl = tvById("importKontakteStatus");
  const btn = tvById("importKontakteBtn");
  btn.disabled = true;
  statusEl.textContent = "Importiere …";
  const bestehendeNamen = new Set(vereineCache.map(v => (v.name || "").trim().toLowerCase()));
  let importiert = 0, uebersprungen = 0;
  for (const v of KONTAKTE_VCARD_FULL) {
    if (!v.name || !v.name.trim()) { continue; }
    if (bestehendeNamen.has(v.name.trim().toLowerCase())) { uebersprungen++; continue; }
    await addDoc(collection(db, "vereine"), {
      name: v.name, region: "", vorstand: v.vorstand || "",
      ansprechpartner: "", email: v.email || "", telefon: v.telefon || "",
      ansprechpartner2: "", email2: "", telefon2: "",
      einladungEmail1: true, einladungEmail2: false,
      erstelltAm: serverTimestamp()
    });
    importiert++;
  }
  statusEl.textContent = `Fertig: ${importiert} Kontakt(e) importiert, ${uebersprungen} übersprungen (bereits vorhanden).`;
  await markiereImportErledigt("kontakteImport");
}

tvById("importKontakteBtn").addEventListener("click", importKontakteHandler);

tvById("importKreis102Btn").addEventListener("click", async () => {
  const statusEl = tvById("importKreis102Status");
  const btn = tvById("importKreis102Btn");
  btn.disabled = true;
  statusEl.textContent = "Importiere …";
  const bestehendeNamen = new Set(vereineCache.map(v => (v.name || "").trim().toLowerCase()));
  let importiert = 0, uebersprungen = 0;
  for (const v of KREIS102_VEREINE) {
    if (bestehendeNamen.has(v.name.trim().toLowerCase())) { uebersprungen++; continue; }
    await addDoc(collection(db, "vereine"), {
      name: v.name, region: v.region, vorstand: v.vorstand || "",
      ansprechpartner: v.ansprechpartner || "", email: v.email || "", telefon: v.telefon || "",
      einladungEmail1: true, einladungEmail2: false,
      ansprechpartner2: "", email2: "", telefon2: "",
      erstelltAm: serverTimestamp()
    });
    importiert++;
  }
  statusEl.textContent = `Fertig: ${importiert} Verein(e) importiert, ${uebersprungen} übersprungen (bereits vorhanden).`;
  btn.disabled = false;
  await markiereImportErledigt("kreis102Import");
});

// ---------- Import-Karten: verschwinden nach erfolgtem Import ----------
const IMPORT_KARTEN = [
  { key: "kontakteImport", cardId: "importKontakteCard", liste: () => KONTAKTE_VCARD_FULL },
  { key: "kreis107Import", cardId: "importKreis107Card", liste: () => KREIS107_VEREINE },
  { key: "kreis102Import", cardId: "importKreis102Card", liste: () => KREIS102_VEREINE }
];
const importFlags = {};
let importFlagsGeladen = false;

async function ladeImportFlags() {
  for (const k of IMPORT_KARTEN) {
    try {
      const snap = await getDoc(doc(db, "einstellungen", k.key));
      importFlags[k.key] = snap.exists() && !!snap.data().importiert;
    } catch (e) {
      console.error(e);
      importFlags[k.key] = false;
    }
  }
  importFlagsGeladen = true;
  aktualisiereImportKarten();
}

async function markiereImportErledigt(key) {
  importFlags[key] = true;
  aktualisiereImportKarten();
  try {
    await setDoc(doc(db, "einstellungen", key), { importiert: true, importiertAm: serverTimestamp() });
  } catch (e) { console.error(e); }
}

function aktualisiereImportKarten() {
  if (!importFlagsGeladen) return;
  const namen = new Set(vereineCache.map(v => (v.name || "").trim().toLowerCase()));
  for (const k of IMPORT_KARTEN) {
    const card = tvById(k.cardId);
    if (!card) continue;
    // Waren alle Vereine der Liste schon vorhanden (z. B. früher importiert), gilt der Import als erledigt
    const liste = k.liste().filter(v => v.name && v.name.trim());
    const alleVorhanden = liste.length > 0 && liste.every(v => namen.has(v.name.trim().toLowerCase()));
    if (alleVorhanden && !importFlags[k.key]) {
      importFlags[k.key] = true;
      setDoc(doc(db, "einstellungen", k.key), { importiert: true, importiertAm: serverTimestamp() }).catch(console.error);
    }
    card.classList.toggle("hidden", !!importFlags[k.key]);
  }
}

// ---------- Vereine ----------
let editingVereinId = null;

function resetVereinForm() {
  ["vName","vRegion","vVorstand","vAnsprechpartner","vEmail","vTelefon","vAnsprechpartner2","vEmail2","vTelefon2"]
    .forEach(id => tvById(id).value = "");
  tvById("vEmailEinladung1").checked = false;
  tvById("vEmailEinladung2").checked = false;
  editingVereinId = null;
  tvById("vFormTitle").textContent = "Neuen Verein anlegen";
  tvById("vAddBtn").textContent = "Verein anlegen";
  tvById("vCancelEditBtn").style.display = "none";
}

function startEditVerein(v) {
  editingVereinId = v.id;
  tvById("vName").value = v.name || "";
  tvById("vRegion").value = v.region || "";
  tvById("vVorstand").value = v.vorstand || "";
  tvById("vAnsprechpartner").value = v.ansprechpartner || "";
  tvById("vEmail").value = v.email || "";
  tvById("vTelefon").value = v.telefon || "";
  tvById("vAnsprechpartner2").value = v.ansprechpartner2 || "";
  tvById("vEmail2").value = v.email2 || "";
  tvById("vTelefon2").value = v.telefon2 || "";
  tvById("vEmailEinladung1").checked = !!v.einladungEmail1;
  tvById("vEmailEinladung2").checked = !!v.einladungEmail2;
  tvById("vFormTitle").textContent = "Verein bearbeiten";
  tvById("vAddBtn").textContent = "Änderungen speichern";
  tvById("vCancelEditBtn").style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

tvById("vCancelEditBtn").addEventListener("click", resetVereinForm);

tvById("vAddBtn").addEventListener("click", async () => {
  const name = tvById("vName").value.trim();
  const region = tvById("vRegion").value.trim();
  const vorstand = tvById("vVorstand").value.trim();
  const ansprechpartner = tvById("vAnsprechpartner").value.trim();
  const email = tvById("vEmail").value.trim();
  const telefon = tvById("vTelefon").value.trim();
  const ansprechpartner2 = tvById("vAnsprechpartner2").value.trim();
  const email2 = tvById("vEmail2").value.trim();
  const telefon2 = tvById("vTelefon2").value.trim();
  const einladungEmail1 = tvById("vEmailEinladung1").checked;
  const einladungEmail2 = tvById("vEmailEinladung2").checked;
  if (!name) { alert("Bitte einen Vereinsnamen eingeben."); return; }
  const data = {
    name, region, vorstand, ansprechpartner, email, telefon,
    ansprechpartner2, email2, telefon2,
    einladungEmail1, einladungEmail2
  };
  if (editingVereinId) {
    await updateDoc(doc(db, "vereine", editingVereinId), data);
  } else {
    await addDoc(collection(db, "vereine"), { ...data, erstelltAm: serverTimestamp() });
  }
  resetVereinForm();
});

let vereineSort = { field: "name", dir: 1 };
tvById("sortName").addEventListener("click", () => {
  vereineSort = { field: "name", dir: vereineSort.field === "name" ? -vereineSort.dir : 1 };
  renderVereine();
});
tvById("sortRegion").addEventListener("click", () => {
  vereineSort = { field: "region", dir: vereineSort.field === "region" ? -vereineSort.dir : 1 };
  renderVereine();
});
tvById("vRegionFilter").addEventListener("change", renderVereine);

function listenVereine() {
  const q = query(collection(db, "vereine"));
  onSnapshot(q, (snap) => {
    vereineCache = [];
    snap.forEach((docSnap) => {
      vereineCache.push({ id: docSnap.id, ...docSnap.data() });
    });
    updateRegionFilterOptions();
    renderVereine();
    aktualisiereImportKarten();
    if (viewTurnierDetail && !viewTurnierDetail.classList.contains("hidden")) {
      fillVereinSelect();
    }
  });
}

function updateRegionFilterOptions() {
  const select = tvById("vRegionFilter");
  const current = select.value;
  const regionen = [...new Set(vereineCache.map(v => v.region).filter(Boolean))].sort();
  select.innerHTML = '<option value="">Alle Regionen</option>' +
    regionen.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  select.value = current;

  const datalist = tvById("vRegionDatalist");
  datalist.innerHTML = regionen.map(r => `<option value="${escapeHtml(r)}"></option>`).join("");
}

function renderVereine() {
  const filter = tvById("vRegionFilter").value;
  let list = vereineCache.filter(v => !filter || v.region === filter);
  list.sort((a, b) => {
    const av = (a[vereineSort.field] || "").toLowerCase();
    const bv = (b[vereineSort.field] || "").toLowerCase();
    return av < bv ? -1 * vereineSort.dir : av > bv ? 1 * vereineSort.dir : 0;
  });
  const body = tvById("vereineBody");
  body.innerHTML = "";
  list.forEach((v) => {
    const tr = document.createElement("tr");
    const ansprechpartnerHtml = [v.ansprechpartner, v.ansprechpartner2].filter(Boolean).map(escapeHtml).join("<br>");
    const emailParts = [];
    if (v.email) emailParts.push(escapeHtml(v.email) + (v.einladungEmail1 ? ' <strong title="Für Turniereinladungen">✓</strong>' : ""));
    if (v.email2) emailParts.push(escapeHtml(v.email2) + (v.einladungEmail2 ? ' <strong title="Für Turniereinladungen">✓</strong>' : ""));
    const emailHtml = emailParts.join("<br>");
    const telefonHtml = [v.telefon, v.telefon2].filter(Boolean).map(escapeHtml).join("<br>");
    tr.innerHTML = `
      <td>${escapeHtml(v.name || "")}</td>
      <td>${escapeHtml(v.region || "")}</td>
      <td>${escapeHtml(v.vorstand || "")}</td>
      <td>${ansprechpartnerHtml}</td>
      <td>${emailHtml}</td>
      <td>${telefonHtml}</td>
      <td style="white-space:nowrap;">
        <button class="secondary" data-action="edit" style="margin-right:6px;">Bearbeiten</button>
        <button class="danger" data-action="delete">Löschen</button>
      </td>
    `;
    tr.querySelector('[data-action="edit"]').addEventListener("click", () => startEditVerein(v));
    tr.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (confirm(`Verein "${v.name}" wirklich löschen?`)) {
        await deleteDoc(doc(db, "vereine", v.id));
      }
    });
    body.appendChild(tr);
  });
}

function fillVereinSelect() {
  const select = tvById("tdVereinSelect");
  const sorted = [...vereineCache].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const aktuell = select.value;
  select.innerHTML = `<option value="">– Verein auswählen –</option>` +
    sorted.map(v => `<option value="${v.id}">${escapeHtml(v.name)}${v.region ? " (" + escapeHtml(v.region) + ")" : ""}</option>`).join("");
  if (aktuell && sorted.some(v => v.id === aktuell)) select.value = aktuell;
}


// ---------- Startliste drucken / als PDF speichern ----------
function startlisteDaten() {
  const t = aktuellesTurnier || {};
  const info = [];
  const wann = (t.datum ? formatDatum(t.datum) : "") + (t.uhrzeit ? ", " + t.uhrzeit + " Uhr" : "");
  if (wann) info.push("Datum: " + wann);
  if (t.ort) info.push("Ort: " + t.ort);
  if (t.meldeUhrzeit) info.push("Meldeschluss: " + t.meldeUhrzeit + " Uhr");
  info.push("Mannschaften: " + aktuelleMeldungenListe.length + (t.maxMannschaften ? " von max. " + t.maxMannschaften : ""));
  const rows = aktuelleMeldungenListe.map((m, i) => [String(i + 1), m.verein, m.datum ? formatDatum(m.datum) : "", m.art]);
  const d = new Date();
  const heute = String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
  return { title: "Startliste – " + (t.name || "Turnier"), name: t.name || "Turnier", info, rows, heute };
}

function pdfBytesStartliste(daten) {
  const W = 595, H = 842, M = 50;
  const MAP = { "–": 0x96, "—": 0x97, "€": 0x80, "…": 0x85, "„": 0x84, "“": 0x93, "”": 0x94, "’": 0x92, "‘": 0x91 };
  const enc = (s) => {
    let o = "";
    for (const ch of String(s).replace(/[\r\n\t]+/g, " ")) {
      let c = MAP[ch] !== undefined ? MAP[ch] : ch.charCodeAt(0);
      if (c > 255) c = 63;
      const t = String.fromCharCode(c);
      o += (t === "\\" || t === "(" || t === ")") ? "\\" + t : t;
    }
    return o;
  };
  const text = (font, size, x, y, s) => "BT /" + font + " " + size + " Tf " + x + " " + y + " Td (" + enc(s) + ") Tj ET\n";
  const line = (y, grau) => grau + " G 0.5 w " + M + " " + y + " m " + (W - M) + " " + y + " l S\n";
  const cols = [
    { x: M, max: 4, label: "#" },
    { x: M + 30, max: 46, label: "Verein" },
    { x: M + 300, max: 12, label: "Anmeldedatum" },
    { x: M + 390, max: 16, label: "Angemeldet per" }
  ];
  const pages = [];
  let cur = "", y = H - M;
  const kopf = () => {
    let s = "";
    cols.forEach((c) => { s += text("F2", 10, c.x, y, c.label); });
    s += line(y - 5, "0.3");
    y -= 20;
    return s;
  };
  cur += text("F2", 16, M, y, daten.title);
  y -= 24;
  daten.info.forEach((l) => { cur += text("F1", 10, M, y, l); y -= 14; });
  y -= 10;
  cur += kopf();
  const rows = daten.rows.length ? daten.rows : [["", "Noch keine Meldungen für dieses Turnier.", "", ""]];
  rows.forEach((r) => {
    if (y < 70) { pages.push(cur); cur = ""; y = H - M; cur += kopf(); }
    cols.forEach((c, i) => {
      let v = String(r[i] === undefined ? "" : r[i]);
      if (v.length > c.max) v = v.slice(0, c.max - 3) + "...";
      cur += text("F1", 10, c.x, y, v);
    });
    cur += line(y - 5, "0.85");
    y -= 18;
  });
  pages.push(cur);
  const n = pages.length;
  const objs = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = [];
  for (let i = 0; i < n; i++) kids.push((5 + 2 * i) + " 0 R");
  objs[2] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + n + " >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((p, i) => {
    const content = p + text("F1", 8, M, 30, "Gedruckt am " + daten.heute + "  –  Seite " + (i + 1) + " von " + n);
    objs[5 + 2 * i] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + (6 + 2 * i) + " 0 R >>";
    objs[6 + 2 * i] = "<< /Length " + content.length + " >>\nstream\n" + content + "endstream";
  });
  let out = "%PDF-1.4\n";
  const offs = [];
  for (let i = 1; i < objs.length; i++) {
    offs[i] = out.length;
    out += i + " 0 obj\n" + objs[i] + "\nendobj\n";
  }
  const xr = out.length;
  out += "xref\n0 " + objs.length + "\n0000000000 65535 f \n";
  for (let i = 1; i < objs.length; i++) out += String(offs[i]).padStart(10, "0") + " 00000 n \n";
  out += "trailer\n<< /Size " + objs.length + " /Root 1 0 R >>\nstartxref\n" + xr + "\n%%EOF";
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

tvById("tdPdfBtn").addEventListener("click", () => {
  if (!aktuellesTurnier) return;
  const daten = startlisteDaten();
  const blob = new Blob([pdfBytesStartliste(daten)], { type: "application/pdf" });
  const a = document.createElement("a");
  const dateiname = "Startliste_" + daten.name.replace(/[^A-Za-z0-9ÄÖÜäöüß_-]+/g, "_") + (aktuellesTurnier.datum ? "_" + aktuellesTurnier.datum : "") + ".pdf";
  a.href = URL.createObjectURL(blob);
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
});

tvById("tdPrintBtn").addEventListener("click", () => {
  if (!aktuellesTurnier) return;
  const daten = startlisteDaten();
  const zeilen = daten.rows.length
    ? daten.rows.map((r) => "<tr><td>" + escapeHtml(r[0]) + "</td><td>" + escapeHtml(r[1]) + "</td><td>" + escapeHtml(r[2]) + "</td><td>" + escapeHtml(r[3]) + "</td></tr>").join("")
    : '<tr><td colspan="4">Noch keine Meldungen für dieses Turnier.</td></tr>';
  const html = '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>' + escapeHtml(daten.title) + '</title>'
    + '<style>@page{size:A4;margin:15mm}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0}'
    + 'h1{font-size:20px;margin:0 0 8px}p{margin:2px 0;font-size:13px}'
    + 'table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}'
    + 'th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #999}th{border-bottom:2px solid #000}'
    + 'tr{page-break-inside:avoid}.fuss{margin-top:16px;font-size:11px;color:#444}</style></head><body>'
    + '<h1>' + escapeHtml(daten.title) + '</h1>'
    + daten.info.map((l) => "<p>" + escapeHtml(l) + "</p>").join("")
    + '<table><thead><tr><th>#</th><th>Verein</th><th>Anmeldedatum</th><th>Angemeldet per</th></tr></thead><tbody>' + zeilen + '</tbody></table>'
    + '<div class="fuss">Gedruckt am ' + escapeHtml(daten.heute) + '</div></body></html>';
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open(); d.write(html); d.close();
  setTimeout(() => {
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => f.remove(), 3000);
  }, 300);
});

// ---------- Hilfsfunktionen ----------
function formatDatum(isoDate) {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

window.tvSignOut=()=>signOut(auth);
window.__tvRoot=document.getElementById("tvRoot");
}catch(e){console.error("Turnierverwaltung konnte nicht geladen werden:",e)}
})();
function tvMount(c,mode){const r=window.__tvRoot;if(!c)return false;if(!r){alert("Die Turnierverwaltung konnte nicht geladen werden.");return false}c.innerHTML="";c.appendChild(r);r.classList.toggle("tv-public",mode==="public");const n=document.getElementById("tv_navTurniere");if(n)n.click();return true}
function renderTurnierverwaltungAdmin(){
 const a=document.getElementById('adminMain');
 if(!appPermissions.admin){a.innerHTML='<h2>Turnierverwaltung</h2><div class="card">Nur für Administratoren freigegeben.</div>';return}
 a.innerHTML='<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">'
   +'<h2 style="margin:0">Turnierverwaltung</h2>'
   +'<button type="button" onclick="returnToAdminManagementView()">← Zurück zur Verwaltung</button></div>'
   +'<div class="card small" style="margin-bottom:10px">Die Turnierverwaltung verwendet dieselbe Firebase-Anmeldung. Smartphone-Zugang und QR-Code findest du direkt in der Turnierverwaltung.</div>'
   +'<iframe title="Turnierverwaltung Admin" src="turnierverwaltung.html?v=2.5.2" style="width:100%;height:calc(100vh - 220px);min-height:620px;border:0;border-radius:10px;background:#fff"></iframe>';
}
