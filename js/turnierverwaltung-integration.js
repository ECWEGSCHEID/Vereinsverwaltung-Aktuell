
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
const KREIS107_VEREINE = [
  { name: "EC Dreisessel Altreichenau", region: "Kreis 107", vorstand: "", ansprechpartner: "Reiner Schlig", telefon: "0171-8201122", email: "R.Schlig@gmx.de" },
  { name: "EC Bierhütte", region: "Kreis 107", vorstand: "", ansprechpartner: "Dillinger Reinhold", telefon: "0151-64320208", email: "reinhold.dillinger@t-online.de" },
  { name: "DJK Böhmzwiesel", region: "Kreis 107", vorstand: "", ansprechpartner: "Manuel Schmöller", telefon: "0171-7748133", email: "Stockschuetzen.Boehmzwiesel@t-online.de" },
  { name: "EC Büchlberg (Winterspielbetrieb eingestellt)", region: "Kreis 107", vorstand: "", ansprechpartner: "Schopf Ernst", telefon: "08505/872850", email: "Stephan.Bukowski@gmx.de" },
  { name: "DJK EC Fürsteneck", region: "Kreis 107", vorstand: "", ansprechpartner: "Mini Christian", telefon: "08505-900415, 0175-5283735", email: "chris.1312@yahoo.de" },
  { name: "EC Haag (Spielbetrieb eingestellt)", region: "Kreis 107", vorstand: "", ansprechpartner: "Thaler Christian", telefon: "0160/7016934", email: "dala82@freenet.de" },
  { name: "EC Hauzenberg", region: "Kreis 107", vorstand: "", ansprechpartner: "Kainz Albert", telefon: "0171/2453462", email: "albert.kainz@hauzenberg-ec.de" },
  { name: "SC Herzogsreut", region: "Kreis 107", vorstand: "", ansprechpartner: "Weiß Peter", telefon: "0160/5453609", email: "peter_mhd@yahoo.de" },
  { name: "DJK Karlsbach", region: "Kreis 107", vorstand: "", ansprechpartner: "Fuchs Berthold", telefon: "08551/911859", email: "eisstock@sv-djk-karlsbach.de" },
  { name: "ESV Kellberg", region: "Kreis 107", vorstand: "", ansprechpartner: "Bader Josef", telefon: "0151/41484671", email: "sportwart@esv-kellberg.de" },
  { name: "SV Kumreut", region: "Kreis 107", vorstand: "", ansprechpartner: "Haidl Thomas", telefon: "0172/7966590", email: "Thomas-Haidl@web.de" },
  { name: "DJK Oberkümmering e.V. (Winterspielbetrieb eingestellt)", region: "Kreis 107", vorstand: "", ansprechpartner: "Kimminger Daniel", telefon: "01517/2958429", email: "daniel.kimminger@gmx.de" },
  { name: "TSV Obernzell (Winterspielbetrieb eingestellt)", region: "Kreis 107", vorstand: "", ansprechpartner: "Rösser Alfred", telefon: "01512/9072143", email: "a-roesser@t-online.de" },
  { name: "SV Perlesreut", region: "Kreis 107", vorstand: "", ansprechpartner: "Geier Erich", telefon: "08555/47007, 0160/6410442", email: "info@ladler.de" },
  { name: "EC Rackling", region: "Kreis 107", vorstand: "", ansprechpartner: "Hartl Ewald", telefon: "08591/1483", email: "ortner-martin@t-online.de" },
  { name: "EC Ringelai (Winterspielbetrieb eingestellt)", region: "Kreis 107", vorstand: "", ansprechpartner: "Eibl Manfred", telefon: "08555/1448", email: "huchenzopf@gmx.de" },
  { name: "SV Röhrnbach", region: "Kreis 107", vorstand: "", ansprechpartner: "Irlesberger Gerald", telefon: "0151-52978733", email: "geier.mobil@gmx.de" },
  { name: "EV Rothau e.V.", region: "Kreis 107", vorstand: "", ansprechpartner: "Behringer Helmut", telefon: "08504/922072", email: "Roland.baumeister@web.de" },
  { name: "EC Salzweg", region: "Kreis 107", vorstand: "", ansprechpartner: "Dersch Josef", telefon: "0851/46852, Handy 0162/4155111", email: "vorstand@ecsalzweg.com" },
  { name: "EC Saßbach", region: "Kreis 107", vorstand: "", ansprechpartner: "Maier Max", telefon: "0151/15264856", email: "info@ec-sassbach.de" },
  { name: "EC Sittenberg-Ruderting e.V.", region: "Kreis 107", vorstand: "", ansprechpartner: "Kobler Christian", telefon: "08509/3220", email: "ecsittenberg@t-online.de" },
  { name: "SV Weiß-Blau Untergriesbach (Winterspielbetrieb eingestellt)", region: "Kreis 107", vorstand: "", ansprechpartner: "Pfeil Ralf", telefon: "08593-9384700, Handy 0151/10545627", email: "info@elektropfeil.de" },
  { name: "SV Vorderfreundorf", region: "Kreis 107", vorstand: "", ansprechpartner: "Schnelzer Franz", telefon: "08585/1053, Handy 0151-40249566", email: "f.schnelzer@t-online.de" },
  { name: "EC Wegscheid", region: "Kreis 107", vorstand: "", ansprechpartner: "Hellauer Manfred", telefon: "08592/935045", email: "m.stadler@ec-wegscheid.de" }
];

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
const KREIS102_VEREINE = [
  { name: "DJK EC Aicha v. Wald e.V.", region: "Kreis 102", vorstand: "Dörfer Herbert", ansprechpartner: "", telefon: "08544-8597", email: "herbert.doerfer@web.de" },
  { name: "EC DJK Aigen / Inn", region: "Kreis 102", vorstand: "Schmidt Rudolf", ansprechpartner: "", telefon: "0160-5531805", email: "ecdjkaigen@gmx.de" },
  { name: "Stockschützen Alkofen", region: "Kreis 102", vorstand: "Sterr Oskar", ansprechpartner: "", telefon: "08541-6960 oder 0170-5029301", email: "johann.wuerdinger@gmx.de" },
  { name: "ESC Dreiburgenland-Fürstenstein e.V.", region: "Kreis 102", vorstand: "Kubitschek Heribert jun.", ansprechpartner: "", telefon: "08504-5395", email: "kubi.h@t-online.de" },
  { name: "ESC Egglfing", region: "Kreis 102", vorstand: "Schmidt Rudolf", ansprechpartner: "", telefon: "08537-1277, Mobil: 0175-5228279", email: "rudi-elvira-schmidt@t-online.de" },
  { name: "EC Eging a. See", region: "Kreis 102", vorstand: "Richard Preis", ansprechpartner: "Berhard Oberbigler", telefon: "08544-7710, Handy: 0176-55660835", email: "bernhard.oberbigler@onlinehome.de" },
  { name: "FC Fürstenzell", region: "Kreis 102", vorstand: "Kapfhammer Hans", ansprechpartner: "", telefon: "08506-564", email: "familiekapfhammer@msn.com" },
  { name: "EC Garham", region: "Kreis 102", vorstand: "Lösl Werner", ansprechpartner: "", telefon: "0163-6063627", email: "werner.loesl@web.de" },
  { name: "ASC Bad Griesbach e.V.", region: "Kreis 102", vorstand: "Zauner Christian", ansprechpartner: "", telefon: "0151-53041440", email: "info@zaudir.de" },
  { name: "SpVgg Hacklberg", region: "Kreis 102", vorstand: "Stemp Willi", ansprechpartner: "", telefon: "0851-21095224", email: "" },
  { name: "DJK SV Hartkirchen", region: "Kreis 102", vorstand: "Seitz Johannes", ansprechpartner: "", telefon: "0151-51767755", email: "seitz1963@web.de" },
  { name: "ESV Hidring", region: "Kreis 102", vorstand: "", ansprechpartner: "Griesbacher Christian", telefon: "0172-8966984", email: "esv_hidring@yahoo.com" },
  { name: "FC 1960 Indling", region: "Kreis 102", vorstand: "Siegmar Werner", ansprechpartner: "", telefon: "01517-3001145", email: "WimmerSilke@t-online.de" },
  { name: "TSV Karpfham", region: "Kreis 102", vorstand: "Wagner Manfred", ansprechpartner: "", telefon: "0160-90391881", email: "stockclubkarpfham@gmail.com" },
  { name: "DJK SC Kirchham", region: "Kreis 102", vorstand: "Frammelsberger Daniel", ansprechpartner: "", telefon: "", email: "angerer.hof@t-online" },
  { name: "ESC Knadlarn", region: "Kreis 102", vorstand: "Rimböck Stefan", ansprechpartner: "Berger Gerhard", telefon: "08542-9199990, Mobil: 0151-70160998", email: "stefan.johanna@gmx.de" },
  { name: "TSV DJK Malching", region: "Kreis 102", vorstand: "Heringer Roland - Altmann Franz", ansprechpartner: "", telefon: "0170-9156916, 08573-1065", email: "cafe-christine@t-online.de" },
  { name: "AC Neustift", region: "Kreis 102", vorstand: "Wippl Willi", ansprechpartner: "Steiger Michael (Schriftführer)", telefon: "08541-1543, 08542-6409646", email: "Mandy230577@freenet.de" },
  { name: "SC Batavia Passau", region: "Kreis 102", vorstand: "Schießl Andreas", ansprechpartner: "", telefon: "0151-10979996", email: "info@faschiessl.de" },
  { name: "EC Passau-Neustift", region: "Kreis 102", vorstand: "Schäfer Alexander", ansprechpartner: "", telefon: "0160-91163450", email: "ec-passauneustift@t-online.de" },
  { name: "SC Passau-Ries", region: "Kreis 102", vorstand: "Vogl Günther", ansprechpartner: "", telefon: "0851-53753", email: "mosl.zillner@gmx.de" },
  { name: "EC Eintracht Pleinting e.V.", region: "Kreis 102", vorstand: "Eglseder Oliver", ansprechpartner: "Klement Thomas (Spartenleiter)", telefon: "0151-25726223", email: "klementthomas@gmx.de" },
  { name: "SV Pocking 1892 e.V.", region: "Kreis 102", vorstand: "Lustinger Franz", ansprechpartner: "", telefon: "08531-7855, Mobil: 0151-52033906", email: "Franz.Lustinger@t-online.de" },
  { name: "EC Poigham-Tettenweis (Kein Spielbetrieb)", region: "Kreis 102", vorstand: "Anton Brummer", ansprechpartner: "", telefon: "08531-248038", email: "ec-poigham-tettenweis@gmx.de" },
  { name: "SV Rainding e.V. (Kein Spielbetrieb)", region: "Kreis 102", vorstand: "", ansprechpartner: "", telefon: "", email: "" },
  { name: "EC Rathsmannsdorf", region: "Kreis 102", vorstand: "Aulinger Manfred", ansprechpartner: "", telefon: "08546-973259", email: "M.B.Aulinger78@gmx.de" },
  { name: "SC Reutern", region: "Kreis 102", vorstand: "Fenzl Andreas", ansprechpartner: "", telefon: "08532-920974", email: "fenzlandi@gmx.de" },
  { name: "TSV Rotthalmünster (Kein Spielbetrieb)", region: "Kreis 102", vorstand: "Lew Franz", ansprechpartner: "", telefon: "08533-96240", email: "franz.lew@bits-und-bytes.de" },
  { name: "SVG Ruhstorf", region: "Kreis 102", vorstand: "Hofberger Robert", ansprechpartner: "", telefon: "08531-136061, Mobil: 0174-8944295", email: "r.hofberger@t-online.de" },
  { name: "FC Schalding l.d.Donau", region: "Kreis 102", vorstand: "Klement Franz", ansprechpartner: "", telefon: "08546-795", email: "franz.klement@gmx.net" },
  { name: "SV Schalding Heining", region: "Kreis 102", vorstand: "Schmidter Michael", ansprechpartner: "", telefon: "0151-12408389", email: "michael.schmidter@web.de" },
  { name: "TSV-DJK Sulzbach", region: "Kreis 102", vorstand: "Antesberger Johannes", ansprechpartner: "", telefon: "0151-54746618", email: "antesjoh@web.de" },
  { name: "FC Unteriglbach e.V.", region: "Kreis 102", vorstand: "Koll Günther", ansprechpartner: "", telefon: "01706753831", email: "stockschuetzen@fcunteriglbach.de" },
  { name: "EV Danubia Vilshofen", region: "Kreis 102", vorstand: "Göttl Gerhard", ansprechpartner: "", telefon: "0170-4347966", email: "danubia-vilshofen@web.de" },
  { name: "EC Florian Vilshofen (Kein Spielbetrieb)", region: "Kreis 102", vorstand: "", ansprechpartner: "", telefon: "", email: "" },
  { name: "EC Vilusa Vilshofen 1975", region: "Kreis 102", vorstand: "Kapfhammer Peter", ansprechpartner: "", telefon: "08541-5931", email: "hp.kapfhammer@t-online.de" },
  { name: "DJK Vornbach / Inn (Kein Spielbetrieb)", region: "Kreis 102", vorstand: "Oberpeilsteiner Hans", ansprechpartner: "", telefon: "08503-758", email: "Oberpeilsteiner-j@t-online.de" },
  { name: "EC Altwasser Windorf", region: "Kreis 102", vorstand: "Schuster Thomas", ansprechpartner: "", telefon: "0170-4335026", email: "ecaltwasserwindorf@gmx.de" },
  { name: "DJK EC Windorf (Kein Spielbetrieb)", region: "Kreis 102", vorstand: "Bichlmeier Gerold", ansprechpartner: "", telefon: "08541-7917", email: "pbichlmeier@gmx.de" },
  { name: "EV Weiß Blau Windorf", region: "Kreis 102", vorstand: "Bichlmeier Patrick", ansprechpartner: "", telefon: "0151-46418792", email: "weiss-blau.windorf@gmx.de" },
  { name: "SV Würding", region: "Kreis 102", vorstand: "", ansprechpartner: "Alois Freudenstein (Spartenleiter)", telefon: "0171-1458803", email: "a.freudenstein89@t-online.de" },
  { name: "EC Zaundorf", region: "Kreis 102", vorstand: "Doppelhammer Walter", ansprechpartner: "", telefon: "08545-969652", email: "ec.zaundorf@gmx.de" }
];

// ---------- Kontakte-Import (vCard) ----------
const KONTAKTE_VCARD_FULL = [
  { name: "DJK Aicha vorm Wald", vorstand: "Dörfer Herbert", email: "herbert.doerfer@web.de", telefon: "0049-85448597" },
  { name: "EC Aigen am Inn", vorstand: "Brundobler Johann", email: "info@bavaria-camping.de", telefon: "0049-8537260" },
  { name: "Adi Allmannsberger", vorstand: "", email: "a.allmannsberger@ec-wegscheid.de", telefon: "" },
  { name: "Richard Altendorfer", vorstand: "Gsenget Stockschützen", email: "r.altendorfer@altendorfer-kt.de", telefon: "" },
  { name: "Union Altenfelden", vorstand: "Sigl Herbert", email: "michael.stratberger@aon.at", telefon: "0043-66473635299" },
  { name: "Union Altenhof", vorstand: "Huber Heinrich", email: "heinrichhuber@gmail.com", telefon: "0043-7285588" },
  { name: "EC Altwasser Windorf", vorstand: "Schuster Thomas", email: "ecaltwasserwindorf@gmx.de", telefon: "0049-8541910949" },
  { name: "Union Arnreit", vorstand: "Gierlinger Manfred", email: "gierlingerdaim38@gmail.com", telefon: "0043-6643467945" },
  { name: "ASC Bad Griesbach", vorstand: "", email: "erwin.schraml@t-online.de", telefon: "" },
  { name: "Batavia Passau", vorstand: "Luger Franz", email: "f.luger@vodafone.de", telefon: "0049177-49081161" },
  { name: "FC Richnach Bianca Grütz", vorstand: "", email: "bianca2912@gmx.de", telefon: "" },
  { name: "EC Bierhütte", vorstand: "Nußhardt Alois", email: "scheibelbergerjosef@web.de", telefon: "0049-85581219" },
  { name: "Roßleiten Bleier Fabian", vorstand: "", email: "fabianbleierfotografie@hotmail.com", telefon: "066475066434" },
  { name: "Josef Braun", vorstand: "Schöngeissing", email: "josef.braun@topbraun.de", telefon: "" },
  { name: "EC Büchlberg", vorstand: "Bukowski Stephan", email: "stephan.bukowski@gmx.de", telefon: "" },
  { name: "FC Unteriglbach", vorstand: "", email: "stockschuetzen@fcunteriglbach.de", telefon: "" },
  { name: "DJK Böhmzwiesel", vorstand: "", email: "stockschuetzen.boehmzwiesel@t-online.de", telefon: "" },
  { name: "DJK Karlsbach", vorstand: "", email: "kersche@go4more.de", telefon: "" },
  { name: "DJK Traunstein", vorstand: "", email: "stockis@djk-traunstein.de", telefon: "" },
  { name: "ESC Dreiburgenland", vorstand: "Gastinger Karin", email: "kgastinger@web.de", telefon: "0049-85045801" },
  { name: "EC Dreisessel Altreichenau", vorstand: "Schilg Rainer", email: "r.schlig@gmx.de", telefon: "0049-1718201122" },
  { name: "Sabine Eberl", vorstand: "", email: "sabine.eberl83@web.de", telefon: "" },
  { name: "Christian Ebertsberger", vorstand: "", email: "ebertsberger.c@web.de", telefon: "" },
  { name: "EC Fürstenzell", vorstand: "", email: "familiekapfhammer@msn.com", telefon: "" },
  { name: "EC Gerabach", vorstand: "", email: "steininger.nina@web.de", telefon: "" },
  { name: "EC Hauzenberg", vorstand: "", email: "albert.kainz@hauzenberg-ec.de", telefon: "" },
  { name: "EC Kreuzstraßl", vorstand: "", email: "ec.kreuzstrassl@web.de", telefon: "" },
  { name: "EC Rainbach", vorstand: "", email: "stocksport-rainbach@gmx.at", telefon: "" },
  { name: "EC Ringelai", vorstand: "Eibl Manfred", email: "huchenzopf@gmx.de", telefon: "0049-85551448" },
  { name: "EC Zaundorf", vorstand: "", email: "ec.zaundorf@gmx.de", telefon: "" },
  { name: "TSV Kapfham", vorstand: "", email: "e.eichinger@t-online.de", telefon: "" },
  { name: "EC Eintracht Kalteneck", vorstand: "Fuchs Manfred", email: "alexander.moyses@web.de", telefon: "0049-85052717" },
  { name: "EC Eintracht Pleinting", vorstand: "Hugo Meyer", email: "klementthomas@outlook.de", telefon: "0049-15122641513" },
  { name: "Union  Eschenau", vorstand: "Fehlhofer Peter", email: "fehlhofer.peter@gmx.at", telefon: "0043-6643947743" },
  { name: "Union Esternberg", vorstand: "", email: "r.schriefl@eduhi.at", telefon: "" },
  { name: "Union Esternberg", vorstand: "Dullinger Josef", email: "stocksport-esternberg@gmx.at", telefon: "0043-77146312" },
  { name: "ESV Hidring", vorstand: "", email: "zilch.sigmund@t-online.de", telefon: "" },
  { name: "ESV Weierfing", vorstand: "Hörandner Norbert", email: "esv.weierfing@aon.at", telefon: "" },
  { name: "EV Weiß Blau Windorf e.v.", vorstand: "", email: "weiss-blau.windorf@gmx.de", telefon: "" },
  { name: "Andrea Faltermeier", vorstand: "Grünbach Schneidermühle", email: "andrea.faltermeier91@gmx.de", telefon: "" },
  { name: "Askö Freinberg", vorstand: "Pöschl Gottfried", email: "ortnerreinhold401@gmail.com", telefon: "0043-66473883480" },
  { name: "TV Freyung 1893", vorstand: "Schuster Günter", email: "horst.kubitschek@freenet.de", telefon: "0049-1608244436" },
  { name: "Stockschützenverein Furtmühle", vorstand: "Bauer Edeltraud", email: "esv.furtmuehle@gmx.at", telefon: "0043-6641592969" },
  { name: "Klaus Gottinger", vorstand: "", email: "k.gottinger@ec-wegscheid.de", telefon: "" },
  { name: "ESV Grubweg Passau", vorstand: "Seltenhofer Walter", email: "w-seltenhofer@kabelmail.de", telefon: "004985144451" },
  { name: "EC Haag", vorstand: "Thaler Christian", email: "dala82@freenet.de", telefon: "0049-1607016934" },
  { name: "SpVgg Hacklberg Passau", vorstand: "Stemp Willi", email: "spvgg-hacklberg@t-online.de", telefon: "0049-8512136711" },
  { name: "Kumreut", vorstand: "", email: "thomas-haidl@web.de", telefon: "" },
  { name: "Stockschützen Hals", vorstand: "Erich Rohn", email: "service@opelrohn.de", telefon: "0049-85092368" },
  { name: "DJK Hartkirchen", vorstand: "Seitz Johannes", email: "seitz1963@web.de", telefon: "0049-8538533" },
  { name: "ESV Haslach an der Mühl", vorstand: "Krenn Josef", email: "1_esv-haslach@a1.net", telefon: "0043-6645722184" },
  { name: "Union Helfenberg", vorstand: "Bindeus Nikolaus", email: "nikolaus.bindeus@hotmail.com", telefon: "0043-6648108128" },
  { name: "Manfred Hellauer", vorstand: "", email: "m.hellauer@ec-wegscheid.de", telefon: "" },
  { name: "Askö Kirchberg Herwig Höfler", vorstand: "", email: "herwig4131@gmail.com", telefon: "" },
  { name: "SC Herzogsreut", vorstand: "Moritz Ferdinand", email: "ferdinand.moritz57@web.de", telefon: "0049-8550775" },
  { name: "SSV Jandelsbrunn", vorstand: "Fesl Josef", email: "ssv-stock@web.de", telefon: "0049-858391097" },
  { name: "EC Thyrnau Jentsch Markus", vorstand: "", email: "stinki123@hotmail.de", telefon: "" },
  { name: "FC Fürstenzell", vorstand: "", email: "kapfhammermichael@web.de", telefon: "" },
  { name: "DJK Karlsbach", vorstand: "Fuchs Berthold", email: "eisstock@sv-djk-karlsbach.de", telefon: "0049-8551911859" },
  { name: "ESV Kellberg", vorstand: "Schick Armin", email: "sportwart@esv-kellberg.de", telefon: "0049-1626031554" },
  { name: "Askö Kirchberg", vorstand: "Hofer Hubert", email: "ewald.hintringer@aon.at", telefon: "0043-6648115007" },
  { name: "SPÖ Kollerschlag", vorstand: "Krenn Heinrich", email: "heinrichkrenn@aon.at", telefon: "0043-6649165530" },
  { name: "Union Kollerschlag", vorstand: "Löffler Bernd", email: "berndl1980@gmail.com", telefon: "0043-6505736178" },
  { name: "Franz Krenn", vorstand: "SSV Atzesberg", email: "franz.krenn@ronet.at", telefon: "" },
  { name: "EC Leoprechting", vorstand: "Wagner Josef", email: "alfred.loesch@gmx.de", telefon: "0049-8505922066" },
  { name: "EC Linden Freyung", vorstand: "Binder Roland", email: "robert.binder82@web.de", telefon: "0049-1707370302" },
  { name: "Mario Meisinger", vorstand: "", email: "mario.meisinger@gmx.de", telefon: "" },
  { name: "Eisschützenverein Mühltal / Neufelden", vorstand: "", email: "karlhennerbichler63@gmail.com", telefon: "" },
  { name: "Eisschützenverein Mühltal/Neufelden", vorstand: "Leitner Karl", email: "esv.neufelden@gmail.com", telefon: "0043-6644366342" },
  { name: "TV Münzkirchen", vorstand: "Reidinger Inge", email: "siegfried.schopf@aon.at", telefon: "0043-6767378950" },
  { name: "Union Natternbach", vorstand: "Wimmer Johann", email: "postfach.johann.wimmer@gmx.at", telefon: "0043-67673989530" },
  { name: "ESV Neukirchen am Walde", vorstand: "Kasbauer Markus", email: "verkauf@auto-puehringer.at", telefon: "0043-6644534571" },
  { name: "Union Neustift", vorstand: "Scharrer Erich", email: "scharrermarliese@gmail.com", telefon: "0043-6641253790" },
  { name: "Union Niederkappel", vorstand: "", email: "esvniederkappel@gmail.com", telefon: "0043-6767258411" },
  { name: "ESV Niederkraml", vorstand: "Kasper Florian", email: "florian@diejungenbacardi.at", telefon: "0043-6641510741" },
  { name: "Oberkümmering", vorstand: "", email: "daniel.kimminger@gmx.de", telefon: "08586-4199" },
  { name: "TSV  Obernzell", vorstand: "Scharinger Franz", email: "langbettina@t-online.de", telefon: "0049-8591938734" },
  { name: "Union Oepping", vorstand: "Lauss Reinhold", email: "laussreinhold@gmx.at", telefon: "0043-6646176727" },
  { name: "EC Passau Neustift", vorstand: "Schäfer Gertrud", email: "ec-passauneustift@t-online.de", telefon: "0049-85181776" },
  { name: "SC Passau Ries", vorstand: "Vogl Günther", email: "vogl.ries@t-online.de", telefon: "0049-85153753" },
  { name: "Union Peilstein", vorstand: "Brandl Roman", email: "christine.stockinger@utvnet.at", telefon: "0043-6766067087" },
  { name: "SV Perlesreut", vorstand: "Geier Erich", email: "info@ladler.de", telefon: "0049-855547007" },
  { name: "Herbert Perr", vorstand: "", email: "h.perr@ec-wegscheid.de", telefon: "" },
  { name: "Herzogsreut Peter Weiß", vorstand: "", email: "peter_mhd@yahoo.de", telefon: "" },
  { name: "Askö Peuerbach", vorstand: "Grüeis Leopold", email: "believer@gmx.com", telefon: "0043-6504213497" },
  { name: "SU Peuerbach", vorstand: "Dornetshuber Ludwig", email: "su.peuerbach.stocksport@aon.at", telefon: "0043-68120128827" },
  { name: "Union Putzleinsdorf", vorstand: "Höglinger Arnold", email: "hoeglinger.arnold@outlook.com", telefon: "0043-6803107382" },
  { name: "EC Rackling", vorstand: "Hartl Ewald", email: "ortner-martin@t-online.de", telefon: "0049-85911483" },
  { name: "EC Rathmannsdorf", vorstand: "Aulinger Manfred", email: "m.b.aulinger78@gmx.de", telefon: "0049-8546973259" },
  { name: "Union  Rohrbach", vorstand: "Neumüller Josef", email: "stocksport.rohrbach@aon.at", telefon: "0043-6644349442" },
  { name: "SV Röhrnbach", vorstand: "Geier Norbert", email: "geier.mobil@gmx.de", telefon: "0049-8582528" },
  { name: "EV Rothau", vorstand: "Behringer Helmut", email: "konrad.baumeister@t-online.de", telefon: "0049-8504922072" },
  { name: "Niederkappel Rothbauer Thomas", vorstand: "", email: "t.rothbauer@rotech.at", telefon: "" },
  { name: "TSV Obernzell Salzinger Bernd", vorstand: "", email: "berndsalzinger@web.de", telefon: "" },
  { name: "EC Salzweg", vorstand: "Josef Dersch", email: "vorstand@ecsalzweg.com", telefon: "0049-85146852" },
  { name: "SSV Sarleinsbach", vorstand: "Höglinger Bernhard", email: "ssv-sarleinsbach@ronet.at", telefon: "0043-67681412654" },
  { name: "EC Saßbach", vorstand: "Moosbauer Gerhard", email: "info@ec-sassbach.de", telefon: "0049-8581988128" },
  { name: "Union Schardenberg", vorstand: "Haas Helmut", email: "haasfranz@flashnet.at", telefon: "0043-6504238942" },
  { name: "Union St.Willibald Schopf Johann", vorstand: "", email: "johann.schopf@aon.at", telefon: "066473417170" },
  { name: "Union Windischgarsten", vorstand: "", email: "rene.schweiger@gmx.net", telefon: "" },
  { name: "EC Sittenberg", vorstand: "Reißner Georg", email: "ecsittenberg@t-online.de", telefon: "0049-8593-1539" },
  { name: "Wernstein Sportunion", vorstand: "Josef Piroth", email: "hamedinger@wnet.at", telefon: "" },
  { name: "SSV Atzesberg", vorstand: "", email: "franz.krenn@ronet.at", telefon: "" },
  { name: "SSV Sarleinsbach", vorstand: "", email: "w.kehrer@home-3.at", telefon: "" },
  { name: "ESV St.Aegidi", vorstand: "Ecker Josef", email: "esvstaegidi@gmx.at", telefon: "0043-6605538880" },
  { name: "Union St.Johann am Wimberg", vorstand: "Kepplinger Walter", email: "walter.kepplinger@aon.at", telefon: "0043-6648398827" },
  { name: "Union St.Peter", vorstand: "Kepplinger Josef", email: "usp-stocksport@gmx.at", telefon: "0043-6641127005" },
  { name: "Union St.Roman", vorstand: "Gradinger Johann", email: "J.Umbauer@gmx.at", telefon: "0043-77166296" },
  { name: "Union St.Ulrich", vorstand: "Lindorfer Herbert", email: "h.lindorfer@gmx.at", telefon: "0043-6641458266" },
  { name: "Stockschützen Alkoven", vorstand: "", email: "albert@irgenfried.de", telefon: "" },
  { name: "SU Walding", vorstand: "", email: "markus.reiter@gmx.at", telefon: "" },
  { name: "Sulzbach", vorstand: "", email: "stockschuetzen-sulzbach@gmx.de", telefon: "" },
  { name: "SV Abenberg", vorstand: "", email: "stockschuetzen@sv-abenberg.de", telefon: "" },
  { name: "SV Lacken", vorstand: "", email: "andreasstrasser17@gmail.com", telefon: "" },
  { name: "SV Lichtenberg", vorstand: "", email: "stock@sv-lichtenberg.at", telefon: "" },
  { name: "SV Pocking", vorstand: "", email: "franz.lustinger@t-online.de", telefon: "" },
  { name: "SV Pocking", vorstand: "", email: "udomichl@web.de", telefon: "" },
  { name: "SV Schalding Heining", vorstand: "", email: "winter.anderl@t-online.de", telefon: "" },
  { name: "SV Windberg", vorstand: "", email: "erwin.schiessl@t-online.de", telefon: "" },
  { name: "TSV Harburg", vorstand: "", email: "stock.harburg@gmail.com", telefon: "" },
  { name: "TSV Kapfham", vorstand: "", email: "gn_ni@t-online.de", telefon: "" },
  { name: "TSV Obernzell", vorstand: "Salzinger Bernd", email: "berndsalzinger@web.de", telefon: "" },
  { name: "Union Ulrichsberg", vorstand: "Neumüller Christine", email: "neumueller.christine@aon.at", telefon: "0043-69911155048" },
  { name: "Union Altenfelden", vorstand: "", email: "schriftfuehrer@stocksport-altenfelden.at", telefon: "" },
  { name: "Union Anreit", vorstand: "", email: "gierlinger.daim@aon.at", telefon: "" },
  { name: "Union Arnreit", vorstand: "", email: "stoebich.ewald@aon.at", telefon: "" },
  { name: "Union Freistadt", vorstand: "", email: "unionfreistadt-stocksport@gmx.at", telefon: "" },
  { name: "Union Hinzenbach", vorstand: "Heumader Gerlinde", email: "unionhinzenbach@gmx.at", telefon: "0650-5354508" },
  { name: "Union Niederwaldkirchen", vorstand: "", email: "gruenzweil.manfred@aon.at", telefon: "" },
  { name: "Union Peilsten", vorstand: "", email: "patrick.heinz.wiesinger@gmail.com", telefon: "" },
  { name: "Union Rainbach", vorstand: "", email: "ernst.wurm@gmx.at", telefon: "" },
  { name: "Union Rohrbach", vorstand: "", email: "margitfrisch273@gmail.com", telefon: "" },
  { name: "Ploederl Karl", vorstand: "", email: "m.ploederl@gmx.at", telefon: "" },
  { name: "Union St.Peter", vorstand: "", email: "christian.eckerstorfer@aon.at", telefon: "" },
  { name: "Union St.Veit im Mkr.", vorstand: "", email: "fuereder.josef@gmx.at", telefon: "" },
  { name: "Union Windischgarsten", vorstand: "", email: "r.humpl@pptv.at", telefon: "" },
  { name: "SV Weiß Blau Untergrießbach", vorstand: "Pfeil Reinhold", email: "hans.schanzer@gmail.com", telefon: "0049-85931539" },
  { name: "Union Viechtenstein", vorstand: "", email: "unionvichtenstein.stocksport@gmail.com", telefon: "0043-6505550111" },
  { name: "FC Vorderfreundorf", vorstand: "Schnelzer Franz", email: "f.schnelzer@t-online.de", telefon: "0049-1757249995" },
  { name: "Union Waldmark", vorstand: "Feilmayr Harald", email: "hari-1981@gmx.at", telefon: "0043-6641355279" }
];

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
