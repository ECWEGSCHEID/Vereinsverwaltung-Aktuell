(function () {
'use strict';
const endpoint='https://firestore.googleapis.com/v1/projects/ec-wegscheid-verwaltung-neu/databases/(default)/documents/turnierauswertung/cup';
function val(f){if(!f)return null;if('stringValue'in f)return f.stringValue;if('integerValue'in f)return Number(f.integerValue);if('doubleValue'in f)return Number(f.doubleValue);if('booleanValue'in f)return f.booleanValue;if('nullValue'in f)return null;if(f.arrayValue)return(f.arrayValue.values||[]).map(val);if(f.mapValue)return Object.fromEntries(Object.entries(f.mapValue.fields||{}).map(([k,v])=>[k,val(v)]));return null;}
const node=(tag,txt,parent)=>{let e=document.createElement(tag);e.textContent=String(txt);parent.append(e);return e};
const N=x=>Number(x)||0;
function standings(g){const stats=new Map();for(const team of (g.teams||[])){stats.set(String(team.id),{id:String(team.id),name:team.name||'—',played:0,points:0,sets:0,for:0,against:0,dq:!!team.dq,dnf:!!team.dnf});}
 for(const m of Object.values(g.matches||{})){let a=stats.get(String(m.teamA)),b=stats.get(String(m.teamB));if(!a||!b)continue;if(!m.completed && !(a.dq||a.dnf||b.dq||b.dnf))continue;
 if(!a.dq&&!a.dnf)a.played++;if(!b.dq&&!b.dnf)b.played++;
 if(!(a.dq||a.dnf||b.dq||b.dnf)){a.for+=N(m.stocksA);a.against+=N(m.stocksB);b.for+=N(m.stocksB);b.against+=N(m.stocksA);}
 let pa=0,pb=0;if(m.games?.length){for(const gm of m.games){if(N(gm.sA)>N(gm.sB))pa+=2;else if(N(gm.sB)>N(gm.sA))pb+=2;else if(N(gm.sA)||N(gm.sB)){pa++;pb++;}}}else{pa=N(m.pointsA);pb=N(m.pointsB);}
 if(a.dq||a.dnf){if(!(b.dq||b.dnf)){b.points+=3;b.sets+=2;}}else if(b.dq||b.dnf){a.points+=3;a.sets+=2;}else if(pa>pb)a.points+=3;else if(pb>pa)b.points+=3;else{a.points++;b.points++;}
 if(!(a.dq||a.dnf||b.dq||b.dnf)){a.sets+=pa;b.sets+=pb;}
 }
 const arr=[...stats.values()];for(let row of arr){if(row.dq||row.dnf){row.played=0;row.points=0;row.sets=0;row.for=0;row.against=0;}row.quota=row.against===0?(row.for?999:1):row.for/row.against;}
 return arr.sort((a,b)=>Number(a.dq)-Number(b.dq)||Number(a.dnf)-Number(b.dnf)||b.points-a.points||b.sets-a.sets||b.quota-a.quota);
}

function createTeamResultsDialog(holder) {
  const dialog = node('dialog', '', holder);
  dialog.className = 'cup-team-results';
  dialog.setAttribute('aria-labelledby', 'cup-team-results-title');
  const title = node('h2', '', dialog);
  title.id = 'cup-team-results-title';
  const list = node('ul', '', dialog);
  const close = node('button', 'Schließen', dialog);
  close.type = 'button';
  close.autofocus = true;
  close.onclick = () => dialog.close();

  return function showTeamResults(group, team) {
    title.textContent = 'Spiele von ' + team.name + (team.dq ? ' · DSQ' : team.dnf ? ' · DNF' : '');
    list.replaceChildren();
    const teams = new Map((group.teams || []).map(entry => [String(entry.id), entry]));
    for (const match of Object.values(group.matches || {})) {
      const isA = String(match.teamA) === team.id;
      if (!isA && String(match.teamB) !== team.id) continue;
      const opponent = teams.get(String(isA ? match.teamB : match.teamA));
      const opponentStatus = opponent?.dq ? ' · DSQ' : opponent?.dnf ? ' · DNF' : '';
      const leg = match.leg ? '[' + match.leg + '] ' : '';
      const item = node('li', '', list);
      node('strong', leg + 'gegen ' + (opponent?.name || (isA ? match.nameB : match.nameA) || 'Unbekannt') + opponentStatus, item);
      if (!match.completed) {
        const status = team.dq || opponent?.dq ? 'DSQ' : team.dnf || opponent?.dnf ? 'DNF' : 'Offen';
        node('span', status, item);
        continue;
      }
      const ownPoints = N(isA ? match.pointsA : match.pointsB);
      const opposingPoints = N(isA ? match.pointsB : match.pointsA);
      const ownStocks = N(isA ? match.stocksA : match.stocksB);
      const opposingStocks = N(isA ? match.stocksB : match.stocksA);
      const score = node('span', ownPoints + ':' + opposingPoints + ' Satzpkt. (' + ownStocks + ':' + opposingStocks + ' Stöcke)', item);
      score.dataset.outcome = ownPoints > opposingPoints ? 'win' : ownPoints < opposingPoints ? 'loss' : 'draw';
    }
    if (!list.children.length) node('li', 'Für diese Mannschaft sind keine Spiele vorhanden.', list);
    dialog.showModal();
  };
}

async function loadCupTournaments(signal) {
  const response = await fetch(endpoint, {cache:'no-store', signal});
  if (!response.ok) throw new Error('Firebase HTTP ' + response.status);
  const payload = await response.json();
  return val(payload.fields?.tournaments) || {};
}

window.ecwLoadCupTournaments = loadCupTournaments;
window.ecwCupStandings = standings;

window.ecwRenderCupResults = async function ({content, status, mode = 'duo', signal, controlsHost = content, preloaded}) {
function render(tournaments){content.replaceChildren();const entries=Object.entries(tournaments).filter(([,v])=>v&&typeof v==='object');
const filtered=entries.filter(([,t])=>new RegExp(mode==='frauen'?'frauen|damen':'duo','i').test(t.name||''));
const candidates=filtered.length?filtered:entries;
if(!candidates.length){status.textContent='Keine gespeicherten Cup-Ergebnisse vorhanden.';return;}
const controls=node('div','',controlsHost);controls.className='result-selector';const select=node('select','',controls);select.setAttribute('aria-label','Turnier wählen');select.replaceChildren();for(const [id,t] of candidates){const option=document.createElement('option');option.value=id;option.textContent=t.name||id;select.append(option);}
const holder=node('div','',content);
function display(){holder.replaceChildren();const selected=tournaments[select.value];if(!selected)return;
 const showTeamResults = createTeamResultsDialog(holder);
 for (const [gId, group] of Object.entries(selected.groups || {})) {
   const box = node('section', '', holder);
   node('h2', group.name || gId, box);
   const table = node('table', '', box);
   const header = node('tr', '', node('thead', '', table));
   for (const label of ['Pl.', 'Mannschaft', 'Sp.', 'Pkt.', 'Stock', 'Quote', 'Satzpkt.']) node('th', label, header);
   const body = node('tbody', '', table);
   for (const [i, team] of standings(group).entries()) {
     const row = node('tr', '', body);
     node('td', i + 1, row);
     const name = team.name + (team.dq ? ' (DSQ)' : team.dnf ? ' (DNF)' : '');
     const trigger = node('button', name, node('td', '', row));
     trigger.className = 'cup-team-results-trigger';
     trigger.type = 'button';
     trigger.setAttribute('aria-haspopup', 'dialog');
     trigger.onclick = () => showTeamResults(group, team);
     for (const value of [team.played, team.points, team.for + ':' + team.against, team.quota.toFixed(3), team.sets]) node('td', value, row);
   }
 }
 if(!Object.keys(selected.groups||{}).length)node('p','Für dieses Turnier sind keine Gruppentabellen gespeichert.',holder);
}select.onchange=display;display();status.textContent=filtered.length?'Veröffentlichte '+(mode==='frauen'?'Frauen-':'Duo-')+'Cup-Ergebnisse':'Passender Cup nicht eindeutig gefunden. Bitte Turnier auswählen.';
}
async function load(){if(mode==='jahresmeisterschaft'){status.textContent='Ziel-Jahresmeisterschaft: Datenquelle dieser Tabelle ist noch nicht für die mobile öffentliche Ansicht verbunden.';return;}
try {
  const prefetched = preloaded ? await preloaded : null;
  if (signal?.aborted) return;
  const tournaments = prefetched ?? await loadCupTournaments(signal);
  if (!signal?.aborted) render(tournaments);
} catch (error) {
  if (!signal?.aborted) status.textContent = 'Ergebnisdaten konnten nicht geladen werden: ' + error.message;
}}
await load();
};
})();
