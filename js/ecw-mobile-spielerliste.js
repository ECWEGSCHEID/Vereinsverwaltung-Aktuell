(() => {
  'use strict';

  const admin = () => currentUser && auth?.currentUser?.uid === currentUser.uid &&
    profile?.admin === true && profile.whiteboard !== true &&
    String(profile.role || '').toLowerCase() !== 'whiteboard' &&
    currentUser.email?.toLowerCase() !== 'informationssystem@ec-wegscheid.de';
  const panel = $('mobilePlayersView');
  const roster = () => db.doc('appSettings/playerList');
  const directory = () => db.doc('smartphoneAnmeldung/mitglieder');
  let session = 0;
  let rosterData;
  let entries;
  let settings;

  function sameData(first, second) {
    const ordered = snapshot => Object.entries(snapshot.data() || {}).sort(([a], [b]) => a.localeCompare(b));
    return first.exists === second.exists && JSON.stringify(ordered(first)) === JSON.stringify(ordered(second));
  }

  function status(message, error = false) {
    setStatus('mobilePlayersStatus', message, error ? 'err' : '');
  }

  function button(label, action) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.onclick = action;
    return element;
  }

  function resolve(name, aliases) {
    const seen = new Set();
    while (Object.hasOwn(aliases, name) && typeof aliases[name] === 'string' && !seen.has(name)) {
      seen.add(name);
      name = aliases[name];
    }
    return name;
  }

  function linked(name, aliases, members) {
    return members.filter(entry => typeof entry?.name === 'string' && resolve(entry.name, aliases) === name);
  }

  async function openPlayers() {
    if (!admin()) return;
    show('mobilePlayersView');
    const ticket = session;
    rosterData = null;
    $('mobilePlayerRows').replaceChildren();
    $('mobilePlayerAdd').disabled = true;
    status('Spielerliste wird geladen …');
    try {
      const [players, login, navigation] = await Promise.all([
        roster().get({source: 'server'}), directory().get({source: 'server'}),
        ECWSmartphoneNavigation.settingsRef(db).get({source: 'server'})
      ]);
      if (ticket !== session || !admin()) return;
      if (!Array.isArray(players.data()?.players)) throw Error('Zentrale Spielerliste fehlt.');
      rosterData = players.data();
      entries = login.data()?.members || [];
      if (!Array.isArray(entries)) throw Error('Anmeldeverzeichnis ist ungültig.');
      settings = navigation.data();
      $('mobilePlayerAdd').disabled = false;
      render();
      status('');
    } catch (error) {
      if (ticket === session) status(error.message, true);
    }
  }

  async function changeRoster(oldName, newName) {
    if (!admin()) return;
    if (oldName === newName) return;
    const uid = currentUser.uid;
    const ticket = session;
    try {
      await db.runTransaction(async tx => {
        const [snapshot, login] = await Promise.all([tx.get(roster()), tx.get(directory())]);
        if (!admin() || currentUser.uid !== uid) throw Error('Adminsitzung geändert.');
        const data = snapshot.data();
        const players = data?.players;
        const aliases = Object.assign(Object.create(null), data?.aliases);
        if (!Array.isArray(players) || (oldName && !players.includes(oldName))) {
          throw Error('Spielerliste wurde geändert. Bitte erneut öffnen.');
        }
        if (newName && (newName === 'X' || newName.length > 120 || players.includes(newName) ||
            Object.hasOwn(aliases, newName))) throw Error('Dieser Name ist ungültig oder bereits vergeben.');
        if (oldName && !newName && linked(oldName, aliases, login.data()?.members || []).length) {
          throw Error('Dieser Spieler hat ein Smartphone-Konto. Verwalte zuerst die Zuordnung im Anmeldeverzeichnis.');
        }
        const updated = oldName
          ? players.flatMap(name => name === oldName ? (newName ? [newName] : []) : [name])
          : [...players, newName];
        if (!updated.length) throw Error('Die Spielerliste muss mindestens einen Eintrag enthalten.');
        if (oldName && newName) aliases[oldName] = newName;
        tx.update(roster(), {players: updated, aliases: {...aliases}, updatedAt: new Date().toISOString()});
      });
      if (ticket === session && admin()) {
        $('mobilePlayerNew').value = '';
        await openPlayers();
        if (rosterData) status('Spielerliste gespeichert.');
      }
    } catch (error) {
      if (ticket === session) status(error.message, true);
    }
  }

  function render() {
    const query = $('mobilePlayerSearch').value.trim().toLocaleLowerCase('de');
    const rows = $('mobilePlayerRows');
    rows.replaceChildren();
    if (!rosterData) return;
    const names = rosterData.players.filter(name => typeof name === 'string' && name !== 'X')
      .sort((a,b) => a.localeCompare(b, 'de'));
    for (const name of names.filter(name => name.toLocaleLowerCase('de').includes(query))) {
      const row = document.createElement('li');
      row.append(button(name, () => openMember(name)));
      rows.append(row);
    }
    if (!rows.children.length) rows.textContent = 'Keine Spieler gefunden.';
  }

  async function openMember(name) {
    if (!admin() || !rosterData) return;
    const uid = currentUser.uid;
    const ticket = session;
    const dialog = $('mobilePlayerDialog');
    const content = document.createElement('div');
    const permitted = () => admin() && currentUser.uid === uid && session === ticket && dialog.open && content.isConnected;
    $('mobilePlayerHeading').textContent = name;
    $('mobilePlayerDetail').replaceChildren(content);
    const rename = document.createElement('input');
    rename.value = name;
    rename.maxLength = 120;
    rename.setAttribute('aria-label', 'Spielername');
    content.append(rename, button('Namen speichern', () => {
      if (!permitted() || !rename.value.trim()) return;
      dialog.close();
      void changeRoster(name, rename.value.trim());
    }));
    const matches = linked(name, rosterData.aliases || {}, entries);
    if (!matches.length) {
      content.append(button('Spieler entfernen', () => {
        if (!permitted() || !confirm(name + ' aus der Spielerliste entfernen?')) return;
        dialog.close();
        void changeRoster(name, '');
      }), ' Für diesen Spieler ist kein Smartphone-Konto eingerichtet.');
    }
    dialog.showModal();
    if (!matches.length) return;
    const member = matches[0];
    if (member.name !== name) {
      const note = document.createElement('p');
      note.textContent = 'Name bei der Smartphone-Anmeldung: ' + member.name;
      content.append(note);
    }
    const info = document.createElement('p');
    info.setAttribute('role', 'status');
    content.append(info);
    if (matches.length !== 1 || !/^[a-f0-9]{32}$/.test(member.alias) ||
        entries.filter(entry => entry?.alias === member.alias).length !== 1) {
      info.textContent = 'Das Smartphone-Konto ist nicht eindeutig zugeordnet.';
      return;
    }
    const memberUid = member.name === 'Stadler Martin' ? 'n9MpiKXZNLap8wsbRcP4fVjrT4D2' : 'ecw-mobile-' + member.alias;
    const ref = db.doc('smartphoneFreigaben/' + memberUid);
    const bookingRef = db.doc('reservierungZugaenge/' + memberUid);
    try {
      info.textContent = 'Freigaben werden geladen …';
      const [initial, initialBooking] = await Promise.all([ref.get({source: 'server'}), bookingRef.get({source: 'server'}).catch(() => null)]);
      if (!permitted()) return;
      let booking = initialBooking;
      info.textContent = '';
      const grants = initial.data() || {};
      const form = document.createElement('form');
      function checkbox(title, checked) {
        const row = document.createElement('label');
        row.className = 'mobile-player-permission';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checked;
        row.append(input, document.createTextNode(title));
        form.append(row);
        return input;
      }
      const items = ECWSmartphoneNavigation.memberItems(settings);
      const controls = items.map(item => [item, checkbox(item.title, item.custom
        ? !grants.gesperrteLinks?.includes(item.key)
        : ECWSmartphoneNavigation.memberFeatureAllowed(grants, item.feature))]);
      const submit = document.createElement('button');
      submit.textContent = 'Freigaben speichern';
      form.append(submit);
      form.onsubmit = async event => {
        event.preventDefault();
        if (!permitted() || submit.disabled) return;
        submit.disabled = true;
        const updates = {};
        const blocked = new Set(grants.gesperrteLinks || []);
        for (const [item, input] of controls) {
          if (!item.custom) updates[item.key] = input.checked;
          else if (input.checked) blocked.delete(item.key);
          else blocked.add(item.key);
        }
        updates.gesperrteLinks = [...blocked];
        try {
          await db.runTransaction(async tx => {
            const current = await tx.get(ref);
            if (!permitted()) throw Error('Adminsitzung geändert.');
            if (!sameData(current, initial)) {
              throw Error('Freigaben wurden zwischenzeitlich geändert. Bitte erneut öffnen.');
            }
            tx.set(ref, updates);
          });
          if (permitted()) {
            dialog.close();
            status('Freigaben für ' + name + ' gespeichert.');
          }
        } catch (error) {
          if (permitted()) info.textContent = error.code === 'permission-denied'
            ? 'Firebase verweigert das Speichern der Menüfreigaben. Bitte den Regelblock smartphoneFreigaben prüfen.'
            : 'Speichern fehlgeschlagen: ' + error.message;
        } finally {
          submit.disabled = false;
        }
      };
      content.append(form);
      if (booking?.exists) {
        const bookingForm = document.createElement('form');
        const label = document.createElement('label');
        label.className = 'mobile-player-permission';
        const write = document.createElement('input');
        write.type = 'checkbox';
        write.checked = booking.data()?.reservieren === true;
        label.append(write, document.createTextNode('Bahn und Vereinsheim buchen'));
        const saveBooking = document.createElement('button');
        saveBooking.textContent = 'Buchungsrecht speichern';
        const bookingStatus = document.createElement('p');
        bookingStatus.setAttribute('role', 'status');
        bookingForm.append(label, saveBooking, bookingStatus);
        bookingForm.onsubmit = async event => {
          event.preventDefault();
          if (!permitted() || saveBooking.disabled) return;
          saveBooking.disabled = true;
          const allowed = write.checked;
          try {
            await db.runTransaction(async tx => {
              const current = await tx.get(bookingRef);
              if (!permitted()) throw Error('Adminsitzung geändert.');
              if (!sameData(current, booking)) throw Error('Buchungsrecht wurde zwischenzeitlich geändert. Bitte erneut öffnen.');
              tx.update(bookingRef, {reservieren: allowed});
            });
            if (permitted()) {
              booking = await bookingRef.get({source: 'server'});
              bookingStatus.textContent = 'Buchungsrecht gespeichert.';
            }
          } catch (error) {
            if (permitted()) bookingStatus.textContent = 'Buchungsrecht konnte nicht gespeichert werden: ' + error.message;
          } finally {
            saveBooking.disabled = false;
          }
        };
        content.append(bookingForm);
      }
    } catch (error) {
      if (permitted()) info.textContent = 'Freigaben konnten nicht geladen werden: ' + error.message;
    }
    if (permitted()) {
      ecwActivationControls(content, name, permitted, async () => {
        const call = firebase.app().functions('europe-west3').httpsCallable('ecwSmartphoneAktivierungslink');
        return (await call({name: member.name})).data.link;
      }, dialog);
    }
  }

  $('mobilePlayerDialog').addEventListener('close', event => {
    if (!event.target.open) $('mobilePlayerDetail').replaceChildren();
  });

  const originalShow = show;
  show = function (id) {
    ++session;
    if ($('mobilePlayerDialog').open) $('mobilePlayerDialog').close();
    originalShow(id);
    panel.classList.toggle('hidden', id !== 'mobilePlayersView' || !admin());
  };

  const originalApply = applyTiles;
  applyTiles = function () {
    originalApply();
    $('tilePlayers').hidden = !admin();
    if (admin()) $('tileMore').hidden = false;
  };

  document.addEventListener('DOMContentLoaded', () => {
    $('moreTiles').append($('tilePlayers'));
    $('tilePlayers').onclick = openPlayers;
    $('mobilePlayerSearch').oninput = render;
    $('mobilePlayersBack').onclick = () => {show('moreView');applyTiles();};
    $('mobilePlayerAddForm').onsubmit = event => {
      event.preventDefault();
      const name = $('mobilePlayerNew').value.trim();
      if (name) void changeRoster('', name);
    };
  });
})();
