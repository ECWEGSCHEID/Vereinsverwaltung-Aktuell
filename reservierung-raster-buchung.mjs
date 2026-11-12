import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';

const clock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function createRasterBooking(app, auth, {games, status, showRows}) {
  const call = httpsCallable(getFunctions(app, 'europe-west3'), 'ecwBahnreservierung');
  let imported = [], dates = [], dateKey = '', loaded = false, sequence = 0;
  let writable = new Set(), dialog, busy = false;
  const uid = () => auth.currentUser?.uid;

  function update(days, force = false) {
    const key = days.join(',');
    if (!loaded || !uid() || (!force && key === dateKey)) return;
    dateKey = key;
    dates = days;
    writable = new Set();
    const request = ++sequence, account = uid();
    void Promise.allSettled(days.map(date => call({
      action: 'list', date, view: games ? 'spiele' : 'reservierungen'
    }))).then(results => {
      if (request !== sequence || account !== uid()) return;
      const extra = [];
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        if (result.value.data.canBook === true && !games) writable.add(days[index]);
        for (const booking of result.value.data.bookings || []) {
          if (!/^[a-f0-9]{64}$/.test(booking.id) || booking.date !== days[index] ||
              !/^Bahn [1-4]$/.test(booking.resource) || !timePattern.test(booking.timeFrom) ||
              !timePattern.test(booking.timeTo)) continue;
          extra.push({
            id: 1000000 + extra.length, liveId: booking.id, own: !games && booking.own === true,
            date: booking.date, resource: booking.resource, timeFrom: booking.timeFrom, timeTo: booking.timeTo,
            bookedBy: typeof booking.bookedBy === 'string' ? booking.bookedBy : '',
            mode: 'Reserviert', homeTeam: [], guestTeam: []
          });
        }
      });
      status.textContent = results.some(result => result.status === 'rejected')
        ? 'Aktuelle Buchungen konnten nicht vollständig geladen werden.'
        : writable.size ? 'Freies Feld antippen, um eine Bahn zu reservieren.'
          : 'Reservierungen · Leseansicht';
      showRows([...imported, ...extra]);
    });
  }

  function canBook(date, resource, time) {
    return !games && /^Bahn [1-4]$/.test(resource) && writable.has(date)
      && date + ' ' + time >= clock.format(new Date());
  }

  function openSlot(date, resource, time) {
    if (busy || !canBook(date, resource, time)) return;
    dialog?.remove();
    const account = uid();
    dialog = document.createElement('dialog');
    dialog.className = 'w-[min(92vw,360px)] rounded-xl border border-zinc-600 bg-zinc-900 p-4 text-white';
    dialog.innerHTML = '<form class="space-y-3"><h2 class="text-base font-bold">Bahn reservieren</h2><p></p><label class="block">Bis <input type="time" required class="ml-2 rounded bg-zinc-800 p-2 text-white"></label><p role="status"></p><div class="flex gap-2"><button type="button" class="rounded bg-zinc-700 p-2">Abbrechen</button><button type="submit" class="rounded bg-red-700 p-2">Reservieren</button></div></form>';
    const form = dialog.querySelector('form');
    form.querySelector('p').textContent = resource + ' · ' + date.split('-').reverse().join('.') + ' · ab ' + time + ' Uhr';
    const end = form.querySelector('input');
    const [hour, minute] = time.split(':').map(Number);
    const minutes = Math.min(hour * 60 + minute + 30, 1439);
    end.value = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
    const message = form.querySelector('[role="status"]');
    const [cancel, submit] = form.querySelectorAll('button');
    let pending;
    cancel.onclick = () => dialog.close();
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', event => event.currentTarget.remove(), {once: true});
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || account !== uid() || !canBook(date, resource, time)) return;
      if (end.value <= time) {
        message.textContent = 'Die Endzeit muss nach dem Beginn liegen.';
        return;
      }
      if (pending?.end !== end.value) pending = {end: end.value, id: crypto.randomUUID()};
      busy = submit.disabled = cancel.disabled = true;
      try {
        await call({action: 'book', date, resource, timeFrom: time, timeTo: pending.end, requestId: pending.id});
        dialog.close();
        update(dates, true);
      } catch (error) {
        message.textContent = error.message || 'Buchung konnte nicht gespeichert werden.';
      } finally {
        busy = submit.disabled = cancel.disabled = false;
      }
    });
    document.body.append(dialog);
    dialog.showModal();
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
      sequence++; loaded = false; dateKey = ''; imported = []; dates = [];
      writable.clear(); dialog?.close();
    },
    update, canBook, openSlot, cancelBooking
  };
}
