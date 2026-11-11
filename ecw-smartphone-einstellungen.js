(() => {
  'use strict';
  const groups = {
    members: {
      title: 'Mitglieder',
      qr: 'members',
      entry: 'smartphone-mitglieder.html',
      items: {
        reservation: 'Reservierungssystem', planner: 'Terminplaner', hall: 'Halle',
        games: 'Spiele', tables: 'Tabellen', solo: 'Solo Pyramide'
      }
    },
    admin: {
      title: 'Verwaltung',
      qr: 'admin',
      entry: 'mobile-zugang.html?v=2.5.2',
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

  function linkUrl(value) {
    try {
      const address = String(value || '').trim();
      if (!address) return '';
      const url = new URL(address, location.href);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch {}
    return '';
  }

  function readLinks(settings, group) {
    const links = settings?.customLinks?.[group];
    return Array.isArray(links) ? links : [];
  }

  function renderLinks(host, settings, group, className) {
    if (!host) return;
    host.querySelectorAll('[data-smartphone-custom]').forEach(link => link.remove());
    for (const item of readLinks(settings, group)) {
      const url = linkUrl(item?.url);
      if (!url || !item.title || item.visible === false) continue;
      const link = document.createElement('a');
      link.dataset.smartphoneCustom = '';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = className;
      link.textContent = item.title;
      if (item.requiresLogin) link.append(' · Anmeldung auf Zielseite');
      host.append(link);
    }
  }

  function startPageLinks(buttons, parent = '') {
    const pages = [];
    for (const button of buttons || []) {
      const title = String(button.t || '').replace(/\s+/g, ' ').trim();
      const label = parent ? parent + ' › ' + title : title;
      if (Array.isArray(button.sub) && button.sub.length) {
        pages.push(...startPageLinks(button.sub, label));
        continue;
      }
      const href = linkUrl(ecwRebaseLocalTournamentUrl(shSafeUrl(button.u)));
      if (title && href && !/#(?:ecw-ergebnisse|ecw-nuetzliches-links)$/.test(href)) pages.push({title, label, href});
    }
    return pages;
  }

  function addLinkEditor(container, item = {}, pages = []) {
    const row = document.createElement('fieldset');
    row.dataset.linkEditor = '';
    row.style.cssText = 'display:grid;gap:6px;margin:8px 0;min-width:0';
    row.innerHTML = '<label>Name des Menüpunkts <input name="title" maxlength="100" required></label><label>Link <input name="url" type="url" placeholder="https://" maxlength="2048" required></label><label><input name="visible" type="checkbox"> Anzeigen</label><label><input name="requiresLogin" type="checkbox"> Zielseite verlangt Anmeldung</label><button type="button">Entfernen</button>';
    const field = name => row.querySelector('[name="' + name + '"]');
    field('title').value = item.title || '';
    field('url').value = item.url || '';
    field('visible').checked = item.visible !== false;
    field('requiresLogin').checked = item.requiresLogin === true;
    const label = document.createElement('label');
    const select = document.createElement('select');
    select.append(new Option('Eigener Link', ''));
    pages.forEach((page, index) => select.append(new Option(page.label, String(index))));
    const selected = pages.findIndex(page => page.href === item.url);
    if (selected >= 0) select.value = String(selected);
    select.addEventListener('change', () => {
      if (!select.value) return;
      const page = pages[Number(select.value)];
      field('title').value = page.title;
      field('url').value = page.href;
    });
    label.append('Seite der Vereinsstartseite ', select);
    row.prepend(label);
    row.querySelector('button').addEventListener('click', () => row.remove());
    container.append(row);
    return field('title');
  }

  function applyMembers(settings) {
    document.querySelectorAll('#menu [data-mobile-feature]').forEach(button => {
      button.hidden = !visible(settings, 'members', button.dataset.mobileFeature);
    });
    renderLinks(document.querySelector('#menu nav'), settings, 'members', 'reservation-link');
  }

  function applyAdmin(settings) {
    for (const id of Object.keys(groups.admin.items)) {
      const tile = document.getElementById(id);
      if (tile) tile.hidden = !visible(settings, 'admin', id);
    }
    renderLinks(document.getElementById('tileTv')?.parentElement, settings, 'admin', 'tile');
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
    host.innerHTML = '<h2>Smartphonezugänge</h2><form id="smartphone-settings-form"><p>Funktionen einblenden oder eigene Links hinzufügen. Die Option „Zielseite verlangt Anmeldung“ zeigt einen Hinweis im Menü. Das Passwort prüft die Zielseite.</p><div id="smartphone-settings-groups" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px"></div><p><button type="submit" disabled>Speichern</button></p><p id="smartphone-settings-status" role="status">Einstellungen werden geladen …</p></form>';
    const qrSection = document.createElement('section');
    const qrHeading = document.createElement('h3');
    qrHeading.textContent = 'QR-Codes zur Anmeldung';
    const qrGrid = document.createElement('div');
    qrGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px';
    for (const group of Object.values(groups)) {
      const card = document.createElement('div');
      const label = document.createElement('h4');
      label.textContent = group.title;
      const frame = document.createElement('iframe');
      frame.title = 'QR-Code · ' + group.title;
      frame.src = 'mobile-zugang.html?qr=1&kompakt=1&zugang=' + group.qr;
      frame.loading = 'lazy';
      frame.style.cssText = 'display:block;border:0;width:100%;height:214px';
      card.append(label, frame);
      qrGrid.append(card);
    }
    qrSection.append(qrHeading, qrGrid);
    host.append(qrSection);
    const form = host.querySelector('form');
    const status = form.querySelector('[role="status"]');
    const save = form.querySelector('button');
    try {
      const ref = settingsRef(firestoreDb);
      const snapshot = await ref.get({source:'server'});
      if (!form.isConnected || firebaseAuthUser?.uid !== uid) return;
      const settings = snapshot.data();
      const controls = {};
      const editors = {};
      const pages = startPageLinks(typeof SH !== 'undefined' ? SH.buttons : []);
      for (const [key, group] of Object.entries(groups)) {
        const box = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = group.title;
        box.append(legend);
        const entry = document.createElement('a');
        entry.href = new URL(group.entry, location.href).href;
        entry.textContent = entry.href;
        entry.target = '_blank';
        entry.rel = 'noopener';
        entry.style.cssText = 'display:block;overflow-wrap:anywhere;margin:6px 0';
        box.append(entry);
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
        const links = document.createElement('div');
        const add = document.createElement('button');
        add.type = 'button';
        add.textContent = '+ Menüpunkt hinzufügen';
        add.addEventListener('click', () => addLinkEditor(links, {}, pages).focus());
        for (const link of readLinks(settings, key)) addLinkEditor(links, link, pages);
        editors[key] = links;
        box.append(links, add);
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
          settings.customLinks = {};
          for (const [key, editor] of Object.entries(editors)) {
            settings.customLinks[key] = [];
            for (const row of editor.querySelectorAll('[data-link-editor]')) {
              const field = name => row.querySelector('[name="' + name + '"]');
              const title = field('title').value.trim();
              const url = linkUrl(field('url').value);
              if (!title || !url) {
                status.textContent = 'Bitte einen Namen und einen gültigen HTTPS-Link ohne Zugangsdaten eingeben.';
                (!title ? field('title') : field('url')).focus();
                return;
              }
              settings.customLinks[key].push({
                title, url, visible: field('visible').checked, requiresLogin: field('requiresLogin').checked
              });
            }
          }
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
