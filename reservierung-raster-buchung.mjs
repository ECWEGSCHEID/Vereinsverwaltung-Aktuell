import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';

const clock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function createRasterBooking(app, auth, {games, whiteboard, status, showRows, bookingCall}) {
  const call = bookingCall ?? httpsCallable(getFunctions(app, 'europe-west3'), 'ecwBahnreservierung');
  let imported = [], dates = [], dateKey = '', loaded = false, sequence = 0;
  let writable = new Set(), busy = false, options, formAccount, pending, session = 0;
  const uid = () => auth.currentUser?.uid;
  const element = id => document.getElementById(id);
  const pause = () => new Promise(resolve => setTimeout(resolve, 400));

  const resourcePattern = /^(Bahn [1-4]|Vereinsheim)$/;
  const canBookDay = date => writable.has(date);

  async function callWithRetry(data, account) {
    try {
      return await call(data);
    } catch (error) {
      if (!['functions/unauthenticated', 'functions/unavailable', 'functions/deadline-exceeded'].includes(error.code)) throw error;
      await pause();
      if (uid() !== account) throw error;
      return call(data);
    }
  }

  function update(days, force = false) {
    const key = days.join(',');
    if (!loaded || !uid() || (!force && key === dateKey)) return;
    dateKey = key;
    dates = days;
    writable = new Set();
    const request = ++sequence, account = uid();
    void Promise.allSettled(days.map(date => callWithRetry({
      action: 'list', date, view: whiteboard ? 'whiteboard' : games ? 'spiele' : 'reservierungen'
    }, account))).then(results => {
      if (request !== sequence || account !== uid()) return;
      const extra = [];
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        if (result.value.data.canBook === true && !games && !whiteboard) writable.add(days[index]);
        for (const booking of result.value.data.bookings || []) {
          if ((!whiteboard && !/^[a-f0-9]{64}$/.test(booking.id)) || booking.date !== days[index] ||
              !resourcePattern.test(booking.resource) || !timePattern.test(booking.timeFrom) ||
              !(timePattern.test(booking.timeTo) || booking.timeTo === '24:00')) continue;
          extra.push({
            id: 1000000 + extra.length, liveId: booking.id, own: !games && !whiteboard && booking.own === true,
            date: booking.date, resource: booking.resource, timeFrom: booking.timeFrom, timeTo: booking.timeTo,
            bookedBy: typeof booking.bookedBy === 'string' ? booking.bookedBy : '',
            mode: booking.mode || 'Reserviert',
            homeTeam: Array.isArray(booking.homeTeam) ? booking.homeTeam : [],
            guestTeam: Array.isArray(booking.guestTeam) ? booking.guestTeam : []
          });
        }
      });
      const denied = whiteboard && results.some(result =>
        result.status === 'rejected' && result.reason?.code === 'functions/permission-denied');
      status.textContent = denied ? 'Dieses Konto hat keine Whiteboard-Lesefreigabe.'
        : results.some(result => result.status === 'rejected')
        ? 'Aktuelle Buchungen konnten nicht vollständig geladen werden.'
        : writable.size ? 'Freies Feld antippen, um eine Bahn oder das Vereinsheim zu reservieren.'
          : games || whiteboard ? 'Reservierungen · Leseansicht' : 'Für dieses Konto ist nur Lesen freigegeben.';
      showRows([...imported, ...extra]);
    });
  }

  function canBook(date, resource, time) {
    return !games && !whiteboard && resourcePattern.test(resource) && canBookDay(date)
      && date + ' ' + time >= clock.format(new Date());
  }

  async function openSlot(date, resource, time) {
    if (busy || !canBook(date, resource, time)) return;
    busy = true;
    const account = uid(), openingSession = session;
    try {
      const nextOptions = options ?? (await callWithRetry({action: 'bookingOptions'}, account)).data;
      if (openingSession !== session || account !== uid() || !canBook(date, resource, time)) return;
      options = nextOptions;
      if (!Array.isArray(options.players) || typeof options.owner !== 'string') {
        throw new Error('Die Spielerliste fehlt.');
      }
      formAccount = account;
      pending = undefined;
      element('raster-booking-message').textContent = '';
      window.ecwOpenOriginalBookingForm(date, resource, time, options);
    } catch (error) {
      if (account === uid()) status.textContent = 'Buchungsmaske konnte nicht geöffnet werden: ' + (error.message || 'Dienst nicht erreichbar.');
    } finally {
      busy = false;
    }
  }

  function selectedPlayers(side) {
    return Array.from({length: 4}, (_, index) => index + 1)
      .filter(index => element('field_' + side + 'Player' + index).style.display !== 'none')
      .map(index => element(side + 'Player' + index).value)
      .filter(Boolean);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || !uid() || formAccount !== uid()) return;
    const values = {
      action: 'book', date: element('modalBookDate').value,
      resource: element('modalSelectedResource').value,
      timeFrom: element('modalTimeFrom').value, timeTo: element('modalTimeTo').value,
      mode: element('modalTemplateSelect').value,
      homeTeam: selectedPlayers('home'), guestTeam: selectedPlayers('guest')
    };
    const message = element('raster-booking-message');
    if (!canBook(values.date, values.resource, values.timeFrom) || values.timeFrom >= values.timeTo) {
      message.textContent = 'Bitte einen freien zukünftigen Beginn und eine spätere Endzeit wählen.';
      return;
    }
    const signature = JSON.stringify(values);
    if (pending?.signature !== signature) pending = {signature, id: crypto.randomUUID()};
    const button = element('modalSubmitBtn');
    busy = button.disabled = true;
    message.textContent = 'Reservierung wird gespeichert …';
    const account = uid();
    try {
      await call({...values, requestId: pending.id});
      if (account !== uid()) return;
      window.closeBookingModal(true);
      update(dates, true);
    } catch (error) {
      if (account === uid()) message.textContent = error.message || 'Buchung konnte nicht gespeichert werden.';
    } finally {
      busy = button.disabled = false;
    }
  }

  async function cancelBooking(booking) {
    if (busy || games || !booking.own || !writable.has(booking.date) ||
        !confirm('Diese eigene Buchung stornieren?')) return;
    busy = true;
    try {
      await call({action: 'cancel', date: booking.date, id: booking.liveId});
      update(dates, true);
    } catch (error) {
      status.textContent = error.message || 'Stornieren fehlgeschlagen.';
    } finally {
      busy = false;
    }
  }

  return {
    setImported(rows) { imported = rows; loaded = true; },
    reset() {
      sequence++; session++; loaded = false; dateKey = ''; imported = []; dates = [];
      writable.clear(); options = undefined; formAccount = undefined; pending = undefined;
      window.closeBookingModal(true);
    },
    update, canBookDay, canBook, openSlot, submit, cancelBooking, isBusy: () => busy
  };
}
