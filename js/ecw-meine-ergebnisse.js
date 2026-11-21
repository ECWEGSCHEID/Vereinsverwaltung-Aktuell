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
    const players = (Array.isArray(x.players) ? x.players : []).map(p => typeof p === 'string' ? p : p?.name);
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

// ---------- Anzeige ----------
function el(tag, text, parent, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  if (parent) parent.append(node);
  return node;
}
function card(parent, heading, lines, badge) {
  const box = el('article', null, parent, 'planner-event my-result');
  if (badge) el('time', badge, box);
  el('h2', heading, box);
  const list = el('dl', null, box);
  for (const [label, value] of lines) {
    const row = el('div', null, list);
    el('dt', label, row);
    el('dd', value === '' || value === null || value === undefined ? '–' : value, row);
  }
  return box;
}
function placeText(place, of) {
  return place > 0 ? place + '. von ' + of : '–';
}

function render(container, name, data) {
  container.replaceChildren();
  let shown = 0;
  const section = title => {
    const s = el('section', null, container, 'my-results-section');
    el('h2', title, s, 'my-results-heading');
    return s;
  };

  if (data.planner?.length) {
    const past = data.planner.filter(x => !x.upcoming), next = data.planner.filter(x => x.upcoming);
    const year = String(new Date().getFullYear());
    const s = section('Turnierteilnahmen');
    el('p', past.filter(x => x.date.startsWith(year)).length + ' Teilnahmen ' + year + ' · ' + past.length + ' insgesamt', s, 'hint');
    for (const x of next) card(s, x.name, [['Ort', x.location], ['Art', x.type]], deDate(x.date) + ' · angemeldet');
    for (const x of past) card(s, x.name, [['Ort', x.location], ['Art', x.type]], deDate(x.date));
    shown++;
  }

  const cupTitles = {duo: 'Duo Cup', frauen: 'Frauencup', weitere: 'Weitere Cups'};
  for (const kind of ['duo', 'frauen', 'weitere']) {
    const rows = (data.cups || []).filter(x => x.kind === kind);
    if (!rows.length) continue;
    const s = section(cupTitles[kind]);
    for (const x of rows) {
      const status = x.dq ? ' (DSQ)' : x.dnf ? ' (DNF)' : '';
      card(s, x.tournament, [['Platz', placeText(x.place, x.of) + status], ['Mannschaft', x.team],
        ['Gruppe', x.group], ['Punkte', x.points], ['Spiele', x.played], ['Stöcke', x.stocks]]);
    }
    shown++;
  }

  const jm = data.championship;
  if (jm) {
    const s = section('Ziel-Jahresmeisterschaft');
    const done = jm.rounds.filter(v => v !== null).length;
    card(s, jm.title + (jm.season ? ' ' + (jm.season - 1) + '/' + jm.season : ''), [
      ['Platz', placeText(jm.rank, jm.of)], ['Endergebnis', jm.result],
      ['Gesamt', jm.total], ['Streichresultat', jm.drop],
      ['Durchgänge', jm.rounds.map(v => v ?? '–').join(' · ')], ['Abgegeben', done + ' von 6']]);
    shown++;
  }

  for (const message of data.errors || []) el('p', message, container, 'hint');
  if (!shown) el('p', 'Für ' + name + ' sind noch keine Ergebnisse oder Turnierteilnahmen eingetragen.', container, 'hint');
  return shown;
}

/* Lädt alle Quellen parallel. Eine fehlende Quelle blendet nur ihren Abschnitt aus. */
async function load({name, signal, loadPlanner, loadCups, loadChampionship, standings}) {
  const errors = [];
  const attempt = async (label, task) => {
    try { return await task(); } catch (error) {
      if (signal?.aborted) throw error;
      errors.push(label + ' konnte nicht geladen werden' +
        (error?.code === 'permission-denied' ? ' (für dieses Konto nicht freigegeben).' : '.'));
      return null;
    }
  };
  const [events, tournaments, jmState] = await Promise.all([
    attempt('Der Terminplaner', loadPlanner),
    attempt('Die Cup-Ergebnisse', loadCups),
    attempt('Die Ziel-Jahresmeisterschaft', loadChampionship)
  ]);
  return {
    planner: events ? participations(events, name) : [],
    cups: tournaments ? cupEntries(tournaments, name, standings) : [],
    championship: jmState ? championshipEntry(jmState, name) : null,
    errors
  };
}

root.ECWMeineErgebnisse = {sameName, teamHasPlayer, participations, cupEntries, championshipEntry, render, load, isoDate};
})(typeof window !== 'undefined' ? window : globalThis);
