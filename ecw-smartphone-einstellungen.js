(() => {
  'use strict';
  const groups = {
    members: {
      title: 'Mitglieder',
      qr: 'members',
      items: {
        reservation: 'Reservierungssystem', planner: 'Terminplaner', hall: 'Halle',
        games: 'Spiele', tables: 'Tabellen', solo: 'Solo Pyramide'
      }
    },
    admin: {
      title: 'Verwaltung',
      qr: 'admin',
      items: {
        tileTv: 'Turnierverwaltung', tilePlanner: 'Turnier / Termin anlegen',
        tileBoardPoint: 'Vorstandssitzung', tileWorkPoint: 'Arbeitseinsatz',
        tileNews: 'Vereinsnachrichten', tileCup: 'Interne Cup',
        tileJm: 'Ziel Jahresmeisterschaft', tileTechnik: 'Technik'
      }
    }
  };
  const documentName = 'smartphoneNavigation';

  function visible(settings, group, key) {
    return settings?.[group]?.[key] !== false;
  }

  function applyMembers(settings) {
    document.querySelectorAll('#menu [data-mobile-feature]').forEach(button => {
      button.hidden = !visible(settings, 'members', button.dataset.mobileFeature);
    });
  }

  function applyAdmin(settings) {
    for (const id of Object.keys(groups.admin.items)) {
      const tile = document.getElementById(id);
      if (tile) tile.hidden = !visible(settings, 'admin', id);
    }
    const more = document.getElementById('tileMore');
    if (more) more.hidden = ['tileNews', 'tileJm', 'tileCup'].every(id => !visible(settings, 'admin', id));
  }

  function settingsRef(db) {
    return db.collection('appSettings').doc(documentName);
  }

  async function open() {
    if (!firebaseAuthUser || appPermissions.admin !== true || isWhiteboardUser()) {
      showToast('Dieser Bereich ist nur für Administratoren freigegeben.');
      return;
    }
    const host = document.getElementById('adminMain');
    const uid = firebaseAuthUser.uid;
    if (typeof unloadMvAdmin === 'function') unloadMvAdmin();
    window.__adminBack = null;
    host.classList.remove('mv-mode');
    host.innerHTML = '<h2>Smartphonezugänge</h2><form id="smartphone-settings-form"><p>Funktionen einblenden. Benutzerrechte werden separat verwaltet.</p><div id="smartphone-settings-groups" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px"></div><p><button type="submit" disabled>Speichern</button></p><p id="smartphone-settings-status" role="status">Einstellungen werden geladen …</p></form>';
    const form = host.querySelector('form');
    const status = form.querySelector('[role="status"]');
    const save = form.querySelector('button');
    try {
      const ref = settingsRef(firestoreDb);
      const snapshot = await ref.get({source:'server'});
      if (!form.isConnected || firebaseAuthUser?.uid !== uid) return;
      const settings = snapshot.data();
      const controls = {};
      for (const [key, group] of Object.entries(groups)) {
        const box = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = group.title;
        box.append(legend);
        const qr = document.createElement('a');
        qr.href = 'mobile-zugang.html?qr=1&zugang=' + group.qr;
        qr.target = '_blank';
        qr.rel = 'noopener';
        qr.textContent = 'QR-Code zur Anmeldung öffnen';
        box.append(qr);
        controls[key] = {};
        for (const [id, title] of Object.entries(group.items)) {
          const label = document.createElement('label');
          label.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.style.width = 'auto';
          checkbox.checked = visible(settings, key, id);
          label.append(checkbox, title);
          box.append(label);
          controls[key][id] = checkbox;
        }
        form.querySelector('#smartphone-settings-groups').append(box);
      }
      status.textContent = '';
      save.disabled = false;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (firebaseAuthUser?.uid !== uid || appPermissions.admin !== true) return;
        save.disabled = true;
        status.textContent = 'Wird gespeichert …';
        try {
          const settings = Object.fromEntries(Object.entries(controls).map(([key, items]) => [
            key, Object.fromEntries(Object.entries(items).map(([id, control]) => [id, control.checked]))
          ]));
          await ref.set(settings, {merge:true});
          status.textContent = 'Gespeichert. Die Smartphonezugänge übernehmen die Auswahl beim nächsten Öffnen.';
        } catch {
          status.textContent = 'Die Einstellungen konnten nicht gespeichert werden.';
        } finally {
          save.disabled = false;
        }
      });
    } catch {
      status.textContent = 'Die Einstellungen konnten nicht geladen werden.';
    }
  }

  window.ECWSmartphoneNavigation = {documentName, settingsRef, applyMembers, applyAdmin, open};
})();
