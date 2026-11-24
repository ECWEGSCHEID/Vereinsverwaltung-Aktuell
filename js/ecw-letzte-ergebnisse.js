// „Letzte Ergebnisse“ für die Smartphone-Anbindung (Ergebnisse Turniere Intern).
// Sammelt eingegebene Ergebnisse aus Duo Cup, Frauencup und Ziel-Jahresmeisterschaft
// und zeigt die neuesten zuerst, jeweils mit Eingabedatum.
(function () {
  'use strict';

  // Je Wettbewerb höchstens so viele Einträge, damit keiner von den anderen verdrängt wird.
  const LIMIT_PER_SOURCE = 10;

  // „24.11.2026, 20:13:05“ (toLocaleString de-DE) oder ISO-Zeit
  function parseTime(entry) {
    if (entry?.iso) {
      const d = new Date(entry.iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const m = String(entry?.time || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function cupKind(name) {
    if (/frauen|damen/i.test(name || '')) return 'frauencup';
    if (/duo/i.test(name || '')) return 'duoCup';
    return '';
  }

  // Alte Einträge haben nur Text: „Ergebnis eingetragen: A vs B (4:2 Satzpunkte, 30:12 Stöcke)“
  function parseCupText(text) {
    const m = String(text || '').match(/^(Ergebnis eingetragen|Spielkorrektur durchgeführt):\s*(.+?)\s+vs\s+(.+?)\s*\((\d+):(\d+) Satzpunkte,\s*(\d+):(\d+) Stöcke\)/);
    if (!m) return null;
    return {
      kind: m[1].startsWith('Spielkorrektur') ? 'correction' : 'result',
      nameA: m[2], nameB: m[3],
      pointsA: Number(m[4]), pointsB: Number(m[5]), stocksA: Number(m[6]), stocksB: Number(m[7]),
    };
  }

  function cupEntries(tournaments, active) {
    const rows = [];
    for (const tournament of Object.values(tournaments || {})) {
      if (!tournament || typeof tournament !== 'object') continue;
      const key = cupKind(tournament.name);
      if (!key) continue;
      const label = key === 'frauencup' ? 'Frauencup' : 'Duo Cup';
      for (const entry of Array.isArray(tournament.history) ? tournament.history : []) {
        const data = entry?.kind === 'result' || entry?.kind === 'correction'
          ? entry
          : parseCupText(entry?.text);
        if (!data) continue;
        const date = parseTime(entry);
        if (!date) continue;
        rows.push({
          date, dated: true, source: key, label: label + (data.group ? ' · ' + data.group : ''),
          text: `${data.nameA} – ${data.nameB}`,
          score: `${data.pointsA}:${data.pointsB}`,
          detail: `Stöcke ${data.stocksA}:${data.stocksB}` + (data.kind === 'correction' ? ' · korrigiert' : ''),
        });
      }
    }
    return rows;
  }

  function championshipRounds(seasonYear) {
    const y = Number(seasonYear) || new Date().getFullYear();
    return [
      {l: 'Nov–Dez ' + (y - 1), s: (y - 1) + '-11-01'},
      {l: 'Jan–Feb ' + y, s: y + '-01-01'},
      {l: 'Mär–Apr ' + y, s: y + '-03-01'},
      {l: 'Mai–Jun ' + y, s: y + '-05-01'},
      {l: 'Jul–Aug ' + y, s: y + '-07-01'},
      {l: 'Sep–Okt ' + y, s: y + '-09-01'},
    ];
  }

  function scores(round) {
    const list = Array.isArray(round) ? round : round?.__ecwNestedArrayV1;
    return Array.isArray(list) && list.every(Number.isFinite) ? list : null;
  }

  function championshipEntries(state, active) {
    if (!state) return [];
    const rounds = championshipRounds(state.seasonYear);
    const rows = [];
    for (const player of Array.isArray(state.players) ? state.players : []) {
      rounds.forEach((round, j) => {
        const list = scores(player?.r?.[j]);
        if (!list) return;
        const stamp = player?.t?.[j] ? new Date(player.t[j]) : null;
        const dated = !!stamp && !Number.isNaN(stamp.getTime());
        rows.push({
          date: dated ? stamp : new Date(round.s + 'T00:00:00'),
          dated, source: 'jahresmeisterschaft', label: 'Jahresmeisterschaft · ' + round.l,
          text: player.n || '—',
          score: String(list.reduce((a, b) => a + b, 0)),
          detail: list.join(' + '),
        });
      });
    }
    return rows;
  }

  function collect({tournaments, championship, active = {}}) {
    const all = [...cupEntries(tournaments, active), ...championshipEntries(championship, active)];
    // Neueste zuerst: datierte Einträge nach Eingabezeit, ältere Jahresmeisterschafts-Ergebnisse
    // ohne Zeitstempel nach ihrem Durchgang (jüngster Durchgang zuerst).
    const newestFirst = (a, b) => Number(b.dated) - Number(a.dated) || b.date - a.date;
    const rows = [];
    for (const source of ['duoCup', 'frauencup', 'jahresmeisterschaft']) {
      rows.push(...all.filter(row => row.source === source).sort(newestFirst).slice(0, LIMIT_PER_SOURCE));
    }
    return rows.sort((a, b) => b.date - a.date);
  }

  function formatDate(row) {
    if (!row.dated) return 'Datum nicht gespeichert';
    return row.date.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})
      + ' · ' + row.date.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'}) + ' Uhr';
  }

  function render(container, rows) {
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Noch keine Ergebnisse eingegeben.';
      container.append(empty);
      return;
    }
    const list = document.createElement('ol');
    list.className = 'latest-list';
    for (const row of rows) {
      const item = document.createElement('li');
      item.className = 'latest-' + row.source;
      const top = document.createElement('div');
      top.className = 'latest-top';
      const label = document.createElement('span');
      label.className = 'latest-label';
      label.textContent = row.label;
      const date = document.createElement('span');
      date.className = 'latest-date';
      date.textContent = formatDate(row);
      top.append(label, date);
      const main = document.createElement('div');
      main.className = 'latest-main';
      const text = document.createElement('span');
      text.textContent = row.text;
      const score = document.createElement('strong');
      score.textContent = row.score;
      main.append(text, score);
      const detail = document.createElement('div');
      detail.className = 'latest-detail';
      detail.textContent = row.detail;
      item.append(top, main, detail);
      list.append(item);
    }
    container.append(list);
  }

  window.ECWLetzteErgebnisse = {collect, render, parseTime, parseCupText};
})();
