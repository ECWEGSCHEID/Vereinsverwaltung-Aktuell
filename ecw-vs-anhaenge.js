/* Dokumente und Bilder zu einzelnen Punkten (Vorstandssitzung, Mannschaftssitzung, Arbeitseinsätze).
   Die Datei selbst liegt im Browser-Dateispeicher (IndexedDB ecw_year_files_v1, Bereich „files“)
   und wird mit der Versammlungs-Sicherung nach Firebase übertragen. Am Punkt steht nur die Beschreibung
   {id, name, type, size}. Bilder werden vor dem Speichern verkleinert, damit die Sicherung klein bleibt. */
(function () {
  'use strict';

  const DB_NAME = 'ecw_year_files_v1';
  const MAX_DOC = 4 * 1024 * 1024;      // PDF / Office-Dokumente
  const IMAGE_MAX_SIDE = 1600;
  const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
  const hosts = {};
  const urlCache = new Map();

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const d = request.result;
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
        if (!d.objectStoreNames.contains('archives')) d.createObjectStore('archives', {keyPath: 'id'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function store(mode, action) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('files', mode);
      const result = action(tx.objectStore('files'));
      tx.oncomplete = () => { d.close(); resolve(result?.result); };
      tx.onabort = tx.onerror = () => { d.close(); reject(tx.error || new Error('Dateispeicher nicht verfügbar.')); };
    });
  }
  const putFile = (id, blob) => store('readwrite', s => s.put(blob, id));
  const getFile = id => store('readonly', s => s.get(id));
  const deleteFile = id => store('readwrite', s => s.delete(id));

  async function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'}); } catch { return file; }
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', {type: 'image/jpeg'});
  }

  function sizeText(bytes) {
    return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  // HTML-Block für einen Punkt. scope = 'board' | 'team' | 'work', key = Punkt-ID bzw. Index.
  function block(scope, key, list, editable) {
    const items = Array.isArray(list) ? list : [];
    if (!items.length && !editable) return '';
    const chips = items.map(a => {
      const image = /^image\//.test(a.type);
      return `<span class="ecw-att">`
        + `<button type="button" class="ecw-att-open" data-att-open="${esc(a.id)}" title="${esc(a.name)} öffnen">`
        + (image ? `<img alt="" data-att-thumb="${esc(a.id)}">` : '<span class="ecw-att-icon" aria-hidden="true">📄</span>')
        + `<span class="ecw-att-name">${esc(a.name)}</span></button>`
        + (editable ? `<button type="button" class="ecw-att-del no-print" aria-label="${esc(a.name)} entfernen" data-att-del="${esc(a.id)}" data-att-scope="${scope}" data-att-key="${esc(key)}">✕</button>` : '')
        + `</span>`;
    }).join('');
    const add = editable
      ? `<label class="btn ecw-att-add no-print">📎 Dokument / Bild<input type="file" multiple accept="${ACCEPT}" data-att-add data-att-scope="${scope}" data-att-key="${esc(key)}" hidden></label>`
      : '';
    return `<div class="ecw-att-list">${chips}${add}</div>`;
  }

  async function loadThumbs(root = document) {
    for (const img of root.querySelectorAll('img[data-att-thumb]:not([src])')) {
      const id = img.dataset.attThumb;
      try {
        let url = urlCache.get(id);
        if (!url) {
          const blob = await getFile(id);
          if (!blob) { img.replaceWith(Object.assign(document.createElement('span'), {className: 'ecw-att-icon', textContent: '⚠'})); continue; }
          url = URL.createObjectURL(blob);
          urlCache.set(id, url);
        }
        img.src = url;
      } catch { /* Vorschau ist optional */ }
    }
  }

  async function addFiles(scope, key, files) {
    const host = hosts[scope];
    if (!host) return;
    const added = [];
    for (const original of files) {
      const file = await shrinkImage(original);
      if (!/^image\//.test(file.type) && file.size > MAX_DOC) {
        alert(`„${original.name}“ ist ${sizeText(file.size)} groß. Dokumente dürfen höchstens ${sizeText(MAX_DOC)} haben, damit die gemeinsame Sicherung klein bleibt.`);
        continue;
      }
      const id = 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      await putFile(id, file);
      added.push({id, name: file.name, type: file.type || 'application/octet-stream', size: file.size, added: new Date().toISOString()});
    }
    if (added.length && host.add(key, added) === false) {
      for (const a of added) await deleteFile(a.id).catch(() => {});
    }
  }

  async function openFile(id, name) {
    const blob = await getFile(id);
    if (!blob) { alert('Die Datei ist auf diesem Gerät noch nicht vorhanden. Bitte kurz warten, bis der Firebase-Abgleich fertig ist, und erneut versuchen.'); return; }
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url; a.download = name || 'Anhang';
      document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  document.addEventListener('change', async event => {
    const input = event.target.closest?.('input[data-att-add]');
    if (!input || !input.files?.length) return;
    event.stopPropagation();
    const files = Array.from(input.files);
    input.value = '';
    try { await addFiles(input.dataset.attScope, input.dataset.attKey, files); }
    catch (e) { alert('Anhang konnte nicht gespeichert werden: ' + (e.message || e)); }
  }, true);

  document.addEventListener('click', async event => {
    const open = event.target.closest?.('[data-att-open]');
    if (open) {
      event.preventDefault();
      try { await openFile(open.dataset.attOpen, open.querySelector('.ecw-att-name')?.textContent); }
      catch (e) { alert(e.message || String(e)); }
      return;
    }
    const del = event.target.closest?.('[data-att-del]');
    if (del) {
      event.preventDefault();
      const host = hosts[del.dataset.attScope];
      if (!host || !confirm('Diesen Anhang vom Punkt entfernen?')) return;
      if (host.remove(del.dataset.attKey, del.dataset.attDel) !== false) {
        await deleteFile(del.dataset.attDel).catch(() => {});
        urlCache.delete(del.dataset.attDel);
      }
    }
  });

  // Nach jedem Neuzeichnen Vorschaubilder nachladen.
  new MutationObserver(() => { void loadThumbs(); }).observe(document.documentElement, {childList: true, subtree: true});

  const style = document.createElement('style');
  style.textContent = `.ecw-att-list{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
.ecw-att{display:inline-flex;align-items:center;border:1px solid var(--line,#343943);border-radius:8px;overflow:hidden;background:#ffffff0d}
.ecw-att-open{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:inherit;padding:4px 8px;cursor:pointer;font:inherit;font-size:13px;max-width:260px}
.ecw-att-open img{width:44px;height:44px;object-fit:cover;border-radius:4px;background:#fff1}
.ecw-att-icon{font-size:22px}
.ecw-att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ecw-att-del{background:none;border:0;border-left:1px solid var(--line,#343943);color:inherit;cursor:pointer;padding:4px 8px;align-self:stretch}
.ecw-att-add{cursor:pointer;font-size:13px}
@media print{.ecw-att{border-color:#999}.ecw-att-open{color:#000}}`;
  document.head.appendChild(style);

  window.ecwItemAttachments = {
    block,
    register(scope, host) { hosts[scope] = host; },
    loadThumbs,
  };
})();
