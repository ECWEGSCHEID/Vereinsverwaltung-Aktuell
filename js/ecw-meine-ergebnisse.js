/* EC Wegscheid – "Meine Ergebnisse" im Smartphone-Mitgliederbereich.
   Zeigt nur Wettbewerbe, an denen das angemeldete Mitglied teilgenommen hat:
   Turnierteilnahmen (Terminplaner), Duo Cup, Frauencup, weitere Cups und die
   Ziel-Jahresmeisterschaft. Liest nur – schreibt nichts. */
(function (root) {
'use strict';

// ---------- Namen vergleichen ----------
const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const tokens = value => clean(value).toLocaleLowerCase('de-DE')
  .replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);
// Gleiche Wörter in beliebiger Reihenfolge ("Huber Max" = "Max Huber").
function sameName(a, b) {
  const x = tokens(a), y = tokens(b);
  if (!x.length || x.length !== y.length) return false;
  return [...x].sort().join(' ') === [...y].sort().join(' ');
}
// Mannschaftsnamen aus der Auslosung: "Max Huber und Eva Maier", "A, B", "A / B" …
function teamHasPlayer(teamName, name) {
  const parts = clean(teamName).split(/\s+(?:und|&|\+|-|–)\s+|\s*[,/;]\s*/i);
  if (parts.some(part => sameName(part, name))) return true;
  const own = tokens(name);
  if (own.length < 2) return false;
  const words = new Set(tokens(teamName));
  return own.every(word => words.has(word));
}

// ---------- Datum ----------
function isoDate(value) {
  const s = clean(value);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/), y, mo, d;
  if (m) [, y, mo, d] = m;
  else {
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (!m) return '';
    [, d, mo, y] = m;
  }
  const dt = new Date(Date.UTC(+y, +mo - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +mo - 1 || dt.getUTCDate() !== +d) return '';
  return y.padStart(4, '0') + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
const deDate = iso => iso.split('-').reverse().join('.');
function todayVienna(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Vienna',
    year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now).map(x => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day;
}

// ---------- Turnierteilnahmen aus dem Terminplaner ----------
function cancelled(x) {
  return x.cancelled === true || x.canceled === true || x.deleted === true || !!x.cancelledAt ||
    ['abgesagt', 'storniert', 'cancelled', 'canceled', 'deleted', 'entfallen'].includes(clean(x.status).toLowerCase()) ||
    /\b(abgesagt|storniert|entfällt|entfallen)\b/i.test(clean(x.name));
}
function participations(events, name, today = todayVienna()) {
  const seen = new Set(), rows = [];
  for (const x of Array.isArray(events) ? events : []) {
    if (!x || typeof x !== 'object' || cancelled(x)) continue;
    const type = clean(x.effectiveType || x.type).toLowerCase();
    if (!['turnier', 'meisterschaft'].includes(type)) continue;
    // Nur die vier Spielerplätze zählen – wer den Termin nur gemeldet hat ("Gemeldet von"), war nicht dabei.
    const players = (Array.isArray(x.players) ? x.players : []).slice(0, 4).map(p => typeof p === 'string' ? p : p?.name);
    if (!players.some(p => sameName(p, name))) continue;
    const date = isoDate(x.date);
    if (!date) continue;
    const row = {date, name: clean(x.name) || 'Ohne Bezeichnung', location: clean(x.location),
      type: type === 'turnier' ? 'Turnier' : 'Meisterschaft', upcoming: date >= today};
    const key = [row.date, row.name, row.location].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'de'));
}

// ---------- Cups ----------
function cupKind(tournamentName) {
  if (/frauen|damen/i.test(tournamentName || '')) return 'frauen';
  if (/duo/i.test(tournamentName || '')) return 'duo';
  return 'weitere';
}
function cupEntries(tournaments, name, standings) {
  const rows = [];
  for (const [id, t] of Object.entries(tournaments || {})) {
    if (!t || typeof t !== 'object') continue;
    for (const [groupId, group] of Object.entries(t.groups || {})) {
      const team = (group?.teams || []).find(entry => teamHasPlayer(entry?.name, name));
      if (!team) continue;
      const table = standings(group);
      const index = table.findIndex(row => row.id === String(team.id));
      const own = table[index];
      rows.push({id, kind: cupKind(t.name), tournament: clean(t.name) || 'Cup', group: clean(group.name) || groupId,
        team: clean(team.name), place: index + 1, of: table.length, points: own?.points ?? 0,
        played: own?.played ?? 0, sets: own?.sets ?? 0, stocks: own ? own.for + ':' + own.against : '–',
        dq: !!own?.dq, dnf: !!own?.dnf});
    }
  }
  return rows;
}

// ---------- Ziel-Jahresmeisterschaft ----------
// Gleiche Wertung wie die Tabelle: Summe aller 6 Durchgänge minus schwächster Durchgang.
function championshipEntry(state, name) {
  const players = Array.isArray(state?.players) ? state.players : [];
  const rows = players.map(p => {
    const rounds = Array.from({length: 6}, (_, i) => {
      const round = p?.r?.[i];
      if (!round) return null;
      const scores = Array.isArray(round) ? round : round.__ecwNestedArrayV1;
      return Array.isArray(scores) && scores.every(Number.isFinite) ? scores.reduce((a, b) => a + b, 0) : null;
    });
    const values = rounds.map(v => v ?? 0);
    const total = values.reduce((a, b) => a + b, 0), drop = Math.min(...values);
    return {name: clean(p?.n), rounds, total, drop, result: total - drop};
  }).sort((a, b) => b.result - a.result);
  let rank = 0, previous = null;
  rows.forEach((row, i) => { if (row.result !== previous) rank = i + 1; row.rank = rank; previous = row.result; });
  const own = rows.find(row => sameName(row.name, name));
  return own ? {...own, of: rows.length, title: clean(state.title) || 'Ziel-Jahresmeisterschaft',
    season: Number(state.seasonYear) || null, archived: !!state.archived} : null;
}

// ---------- Solo Pyramide ----------
function pyramidEntry(state, name) {
  const players = Array.isArray(state?.players) ? state.players : [];
  const index = players.findIndex(p => typeof p === 'string' && p !== 'FREI' && sameName(p, name));
  if (index < 0) return null;
  return {position: index + 1};
}

// ---------- Anzeige (kompakt) ----------
function el(tag, text, parent, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  if (parent) parent.append(node);
  return node;
}
// Eine Zeile: links Wettbewerb und Details, rechts der Platz.
function row(parent, title, detail, place) {
  const line = el('div', null, parent, 'my-row');
  const text = el('div', null, line, 'my-row-text');
  el('strong', title, text);
  if (detail) el('span', detail, text, 'my-row-detail');
  el('span', place, line, 'my-row-place');
  return line;
}
const placeText = (place, of) => place > 0 ? place + '. von ' + of : '–';

function render(container, name, data) {
  container.replaceChildren();
  let shown = 0;

  // Nur bereits gespielte Turniere des laufenden Jahres; künftige Anmeldungen bleiben weg.
  const year = String(new Date().getFullYear());
  const played = (data.planner || []).filter(x => !x.upcoming && x.date.startsWith(year));
  if (played.length) {
    const box = el('details', null, container, 'my-participations');
    const summary = el('summary', null, box);
    const text = el('div', null, summary, 'my-row-text');
    el('strong', 'Turnierteilnahmen ' + year, text);
    el('span', 'Antippen für die einzelnen Turniere', text, 'my-row-detail');
    el('span', played.length, summary, 'my-row-place');
    const list = el('ul', null, box, 'my-list');
    for (const x of played) {
      const item = el('li', null, list);
      el('time', deDate(x.date), item);
      el('span', x.name + (x.location ? ' · ' + x.location : ''), item);
    }
    shown++;
  }

  const cupTitles = {duo: 'Duo Cup', frauen: 'Frauencup', weitere: 'Cup'};
  for (const kind of ['duo', 'frauen', 'weitere']) {
    for (const x of (data.cups || []).filter(c => c.kind === kind)) {
      const status = x.dq ? ' · DSQ' : x.dnf ? ' · DNF' : '';
      const title = kind === 'weitere' || !new RegExp(cupTitles[kind].replace(' ', '\\s*'), 'i').test(x.tournament)
        ? cupTitles[kind] + ': ' + x.tournament : x.tournament;
      row(container, title, x.group + ' · ' + x.points + ' Pkt. · ' + x.stocks + ' Stöcke' + status, placeText(x.place, x.of));
      shown++;
    }
  }

  const jm = data.championship;
  if (jm) {
    const done = jm.rounds.filter(v => v !== null).length;
    row(container, 'Ziel-Jahresmeisterschaft', jm.result + ' Pkt. · Streich ' + jm.drop + ' · ' + done + '/6 abgegeben',
      placeText(jm.rank, jm.of));
    shown++;
  }

  const solo = data.pyramid;
  if (solo) {
    row(container, 'Solo Pyramide', '', 'Platz ' + solo.position);
    shown++;
  }

  for (const message of data.errors || []) el('p', message, container, 'hint');
  if (!shown) el('p', 'Für ' + name + ' sind noch keine Ergebnisse oder Turnierteilnahmen eingetragen.', container, 'hint');
  return shown;
}

/* Lädt alle Quellen parallel. Eine fehlende Quelle blendet nur ihren Abschnitt aus. */
async function load({name, signal, loadPlanner, loadCups, loadChampionship, loadPyramid, standings}) {
  const errors = [];
  const attempt = async (label, task) => {
    try { return await task(); } catch (error) {
      if (signal?.aborted) throw error;
      errors.push(label + ' konnte nicht geladen werden' +
        (error?.code === 'permission-denied' ? ' (für dieses Konto nicht freigegeben).' : '.'));
      return null;
    }
  };
  const [events, tournaments, jmState, soloState] = await Promise.all([
    attempt('Der Terminplaner', loadPlanner),
    attempt('Die Cup-Ergebnisse', loadCups),
    attempt('Die Ziel-Jahresmeisterschaft', loadChampionship),
    loadPyramid ? attempt('Die Solo Pyramide', loadPyramid) : null
  ]);
  return {
    planner: events ? participations(events, name) : [],
    cups: tournaments ? cupEntries(tournaments, name, standings) : [],
    championship: jmState ? championshipEntry(jmState, name) : null,
    pyramid: soloState ? pyramidEntry(soloState, name) : null,
    errors
  };
}

root.ECWMeineErgebnisse = {sameName, teamHasPlayer, participations, cupEntries, championshipEntry, pyramidEntry, render, load, isoDate};
})(typeof window !== 'undefined' ? window : globalThis);
