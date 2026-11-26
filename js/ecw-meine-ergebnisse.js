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
    const erg = x.ergebnis;
    if (erg && Number(erg.platz) > 0) row.result = 'Platz ' + Number(erg.platz) + (Number(erg.von) > 0 ? ' von ' + Number(erg.von) : '');
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

// ---------- Montags Solo ----------
// Vorrunden-Platz, Anmeldung, Finale-Qualifikation oder Nachrücker-Vormerkung.
function montagsSoloEntries(state, name) {
  if (!state || typeof state !== 'object') return [];
  const dd = v => v ? deDate(String(v)) : 'offen';
  const title = clean(state.title) || 'Montags Solo';
  const labels = {v1: 'Vorrunde 1', v2: 'Vorrunde 2', v3: 'Vorrunde 3'};
  const out = [];
  const finale = state.finale || {};
  const finalDone = !!(finale.result && Array.isArray(finale.result.rows) && finale.result.rows.length);
  for (const key of ['v1', 'v2', 'v3']) {
    const round = state.rounds?.[key];
    if (!round) continue;
    const rows = Array.isArray(round.result?.rows) ? round.result.rows : [];
    const own = rows.find(r => sameName(r?.name, name));
    if (own) out.push({title: title + ' · ' + labels[key], detail: dd(round.date) + ' · ' + own.points + ':' + own.minus + ' Pkt.', place: own.rank + '. von ' + rows.length});
    else if ((round.players || []).some(p => sameName(p?.name, name))) out.push({title: title + ' · ' + labels[key], detail: 'Angemeldet für Montag, ' + dd(round.date), place: 'gemeldet'});
  }
  if (finalDone) {
    const rows = finale.result.rows, own = rows.find(r => sameName(r?.name, name));
    if (own) out.push({title: title + ' · Finale', detail: dd(finale.date) + ' · ' + own.points + ':' + own.minus + ' Pkt.', place: own.rank + '. von ' + rows.length});
    return out;
  }
  const slot = (finale.slots || []).find(s => sameName(s?.name, name));
  if (slot && slot.status !== 'abgesagt') out.push({title: title + ' · Finale', detail: 'Qualifiziert für das Finale am Montag, ' + dd(finale.date), place: 'Finale', highlight: true});
  else if (slot) out.push({title: title + ' · Finale', detail: 'Für das Finale abgesagt', place: '–'});
  else {
    const reserve = ['v1', 'v2', 'v3'].find(k => (state.rounds?.[k]?.reserves || []).some(n => sameName(n, name)));
    if (reserve) out.push({title: title + ' · Finale', detail: 'Als Nachrücker vorgemerkt (' + labels[reserve] + ') · Finale am ' + dd(finale.date), place: 'Nachrücker', highlight: true});
  }
  return out;
}

// ---------- Solo Pyramide ----------
function pyramidEntry(state, name) {
  const players = Array.isArray(state?.players) ? state.players : [];
  const index = players.findIndex(p => typeof p === 'string' && p !== 'FREI' && sameName(p, name));
  if (index < 0) return null;
  return {position: index + 1};
}

// Öffentliche Leseschnittstelle; liefert nur die Spielerreihenfolge (keine Passwörter).
async function loadPyramidPublic(signal) {
  const url = 'https://firestore.googleapis.com/v1/projects/ec-wegscheid-verwaltung-neu/databases/(default)/documents/soloPyramide/state?mask.fieldPaths=players';
  const response = await fetch(url, {cache: 'no-store', signal});
  if (!response.ok) throw new Error('Firebase HTTP ' + response.status);
  const payload = await response.json();
  const values = payload.fields?.players?.arrayValue?.values || [];
  return {players: values.map(v => v.stringValue ?? '')};
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
function rankingBox(container, rl, title, limit) {
    const box = el('details', null, container, 'my-participations my-row-highlight');
    const summary = el('summary', null, box);
    const text = el('div', null, summary, 'my-row-text');
    el('strong', title + (rl.season ? ' ' + rl.season : ''), text);
    el('span', rl.total + ' Punkte · dabei bei ' + rl.joined.length + ' von ' + rl.categories.length + ' Wettbewerben · Antippen', text, 'my-row-detail');
    el('span', 'Platz ' + rl.rank, summary, 'my-row-place');
    const body = el('div', null, box, 'my-rank-body');

    el('div', 'Teilnahme und Punkte je Wettbewerb', body, 'my-rank-head');
    const cats = el('ul', null, body, 'my-list my-rank-list my-rank-cats');
    for (const c of rl.categories) {
      const parts = rl.parts.filter(p => p.category === c);
      const item = el('li', null, cats, parts.length ? '' : 'my-rank-miss');
      const left = el('span', null, item);
      el('b', (parts.length ? '✓ ' : '✗ ') + c, left);
      for (const p of parts) el('small', p.type === 'pyramidGames' ? p.label + ': ' + p.won + ' Siege / ' + p.lost + ' Niederlagen (+' + p.points + ')'
        : p.label + ': Platz ' + p.place + ' von ' + p.of + ' (+' + p.points + ')', left);
      if (!parts.length) el('small', 'nicht dabei', left);
      el('strong', parts.length ? String(parts.reduce((n, p) => n + (Number(p.points) || 0), 0)) : '–', item);
    }

    el('div', 'Deine Umgebung in der Rangliste', body, 'my-rank-head');
    rankTable(body, rl.near, rl.ownIndex - rl.nearStart);

    const top = rl.rows.slice(0, limit), label = 'Die besten ' + top.length + ' anzeigen';
    const all = el('div', null, body, 'my-rank-all');
    const btn = el('button', label, all, 'my-rank-btn');
    btn.type = 'button';
    let table = null;
    btn.addEventListener('click', event => {
      event.preventDefault();
      if (table) { table.remove(); table = null; btn.textContent = label; return; }
      table = rankTable(all, top, rl.ownIndex < limit ? rl.ownIndex : -1); btn.textContent = 'Liste ausblenden';
    });
}
// Tabelle Platz · Name · Punkte; eigene Zeile hervorgehoben
function rankTable(parent, rows, ownAt) {
  const list = el('ol', null, parent, 'my-list my-rank-table');
  rows.forEach((r, i) => {
    const item = el('li', null, list, i === ownAt ? 'my-rank-own' : '');
    el('span', r.rank + '.', item, 'my-rank-no');
    el('span', r.name + (r.all ? ' ★' : ''), item);
    el('strong', String(r.total), item);
  });
  return list;
}
const placeText = (place, of) => place > 0 ? place + '. von ' + of : '–';

function render(container, name, data) {
  container.replaceChildren();
  let shown = 0;

  // EC Wegscheid Rangliste (und Frauenwertung): eigener Platz; aufgeklappt Teilnahme, Punkte, Nachbarn, Bestenliste.
  if (data.ranking) { rankingBox(container, data.ranking, 'EC Wegscheid Rangliste', 20); shown++; }
  if (data.rankingWomen) { rankingBox(container, data.rankingWomen, 'EC Wegscheid Frauenwertung', 10); shown++; }

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
      el('span', x.name + (x.location ? ' · ' + x.location : '') + (x.result ? ' · 🏆 ' + x.result : ''), item);
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

  for (const x of data.montagsSolo || []) {
    const line = row(container, x.title, x.detail, x.place);
    if (x.highlight) line.classList.add('my-row-highlight');
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
function rankingEntry(doc, name, women) {
  if (doc?.visible !== true) return null;
  const rows = Array.isArray(women ? doc?.rowsFrauen : doc?.rows) ? (women ? doc.rowsFrauen : doc.rows) : [];
  const at = rows.findIndex(r => sameName(r.name, name));
  if (at < 0) return null;
  const own = rows[at], parts = Array.isArray(own.parts) ? own.parts : [];
  const docCats = women ? doc.categoriesFrauen : doc.categories;
  const categories = Array.isArray(docCats) && docCats.length ? docCats.map(clean)
    : [...new Set(rows.flatMap(r => (r.parts || []).map(p => clean(p.category))))].filter(Boolean);
  const joined = categories.filter(c => parts.some(p => clean(p.category) === c));
  const nearStart = Math.max(0, at - 5), near = rows.slice(nearStart, at + 6);
  const slim = r => ({rank: r.rank, name: clean(r.name), total: r.total, all: !!r.all});
  return {season: clean(doc.season), rank: own.rank, of: rows.length, total: own.total, parts, categories, joined,
    rows: rows.map(slim), near: near.map(slim), nearStart, ownIndex: at};
}

async function load({name, signal, loadPlanner, loadCups, loadChampionship, loadPyramid, loadMontagsSolo, loadRanking, standings}) {
  const errors = [];
  const attempt = async (label, task) => {
    try { return await task(); } catch (error) {
      if (signal?.aborted) throw error;
      errors.push(label + ' konnte nicht geladen werden' +
        (error?.code === 'permission-denied' ? ' (für dieses Konto nicht freigegeben).' : '.'));
      return null;
    }
  };
  const [events, tournaments, jmState, soloState, msState, rankDoc] = await Promise.all([
    attempt('Der Terminplaner', loadPlanner),
    attempt('Die Cup-Ergebnisse', loadCups),
    attempt('Die Ziel-Jahresmeisterschaft', loadChampionship),
    loadPyramid ? attempt('Die Solo Pyramide', loadPyramid) : null,
    loadMontagsSolo ? attempt('Das Montags Solo', loadMontagsSolo) : null,
    loadRanking ? attempt('Die Vereinsrangliste', loadRanking) : null
  ]);
  return {
    planner: events ? participations(events, name) : [],
    cups: tournaments ? cupEntries(tournaments, name, standings) : [],
    championship: jmState ? championshipEntry(jmState, name) : null,
    pyramid: soloState ? pyramidEntry(soloState, name) : null,
    montagsSolo: msState ? montagsSoloEntries(msState, name) : [],
    ranking: rankDoc ? rankingEntry(rankDoc, name) : null,
    rankingWomen: rankDoc ? rankingEntry(rankDoc, name, true) : null,
    errors
  };
}

root.ECWMeineErgebnisse = {sameName, teamHasPlayer, participations, cupEntries, championshipEntry, pyramidEntry, montagsSoloEntries, rankingEntry, loadPyramidPublic, render, load, isoDate};
})(typeof window !== 'undefined' ? window : globalThis);
