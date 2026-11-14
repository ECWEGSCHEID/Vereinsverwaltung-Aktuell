/* Mobile Technikseite der EC-Wegscheid-Vereinsverwaltung. */
(() => {
  'use strict';

  const temperatureKeys = ['halle', 'aussen', 'vereinsheim'];
  const maxAge = 7 * 60 * 1000;
  const pendingAge = 2 * 60 * 1000;
  const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' });
  const numberFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sources = {};
  let subscriptions = [];
  let refreshTimer;
  let session;
  let sending = false;

  function millis(value) {
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value === 'number') return value;
    return typeof value === 'string' ? Date.parse(value) : NaN;
  }

  function isFresh(value, age = maxAge) {
    const elapsed = Date.now() - millis(value);
    return elapsed >= -60000 && elapsed <= age;
  }

  function formatTime(value) {
    const time = millis(value);
    return Number.isFinite(time) && Math.abs(time) <= 8.64e15 ? dateFormat.format(time) : '';
  }

  function statusMessage(source, unavailable) {
    if (source?.error) {
      return source.error.code === 'permission-denied' ? 'Firebase-Zugriff fehlt.' : source.error.code === 'not-configured' ? 'ECW Technik ist noch nicht konfiguriert.' : 'Verbindung zu Firebase unterbrochen.';
    }
    if (!source) return 'Wird geladen …';
    if (!source.data) return source.cached ? 'Warte auf Verbindung zu Firebase …' : unavailable;
    return '';
  }

  function renderTemperatures() {
    const source = sources.temperatures;
    const data = source?.data;
    $('technikTemperaturStatus').textContent = statusMessage(source, 'Warte auf Messwerte vom Raspberry Pi.')
      || (source.cached ? 'Zuletzt gespeicherte Werte · Firebase offline' : '');
    for (const key of temperatureKeys) {
      const temperature = data?.[key];
      const valid = typeof temperature === 'number' && Number.isFinite(temperature);
      const time = data?.messzeiten?.[key] ?? data?.updatedAt ?? data?.aktualisiert;
      const recent = valid && isFresh(time) && !source.cached;
      $('technik-' + key).textContent = valid ? numberFormat.format(temperature) + ' °C' : '— °C';
      const humidity = data?.[key + '_luftfeuchte_prozent'];
      const battery = data?.[key + '_batteriespannung_v'];
      $('technik-' + key + '-feuchte').textContent = typeof humidity === 'number' && Number.isFinite(humidity)
        ? humidity.toFixed(2).replace('.', ',') + ' %' : '— %';
      $('technik-' + key + '-batterie').textContent = typeof battery === 'number' && Number.isFinite(battery)
        ? battery.toFixed(3).replace('.', ',') + ' V' : '— V';
      $('technik-' + key + '-zeit').textContent = valid
        ? [formatTime(time), recent ? '' : 'Messwert nicht aktuell'].filter(Boolean).join(' · ')
        : 'Kein Messwert';
    }
  }

  function requestPending(command, report) {
    return !!command?.anfrageId && command.anfrageId !== report?.letzteAnfrageId
      && isFresh(command.angefordertAm, pendingAge);
  }

  function renderStockTv() {
    const source = sources.stockTv;
    const commandSource = sources.command;
    const data = source?.data;
    const command = commandSource?.data;
    const fresh = !!data && !source.cached && isFresh(data.updatedAt);
    const ready = fresh && data.steuerungBereit === true && !!commandSource
      && !commandSource.error && !commandSource.cached;
    const pending = requestPending(command, data);
    const status = statusMessage(source, 'Warte auf die StockTV-Anbindung.')
      || (commandSource?.error ? statusMessage(commandSource, '') : '');
    const unconfirmed = !!command?.anfrageId && command.anfrageId !== data?.letzteAnfrageId;
    $('technikStockTvStatus').textContent = status || (pending
      ? 'Anfrage „' + (command.aktiv ? 'An' : 'Aus') + '“ wartet auf Bestätigung.'
      : unconfirmed ? 'Die letzte Anfrage wurde nicht bestätigt.'
      : fresh ? (data.steuerungBereit === true ? 'Steuerung bereit.' : 'Steuerung derzeit nicht bereit.')
      : 'StockTV-Status ist nicht aktuell.');
    for (const [index, element] of Array.from($('technikStockTvGeraete').children).entries()) {
      const active = data?.anzeigen?.[String(index + 1)];
      const label = active === true ? 'An' : active === false ? 'Aus' : 'Unbekannt';
      element.textContent = 'Anzeige ' + (index + 1) + ' · ' + label + (!fresh && typeof active === 'boolean' ? ' (zuletzt gemeldet)' : '');
    }
    $('technikStockTvAn').disabled = !ready || pending || sending;
    $('technikStockTvAus').disabled = !ready || pending || sending;
  }

  function renderJobList(listId, statusId, jobs, source, missing, empty) {
    const list = $(listId);
    list.replaceChildren();
    const status = statusMessage(source, 'Warte auf die Druckserver-Anbindung.');
    const fresh = !!source?.data && !source.cached && isFresh(source.data.updatedAt);
    $(statusId).textContent = status || (!Array.isArray(jobs) ? missing
      : !fresh ? 'Stand nicht aktuell' + (formatTime(source.data.updatedAt) ? ' · ' + formatTime(source.data.updatedAt) : '')
      : jobs.length ? '' : empty);
    if (!Array.isArray(jobs)) return;
    for (const job of jobs.slice(0, 20)) {
      if (!job || typeof job !== 'object') continue;
      const entry = document.createElement('li');
      entry.textContent = [job.titel || 'Druckauftrag', job.status, formatTime(job.zeit)].filter(Boolean).join(' · ');
      list.append(entry);
    }
  }

  function render() {
    renderTemperatures();
    renderStockTv();
    const source = sources.print;
    renderJobList('technikDruckListe', 'technikDruckStatus', source?.data?.letzteAuftraege, source,
      'Auftragsverlauf wurde noch nicht gemeldet.', 'Keine letzten Druckaufträge gemeldet.');
    renderJobList('technikDruckOffenListe', 'technikDruckOffenStatus', source?.data?.offeneAuftraege, source,
      'Offene Aufträge wurden noch nicht gemeldet.', 'Keine offenen Druckaufträge.');
  }

  function subscribe(name, collection, id) {
    const opened = session;
    subscriptions.push(db.collection(collection).doc(id).onSnapshot({ includeMetadataChanges: true }, snapshot => {
      if (session !== opened) return;
      sources[name] = { data: snapshot.exists ? snapshot.data() : null, cached: snapshot.metadata.fromCache };
      render();
    }, error => {
      if (session !== opened) return;
      sources[name] = { error };
      render();
    }));
  }

  function setVisible(visible) {
    if (session) {
      session = null;
      subscriptions.forEach(unsubscribe => unsubscribe());
      subscriptions = [];
      clearInterval(refreshTimer);
    }
    for (const key of Object.keys(sources)) delete sources[key];
    if (!visible || !currentUser || !can('admin')) return;
    session = {};
    sending = false;
    setStatus('technikStockTvMeldung', '');
    render();
    if (window.ecwTechnikDb) {
      const opened=session;
      subscriptions.push(window.ecwTechnikDb.collection('sensors').doc('temperatures').onSnapshot(
        {includeMetadataChanges:true}, snap=>{
          if(session!==opened)return;
          sources.temperatures={data:snap.exists?snap.data():null,cached:snap.metadata.fromCache};render();
        },error=>{if(session!==opened)return;sources.temperatures={error};render();}
      ));
    } else {sources.temperatures={error:{code:'not-configured'}};render();}
    subscribe('stockTv', 'technik', 'stockTvStatus');
    subscribe('command', 'technik', 'stockTvSteuerung');
    subscribe('print', 'technik', 'druckStatus');
    refreshTimer = setInterval(render, 10000);
  }

  async function switchStockTv(aktiv) {
    if (!session || !currentUser || !can('admin') || sending) return;
    const opened = session;
    const uid = currentUser.uid;
    const ref = db.collection('technik').doc('stockTvSteuerung');
    const reportRef = db.collection('technik').doc('stockTvStatus');
    const anfrageId = db.collection('technik').doc().id;
    sending = true;
    setStatus('technikStockTvMeldung', '');
    renderStockTv();
    try {
      await db.runTransaction(async transaction => {
        const report = (await transaction.get(reportRef)).data();
        const previous = (await transaction.get(ref)).data();
        if (report?.steuerungBereit !== true || !isFresh(report.updatedAt)) {
          throw Error('Die StockTV-Steuerung ist derzeit nicht erreichbar.');
        }
        if (requestPending(previous, report)) throw Error('Es wartet bereits eine Anfrage auf Bestätigung.');
        transaction.set(ref, { aktiv, anfrageId, angefordertVon: uid,
          angefordertAm: firebase.firestore.FieldValue.serverTimestamp() });
      });
      if (session === opened) setStatus('technikStockTvMeldung', 'Anfrage gespeichert. Die Anzeige bestätigt den tatsächlichen Zustand.', 'ok');
    } catch (error) {
      if (session === opened) setStatus('technikStockTvMeldung', error.code === 'permission-denied'
        ? 'Die Berechtigung für die StockTV-Steuerung fehlt.' : error.message, 'err');
    } finally {
      if (session === opened) {
        sending = false;
        renderStockTv();
      }
    }
  }

  window.ecwTechnik = { setVisible };
  $('tileTechnik').onclick = () => { if (currentUser && can('admin')) show('technikView'); };
  $('technikStockTvAn').onclick = () => switchStockTv(true);
  $('technikStockTvAus').onclick = () => switchStockTv(false);
})();
