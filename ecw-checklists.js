function openECWChecklists() {
  if (appPermissions.admin !== true || isWhiteboardUser()) return;
  const main = document.getElementById('adminMain');
  main.innerHTML = '<h2>To-do- und Testliste</h2><p role="status"></p><div></div>';
  const message = main.querySelector('[role="status"]');
  const content = message.nextElementSibling;
  const account = firebaseAuth?.currentUser?.uid;
  if (!firestoreDb || !account) {
    message.textContent = 'Firebase-Anmeldung erforderlich.';
    return;
  }

  const ref = firestoreDb.collection('adminChecklists').doc('state');
  const statuses = ['Offen', 'In Arbeit', 'Nachprüfung'];
  const listNames = {topics: 'To-do-Liste', tests: 'Testliste'};
  let busy = false;
  const active = () => content.isConnected && firebaseAuth.currentUser?.uid === account
    && appPermissions.admin === true && !isWhiteboardUser();

  function element(tag, text, parent) {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.append(node);
    return node;
  }

  async function save(change) {
    if (busy || !active()) return;
    busy = true;
    message.textContent = 'Wird gespeichert …';
    try {
      const updated = await firestoreDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const data = change(snapshot.exists ? snapshot.data() : null);
        transaction.set(ref, data);
        return data;
      });
      if (active()) {
        render(updated);
        message.textContent = 'Gespeichert.';
      }
    } catch (error) {
      if (active()) message.textContent = 'Speichern fehlgeschlagen. ' + (error.message || '');
    } finally {
      busy = false;
    }
  }

  function updateList(kind, change) {
    return save(data => {
      if (!data) throw new Error('Die Liste fehlt. Bitte öffne sie erneut.');
      return {...data, [kind]: change(data[kind])};
    });
  }

  function render(data) {
    content.replaceChildren();
    if (!data) {
      const label = element('label', 'Startbestand aus JSON laden', content);
      const input = element('input', '', label);
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        if (!input.files.length) return;
        try {
          const imported = JSON.parse(await input.files[0].text());
          const lists = Object.fromEntries(Object.keys(listNames).map(kind => {
            if (!Array.isArray(imported[kind]) || imported[kind].length > 100) {
              throw new Error('Ungültige Liste.');
            }
            const items = imported[kind].map(({title, description, status}) => {
              if (typeof title !== 'string' || !title.trim() || title.length > 120 ||
                  typeof description !== 'string' || description.length > 600 || !statuses[status]) {
                throw new Error('Ungültiger Eintrag.');
              }
              return {id: crypto.randomUUID(), title, description, status: Number(status)};
            });
            return [kind, items];
          }));
          await save(current => {
            if (current) throw new Error('Der Startbestand wurde bereits angelegt. Bitte öffne die Liste erneut.');
            return lists;
          });
        } catch (error) {
          message.textContent = 'Import fehlgeschlagen. ' + error.message;
        } finally {
          input.value = '';
        }
      };
      const startEmpty = element('button', 'Mit leeren Listen starten', content);
      startEmpty.onclick = () => save(current => {
        if (current) throw new Error('Die Listen wurden bereits angelegt. Bitte öffne sie erneut.');
        return {topics: [], tests: []};
      });
      return;
    }

    for (const [kind, label] of Object.entries(listNames)) {
      const section = element('section', '', content);
      element('h3', label, section);
      const details = element('details', '', section);
      element('summary', 'Punkt hinzufügen', details);
      const form = element('form', '', details);
      const title = element('input', '', element('label', 'Titel', form));
      title.required = true;
      title.maxLength = 120;
      const description = element('textarea', '', element('label', 'Kurze Erklärung', form));
      description.maxLength = 600;
      element('button', 'Hinzufügen', form).type = 'submit';
      form.onsubmit = event => {
        event.preventDefault();
        if (!title.value.trim()) return;
        const item = {id: crypto.randomUUID(), title: title.value.trim(),
          description: description.value.trim(), status: 0};
        void updateList(kind, items => {
          if (items.length >= 100) throw new Error('Die Liste enthält bereits 100 Punkte.');
          return [...items, item];
        });
      };

      const board = element('div', '', section);
      board.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px';
      const lanes = statuses.map(status => {
        const lane = element('section', '', board);
        element('h4', status, lane);
        return lane;
      });
      for (const item of data[kind]) {
        const card = element('article', '', lanes[item.status]);
        card.className = 'card';
        card.style.overflowWrap = 'anywhere';
        element('strong', item.title, card);
        if (item.description) element('p', item.description, card);
        const select = element('select', '', card);
        select.setAttribute('aria-label', 'Status für ' + item.title);
        statuses.forEach((status, index) => select.add(new Option(status, index)));
        select.value = item.status;
        select.onchange = () => {
          const status = Number(select.value);
          select.value = item.status;
          void updateList(kind, items => items.map(entry =>
            entry.id === item.id ? {...entry, status} : entry));
        };
        const remove = element('button', 'Löschen', card);
        remove.type = 'button';
        remove.onclick = () => {
          if (window.confirm('„' + item.title + '“ löschen?')) {
            void updateList(kind, items => items.filter(entry => entry.id !== item.id));
          }
        };
      }
    }
  }

  message.textContent = 'Listen werden geladen …';
  ref.get({source: 'server'}).then(snapshot => {
    if (!active()) return;
    render(snapshot.exists ? snapshot.data() : null);
    message.textContent = '';
  }).catch(error => {
    if (active()) message.textContent = 'Listen konnten nicht geladen werden. ' + (error.message || '');
  });
}
