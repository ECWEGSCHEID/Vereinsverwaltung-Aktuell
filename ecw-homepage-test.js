(() => {
  try {
    if (window.parent !== window && window.parent.ecwHomepageTest) {
      window.ecwHomepageTest = window.parent.ecwHomepageTest;
      window.parent.addEventListener("ecw-homepage-status", () => window.dispatchEvent(new Event("ecw-homepage-status")));
      return;
    }
  } catch {}
  const homepage = "https://ec-wegscheid-test-homepage.m-stadler1978.chatgpt.site";
  const storeKey = "ecw19-homepage-test-outbox";
  const waiting = new Map();
  const recordStatus = new Map();
  const pdfFactories = new WeakMap();
  let popup, channel, folders = [], message = "Test-Homepage noch nicht verbunden.";
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
    if (!folders.length || !popup || popup.closed) {
      status("Homepage-Übertragung vorgemerkt. Bitte die Test-Homepage verbinden.",record.key);
      return;
    }
    if ([...waiting.values()].some(item => item.record === record)) return;
    const makePdfs = pdfFactories.get(record);
    if (record.pdfMode && !makePdfs) return;
    const request = crypto.randomUUID();
    const target = popup;
    const targetChannel = channel;
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
      if (target.closed) throw Error("Bitte die Test-Homepage erneut verbinden.");
      const timer = setTimeout(() => {
        waiting.delete(request);
        status("Homepage-Übertragung unbestätigt. Bitte Verbindung erneut öffnen.",record.key);
      },45000);
      waiting.get(request).timer = timer;
      status("Übertragung an die Test-Homepage läuft …",record.key);
      target.postMessage({ecwHomepage:targetChannel, request, record, pdfs},homepage);
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
    if (event.origin !== homepage || event.source !== popup || data?.ecwHomepage !== channel) return;
    if (Array.isArray(data.folders)) {
      folders = data.folders;
      status("Mit der Test-Homepage verbunden.");
      Object.values(pending).forEach(send);
      return;
    }
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
    status(sent.record.remove ? "Veröffentlichung zurückgenommen." : "Auf der Test-Homepage gespeichert.",sent.record.key);
  });

  window.ecwHomepageTest = {
    connect() {
      const opener = window;
      folders = [];
      channel = crypto.randomUUID();
      for (const item of waiting.values()) clearTimeout(item.timer);
      waiting.clear();
      const query = new URLSearchParams({von:opener.location.origin,kanal:channel});
      popup = opener.open(homepage + "/homepage-verbindung.html?" + query,"ecwHomepageTest19","popup,width=530,height=480");
      status(popup ? "Bitte Testverbindung im geöffneten Fenster zulassen." : "Bitte Pop-ups für die Verbindung erlauben.");
    },
    queue,
    options(select, selected = select.value) {
      select.replaceChildren(new select.ownerDocument.defaultView.Option("– Homepage-Unterordner auswählen –",""));
      for (const folder of folders) select.add(new select.ownerDocument.defaultView.Option(folder.title,folder.id));
      if (selected && !folders.some(folder => folder.id === selected)) select.add(new select.ownerDocument.defaultView.Option("Bisheriger Ordner · " + selected,selected));
      select.value = selected;
    },
    report: (key,text) => status(text,key),
    status: key => (key && recordStatus.get(key)) || message,
  };
})();
