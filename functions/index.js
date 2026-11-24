'use strict';

const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {validBooking, validDate, overlaps, normalizedName} = require('./booking');
const {createHash} = require('node:crypto');

initializeApp();
const db = getFirestore();
const imported = db.doc('reservierungMigration/buchungen_20261112');
const roster = db.doc('appSettings/playerList');
// Anlässe für das Vereinsheim (ohne Spielerauswahl). "Vereinsheim" bleibt für ältere Buchungen gültig.
const clubhouseModes = ['Vereinsfeier', 'Gremlins Heimspiel', 'Geburtstagsfeier', 'Turnier',
  'Vorstandssitzung', 'Vereinsveranstaltung', 'Vereinsheim'];
const modes = new Map([
  ['Freies Training (Standard)', 0], ['Cup-Spiel', 4], ['Solo Turnier', 1], ['Duo Cup', 2],
  ['Frauencup', 2], ...clubhouseModes.map(mode => [mode, 0]),
]);
const informationssystemEmail = 'informationssystem@ec-wegscheid.de';
const pilot = 'n9MpiKXZNLap8wsbRcP4fVjrT4D2';
const technicalMember = /^ecw-mobile-[a-f0-9]{32}$/;
const time = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

function canRead(snapshot, uid, games) {
  const grants = snapshot.data() || {};
  const reservation = grants.reservierungenLesen ?? (uid === pilot || technicalMember.test(uid));
  return (games ? grants.spiele ?? reservation : reservation) === true;
}

function writer(snapshot) {
  const access = snapshot.data();
  const name = typeof access?.spielerName === 'string' ? access.spielerName.trim() : '';
  return access?.reservieren === true && name ? name : '';
}

function requireWriter(permissions, access, uid) {
  const name = writer(access);
  if (!canRead(permissions, uid, false) || !name) {
    throw new HttpsError('permission-denied', 'Für dieses Konto fehlt die Buchungsfreigabe.');
  }
  return name;
}

function canBookAsRosterMember(profile, email) {
  const role = profile.data();
  return !!role && (role.admin === true || role.whiteboard === true ||
    role.role === 'whiteboard' || email?.toLowerCase() === informationssystemEmail);
}

// Administratoren der Vereinsverwaltung (users/{uid}.admin) dürfen alle Reservierungen ändern und löschen.
function isAdmin(profile) {
  return profile?.data()?.admin === true;
}

// Feste Kennung für übernommene Buchungen (Bestand 12.11.), die keine eigene ID haben.
function rowKey(row) {
  return createHash('sha256').update(JSON.stringify([
    row.date, row.resource, row.timeFrom, row.timeTo, row.bookedBy || '', row.mode || '',
    row.homeTeam || [], row.guestTeam || []
  ])).digest('hex');
}

function playerNames(snapshot) {
  const values = snapshot.data()?.players;
  if (!Array.isArray(values)) throw new HttpsError('failed-precondition', 'Die zentrale Spielerliste ist nicht verfügbar.');
  return [...new Set(values.filter(name => typeof name === 'string' && name.trim() && name.length <= 120).map(name => name.trim()))];
}

function details(input, snapshot, owner) {
  const clubhouse = input.resource === 'Vereinsheim';
  const mode = input.mode ?? (clubhouse ? 'Vereinsheim' : 'Freies Training (Standard)');
  if (clubhouse !== clubhouseModes.includes(mode)) throw new HttpsError('invalid-argument', 'Der Modus passt nicht zur Ressource.');
  const limit = modes.get(mode);
  if (limit === undefined) throw new HttpsError('invalid-argument', 'Unbekannter Spielmodus.');
  const homeTeam = input.homeTeam ?? [];
  const guestTeam = input.guestTeam ?? [];
  const allowed = new Set(limit ? [owner, ...playerNames(snapshot)] : []);
  if ([homeTeam, guestTeam].some(team => !Array.isArray(team) || team.length > limit || team.some(name => !allowed.has(name)))) {
    throw new HttpsError('invalid-argument', 'Bitte die Spieler aus der zentralen Liste auswählen.');
  }
  const names = [...homeTeam, ...guestTeam].map(normalizedName);
  if (new Set(names).size !== names.length) throw new HttpsError('invalid-argument', 'Jeder Spieler kann nur einmal ausgewählt werden.');
  return {mode, homeTeam, guestTeam};
}

function bookingList(snapshot, required = false) {
  const list = snapshot.data()?.list;
  if (Array.isArray(list)) return list;
  if (!required && !snapshot.exists) return [];
  throw new HttpsError('failed-precondition', 'Der Buchungsbestand ist nicht verfügbar.');
}

function verifyDay(rows, date) {
  if (rows.some(row => row?.date === date &&
      (!time.test(row.timeFrom) || !time.test(row.timeTo) || row.timeFrom >= row.timeTo ||
       !/^(Bahn [1-4]|Vereinsheim)$/.test(row.resource)))) {
    throw new HttpsError('failed-precondition', 'Die Buchungen dieses Tages müssen zuerst geprüft werden.');
  }
}

exports.ecwBahnreservierung = onCall({region: 'europe-west3', maxInstances: 2}, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Bitte im Smartphonezugang anmelden.');
  const input = request.data;
  const access = db.collection('reservierungZugaenge').doc(uid);
  const permissions = db.collection('smartphoneFreigaben').doc(uid);
  const fromStartPage = input?.view === 'whiteboard';
  const email = request.auth.token?.email;
  const userProfile = db.doc('users/' + uid);
  if (input?.action === 'bookingOptions') {
    const [grants, profile, players, account] = await db.getAll(permissions, access, roster, userProfile);
    if (fromStartPage && canBookAsRosterMember(account, email)) {
      return {owner: '', players: playerNames(players), chooseBooker: true};
    }
    const owner = requireWriter(grants, profile, uid);
    return {owner, players: [...new Set([owner, ...playerNames(players)])]};
  }
  if (!validDate(input?.date)) throw new HttpsError('invalid-argument', 'Ungültiges Datum.');
  const day = db.collection('reservierungBuchungstage').doc(input.date);

  if (input.action === 'list' && input.view === 'whiteboard') {
    const [account, grants, profile, saved, history] = await db.getAll(userProfile, permissions, access, day, imported);
    const rosterBooking = canBookAsRosterMember(account, email);
    const memberRead = canRead(grants, uid, false);
    if (!rosterBooking && !memberRead) {
      throw new HttpsError('permission-denied', 'Der Kalender ist für dieses Konto nicht freigegeben.');
    }
    const past = bookingList(history, true).filter(row => row.date === input.date);
    const canBook = rosterBooking || !!writer(profile);
    const admin = isAdmin(account);
    const visible = ({date, resource, timeFrom, timeTo, bookedBy, mode, homeTeam, guestTeam}) =>
      ({date, resource, timeFrom, timeTo, bookedBy, mode, homeTeam, guestTeam});
    return {canBook, admin, bookings: [
      ...past.map(row => admin ? {...visible(row), legacyKey: rowKey(row), own: true} : visible(row)),
      ...bookingList(saved).map(row => (canBook && row.ownerUid === uid) || admin
        ? {...visible(row), id: row.id, own: true}
        : visible(row))
    ]};
  }

  if (input.action === 'list') {
    const [grants, profile, saved] = await db.getAll(permissions, access, day);
    const games = input.view === 'spiele';
    if (!canRead(grants, uid, games)) throw new HttpsError('permission-denied', 'Der Kalender ist für dieses Konto gesperrt.');
    const canBook = !games && !!writer(profile);
    return {canBook, bookings: bookingList(saved).map(({id, date, resource, timeFrom, timeTo, ownerUid, bookedBy, mode, homeTeam, guestTeam}) => ({
      id, date, resource, timeFrom, timeTo, bookedBy, mode: mode || 'Reserviert', homeTeam: homeTeam || [], guestTeam: guestTeam || [], own: canBook && ownerUid === uid
    }))};
  }

  if (input.action === 'book' && validBooking(input) &&
      typeof input.requestId === 'string' && /^[a-f0-9-]{36}$/.test(input.requestId)) {
    const {date, resource, timeFrom, timeTo} = input;
    const id = createHash('sha256').update(uid + ':' + input.requestId).digest('hex');
    return db.runTransaction(async transaction => {
      const [grants, profile, history, saved, players] = await transaction.getAll(permissions, access, imported, day, roster);
      const [account] = fromStartPage ? await transaction.getAll(userProfile) : [];
      const rosterBooking = fromStartPage && canBookAsRosterMember(account, email);
      let name;
      if (rosterBooking) {
        name = input.bookedBy;
        if (!playerNames(players).includes(name)) {
          throw new HttpsError('invalid-argument', 'Bitte einen Namen aus der Spielerliste auswählen.');
        }
      } else {
        name = requireWriter(grants, profile, uid);
      }
      const legacy = bookingList(history, true);
      const bookings = bookingList(saved);
      verifyDay(legacy, date);
      verifyDay(bookings, date);
      const selection = details(input, players, name);
      const prior = bookings.find(booking => booking.id === id);
      if (prior) {
        if (prior.bookedBy !== name || prior.resource !== resource || prior.timeFrom !== timeFrom || prior.timeTo !== timeTo ||
            (prior.mode ?? 'Freies Training (Standard)') !== selection.mode ||
            JSON.stringify(prior.homeTeam || []) !== JSON.stringify(selection.homeTeam) ||
            JSON.stringify(prior.guestTeam || []) !== JSON.stringify(selection.guestTeam)) {
          throw new HttpsError('already-exists', 'Diese Buchungsanfrage wurde bereits verwendet.');
        }
        return {id};
      }
      if (saved.data()?.cancelled?.includes(id)) {
        throw new HttpsError('failed-precondition', 'Diese Buchung wurde bereits storniert. Bitte das Formular neu öffnen.');
      }
      let ownerUid = uid;
      if (rosterBooking) {
        const matches = await transaction.get(
          db.collection('reservierungZugaenge')
            .where('spielerName', '==', name).limit(2)
        );
        if (matches.size === 1 &&
            writer(matches.docs[0]) === name) {
          ownerUid = matches.docs[0].id;
        }
      }
      const booking = {id, date, resource, timeFrom, timeTo,
        ownerUid, createdByUid: uid, bookedBy: name, ...selection};
      const collisionUid = rosterBooking ? null : uid;
      if (legacy.some(existing => overlaps(existing, booking, name, collisionUid)) ||
          bookings.some(existing => overlaps(existing, booking, name, collisionUid))) {
        throw new HttpsError('already-exists', 'Die Ressource oder der Spieler ist in diesem Zeitraum bereits gebucht.');
      }
      transaction.set(day, {list: [...bookings, booking]}, {merge: true});
      return {id};
    });
  }

  if (input.action === 'cancel' && typeof input.id === 'string' && /^[a-f0-9]{64}$/.test(input.id)) {
    return db.runTransaction(async transaction => {
      const [grants, profile, saved, account] = await transaction.getAll(permissions, access, day, userProfile);
      const admin = isAdmin(account);
      if (!admin && !(fromStartPage && canBookAsRosterMember(account, email))) requireWriter(grants, profile, uid);
      const bookings = bookingList(saved);
      const target = bookings.find(booking => booking.id === input.id);
      if (!target) return {cancelled: true};
      if (target.ownerUid !== uid && !admin) throw new HttpsError('permission-denied', 'Nur eigene Buchungen können storniert werden.');
      const cancelled = saved.data()?.cancelled || [];
      transaction.set(day, {list: bookings.filter(booking => booking.id !== input.id), cancelled: [...cancelled, input.id]}, {merge: true});
      return {cancelled: true};
    });
  }

  // Administrator: übernommene Buchung (Bestand 12.11., ohne ID) löschen.
  if (input.action === 'cancelImported' && typeof input.key === 'string' && /^[a-f0-9]{64}$/.test(input.key)) {
    return db.runTransaction(async transaction => {
      const [account, history] = await transaction.getAll(userProfile, imported);
      if (!isAdmin(account)) throw new HttpsError('permission-denied', 'Nur Administratoren dürfen diese Buchung löschen.');
      const legacy = bookingList(history, true);
      const rest = legacy.filter(row => !(row?.date === input.date && rowKey(row) === input.key));
      if (rest.length === legacy.length) return {cancelled: true};
      transaction.set(imported, {list: rest}, {merge: true});
      return {cancelled: true};
    });
  }

  // Administrator: Buchung ändern (alte entfernen, neue prüfen und speichern – in einem Schritt).
  if (input.action === 'adminReplace' && input.booking && validBooking(input.booking) &&
      typeof input.requestId === 'string' && /^[a-f0-9-]{36}$/.test(input.requestId) &&
      ((typeof input.id === 'string' && /^[a-f0-9]{64}$/.test(input.id)) ||
       (typeof input.key === 'string' && /^[a-f0-9]{64}$/.test(input.key)))) {
    const next = input.booking;
    const nextDay = db.collection('reservierungBuchungstage').doc(next.date);
    const sameDay = next.date === input.date;
    const id = createHash('sha256').update(uid + ':' + input.requestId).digest('hex');
    return db.runTransaction(async transaction => {
      const refs = [userProfile, imported, day, roster];
      if (!sameDay) refs.push(nextDay);
      const [account, history, saved, players, savedNext] = await transaction.getAll(...refs);
      if (!isAdmin(account)) throw new HttpsError('permission-denied', 'Nur Administratoren dürfen fremde Buchungen ändern.');
      const name = next.bookedBy;
      if (typeof name !== 'string' || !playerNames(players).includes(name)) {
        throw new HttpsError('invalid-argument', 'Bitte einen Namen aus der Spielerliste auswählen.');
      }
      let legacy = bookingList(history, true);
      let bookings = bookingList(saved);
      let old;
      if (input.id) {
        old = bookings.find(booking => booking.id === input.id);
        bookings = bookings.filter(booking => booking.id !== input.id);
      } else {
        old = legacy.find(row => row?.date === input.date && rowKey(row) === input.key);
        legacy = legacy.filter(row => !(row?.date === input.date && rowKey(row) === input.key));
      }
      if (!old) throw new HttpsError('not-found', 'Die Buchung wurde inzwischen geändert oder gelöscht.');
      const target = sameDay ? bookings : bookingList(savedNext);
      verifyDay(legacy, next.date);
      verifyDay(target, next.date);
      const selection = details(next, players, name);
      let ownerUid = old.bookedBy === name && old.ownerUid ? old.ownerUid : uid;
      if (old.bookedBy !== name) {
        const matches = await transaction.get(
          db.collection('reservierungZugaenge').where('spielerName', '==', name).limit(2));
        if (matches.size === 1 && writer(matches.docs[0]) === name) ownerUid = matches.docs[0].id;
      }
      const booking = {id, date: next.date, resource: next.resource, timeFrom: next.timeFrom, timeTo: next.timeTo,
        ownerUid, createdByUid: uid, bookedBy: name, ...selection};
      if (legacy.some(existing => overlaps(existing, booking, name, null)) ||
          target.some(existing => overlaps(existing, booking, name, null))) {
        throw new HttpsError('already-exists', 'Die Ressource oder ein Spieler ist in diesem Zeitraum bereits gebucht.');
      }
      if (!input.id) transaction.set(imported, {list: legacy}, {merge: true});
      if (sameDay) {
        transaction.set(day, {list: [...bookings, booking]}, {merge: true});
      } else {
        if (input.id) transaction.set(day, {list: bookings}, {merge: true});
        transaction.set(nextDay, {list: [...target, booking]}, {merge: true});
      }
      return {id};
    });
  }

  throw new HttpsError('invalid-argument', 'Bitte eine gültige zukünftige Buchungszeit wählen.');
});
