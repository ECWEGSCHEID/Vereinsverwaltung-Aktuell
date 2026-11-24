/* EC Wegscheid – Startkarte "Mein Überblick" im Smartphone-Mitgliederbereich.
   1. eigene Reservierungen der nächsten 14 Tage (neues Reservierungssystem)
   2. offene Forderung in der Solo Pyramide (nur wenn aktiv)
   3. gemeldete Turniere der nächsten 2 Monate
   Dazu ein Button, der alle Einträge als Kalenderdatei (.ics) übergibt. Jeder Termin
   hat eine feste Kennung (UID), damit wiederholtes Übernehmen keine Doppel erzeugt.
   Liest nur – schreibt nichts. */
(function (root) {
'use strict';

const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const nameKey = value => clean(value).toLocaleLowerCase('de-DE')
  .replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
const sameName = (a, b) => !!nameKey(a) && nameKey(a) === nameKey(b);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function viennaToday(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now).map(x => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day;
}
function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso, months) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function isoDate(value) {
  const s = clean(value);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
}
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function shortDate(iso, today) {
  if (iso === today) return 'Heute';
  if (iso === addDays(today, 1)) return 'Morgen';
  const d = new Date(iso + 'T12:00:00Z');
  return WEEKDAYS[d.getUTCDay()] + ' ' + iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.';
}
function firstName(name) {
  // Namen stehen als "Nachname Vorname"; begrüßt wird mit dem Vornamen.
  const parts = clean(name).split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
}

// ---------- 1. Reservierungen ----------
function reservations(rows, name, today) {
  const until = addDays(today, 13);
  const seen = new Set(), out = [];
  for (const r of rows || []) {
    const date = isoDate(r?.date);
    if (!date || date < today || date > until || !TIME.test(r.timeFrom || '')) continue;
    const home = (r.homeTeam || []).map(clean).filter(Boolean);
    const guest = (r.guestTeam || []).map(clean).filter(Boolean);
    const booker = clean(r.bookedBy);
    const bookedBySelf = r.own === true || sameName(booker, name);
    const inHome = home.some(p => sameName(p, name)), inGuest = guest.some(p => sameName(p, name));
    if (!bookedBySelf && !inHome && !inGuest) continue;
    const key = [date, r.resource, r.timeFrom, r.timeTo].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const mates = (inGuest ? guest : home).filter(p => !sameName(p, name));
    const rivals = inGuest ? home : inHome ? guest : [];
    out.push({date, timeFrom: r.timeFrom, timeTo: r.timeTo, resource: clean(r.resource), mode: (clean(r.mode) || 'Reserviert') + (clean(r.note) ? ' „' + clean(r.note) + '“' : ''),
      booker, bookedBySelf, mates, rivals, uidKey: key});
  }
  return out.sort((a, b) => (a.date + a.timeFrom).localeCompare(b.date + b.timeFrom));
}

// ---------- 2. Solo Pyramide ----------
function openChallenge(state, name, now = Date.now()) {
  const list = Array.isArray(state?.fixedChallenges) ? state.fixedChallenges : [];
  const ch = list.find(c => c && c.status === 'fixed' && Number(c.expiresAt) > now &&
    (sameName(c.challenger, name) || sameName(c.opponent, name)));
  if (!ch) return null;
  const challenging = sameName(ch.challenger, name);
  const msLeft = Number(ch.expiresAt) - now;
  const days = Math.floor(msLeft / 86400000), hours = Math.floor(msLeft / 3600000);
  return {other: clean(challenging ? ch.opponent : ch.challenger), challenging,
    left: days >= 1 ? 'noch ' + days + (days === 1 ? ' Tag' : ' Tage') : 'noch ' + Math.max(1, hours) + ' Std.'};
}

// ---------- 3. Turniere ----------
function cancelled(x) {
  return x.cancelled === true || x.canceled === true || x.deleted === true || !!x.cancelledAt ||
    ['abgesagt', 'storniert', 'cancelled', 'canceled', 'deleted', 'entfallen'].includes(clean(x.status).toLowerCase()) ||
    /\b(abgesagt|storniert|entfällt|entfallen)\b/i.test(clean(x.name));
}
function tournaments(entries, name, today) {
  const until = addMonths(today, 2), out = [];
  for (const {id, data: x} of entries || []) {
    if (!x || cancelled(x)) continue;
    const type = clean(x.effectiveType || x.type).toLowerCase();
    if (!['turnier', 'meisterschaft'].includes(type)) continue;
    const players = (Array.isArray(x.players) ? x.players : []).slice(0, 4).map(clean);
    if (!players.some(p => sameName(p, name))) continue;
    const date = isoDate(x.date);
    if (!date || date < today || date > until) continue;
    out.push({id, date, time: TIME.test(clean(x.time)) ? clean(x.time) : '', name: clean(x.name) || 'Turnier',
      location: clean(x.location), mates: players.filter(p => p && !/^x$/i.test(p) && !sameName(p, name))});
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// ---------- 4. Laufende Wettbewerbe ----------
// status: {duoCup, frauencup, jahresmeisterschaft, montagsSolo} aus smartphoneBetrieb/wettbewerbe,
// soloPyramide aus smartphoneBetrieb/soloPyramide. Nur aktive Wettbewerbe werden gezeigt.
const MOTIVATION = [
  'Noch bei keinem Wettbewerb dabei? Komm zum Training – jeder Schuss bringt dich weiter!',
  'Die Bahn wartet auf dich. Ein Training, und du bist wieder mittendrin!',
  'Wer trainiert, trifft. Schau beim nächsten Training vorbei!',
  'Der beste Zeitpunkt zum Einsteigen ist jetzt – wir sehen uns beim Training!',
  'Stocksport lebt von der Gemeinschaft. Komm zum Training und mach mit!',
  'Jeder Meister hat mal mit einem Trainingsschuss angefangen. Deiner wartet!',
  'Ein guter Stock braucht eine sichere Hand – die holst du dir beim Training.',
  'Training heute, Pokal morgen. Wir freuen uns auf dich!',
  'Die Mannschaft ist nur so stark wie ihr Training. Sei dabei!',
  'Nimm dir eine Stunde Zeit für dich und deinen Stock – wir sehen uns auf der Bahn beim Training!'
];
function motivation(today) {
  const n = Number(today.replace(/-/g, '')) || 0;
  return MOTIVATION[n % MOTIVATION.length];
}
function competitions(status, sources, name) {
  const M = root.ECWMeineErgebnisse;
  const out = [];
  const cups = sources.cupTournaments && M && sources.standings
    ? M.cupEntries(sources.cupTournaments, name, sources.standings) : null;
  const cup = (key, kind, title) => {
    if (status?.[key] !== true) return;
    const entry = cups?.find(c => c.kind === kind);
    out.push({key, title, countable: !!cups, joined: !!entry});
  };
  cup('duoCup', 'duo', 'Duo Cup');
  cup('frauencup', 'frauen', 'Frauencup');
  if (status?.soloPyramide === true) {
    const p = sources.pyramid && M ? M.pyramidEntry(sources.pyramid, name) : null;
    out.push({key: 'soloPyramide', title: 'Solo Pyramide', countable: !!sources.pyramid, joined: !!p});
  }
  if (status?.montagsSolo === true) {
    // Das Montags-Solo-Turnier wird noch erstellt; die Teilnahme kann noch nicht ausgewertet werden.
    out.push({key: 'montagsSolo', title: 'Montags Solo Turnier', countable: false, joined: false});
  }
  if (status?.jahresmeisterschaft === true) {
    const j = sources.championship && M ? M.championshipEntry(sources.championship, name) : null;
    out.push({key: 'jahresmeisterschaft', title: 'Ziel-Jahresmeisterschaft', countable: !!sources.championship, joined: !!j});
  }
  return out;
}

// ---------- Kalender (.ics) ----------
function icsText(value) {
  return clean(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
function icsFold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 60) { out.push(rest.slice(0, 60)); rest = ' ' + rest.slice(60); }
  out.push(rest);
  return out.join('\r\n');
}
function icsUid(prefix, key) {
  let h = 0;
  for (const c of String(key)) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return prefix + '-' + String(key).replace(/[^A-Za-z0-9]/g, '').slice(0, 40) + '-' + (h >>> 0).toString(36) + '@ec-wegscheid.de';
}
const icsDate = (iso, time) => iso.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');
function addHours(iso, time, hours) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + hours * 60;
  const day = addDays(iso, Math.floor(total / 1440));
  const mins = total % 1440;
  return {date: day, time: String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0')};
}
function buildIcs(data, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // Höhere SEQUENCE bei jedem Export: Kalender übernehmen geänderte Zeiten, statt Doppel anzulegen.
  const sequence = Math.floor(now.getTime() / 60000) - 29000000;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EC Wegscheid//Mein Ueberblick//DE',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:EC Wegscheid'];
  const event = (uid, start, end, summary, location, description) => {
    lines.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + stamp, 'SEQUENCE:' + sequence);
    if (start.time) {
      lines.push('DTSTART:' + icsDate(start.date, start.time), 'DTEND:' + icsDate(end.date, end.time));
    } else {
      lines.push('DTSTART;VALUE=DATE:' + icsDate(start.date), 'DTEND;VALUE=DATE:' + icsDate(addDays(start.date, 1)));
    }
    lines.push('SUMMARY:' + icsText(summary));
    if (location) lines.push('LOCATION:' + icsText(location));
    if (description) lines.push('DESCRIPTION:' + icsText(description));
    lines.push('END:VEVENT');
  };
  for (const r of data.reservations || []) {
    const end = r.timeTo === '24:00' ? {date: addDays(r.date, 1), time: '00:00'} : {date: r.date, time: r.timeTo};
    event(icsUid('res', r.uidKey), {date: r.date, time: r.timeFrom}, end,
      r.mode + ' · ' + r.resource, 'EC Wegscheid · ' + r.resource,
      [r.mates.length ? 'Mit: ' + r.mates.join(', ') : '', r.rivals.length ? 'Gegen: ' + r.rivals.join(', ') : '',
        r.booker ? 'Reserviert von: ' + r.booker : ''].filter(Boolean).join(' · '));
  }
  for (const t of data.tournaments || []) {
    event(icsUid('turnier', t.id || t.date + t.name), {date: t.date, time: t.time},
      t.time ? addHours(t.date, t.time, 4) : null, t.name, t.location,
      t.mates.length ? 'Mit: ' + t.mates.join(', ') : '');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
function downloadIcs(text) {
  const blob = new Blob([text], {type: 'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ec-wegscheid-termine.ics';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- Anzeige ----------
function el(tag, text, parent, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null && text !== '') node.textContent = String(text);
  if (className) node.className = className;
  if (parent) parent.append(node);
  return node;
}
function modeClass(mode) {
  if (/frauen|damen/i.test(mode)) return 'ov-mode ov-mode-frauen';
  if (/solo/i.test(mode)) return 'ov-mode ov-mode-solo';
  return 'ov-mode';
}
function render(host, name, data, today = viennaToday()) {
  host.replaceChildren();
  el('p', 'Servus' + (name ? ' ' + firstName(name) : '') + '!', host, 'ov-hi');
  const calendarCount = (data.reservations?.length || 0) + (data.tournaments?.length || 0);
  if (calendarCount) {
    const button = el('button', 'Termine in privaten Kalender übertragen', host, 'ov-calendar');
    button.type = 'button';
    button.setAttribute('aria-label', 'Reservierungen und Turniere in den Kalender übernehmen');
    button.addEventListener('click', () => downloadIcs(buildIcs(data)));
  }
  let shown = 0;
  const label = (text, count) => {
    const line = el('div', null, host, 'ov-label');
    el('span', text, line);
    if (count) el('span', count, line);
  };

  const comps = data.competitions || [];
  if (comps.length) {
    label('LAUFENDE WETTBEWERBE');
    const chip = (parent, c) => el('span', c.title, parent, 'ov-chip ov-chip-' + c.key);
    const running = el('div', null, host, 'ov-chips');
    for (const c of comps) chip(running, c);
    const countable = comps.filter(c => c.countable);
    const joined = countable.filter(c => c.joined);
    if (joined.length) {
      const line = el('div', null, host, 'ov-chips ov-joined-line');
      el('span', 'Du bist dabei (' + joined.length + ' von ' + countable.length + '):', line, 'ov-joined-label');
      for (const c of joined) chip(line, c);
    } else if (countable.length) {
      el('div', motivation(today), host, 'ov-box ov-motivation');
    }
    shown++;
  }

  if (data.reservations?.length) {
    label('MEINE RESERVIERUNGEN (DIE NÄCHSTEN 14 TAGE)', data.reservations.length);
    for (const r of data.reservations) {
      const box = el('div', null, host, 'ov-box');
      const top = el('div', null, box, 'ov-title');
      el('span', shortDate(r.date, today) + ' · ' + r.timeFrom + '–' + r.timeTo + ' · ' + r.resource, top);
      el('span', r.mode, top, modeClass(r.mode));
      const parts = [r.bookedBySelf ? 'reserviert von dir' : r.booker ? 'reserviert von ' + r.booker : ''];
      if (r.mates.length) parts.push('mit ' + r.mates.join(', '));
      if (r.rivals.length) parts.push('gegen ' + r.rivals.join(', '));
      el('div', parts.filter(Boolean).join(' · '), box, 'ov-sub');
    }
    shown++;
  }

  if (data.challenge) {
    label('SOLO PYRAMIDE');
    const box = el('div', null, host, 'ov-box ov-warn');
    el('div', 'Offene Forderung gegen ' + data.challenge.other, box, 'ov-title');
    el('div', (data.challenge.challenging ? 'du forderst' : 'du wirst gefordert') + ' · ' + data.challenge.left, box, 'ov-sub');
    shown++;
  }

  if (data.tournaments?.length) {
    label('MEINE TURNIERE (DIE NÄCHSTEN 2 MONATE)', data.tournaments.length);
    const list = el('div', null, host, 'ov-list');
    for (const t of data.tournaments) {
      const box = el('div', null, list, 'ov-box');
      el('div', shortDate(t.date, today) + (t.time ? ' · ' + t.time : ''), box, 'ov-date');
      el('div', t.name, box, 'ov-title');
      el('div', [t.location, t.mates.length ? 'mit ' + t.mates.join(', ') : ''].filter(Boolean).join(' · '), box, 'ov-sub');
    }
    shown++;
  }

  if (!shown) el('p', 'Aktuell steht nichts an.', host, 'ov-sub');
  return shown;
}

root.ECWMeinUeberblick = {reservations, openChallenge, tournaments, competitions, buildIcs, render, viennaToday, addDays, firstName};
})(typeof window !== 'undefined' ? window : globalThis);
