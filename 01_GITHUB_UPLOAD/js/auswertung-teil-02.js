
    const ADMIN_PASS = null; // Firebase-Rollen ersetzen das alte Admin-Passwort

    let tournaments = {};
    let activeId = null;
    let activeGroup = null;
    let activeKoStage = null;
    let selectedMatchRef = null;
    let adminEditingMatchRef = null;
    let currentMatchGames = [];

    window.initFirebaseSync = function() {
      if (!window.db || !window.fbRef || !window.fbOnValue) return;
      const tRef = window.fbRef(window.db, 'cup/public/tournaments');
      window.fbOnValue(tRef, (snapshot) => {
        tournaments = snapshot.val() || {};
        if(document.getElementById('adminSecPrint')?.style.display==='block' && typeof window.cupFinalLoad==='function') window.cupFinalLoad();
        renderMainButtons();
        if (activeId && tournaments[activeId]) {
          if (document.getElementById('view-groups').classList.contains('active')) openGroupSelection(activeId);
          else if (document.getElementById('view-table').classList.contains('active') && activeGroup) openGroupTable(activeGroup);
          else if (document.getElementById('view-ko').classList.contains('active') && activeKoStage) renderKoMatches(activeKoStage);
        }
      }, (err) => {
        console.error(err);
        console.warn("Firebase ist zu diesem Zeitpunkt noch nicht initialisiert.");
      });
    };

    window.addEventListener('load', () => {
setDefaultTeamsTemplate();
      if (window.initFirebaseSync) window.initFirebaseSync();
    });

    function switchAdminTab(tab) {
      const tabs = ['new','matchEdit','history','print','edit'];
      tabs.forEach(t => {
        const el = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        const sec = document.getElementById('adminSec' + t.charAt(0).toUpperCase() + t.slice(1));
        if (el) el.classList.remove('active');
        if (sec) sec.style.display = 'none';
      });
      const a = tab.charAt(0).toUpperCase() + tab.slice(1);
      document.getElementById('tab' + a)?.classList.add('active');
      document.getElementById('adminSec' + a).style.display = 'block';
      if(tab==='print' && typeof window.cupFinalLoad==='function') window.cupFinalLoad();
    }

    function setDefaultTeamsTemplate() {
      document.getElementById('adminTeams').value =
        Array.from({length:6}, (_,i) => `Mannschaft ${i+1}`).join('\n');
    }

    let cupSaveQueue=Promise.resolve();
    let cupSaveStatusTimer=null;

    function showCupSaveStatus(text,type='busy'){
      let el=document.getElementById('cupFirebaseSaveStatus');
      if(!el){
        el=document.createElement('div');
        el.id='cupFirebaseSaveStatus';
        el.style.cssText=[
          'position:fixed','left:50%','bottom:22px','transform:translateX(-50%)',
          'z-index:99999','padding:11px 16px','border-radius:9px',
          'font-weight:800','font-size:.9rem','box-shadow:0 6px 22px rgba(0,0,0,.45)',
          'border:1px solid rgba(255,255,255,.35)','max-width:min(92vw,680px)',
          'text-align:center','pointer-events:none'
        ].join(';');
        document.body.appendChild(el);
      }

      const styles={
        busy:{bg:'#1f2937',fg:'#fff'},
        ok:{bg:'#166534',fg:'#fff'},
        error:{bg:'#991b1b',fg:'#fff'}
      };
      const c=styles[type]||styles.busy;
      el.style.background=c.bg;
      el.style.color=c.fg;
      el.textContent=text;
      el.style.display='block';

      clearTimeout(cupSaveStatusTimer);
      if(type==='ok'){
        cupSaveStatusTimer=setTimeout(()=>{el.style.display='none'},3500);
      }else if(type==='error'){
        cupSaveStatusTimer=setTimeout(()=>{el.style.display='none'},12000);
      }
    }

    function saveData() {
      if (!window.db || !window.fbRef || !window.fbSet) {
        showCupSaveStatus('✗ Firebase ist noch nicht bereit. Bitte kurz warten und erneut speichern.','error');
        return Promise.resolve(false);
      }

      // Exakte Momentaufnahme speichern, damit mehrere schnelle Eingaben
      // nicht gegeneinander laufen.
      const snapshot=JSON.parse(JSON.stringify(tournaments));
      showCupSaveStatus('☁ Firebase: Speicherung läuft …','busy');

      cupSaveQueue=cupSaveQueue
        .catch(()=>{})
        .then(()=>window.fbSet(
          window.fbRef(window.db,'cup/public/tournaments'),
          snapshot
        ))
        .then(()=>{
          showCupSaveStatus('✓ Firebase: erfolgreich gespeichert','ok');
          return true;
        })
        .catch(err=>{
          console.error('Cup Firebase speichern:',err);
          const msg=String(err?.message||err||'Unbekannter Fehler');
          showCupSaveStatus('✗ Firebase-Speicherung fehlgeschlagen: '+msg,'error');
          return false;
        });

      return cupSaveQueue;
    }

    function exportDataToFile() {
      const blob = new Blob([JSON.stringify(tournaments, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `stocksport_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function importDataFromFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
          tournaments = data;
          saveData();
          alert('Daten erfolgreich importiert.');
        } catch {
          alert('Fehler beim Importieren: ungültige JSON-Datei.');
        }
        event.target.value = '';
      };
      reader.readAsText(file);
    }

    function addHistoryEntry(tId, text) {
      if (!tournaments[tId]) return;
      tournaments[tId].history ||= [];
      tournaments[tId].history.unshift({
        time: new Date().toLocaleString('de-DE'),
        text
      });
    }

    function showView(id) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(id)?.classList.add('active');
      const backBtn = document.getElementById('globalStartMenuBtn');
      // Nur die Cup-Ebenen verwenden den eigenen Zurueck-Button.
      // Bei Einbettung wird der Hauptmenue-Button vom Hauptprogramm angezeigt.
      const cupLevel = ['view-main','view-groups','view-table','view-match','view-ko','view-admin'].includes(id) && !(window.ECW_EMBEDDED_ADMIN && (id==='view-main'||id==='view-admin'));
      document.documentElement.classList.toggle('cup-navigation-visible',cupLevel);
      if (backBtn) backBtn.style.display = cupLevel ? 'block' : 'none';
      if (backBtn) {
        if (id === 'view-match' || id === 'view-table' || id === 'view-groups' || id === 'view-ko') {
          backBtn.textContent = '← Zurück';
          backBtn.onclick = () => {
            if (id === 'view-table') {
              const detail = document.getElementById('playerMatchesContainer');
              if (detail && detail.style.display !== 'none') { closePlayerMatches(); return; }
              showView('view-groups');
            } else if (id === 'view-groups') {
              goToMainMenu();
            } else {
              showView('view-groups');
            }
          };
        } else {
          backBtn.textContent = '↩️ Zurück zum Startmenü';
          backBtn.onclick = goBackToStartMenu;
        }
      }
      if (typeof updateHeader === 'function') updateHeader(id);
    }

    function goToMainMenu() {
      renderMainButtons();
      showView('view-main');
    }

    function goBackToStartMenu() {
      showHome();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function checkAdminAccess() {
      const r = window.getEffectiveRole ? window.getEffectiveRole() : (window.currentRole || 'guest');
      if (r !== 'admin' && r !== 'turnierauswertung') {
        alert("Dieser Bereich ist nur für ADMIN bzw. TURNIERAUSWERTUNG freigegeben.");
        return;
      }
      populateAdminTournamentList();
      populateAdminPrintList();
      populateAdminMatchEditTournaments();
      populateAdminHistoryTournaments();
switchAdminTab('new');
      showView('view-admin');
    }

    function fillTournamentSelect(id, includeBlank=true) {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = includeBlank ? '<option value="">-- Turnier wählen --</option>' : '';
      Object.entries(tournaments).forEach(([key,t]) => {
        const o = document.createElement('option');
        o.value = key; o.textContent = t.name || key;
        select.appendChild(o);
      });
    }
    function populateAdminTournamentList(){ fillTournamentSelect('adminSelectTournament'); }
    function populateAdminPrintList(){ fillTournamentSelect('adminPrintSelectTournament'); }
    function populateAdminMatchEditTournaments(){ fillTournamentSelect('adminMatchEditSelectTournament'); }
    function populateAdminHistoryTournaments(){ fillTournamentSelect('adminHistorySelectTournament'); }

    function renderMainButtons() {
      const c = document.getElementById('tournamentButtons');
      if (!c) return;
      c.innerHTML = '';
      const ids = Object.keys(tournaments);
      if (!ids.length) {
        c.innerHTML = '<p style="color:var(--text-muted);text-align:center;">Keine Turniere vorhanden.</p>';
        return;
      }
      ids.forEach(id => {
        const b = document.createElement('button');
        b.className = 'btn-tournament';
        b.textContent = tournaments[id].name;
        b.onclick = () => openGroupSelection(id);
        c.appendChild(b);
      });
    }

    // Stabile Gruppenreihenfolge auch nach Firebase-Ladevorgängen: A, B, C ...
    function cupSortedGroups(groups) {
      return Object.entries(groups || {}).sort(([keyA, a], [keyB, b]) => {
        const index = (key, data) => {
          const m = String(key).match(/^group_(\d+)$/i);
          if (m) return Number(m[1]);
          const n = String(data?.name || key).match(/(?:Gruppe\s*)?([A-Z])$/i);
          return n ? n[1].toUpperCase().charCodeAt(0) - 64 : Number.MAX_SAFE_INTEGER;
        };
        return index(keyA,a)-index(keyB,b) || String(keyA).localeCompare(String(keyB),'de',{numeric:true});
      });
    }

    function openGroupSelection(id) {
      activeId = id;
      const t = tournaments[id];
      if (!t) return;

      if (t.groups) {
        cupSortedGroups(t.groups).forEach(([gKey, gData]) => {
          if (!gData.matches || Object.keys(gData.matches).length === 0) {
            if (gData.teams && gData.teams.length >= 2) {
              gData.matches = generateFixturesForTeams(gData.teams, !!t.hasReturnLeg);
            }
          }
        });
      }

      let sets = t.totalSets || 5;
      let desc = sets === 'bo3' ? 'Best of 3' : sets === 'bo5' ? 'Best of 5' : `${sets} Sätze`;
      document.getElementById('groupsTitle').textContent = t.name;
      document.getElementById('groupsSub').textContent =
        `${t.groupCount} Gruppe(n) | ${t.advancing || 2} Aufsteiger | ${desc} ${t.hasReturnLeg ? '| Mit Rückrunde' : ''}`;
      const c = document.getElementById('groupCardsContainer');
      c.innerHTML = '';
      
      if (t.groups) {
        const groupCount = cupSortedGroups(t.groups).length;
        // V2.5.2: Gruppen unabhängig von der Anzahl untereinander anzeigen.
        c.style.setProperty('--cup-group-cols', 1);
        cupSortedGroups(t.groups).forEach(([gKey, gData]) => {
          const div = document.createElement('div');
          div.className = 'group-card';
          div.innerHTML = `<h3>${gData.name || gKey}</h3>
            <div class="cup-group-actions">
              <button class="btn" style="padding:6px; font-size:0.8rem;" onclick="openMatchSelection('${gKey}')">✏️ Ergebnis eingeben</button>
              <button class="btn btn-secondary" style="padding:6px; font-size:0.8rem;" onclick="openGroupTable('${gKey}')">📊 Tabelle</button>
            </div>`;
          c.appendChild(div);
        });
      }

      if (t.hasKo) {
        document.getElementById('dashKoContainer').style.display = 'block';
      } else {
        document.getElementById('dashKoContainer').style.display = 'none';
      }

      showView('view-groups');
    }

    function openGroupTable(gKey) {
      activeGroup = gKey;
      const t = tournaments[activeId];
      const g = t.groups[gKey];
      document.getElementById('tableTitle').textContent = `Tabelle: ${g.name || gKey}`;
      document.getElementById('playerMatchesContainer').style.display = 'none';
      
      const tbody = document.getElementById('tableBody');
      tbody.innerHTML = '';
      
      let standings = calculateStandings(gKey);
      standings.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'player-row';
        if (idx < (t.advancing || 2) && t.groupCount === 1) {
          tr.classList.add('promotion-cutoff');
        }
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td>${row.name} ${row.dq ? '<span class="cup-status-label">DSQ</span>' : row.dnf ? '<span class="cup-status-label">DNF</span>' : ''}</td>
          <td>${row.played}</td>
          <td>${row.points}</td>
          <td>${row.stocksFor}:${row.stocksAgainst}</td>
          <td>${row.quota.toFixed(3)}</td>
          <td class="pts-disp">${row.setPoints || 0}</td>
        `;
        tr.onclick = () => showPlayerMatchesInTable(row.id, row.name);
        tbody.appendChild(tr);
      });

      showView('view-table');
      // Die Zeilenhöhe wird nach der tatsächlichen Mannschaftszahl und Displayhöhe berechnet.
      requestAnimationFrame(() => ecwFitCupTable());
    }

    function ecwFitCupTable() {
      const view = document.getElementById('view-table');
      const table = view?.querySelector('table');
      if (!view || !table || !view.classList.contains('active')) return;
      const rows = view.querySelectorAll('#tableBody tr').length;
      const top = table.getBoundingClientRect().top;
      const available = Math.max(160, window.innerHeight - top - 96);
      const rowHeight = Math.min(62, Math.max(19, available / Math.max(1, rows + 1)));
      const font = Math.min(24, Math.max(11, rowHeight * .38));
      const padding = Math.max(1, Math.min(18, (rowHeight - font * 1.25) / 2));
      view.style.setProperty('--cup-row-font', font.toFixed(1) + 'px');
      view.style.setProperty('--cup-row-pad', padding.toFixed(1) + 'px');
    }
    window.addEventListener('resize', () => { ecwFitCupTable(); ecwFitCupPlayerMatches(); });

    function ecwFitCupPlayerMatches() {
      const panel = document.getElementById('playerMatchesContainer');
      const list = document.getElementById('playerMatchesList');
      if (!panel || !list || panel.style.display === 'none') return;
      const n = Math.max(1, list.children.length);
      const available = Math.max(120, list.getBoundingClientRect().height);
      const row = available / n;
      list.style.setProperty('--cup-match-gap', Math.min(12,Math.max(2,row*.08)).toFixed(1)+'px');
      list.style.setProperty('--cup-match-font', Math.min(24,Math.max(10,row*.27)).toFixed(1)+'px');
      list.style.setProperty('--cup-match-pad', Math.min(18,Math.max(1,row*.1)).toFixed(1)+'px');
    }

    function showPlayerMatchesInTable(teamId, teamName) {
      const t = tournaments[activeId];
      const g = t.groups[activeGroup];
      const container = document.getElementById('playerMatchesContainer');
      const titleEl = document.getElementById('playerMatchesTitle');
      const listEl = document.getElementById('playerMatchesList');

      const selectedTeam = (g.teams || []).find(tm => String(tm.id) === String(teamId));
      const ownStatus = selectedTeam && selectedTeam.dq ? ' · DSQ' : selectedTeam && selectedTeam.dnf ? ' · DNF' : '';
      titleEl.textContent = `Spiele von ${teamName}${ownStatus}`;
      listEl.innerHTML = '';

      const teamMap = new Map((g.teams || []).map(tm => [String(tm.id), tm]));
      const matches = Object.values(g.matches || {}).filter(m => String(m.teamA) === String(teamId) || String(m.teamB) === String(teamId));

      if (matches.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:4px;">Keine Spiele gefunden.</p>';
      } else {
        matches.forEach(m => {
          const isA = String(m.teamA) === String(teamId);
          const opponentId = isA ? m.teamB : m.teamA;
          const opponentObj = teamMap.get(String(opponentId));
          const opponentName = opponentObj ? opponentObj.name : 'Unbekannt';
          const legText = m.leg ? `[${m.leg}]` : '';
          const opponentStatus = opponentObj && opponentObj.dq ? 'DSQ' : opponentObj && opponentObj.dnf ? 'DNF' : '';

          // Bei nicht gespielten Partien den hinterlegten Teamstatus statt "Offen" zeigen.
          const ownTeamStatus = selectedTeam && selectedTeam.dq ? 'DSQ' : selectedTeam && selectedTeam.dnf ? 'DNF' : '';
          const matchStatus = ownTeamStatus || opponentStatus;
          let resultText = matchStatus
            ? `<span class="cup-status-label" style="font-weight:700;">${matchStatus}</span>`
            : '<span style="color:var(--text-muted);">Offen</span>';
          if (m.completed) {
            const ownPoints = isA ? m.pointsA : m.pointsB;
            const oppPoints = isA ? m.pointsB : m.pointsA;
            const ownStocks = isA ? m.stocksA : m.stocksB;
            const oppStocks = isA ? m.stocksB : m.stocksA;
            const won = ownPoints > oppPoints;
            const color = won ? 'var(--success)' : (ownPoints < oppPoints ? 'var(--danger)' : 'var(--gold)');
            resultText = `<span style="color:${color}; font-weight:bold;">${ownPoints}:${oppPoints} Satzpkt. (${ownStocks}:${oppStocks} Stöcke)</span>`;
          }

          const div = document.createElement('div');
          div.className = 'cup-player-match';
          div.innerHTML = `
            <span class="cup-opponent">${legText} vs. ${opponentName} ${opponentStatus ? '<span class="cup-status-label">' + opponentStatus + '</span>' : ''}</span>
            <span class="cup-result">${resultText}</span>
          `;
          listEl.appendChild(div);
        });
      }

      container.style.display = 'flex';
      // Alle Begegnungen untereinander; Größe automatisch an die Anzahl anpassen.
      requestAnimationFrame(() => ecwFitCupPlayerMatches());
    }

    function closePlayerMatches() {
      document.getElementById('playerMatchesContainer').style.display = 'none';
    }

    function calculateStandings(gKey) {
      const t = tournaments[activeId];
      const g = t.groups[gKey];
      const teams = g.teams || [];
      const stats = {};

      teams.forEach(tm => {
        stats[tm.id] = {
          id: tm.id,
          name: tm.name,
          played: 0,
          points: 0,
          stocksFor: 0,
          stocksAgainst: 0,
          setPoints: 0,
          dq: tm.dq || false,
          dnf: tm.dnf || false
        };
      });

      if (g.matches) {
        Object.values(g.matches).forEach(m => {
          if (!m.completed) return;
          const a = stats[m.teamA];
          const b = stats[m.teamB];
          if (!a || !b) return;

          a.played++;
          b.played++;

          a.stocksFor += m.stocksA;
          a.stocksAgainst += m.stocksB;
          b.stocksFor += m.stocksB;
          b.stocksAgainst += m.stocksA;

          let pA = 0;
          let pB = 0;
          if (m.games && m.games.length > 0) {
            m.games.forEach(gm => {
              if (gm.sA > gm.sB) pA += 2;
              else if (gm.sB > gm.sA) pB += 2;
              else if (gm.sA > 0 || gm.sB > 0) { pA += 1; pB += 1; }
            });
          } else {
            pA = m.pointsA || 0;
            pB = m.pointsB || 0;
          }

          if(a.dq||a.dnf){if(!(b.dq||b.dnf))b.points+=3;}
          else if(b.dq||b.dnf){a.points+=3;}
          else if (pA > pB) {a.points += 3;}
          else if (pB > pA) {b.points += 3;}
          else {a.points += 1;b.points += 1;}
          if(!(a.dq||a.dnf))a.setPoints += pA;
          if(!(b.dq||b.dnf))b.setPoints += pB;
        });
      }

      let arr = Object.values(stats);
      arr.forEach(item => {
        if(item.dq||item.dnf){item.points=0;item.setPoints=0;item.stocksFor=0;item.stocksAgainst=0;}
        item.quota = item.stocksAgainst === 0 ? (item.stocksFor > 0 ? 999.0 : 1.0) : item.stocksFor / item.stocksAgainst;
      });

      arr.sort((x, y) => {
        if (x.dq !== y.dq) return x.dq ? 1 : -1;
        if (x.dnf !== y.dnf) return x.dnf ? 1 : -1;
        if (y.points !== x.points) return y.points - x.points;
        if (y.setPoints !== x.setPoints) return y.setPoints - x.setPoints;
        return y.quota - x.quota;
      });

      return arr;
    }

    function openMatchSelection(gKey) {
      activeGroup = gKey;
      const t = tournaments[activeId];
      const g = t.groups[gKey];
      
      document.getElementById('matchGroupHeader').textContent = `Ergebnis eintragen · ${g.name || gKey}`;
      const selA = document.getElementById('selectTeamA');
      const selB = document.getElementById('selectTeamB');
      
      selA.innerHTML = '<option value="">-- Mannschaft wählen --</option>';
      const teamsWithOpenMatches = new Set();
      Object.values(g.matches || {}).forEach(m => {
        if (!m.completed) {
          teamsWithOpenMatches.add(String(m.teamA));
          teamsWithOpenMatches.add(String(m.teamB));
        }
      });
      (g.teams || []).forEach(tm => {
        if (!tm.dq && !tm.dnf && teamsWithOpenMatches.has(String(tm.id))) {
          const o = document.createElement('option');
          o.value = tm.id; o.textContent = tm.name;
          selA.appendChild(o);
        }
      });

      selB.innerHTML = '<option value="">-- Zuerst Mannschaft wählen --</option>';
      selB.disabled = true;
      document.getElementById('scoreArea').style.display = 'none';
      const emptyHint = document.getElementById('cupEmptySelection');
      if (emptyHint) emptyHint.style.display = 'flex';
      
      showView('view-match');
    }

    function onTeamASelected() {
      const valA = document.getElementById('selectTeamA').value;
      const selB = document.getElementById('selectTeamB');
      const t = tournaments[activeId];
      const g = t.groups[activeGroup];

      selB.innerHTML = '<option value="">-- Offenes Spiel wählen --</option>';
      const hint = document.getElementById('noOpenMatchesHint');
      hint.style.display = 'none';
      if (!valA) {
        selB.disabled = true;
        document.getElementById('scoreArea').style.display = 'none';
        return;
      }

      const teamMap = new Map((g.teams || []).map(tm => [String(tm.id), tm]));
      const openMatches = Object.entries(g.matches || {}).filter(([mId, m]) =>
        !m.completed && (String(m.teamA) === String(valA) || String(m.teamB) === String(valA))
      );

      openMatches.forEach(([mId, m]) => {
        const opponentId = String(m.teamA) === String(valA) ? m.teamB : m.teamA;
        const opponent = teamMap.get(String(opponentId));
        if (!opponent || opponent.dq || opponent.dnf) return;

        const o = document.createElement('option');
        o.value = mId;
        const leg = m.leg || (String(m.teamA) === String(valA) ? 'Hinrunde' : 'Rückrunde');
        const homeTeam = teamMap.get(String(m.teamA));
        const awayTeam = teamMap.get(String(m.teamB));
        o.textContent = leg + ': ' + (homeTeam ? homeTeam.name : m.teamA) + ' - ' + (awayTeam ? awayTeam.name : m.teamB);
        selB.appendChild(o);
      });

      selB.disabled = openMatches.length === 0;
      hint.style.display = openMatches.length === 0 ? 'block' : 'none';
      document.getElementById('scoreArea').style.display = 'none';
      const emptyHint = document.getElementById('cupEmptySelection');
      if (emptyHint) emptyHint.style.display = 'flex';
    }

    function onTeamBSelected() {
      const valA = document.getElementById('selectTeamA').value;
      const matchId = document.getElementById('selectTeamB').value;
      if (!valA || !matchId) {
        document.getElementById('scoreArea').style.display = 'none';
        return;
      }

      const t = tournaments[activeId];
      const g = t.groups[activeGroup];
      const selectedMatch = (g.matches || {})[matchId];
      if (!selectedMatch || selectedMatch.completed) {
        document.getElementById('scoreArea').style.display = 'none';
        return;
      }
      // Dieselbe Reihenfolge wie auf der gedruckten Spielkarte, auch wenn Spieler 2 das Spiel auswählt.
      const teamAObj = g.teams.find(x => String(x.id) === String(selectedMatch.teamA));
      const teamBObj = g.teams.find(x => String(x.id) === String(selectedMatch.teamB));
      if (!teamAObj || !teamBObj) return;

      document.getElementById('teamAName').textContent = teamAObj.name;
      document.getElementById('teamBName').textContent = teamBObj.name;

      let totalSets = t.totalSets || 5;
      
      const existingMatch = selectedMatch;

      currentMatchGames = [];
      if (existingMatch && existingMatch.games && existingMatch.games.length > 0) {
        currentMatchGames = JSON.parse(JSON.stringify(existingMatch.games));
      } else {
        for(let i=0; i<totalSets; i++) {
          currentMatchGames.push({ sA: 0, sB: 0 });
        }
      }

      renderMatchSteppers();
      const scoreArea = document.getElementById('scoreArea');
      scoreArea.style.setProperty('--cup-set-count', String(currentMatchGames.length));
      scoreArea.dataset.density = currentMatchGames.length >= 8 ? 'dense' : currentMatchGames.length >= 6 ? 'compact' : 'normal';
      scoreArea.style.display = 'flex';
      const emptyHint = document.getElementById('cupEmptySelection');
      if (emptyHint) emptyHint.style.display = 'none';
    }

    function renderMatchSteppers() {
      const container = document.getElementById('gamesContainer');
      container.innerHTML = '';

      currentMatchGames.forEach((gm, idx) => {
        const row = document.createElement('div');
        row.className = 'game-row';
        row.innerHTML = `
          <div class="game-title">Satz ${idx+1}</div>
          <div class="stepper">
            <button class="btn-step" onclick="changeScore(${idx}, 'A', -1)">-</button>
            <span class="score-disp" id="scoreA_${idx}">${gm.sA}</span>
            <button class="btn-step" onclick="changeScore(${idx}, 'A', 1)">+</button>
          </div>
          <div class="game-separator" aria-hidden="true"></div>
          <div class="stepper">
            <button class="btn-step" onclick="changeScore(${idx}, 'B', -1)">-</button>
            <span class="score-disp" id="scoreB_${idx}">${gm.sB}</span>
            <button class="btn-step" onclick="changeScore(${idx}, 'B', 1)">+</button>
          </div>
        `;
        container.appendChild(row);
      });
      updateMatchSummary();
    }

    function changeScore(idx, team, delta) {
      if (team === 'A') {
        currentMatchGames[idx].sA = Math.max(0, currentMatchGames[idx].sA + delta);
        document.getElementById(`scoreA_${idx}`).textContent = currentMatchGames[idx].sA;
      } else {
        currentMatchGames[idx].sB = Math.max(0, currentMatchGames[idx].sB + delta);
        document.getElementById(`scoreB_${idx}`).textContent = currentMatchGames[idx].sB;
      }
      updateMatchSummary();
    }

    function updateMatchSummary() {
      let pA = 0, pB = 0, stA = 0, stB = 0;
      currentMatchGames.forEach(gm => {
        stA += gm.sA;
        stB += gm.sB;
        if (gm.sA > gm.sB) pA += 2;
        else if (gm.sB > gm.sA) pB += 2;
        else if (gm.sA > 0 || gm.sB > 0) { pA += 1; pB += 1; }
      });
      document.getElementById('matchStockTotal').textContent = `${stA} : ${stB}`;
      document.getElementById('matchSummary').textContent = `${pA} : ${pB}`;
    }

    function saveMatchResult() {
      const selectedTeamId = document.getElementById('selectTeamA').value;
      const targetMatchId = document.getElementById('selectTeamB').value;
      if (!selectedTeamId || !targetMatchId) return;

      let pA = 0, pB = 0, stA = 0, stB = 0;
      currentMatchGames.forEach(gm => {
        stA += gm.sA;
        stB += gm.sB;
        if (gm.sA > gm.sB) pA += 2;
        else if (gm.sB > gm.sA) pB += 2;
        else if (gm.sA > 0 || gm.sB > 0) { pA += 1; pB += 1; }
      });

      const t = tournaments[activeId];
      const g = t.groups[activeGroup];
      g.matches ||= {};
      const scheduledMatch = g.matches[targetMatchId];
      if (!scheduledMatch || scheduledMatch.completed) {
        alert("Dieses Spiel ist nicht mehr offen.");
        return;
      }
      const nameA = g.teams.find(x => String(x.id) === String(scheduledMatch.teamA))?.name || 'Spieler 1';
      const nameB = g.teams.find(x => String(x.id) === String(scheduledMatch.teamB))?.name || 'Spieler 2';
      const confirmed = window.confirm(
        `Ergebnis mit Gegner kontrollieren und bestätigen.\n\n${nameA} – ${nameB}\n` +
        `Gesamte Stockpunkte: ${stA} : ${stB}\nSpielergebnis: ${pA} : ${pB}\n\nErgebnis verbindlich speichern?`
      );
      if (!confirmed) return;

      const selectedIsHome = true; // Eingabe entspricht immer der Reihenfolge der Spielkarte.
      const valA = scheduledMatch.teamA;
      const valB = scheduledMatch.teamB;
      const savedGames = selectedIsHome
        ? JSON.parse(JSON.stringify(currentMatchGames))
        : currentMatchGames.map(gm => ({ sA: gm.sB, sB: gm.sA }));
      const savedPointsA = selectedIsHome ? pA : pB;
      const savedPointsB = selectedIsHome ? pB : pA;
      const savedStocksA = selectedIsHome ? stA : stB;
      const savedStocksB = selectedIsHome ? stB : stA;

      g.matches[targetMatchId] = {
        ...scheduledMatch,
        teamA: valA,
        teamB: valB,
        games: savedGames,
        pointsA: savedPointsA,
        pointsB: savedPointsB,
        stocksA: savedStocksA,
        stocksB: savedStocksB,
        completed: true
      };

      const teamAObj = g.teams.find(x => x.id == valA);
      const teamBObj = g.teams.find(x => x.id == valB);
      addHistoryEntry(activeId, `Ergebnis eingetragen: ${teamAObj.name} vs ${teamBObj.name} (${pA}:${pB} Satzpunkte, ${stA}:${stB} Stöcke)`);

      saveData();
      alert("Ergebnis übernommen. Die Firebase-Speicherung wird unten angezeigt.");
      openGroupSelection(activeId);
    }

    function openKoInfo(stage) {
      activeKoStage = stage;
      renderKoMatches(stage);
    }

    function renderKoMatches(stage) {
      activeKoStage = stage;
      document.getElementById('koTitle').textContent = `KO-Phase: ${stage}`;
      const list = document.getElementById('koMatchList');
      const matches = (tournaments[activeId]?.koMatches?.[stage]) || {};
      if (!Object.keys(matches).length) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:10px;">Noch keine KO-Begegnungen generiert.</p>';
      } else {
        list.innerHTML = Object.values(matches).map(m => `<div class="corr-item"><b>${m.nameA || 'Team A'}</b> vs <b>${m.nameB || 'Team B'}</b> <span style="color:var(--text-muted)">${m.completed ? `(${m.pointsA}:${m.pointsB})` : '[Offen]'}</span></div>`).join('');
      }
      showView('view-ko');
    }

    function autoGenerateKoPairings() {
      const t = tournaments[activeId];
      if (!t || !t.hasKo) return;
      const advancing = Math.max(1, parseInt(t.advancing || 2));
      const qualified = [];
      Object.entries(t.groups || {}).forEach(([gKey, g]) => {
        calculateStandingsForTournamentGroup(t, gKey).slice(0, advancing).forEach((row, idx) => {
          qualified.push({ id: row.id, name: row.name, group: gKey, rank: idx + 1 });
        });
      });
      const stages = {};
      let count = 1;
      while (Math.pow(2, count) <= qualified.length) count++;
      const size = Math.pow(2, Math.floor(Math.log2(Math.max(2, qualified.length))));
      const entrants = qualified.slice(0, size);
      for (let i=0; i<entrants.length/2; i++) {
        const a = entrants[i], b = entrants[entrants.length-1-i];
        const id = `ko_${Date.now()}_${i}`;
        stages['Viertelfinale'] ||= {};
        stages['Viertelfinale'][id] = { teamA:a.id, teamB:b.id, nameA:a.name, nameB:b.name, completed:false, games:[], pointsA:0, pointsB:0, stocksA:0, stocksB:0 };
      }
      t.koMatches = stages;
      addHistoryEntry(activeId, 'KO-Paarungen aus der Tabelle neu erzeugt.');
      saveData();
      renderKoMatches(activeKoStage || 'Viertelfinale');
    }

    function calculateStandingsForTournamentGroup(t, gKey) {
      const old = activeId;
      activeId = Object.keys(tournaments).find(k => tournaments[k] === t) || old;
      const result = calculateStandings(gKey);
      activeId = old;
      return result;
    }

    function generateFixturesForTeams(teams, hasReturnLeg) {
      let matches = {};
      if (teams.length < 2) return matches;

      let list = [...teams];
      if (list.length % 2 !== 0) {
        list.push({ id: -1, name: 'PAUSE', dummy: true });
      }

      let numTeams = list.length;
      let rounds = numTeams - 1;
      let half = numTeams / 2;
      let matchCounter = 1;

      for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < half; i++) {
          let t1 = list[i];
          let t2 = list[numTeams - 1 - i];
          if (!t1.dummy && !t2.dummy) {
            let mId = `m_gen_${matchCounter++}`;
            matches[mId] = {
              teamA: t1.id,
              teamB: t2.id,
              games: [],
              pointsA: 0,
              pointsB: 0,
              stocksA: 0,
              stocksB: 0,
              completed: false,
              leg: 'Hinrunde'
            };
          }
        }
        let temp = list.pop();
        list.splice(1, 0, temp);
      }

      if (hasReturnLeg) {
        let hinrundeKeys = Object.keys(matches);
        hinrundeKeys.forEach(k => {
          let hm = matches[k];
          let mId = `m_gen_${matchCounter++}`;
          matches[mId] = {
            teamA: hm.teamB,
            teamB: hm.teamA,
            games: [],
            pointsA: 0,
            pointsB: 0,
            stocksA: 0,
            stocksB: 0,
            completed: false,
            leg: 'Rückrunde'
          };
        });
      }

      return matches;
    }

    function createNewTournament() {
      const name = document.getElementById('adminName').value.trim();
      if (!name) {
        alert("Bitte einen Turniernamen eingeben.");
        return;
      }
      // Gleiche Turniernamen (auch mit anderer Großschreibung/Leerzeichen) verhindern.
      const normalizeCupName = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
      const duplicate = Object.values(tournaments).some(t => normalizeCupName(t?.name) === normalizeCupName(name));
      if (duplicate) {
        alert(`Ein Cup mit dem Namen "${name}" ist bereits vorhanden. Bitte einen anderen Turniernamen wählen.`);
        document.getElementById('adminName').focus();
        return;
      }
      const groupCount = parseInt(document.getElementById('adminGroupCount').value);
      const advancing = parseInt(document.getElementById('adminAdvancing').value);
      const totalSets = parseInt(document.getElementById('adminTotalSets').value);
      const hasKo = document.getElementById('adminHasKo').checked;
      const hasReturnLeg = document.getElementById('adminHasReturnLeg').checked;
      const teamLines = document.getElementById('adminTeams').value.split('\n').map(s => s.trim()).filter(Boolean);

      if (teamLines.length < 2) {
        alert("Bitte mindestens 2 Mannschaften eingeben.");
        return;
      }

      const tId = 't_' + Date.now();
      tournaments[tId] = {
        name,
        groupCount,
        advancing,
        totalSets,
        hasKo,
        hasReturnLeg,
        groups: {},
        history: []
      };

      for (let i = 0; i < groupCount; i++) {
        tournaments[tId].groups[`group_${i+1}`] = {
          name: groupCount === 1 ? 'Gruppe 1' : `Gruppe ${String.fromCharCode(65 + i)}`,
          teams: []
        };
      }

      teamLines.forEach((tName, idx) => {
        let gKey = `group_${(idx % groupCount) + 1}`;
        tournaments[tId].groups[gKey].teams.push({
          id: idx + 1,
          name: tName
        });
      });

      Object.keys(tournaments[tId].groups).forEach(gKey => {
        let g = tournaments[tId].groups[gKey];
        g.matches = generateFixturesForTeams(g.teams, hasReturnLeg);
      });

      addHistoryEntry(tId, `Turnier "${name}" erstellt (inkl. Spielplan).`);
      saveData().then(saved => {
        if (saved) {
          alert("Turnier & Spielplan erfolgreich erstellt!");
          goToMainMenu();
        } else {
          // Fehlgeschlagene Speicherung nicht als Erfolg melden.
          delete tournaments[tId];
          renderMainButtons();
          alert("Das Turnier konnte nicht in Firebase gespeichert werden. Bitte die Fehlermeldung beachten.");
        }
      });
    }

    function onAdminMatchEditTournamentChange() {
      const tId = document.getElementById('adminMatchEditSelectTournament').value;
      const wrapper = document.getElementById('adminMatchEditGroupWrapper');
      const groupSel = document.getElementById('adminMatchEditSelectGroup');
      if (!tId || !tournaments[tId]) {
        wrapper.style.display = 'none';
        return;
      }
      wrapper.style.display = 'block';
      groupSel.innerHTML = '<option value="">-- Gruppe wählen --</option>';
      Object.entries(tournaments[tId].groups).forEach(([gKey, gData]) => {
        const o = document.createElement('option');
        o.value = gKey; o.textContent = gData.name || gKey;
        groupSel.appendChild(o);
      });
      document.getElementById('adminCompletedMatchesList').innerHTML = '';
      document.getElementById('adminEditMatchForm').style.display = 'none';
    }

    function loadCompletedMatchesForAdmin() {
      const tId = document.getElementById('adminMatchEditSelectTournament').value;
      const gKey = document.getElementById('adminMatchEditSelectGroup').value;
      const list = document.getElementById('adminCompletedMatchesList');
      if (!tId || !gKey) return;

      const g = tournaments[tId].groups[gKey];
      list.innerHTML = '';
      if (!g.matches || Object.keys(g.matches).length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Keine Spiele gefunden.</p>';
        return;
      }

      Object.entries(g.matches).sort((a,b) => {
        const ac = !!a[1].completed, bc = !!b[1].completed;
        if (ac !== bc) return ac ? -1 : 1;
        return 0;
      }).forEach(([mId, m]) => {
        const tA = g.teams.find(x => x.id == m.teamA)?.name || 'Team A';
        const tB = g.teams.find(x => x.id == m.teamB)?.name || 'Team B';
        const statusText = m.completed ? `(${m.pointsA}:${m.pointsB} Satzpunkte)` : '[Offen]';
        const div = document.createElement('div');
        div.className = 'corr-item';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
          <span><b>${tA}</b> vs <b>${tB}</b> ${statusText}</span>
          <button class="btn btn-secondary" style="width:auto; padding:4px 8px; margin:0;" onclick="startAdminMatchCorrection('${tId}', '${gKey}', '${mId}')">✏️ Bearbeiten</button>
        `;
        list.appendChild(div);
      });
    }

    function startAdminMatchCorrection(tId, gKey, mId) {
      adminEditingMatchRef = { tId, gKey, mId };
      const m = tournaments[tId].groups[gKey].matches[mId];
      const g = tournaments[tId].groups[gKey];
      const tA = g.teams.find(x => x.id == m.teamA)?.name || 'Team A';
      const tB = g.teams.find(x => x.id == m.teamB)?.name || 'Team B';

      document.getElementById('adminEditMatchHeader').textContent = `${tA} vs ${tB}`;
      
      let totalSets = tournaments[tId].totalSets || 5;
      currentMatchGames = m.games && m.games.length > 0 ? JSON.parse(JSON.stringify(m.games)) : [];
      if (currentMatchGames.length === 0) {
        for(let i=0; i<totalSets; i++) currentMatchGames.push({sA:0, sB:0});
      }

      const container = document.getElementById('adminEditGamesContainer');
      container.innerHTML = '';
      currentMatchGames.forEach((gm, idx) => {
        const row = document.createElement('div');
        row.className = 'game-row';
        row.innerHTML = `
          <div class="game-title">Satz ${idx+1}</div>
          <div class="stepper">
            <button class="btn-step" onclick="changeAdminScore(${idx}, 'A', -1)">-</button>
            <span class="score-disp" id="adminScoreA_${idx}">${gm.sA}</span>
            <button class="btn-step" onclick="changeAdminScore(${idx}, 'A', 1)">+</button>
          </div>
          <div style="font-weight:bold; color:var(--text-muted);">:</div>
          <div class="stepper">
            <button class="btn-step" onclick="changeAdminScore(${idx}, 'B', -1)">-</button>
            <span class="score-disp" id="adminScoreB_${idx}">${gm.sB}</span>
            <button class="btn-step" onclick="changeAdminScore(${idx}, 'B', 1)">+</button>
          </div>
        `;
        container.appendChild(row);
      });
      updateAdminMatchSummary();
      document.getElementById('adminEditMatchForm').style.display = 'block';
    }

    function changeAdminScore(idx, team, delta) {
      if (team === 'A') {
        currentMatchGames[idx].sA = Math.max(0, currentMatchGames[idx].sA + delta);
        document.getElementById(`adminScoreA_${idx}`).textContent = currentMatchGames[idx].sA;
      } else {
        currentMatchGames[idx].sB = Math.max(0, currentMatchGames[idx].sB + delta);
        document.getElementById(`adminScoreB_${idx}`).textContent = currentMatchGames[idx].sB;
      }
      updateAdminMatchSummary();
    }

    function updateAdminMatchSummary() {
      let pA = 0, pB = 0, stA = 0, stB = 0;
      currentMatchGames.forEach(gm => {
        stA += gm.sA;
        stB += gm.sB;
        if (gm.sA > gm.sB) pA += 2;
        else if (gm.sB > gm.sA) pB += 2;
        else if (gm.sA > 0 || gm.sB > 0) { pA += 1; pB += 1; }
      });
      document.getElementById('adminEditMatchSummary').textContent = `Endstand: Satzpunkte ${pA} : ${pB} (Stöcke ${stA} : ${stB})`;
    }

    function saveAdminMatchCorrection() {
      if (!adminEditingMatchRef) return;
      const { tId, gKey, mId } = adminEditingMatchRef;
      const m = tournaments[tId].groups[gKey].matches[mId];

      let pA = 0, pB = 0, stA = 0, stB = 0;
      currentMatchGames.forEach(gm => {
        stA += gm.sA;
        stB += gm.sB;
        if (gm.sA > gm.sB) pA += 2;
        else if (gm.sB > gm.sA) pB += 2;
        else if (gm.sA > 0 || gm.sB > 0) { pA += 1; pB += 1; }
      });

      m.games = JSON.parse(JSON.stringify(currentMatchGames));
      m.pointsA = pA;
      m.pointsB = pB;
      m.stocksA = stA;
      m.stocksB = stB;
      m.completed = true;

      addHistoryEntry(tId, `Spielkorrektur durchgeführt.`);
      saveData();
      alert("Korrektur gespeichert!");
      document.getElementById('adminEditMatchForm').style.display = 'none';
      loadCompletedMatchesForAdmin();
    }

    function resetAdminMatchToOpen() {
      if (!adminEditingMatchRef) {
        alert("Kein Spiel ausgewählt.");
        return;
      }
      const { tId, gKey, mId } = adminEditingMatchRef;
      if (!tournaments[tId] || !tournaments[tId].groups[gKey] || !tournaments[tId].groups[gKey].matches[mId]) {
        alert("Fehler: Spiel nicht gefunden.");
        return;
      }
      const m = tournaments[tId].groups[gKey].matches[mId];
      
      if (!confirm("Soll dieses Spiel wirklich auf 'Offen' zurückgesetzt werden? Das Ergebnis wird gelöscht und fließt nicht mehr in die Tabelle ein.")) {
        return;
      }

      m.completed = false;
      m.games = [];
      m.pointsA = 0;
      m.pointsB = 0;
      m.stocksA = 0;
      m.stocksB = 0;

      addHistoryEntry(tId, `Spiel auf 'Offen' zurückgesetzt.`);
      saveData();
      alert("Spiel wurde erfolgreich auf 'Offen' zurückgesetzt!");
      document.getElementById('adminEditMatchForm').style.display = 'none';
      loadCompletedMatchesForAdmin();
    }

    function resetAllMatchesForGroup() {
      const tId = document.getElementById('adminSelectTournament').value;
      const gKey = document.getElementById('adminTeamEditGroupSelect').value;
      if (!tId || !gKey) {
        alert("Bitte zuerst ein Turnier und eine Gruppe auswählen.");
        return;
      }
      const groupName = tournaments[tId].groups[gKey].name || gKey;
      if (!confirm(`Soll wirklich der gesamte Spielplan für "${groupName}" zurückgesetzt werden? Alle eingetragenen Ergebnisse gehen verloren!`)) {
        return;
      }

      const g = tournaments[tId].groups[gKey];
      if (g.matches) {
        Object.values(g.matches).forEach(m => {
          m.completed = false;
          m.games = [];
          m.pointsA = 0;
          m.pointsB = 0;
          m.stocksA = 0;
          m.stocksB = 0;
        });
      }

      addHistoryEntry(tId, `Alle Spiele für Gruppe "${groupName}" zurückgesetzt.`);
      saveData();
      alert(`Alle Spiele für "${groupName}" wurden auf Offen zurückgesetzt.`);
    }

    function loadTournamentHistory() {
      const tId = document.getElementById('adminHistorySelectTournament').value;
      const container = document.getElementById('adminHistoryContainer');
      container.innerHTML = '';
      if (!tId || !tournaments[tId]) return;

      const history = tournaments[tId].history || [];
      if (history.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Keine Historie vorhanden.</p>';
        return;
      }

      history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<span style="font-size:0.65rem; color:var(--text-muted);">${item.time}</span><span>${item.text}</span>`;
        container.appendChild(div);
      });
    }

    function loadAdminTournamentData() {
      const tId = document.getElementById('adminSelectTournament').value;
      const body = document.getElementById('adminEditBody');
      if (!tId || !tournaments[tId]) {
        body.style.display = 'none';
        return;
      }
      body.style.display = 'block';
      const t = tournaments[tId];
      document.getElementById('adminEditName').value = t.name || '';
      document.getElementById('adminEditGroupCount').value = String(t.groupCount || Object.keys(t.groups || {}).length || 1);
      document.getElementById('adminEditAdvancing').value = String(t.advancing || 2);
      document.getElementById('adminEditHasKo').checked = !!t.hasKo;
      document.getElementById('adminEditHasReturnLeg').checked = !!t.hasReturnLeg;
      document.getElementById('adminRegenerationNotice').style.display = t.needsRegeneration ? 'block' : 'none';
      
      const groupSel = document.getElementById('adminTeamEditGroupSelect');
      const dqGroupSel = document.getElementById('adminDqGroupSelect');
      groupSel.innerHTML = '<option value="">-- Gruppe wählen --</option>';
      dqGroupSel.innerHTML = '<option value="">-- Gruppe wählen --</option>';

      Object.entries(tournaments[tId].groups).forEach(([gKey, gData]) => {
        groupSel.innerHTML += `<option value="${gKey}">${gData.name || gKey}</option>`;
        dqGroupSel.innerHTML += `<option value="${gKey}">${gData.name || gKey}</option>`;
      });
      document.getElementById('adminTeamEditList').innerHTML = '';
      document.getElementById('adminDqTeamSelect').innerHTML = '<option value="">-- Zuerst Gruppe wählen --</option>';
    }

    function collectCompletedMatchResults(t) {
      const map = new Map();
      Object.values(t.groups || {}).forEach(g => {
        Object.values(g.matches || {}).forEach(m => {
          if (!m.completed) return;
          const a = String(m.teamA), b = String(m.teamB);
          const leg = m.leg || '';
          map.set(`${a}|${b}|${leg}`, JSON.parse(JSON.stringify(m)));
        });
      });
      return map;
    }

    function markTournamentNeedsRegeneration(tId, message) {
      if (!tournaments[tId]) return;
      tournaments[tId].needsRegeneration = true;
      if (message) addHistoryEntry(tId, message);
      const notice = document.getElementById('adminRegenerationNotice');
      if (notice && document.getElementById('adminSelectTournament').value === tId) notice.style.display = 'block';
    }

    function saveTournamentSettings() {
      const tId = document.getElementById('adminSelectTournament').value;
      if (!tId || !tournaments[tId]) return;
      const t = tournaments[tId];
      const newName = document.getElementById('adminEditName').value.trim();
      const newGroupCount = parseInt(document.getElementById('adminEditGroupCount').value);
      const newAdvancing = parseInt(document.getElementById('adminEditAdvancing').value);
      const newHasKo = document.getElementById('adminEditHasKo').checked;
      const newReturnLeg = document.getElementById('adminEditHasReturnLeg').checked;
      if (!newName) { alert('Name darf nicht leer sein.'); return; }

      const oldGroupCount = t.groupCount || Object.keys(t.groups || {}).length || 1;
      const structureChanged = oldGroupCount !== newGroupCount;
      const teamsOrGroupsChanged = structureChanged;

      if (structureChanged) {
        const allTeams = Object.values(t.groups || {}).flatMap(g => g.teams || []);
        const newGroups = {};
        for (let i=0; i<newGroupCount; i++) {
          newGroups[`group_${i+1}`] = {
            name: newGroupCount === 1 ? 'Gruppe 1' : `Gruppe ${String.fromCharCode(65+i)}`,
            teams: []
          };
        }
        allTeams.forEach((team, idx) => {
          newGroups[`group_${(idx % newGroupCount)+1}`].teams.push(team);
        });
        t.groups = newGroups;
        t.groupCount = newGroupCount;
        t.needsRegeneration = true;
      }

      t.name = newName;
      t.advancing = newAdvancing;
      t.hasKo = newHasKo;
      t.hasReturnLeg = newReturnLeg;
      addHistoryEntry(tId, `Turnier-Einstellungen aktualisiert (Aufsteiger: ${newAdvancing}, KO: ${newHasKo ? 'Ja' : 'Nein'}, Rückrunde: ${newReturnLeg ? 'Ja' : 'Nein'}).`);
      if (teamsOrGroupsChanged) {
        addHistoryEntry(tId, 'Gruppenstruktur geändert – Spielplan muss neu generiert werden.');
        document.getElementById('adminRegenerationNotice').style.display = 'block';
        saveData();
        alert('Spielplan muss neu generiert werden. Bitte den Button „Spielplan neu generieren“ verwenden.');
        return;
      }
      saveData();
      populateAdminTournamentList();
      alert('Turnier-Einstellungen gespeichert!');
    }

    function regenerateTournamentFixtures() {
      const tId = document.getElementById('adminSelectTournament').value;
      if (!tId || !tournaments[tId]) return;
      const t = tournaments[tId];

      const pass = prompt('Bitte Admin-Passwort eingeben, um den Spielplan neu zu generieren:');
      if (pass === null) return;
      if (pass !== ADMIN_PASS) { alert('Falsches Admin-Passwort!'); return; }

      const keepPlayed = confirm('Bereits gespielte Spiele behalten?\n\nOK = Ergebnisse behalten\nAbbrechen = Gespielte Spiele löschen');
      const oldResults = keepPlayed ? collectCompletedMatchResults(t) : new Map();
      const hasReturnLeg = document.getElementById('adminEditHasReturnLeg').checked;
      t.hasReturnLeg = hasReturnLeg;

      Object.entries(t.groups || {}).forEach(([gKey, g]) => {
        const fresh = generateFixturesForTeams(g.teams || [], hasReturnLeg);
        Object.entries(fresh).forEach(([mId, m]) => {
          const key = `${String(m.teamA)}|${String(m.teamB)}|${m.leg || ''}`;
          const saved = oldResults.get(key);
          if (saved) fresh[mId] = { ...m, ...saved, teamA:m.teamA, teamB:m.teamB, leg:m.leg || saved.leg };
        });
        g.matches = fresh;
      });

      t.needsRegeneration = false;
      addHistoryEntry(tId, `Spielplan neu generiert (${keepPlayed ? 'gespielte Ergebnisse behalten' : 'gespielte Ergebnisse gelöscht'}).`);
      saveData();
      document.getElementById('adminRegenerationNotice').style.display = 'none';
      alert('Spielplan erfolgreich neu generiert!');
      loadAdminTournamentData();
    }

    function loadAdminTeamsForGroup() {
      const tId = document.getElementById('adminSelectTournament').value;
      const gKey = document.getElementById('adminTeamEditGroupSelect').value;
      const list = document.getElementById('adminTeamEditList');
      list.innerHTML = '';
      if (!tId || !gKey) return;

      const g = tournaments[tId].groups[gKey];
      (g.teams || []).forEach(tm => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '4px';
        div.style.marginBottom = '4px';
        div.innerHTML = `
          <input type="text" value="${tm.name}" id="teamName_${tm.id}" style="margin-bottom:0;">
          <button class="btn btn-success" style="width:auto; padding:4px 8px; margin:0;" onclick="updateTeamName('${gKey}', ${tm.id})">💾</button>
          <button class="btn btn-danger" style="width:auto; padding:4px 8px; margin:0;" onclick="deleteTeamFromGroup('${gKey}', ${tm.id})">🗑️</button>
        `;
        list.appendChild(div);
      });
    }

    function updateTeamName(gKey, teamId) {
      const tId = document.getElementById('adminSelectTournament').value;
      const input = document.getElementById(`teamName_${teamId}`);
      if (!input) return;
      const newName = input.value.trim();
      if (!newName) return;

      const g = tournaments[tId].groups[gKey];
      const tm = g.teams.find(x => x.id == teamId);
      if (tm) {
        tm.name = newName;
        markTournamentNeedsRegeneration(tId, `Team-Name aktualisiert zu "${newName}" – Spielplan muss neu generiert werden.`);
        addHistoryEntry(tId, `Team-Name aktualisiert zu "${newName}"`);
        saveData();
        alert("Name aktualisiert!");
      }
    }

    function addNewTeamToGroup() {
      const tId = document.getElementById('adminSelectTournament').value;
      const gKey = document.getElementById('adminTeamEditGroupSelect').value;
      const input = document.getElementById('adminNewTeamInput');
      const name = input.value.trim();
      if (!tId || !gKey || !name) return;

      const g = tournaments[tId].groups[gKey];
      g.teams ||= [];
      const newId = Date.now();
      g.teams.push({ id: newId, name });
      input.value = '';
      markTournamentNeedsRegeneration(tId, `Neues Team "${name}" hinzugefügt – Spielplan muss neu generiert werden.`);
      addHistoryEntry(tId, `Neues Team "${name}" hinzugefügt.`);
      saveData();
      loadAdminTeamsForGroup();
    }

    function deleteTeamFromGroup(gKey, teamId) {
      if (!confirm("Team wirklich löschen?")) return;
      const tId = document.getElementById('adminSelectTournament').value;
      const g = tournaments[tId].groups[gKey];
      g.teams = g.teams.filter(x => x.id != teamId);
      markTournamentNeedsRegeneration(tId, 'Team gelöscht – Spielplan muss neu generiert werden.');
      addHistoryEntry(tId, `Team gelöscht.`);
      saveData();
      loadAdminTeamsForGroup();
    }

    function loadDqTeamsList() {
      const tId = document.getElementById('adminSelectTournament').value;
      const gKey = document.getElementById('adminDqGroupSelect').value;
      const teamSel = document.getElementById('adminDqTeamSelect');
      teamSel.innerHTML = '<option value="">-- Mannschaft wählen --</option>';
      if (!tId || !gKey) return;

      const g = tournaments[tId].groups[gKey];
      (g.teams || []).forEach(tm => {
        let status = tm.dq ? ' (DQ)' : tm.dnf ? ' (DNF)' : '';
        const o = document.createElement('option');
        o.value = tm.id; o.textContent = tm.name + status;
        teamSel.appendChild(o);
      });
    }

    // V2.9.22: DQ/DNF gilt rückwirkend für alle Paarungen der Gruppe.
    // Originalergebnisse bleiben im Datensatz, um eine Rücknahme zu ermöglichen.
    function cupApplyForfeitResults(group) {
      const teamById=new Map((group.teams||[]).map(t=>[String(t.id),t]));
      Object.values(group.matches||{}).forEach(m=>{
        if(m._dqOriginal){
          const saved=m._dqOriginal;
          ['completed','games','pointsA','pointsB','stocksA','stocksB'].forEach(k=>{
            if(Object.prototype.hasOwnProperty.call(saved,k))m[k]=JSON.parse(JSON.stringify(saved[k]));
            else delete m[k];
          });
          delete m._dqOriginal;
          delete m.forfeit;
        }
        const a=teamById.get(String(m.teamA)),b=teamById.get(String(m.teamB));
        if(!a||!b)return;
        const outA=!!(a.dq||a.dnf),outB=!!(b.dq||b.dnf);
        if(!outA&&!outB)return;
        const original={};
        ['completed','games','pointsA','pointsB','stocksA','stocksB'].forEach(k=>{
          if(Object.prototype.hasOwnProperty.call(m,k))original[k]=JSON.parse(JSON.stringify(m[k]));
        });
        m._dqOriginal=original;
        m.completed=true;
        const originalGames=Array.isArray(original.games)?original.games:[];
        const sets=Math.max(1,originalGames.length,Number(group.setsPerMatch||group.satzAnzahl||group.numberOfGames||0)||0);
        m.games=Array.from({length:sets},()=>({sA:outA?0:1,sB:outB?0:1}));
        m.pointsA=outA?0:2;m.pointsB=outB?0:2;
        m.stocksA=0;m.stocksB=0;
        m.forfeit=outA&&outB?'DQ/DNF beide':outA?(a.dq?'DQ':'DNF'):(b.dq?'DQ':'DNF');
      });
    }

    function disqualifyTeamAction() {
      const tId = document.getElementById('adminSelectTournament').value;
      const gKey = document.getElementById('adminDqGroupSelect').value;
      const teamId = document.getElementById('adminDqTeamSelect').value;
      const type = document.getElementById('adminDqTypeSelect').value;
      if (!tId || !gKey || !teamId) return;

      const g = tournaments[tId].groups[gKey];
      const tm = g.teams.find(x => x.id == teamId);
      if (!tm) return;

      tm.dq = (type === 'DQ');
      tm.dnf = (type === 'DNF');
      cupApplyForfeitResults(g);
      addHistoryEntry(tId, `Team "${tm.name}" Status gesetzt auf ${type}`);
      saveData();
      alert(`Status ${type} gesetzt!`);
      loadDqTeamsList();
    }

    function removeDisqualificationAction() {
      const tId = document.getElementById('adminSelectTournament').value;
      const gKey = document.getElementById('adminDqGroupSelect').value;
      const teamId = document.getElementById('adminDqTeamSelect').value;
      if (!tId || !gKey || !teamId) return;

      const g = tournaments[tId].groups[gKey];
      const tm = g.teams.find(x => x.id == teamId);
      if (!tm) return;

      tm.dq = false;
      tm.dnf = false;
      cupApplyForfeitResults(g);
      addHistoryEntry(tId, `Team "${tm.name}" Status aufgehoben.`);
      saveData();
      alert("Status aufgehoben!");
      loadDqTeamsList();
    }

    async function deleteTournament() {
      const select = document.getElementById('adminSelectTournament');
      const tId = select?.value;
      if (!tId || !tournaments[tId]) {
        alert('Bitte zuerst unter Verwaltung einen Cup auswählen.');
        return;
      }
      const cupName = tournaments[tId].name || tId;
      if (!confirm(`Turnier "${cupName}" wirklich unwiderruflich löschen?\n\nEs wird nur der ausgewählte Cup gelöscht, auch wenn weitere Cups gleich heißen.`)) return;

      const backup = tournaments[tId];
      const btn = document.getElementById('cupDeleteTournamentBtn');
      if (btn) btn.disabled = true;
      delete tournaments[tId];
      try {
        const saved = await saveData();
        if (!saved) {
          tournaments[tId] = backup;
          alert('Löschen fehlgeschlagen. Der Cup wurde nicht dauerhaft entfernt. Bitte die Firebase-Fehlermeldung beachten.');
          return;
        }
        if (activeId === tId) {
          activeId = null;
          activeGroup = null;
          activeKoStage = null;
        }
        renderMainButtons();
        populateAdminTournamentList();
        populateAdminPrintList();
        populateAdminMatchEditTournaments();
        populateAdminHistoryTournaments();
        alert(`Cup "${cupName}" wurde erfolgreich gelöscht.`);
        goToMainMenu();
      } catch (err) {
        tournaments[tId] = backup;
        console.error('Cup löschen:', err);
        alert('Löschen fehlgeschlagen: ' + (err?.message || err));
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    function onPrintTournamentChanged() {
      const tId = document.getElementById('adminPrintSelectTournament').value;
      const content = document.getElementById('adminPrintContent');
      const list = document.getElementById('printMatchList');
      if (!tId || !tournaments[tId]) {
        content.style.display = 'none';
        return;
      }
      content.style.display = 'block';
      
      const t = tournaments[tId];
      
      cupSortedGroups(t.groups).forEach(([gKey, gData]) => {
        if (!gData.matches || Object.keys(gData.matches).length === 0) {
          if (gData.teams && gData.teams.length >= 2) {
            gData.matches = generateFixturesForTeams(gData.teams, !!t.hasReturnLeg);
          }
        }
      });

      let html = '';
      cupSortedGroups(t.groups).forEach(([gKey, gData]) => {
        if (gData.matches) {
          Object.entries(gData.matches).forEach(([mId, m]) => {
            const tA = gData.teams.find(x => x.id == m.teamA)?.name || 'Team A';
            const tB = gData.teams.find(x => x.id == m.teamB)?.name || 'Team B';
            const state = m.completed ? ' (Gespielt)' : ' (Offen)';
            html += `
              <div class="match-checkbox-item">
                <input type="checkbox" class="print-match-cb" data-t="${tId}" data-g="${gKey}" data-m="${mId}" checked>
                <span>[${gData.name || gKey}] ${tA} vs. ${tB}${state}</span>
              </div>
            `;
          });
        }
      });
      list.innerHTML = html || '<p style="color:var(--text-muted); text-align:center; padding:10px;">Keine Spiele vorhanden.</p>';
    }

    function toggleAllMatchesPrint(select) {
      document.querySelectorAll('.print-match-cb').forEach(cb => cb.checked = select);
    }

    function triggerPrintSelected() {
      const printArea = document.getElementById('printArea');
      printArea.innerHTML = '';

      const checkedBoxes = document.querySelectorAll('.print-match-cb:checked');
      if (checkedBoxes.length === 0) {
        alert("Bitte mindestens ein Spiel zum Drucken auswählen.");
        return;
      }

      let boxesArray = Array.from(checkedBoxes);
      for (let i = 0; i < boxesArray.length; i += 2) {
        let pageSlice = boxesArray.slice(i, i + 2);
        
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'print-page-wrapper';

        pageSlice.forEach((cb, subIndex) => {
          const tId = cb.getAttribute('data-t');
          const gKey = cb.getAttribute('data-g');
          const mId = cb.getAttribute('data-m');

          const t = tournaments[tId];
          const g = t.groups[gKey];
          const m = g.matches[mId];

          const tA = g.teams.find(x => x.id == m.teamA)?.name || 'Team A';
          const tB = g.teams.find(x => x.id == m.teamB)?.name || 'Team B';
          const tourneyName = t.name || 'Turnierauswertung';
          
          const totalSets = parseInt(t.totalSets) || 5;
          const dynamicRowHeight = totalSets >= 5 ? Math.max(16, Math.floor(180 / (totalSets + 2))) + 'px' : '28px';

          const sheet = document.createElement('div');
          sheet.className = 'protocol-container';
          sheet.style.setProperty('--row-height', dynamicRowHeight);
          sheet.innerHTML = `
            <table>
              <thead>
                <tr class="print-header-row">
                  <td colspan="5" class="print-spielnummer">Spiel-Nr.: ${i + subIndex + 1}</td>
                  <td colspan="9" class="print-tourney-title">${tourneyName}</td>
                  <td colspan="5" class="print-datum">Datum: ........................</td>
                </tr>
                <tr>
                  <td colspan="10" class="teams-row home-team">Heimmannschaft: <b>${tA}</b></td>
                  <td colspan="9" class="teams-row">Auswärtsmannschaft: <b>${tB}</b></td>
                </tr>
                <tr class="subheader">
                  <td rowspan="2" class="durchgang-col">Durchg.</td>
                  <td rowspan="2" class="anschuss-col">Ansch.</td>
                  <td colspan="6">${tA} (Kehren 1-6)</td>
                  <td rowspan="2" class="stock-sum-col">Ges.-<br>stöcke</td>
                  <td rowspan="2" class="spielpunkte-col">Spiel-<br>punkte</td>
                  <td rowspan="2" class="anschuss-col">Ansch.</td>
                  <td colspan="6">${tB} (Kehren 1-6)</td>
                  <td rowspan="2" class="stock-sum-col">Ges.-<br>stöcke</td>
                  <td rowspan="2" class="spielpunkte-col">Spiel-<br>punkte</td>
                </tr>
                <tr class="subheader">
                  <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td>
                  <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                   let rowsHTML = '';
                   for (let sIdx = 0; sIdx < totalSets; sIdx++) {
                     const anschussA = (sIdx % 2 === 0) ? 'X' : '';
                     const anschussB = (sIdx % 2 === 0) ? '' : 'X';
                     rowsHTML += `
                        <tr>
                          <td class="durchgang-col" style="font-weight: bold;">${sIdx + 1}</td>
                          <td class="anschuss-col" style="font-weight: bold; font-size: 6pt;">${anschussA}</td>
                          <td class="kehre-col"></td><td class="kehre-col"></td><td class="kehre-col"></td><td class="kehre-col"></td><td class="kehre-col"></td><td class="kehre-col"></td>
                          <td class="stock-sum-col"></td>
                          <td class="spielpunkte-col"></td>
                          <td class="anschuss-col" style="font-weight: bold; font-size: 6pt;">${anschussB}</td>
                          <td class="kehre-col"></td><td class="kehre-col"></td><td class="kehre-col"></td><td class="kehre-col"></td><td class="kehre-col"></td><td class="kehre-col"></td>
                          <td class="stock-sum-col"></td>
                          <td class="spielpunkte-col"></td>
                        </tr>
                     `;
                   }
                   return rowsHTML;
                })()}
                <tr class="sum-row">
                  <td colspan="8" style="text-align: right; padding-right: 4px;">Gesamtsumme Stock- und Spielpunkte:</td>
                  <td class="stock-sum-col"></td>
                  <td class="spielpunkte-col"></td>
                  <td colspan="7" style="text-align: right; padding-right: 4px;">Gesamtsumme Stock- und Spielpunkte:</td>
                  <td class="stock-sum-col"></td>
                  <td class="spielpunkte-col"></td>
                </tr>
                <tr class="footer-section">
                  <td colspan="10" style="border-top: none; padding: 1px 3px;">
                    Unterschrift: <span style="font-weight: bold;">${tA}</span>
                  </td>
                  <td colspan="9" style="border-top: none; padding: 1px 3px;">
                    Unterschrift: <span style="font-weight: bold;">${tB}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          `;
          pageWrapper.appendChild(sheet);
        });

        printArea.appendChild(pageWrapper);
      }

      window.print();
    }
  