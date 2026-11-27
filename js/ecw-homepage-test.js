(() => {
  try {
    if (window.parent !== window && window.parent.ecwHomepageTest) {
      window.ecwHomepageTest = window.parent.ecwHomepageTest;
      window.parent.addEventListener("ecw-homepage-status", () => window.dispatchEvent(new Event("ecw-homepage-status")));
      return;
    }
  } catch {}
  const homepage = "https://ec-wegscheid.de/homepage-test";
  const homepageOrigins = new Set([new URL(homepage).origin, "https://www.ec-wegscheid.de"]);
  const storeKey = "ecw19-homepage-test-outbox";
  const waiting = new Map();
  const recordStatus = new Map();
  const pdfFactories = new WeakMap();
  let popup, channel, connectedOrigin, folders = [], message = "Homepage noch nicht verbunden.";
  // Automatische Übertragung: direkt mit der Firebase-Anmeldung der Vereinsverwaltung,
  // ohne Fenster „Homepage verbinden“. Das Fenster bleibt als Ersatzweg erhalten.
  const directApi = "https://www.ec-wegscheid.de/homepage-api/veroeffentlichungen";
  let tokenProvider = null, direct = false, directBusy = false;
  // Die PDFs entstehen in der eingebetteten Turnierverwaltung (anderes Fenster) –
  // „instanceof Blob“ wäre dort immer falsch. Deshalb an den Eigenschaften erkennen.
  const isBlob = value => !!value && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.size === "number";
  async function directFetch(init) {
    const token = await tokenProvider?.();
    if (!token) throw Error("Nicht in der Vereinsverwaltung angemeldet.");
    const response = await fetch(directApi,{...init,headers:{...(init.headers || {}),"X-ECW-Token":token},signal:AbortSignal.timeout(35000),cache:"no-store"});
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Error(result?.error || "Homepage antwortet nicht (HTTP " + response.status + ").");
    return result;
  }
  async function connectDirect() {
    if (!tokenProvider || direct || directBusy) return;
    directBusy = true;
    try {
      const result = await directFetch({method:"GET"});
      if (!Array.isArray(result?.folders)) throw Error("Ordnerliste fehlt.");
      folders = result.folders;
      direct = true;
      status("Automatisch mit der Homepage verbunden.");
      Object.values(pending).forEach(send);
    } catch (error) {
      console.warn("Automatische Homepage-Verbindung:", error);
      if (!folders.length) status("Automatische Homepage-Verbindung nicht möglich: " + error.message + " Ersatzweise „Homepage verbinden“ benutzen.");
    } finally { directBusy = false; }
  }
  let pending = {};
  try { pending = JSON.parse(localStorage.getItem(storeKey) || "{}") || {}; } catch {}
  let lastRevision = Math.max(0,...Object.values(pending).map(item => item?.revision || 0));

  function status(text, key) {
    message = text;
    if (key) recordStatus.set(key,text);
    window.dispatchEvent(new Event("ecw-homepage-status"));
  }

  function saveOutbox() {
    try { localStorage.setItem(storeKey, JSON.stringify(pending)); } catch {}
  }

  async function send(record) {
    if (!direct && (!folders.length || !popup || popup.closed || !connectedOrigin)) {
      status("Homepage-Übertragung vorgemerkt. Bitte die Homepage verbinden.",record.key);
      return;
    }
    if ([...waiting.values()].some(item => item.record === record)) return;
    const makePdfs = pdfFactories.get(record);
    if (record.pdfMode && !makePdfs) return;
    const request = crypto.randomUUID();
    const target = popup;
    const targetChannel = channel;
    const targetOrigin = connectedOrigin;
    waiting.set(request,{record});
    try {
      let pdfs;
      if (makePdfs) {
        status("PDFs werden erstellt …",record.key);
        pdfs = await makePdfs();
      }
      if (!waiting.has(request) || pending[record.key] !== record) {
        waiting.delete(request);
        return;
      }
      if (direct) {
        status("Übertragung an die Homepage läuft …",record.key);
        let body = JSON.stringify(record), headers = {"Content-Type":"application/json"};
        if (record.pdfMode) {
          body = new FormData();
          body.set("record",JSON.stringify(record));
          for (const kind of ["invitation","startList"]) if (isBlob(pdfs?.[kind])) body.set(kind,pdfs[kind],kind + ".pdf");
          headers = {};
        }
        try {
          const result = await directFetch({method:"POST",headers,body});
          if (result?.ok !== true) throw Error(result?.error || "Veröffentlichung unbestätigt.");
          waiting.delete(request);
          if (pending[record.key] === record) { delete pending[record.key]; saveOutbox(); }
          status(record.remove ? "Veröffentlichung zurückgenommen." : "Automatisch auf der Homepage gespeichert.",record.key);
        } catch (error) {
          waiting.delete(request);
          const sizes = ["invitation","startList"].filter(k => isBlob(pdfs?.[k]))
            .map(k => (k === "invitation" ? "Einladung " : "Startliste ") + (pdfs[k].size / 1048576).toFixed(1).replace(".",",") + " MB").join(", ");
          if (pending[record.key] === record) status("Homepage: " + error.message + (sizes ? " (" + sizes + ")" : ""),record.key);
        }
        return;
      }
      if (target.closed) throw Error("Bitte die Homepage erneut verbinden.");
      const timer = setTimeout(() => {
        waiting.delete(request);
        status("Homepage-Übertragung unbestätigt. Bitte Verbindung erneut öffnen.",record.key);
      },45000);
      waiting.get(request).timer = timer;
      status("Übertragung an die Homepage läuft …",record.key);
      target.postMessage({ecwHomepage:targetChannel, request, record, pdfs},targetOrigin);
    } catch (error) {
      clearTimeout(waiting.get(request)?.timer);
      waiting.delete(request);
      if (pending[record.key] === record) status(error.message || "PDF-Übertragung fehlgeschlagen.",record.key);
    }
  }

  function queue(record, retry = false, makePdfs) {
    const previous = pending[record.key];
    if (previous && !retry) {
      const {revision, ...original} = previous;
      if (JSON.stringify(record) === JSON.stringify(original)) {
        if (makePdfs) pdfFactories.set(previous,makePdfs);
        void send(previous);
        return;
      }
    }
    lastRevision = Math.max(Date.now(),lastRevision+1);
    pending[record.key] = {...record, revision:lastRevision};
    if (makePdfs) pdfFactories.set(pending[record.key],makePdfs);
    saveOutbox();
    void send(pending[record.key]);
  }

  window.addEventListener("message", event => {
    const data = event.data;
    if (!homepageOrigins.has(event.origin) || event.source !== popup || data?.ecwHomepage !== channel) return;
    if (Array.isArray(data.folders)) {
      connectedOrigin = event.origin;
      folders = data.folders;
      status("Mit der Homepage verbunden.");
      Object.values(pending).forEach(send);
      return;
    }
    if (event.origin !== connectedOrigin) return;
    const sent = waiting.get(data.request);
    if (!sent) return;
    clearTimeout(sent.timer);
    waiting.delete(data.request);
    if (pending[sent.record.key] !== sent.record) return;
    if (data.error) { status("Homepage: " + data.error,sent.record.key); return; }
    if (pending[sent.record.key] === sent.record) {
      delete pending[sent.record.key];
      saveOutbox();
    }
    status(sent.record.remove ? "Veröffentlichung zurückgenommen." : "Auf der Homepage gespeichert.",sent.record.key);
  });

  window.ecwHomepageTest = {
    connect() {
      const opener = window;
      folders = [];
      connectedOrigin = undefined;
      channel = crypto.randomUUID();
      for (const item of waiting.values()) clearTimeout(item.timer);
      waiting.clear();
      const query = new URLSearchParams({von:opener.location.origin,kanal:channel});
      popup = opener.open(homepage + "/homepage-verbindung.html?" + query,"ecwHomepageTest19","popup,width=530,height=480");
      status(popup ? "Bitte Testverbindung im geöffneten Fenster zulassen." : "Bitte Pop-ups für die Verbindung erlauben.");
    },
    queue,
    // Wird von der Turnierverwaltung nach der Anmeldung gesetzt: liefert den Firebase-ID-Token.
    setTokenProvider(provider) {
      tokenProvider = provider;
      if (provider) void connectDirect();
    },
    options(select, selected = select.value) {
      select.replaceChildren(new select.ownerDocument.defaultView.Option("– Homepage-Unterordner auswählen –",""));
      for (const folder of folders) select.add(new select.ownerDocument.defaultView.Option(folder.title,folder.id));
      if (selected && !folders.some(folder => folder.id === selected)) select.add(new select.ownerDocument.defaultView.Option("Bisheriger Ordner · " + selected,selected));
      select.value = selected;
    },
    report: (key,text) => status(text,key),
    status: key => (key && recordStatus.get(key)) || message,
    // true, sobald die Homepage automatisch (oder über das Fenster) verbunden ist – dann ist „Homepage verbinden“ unnötig
    connected: () => direct || (!!folders.length && !!popup && !popup.closed),
  };
})();
