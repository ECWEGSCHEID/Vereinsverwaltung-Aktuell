/* Internal navigation follows the current repository path. */
(function(){
window.ECW_SITE_BASE=new URL('.',location.href).href;
window.ecwLocalUrl=function(value){try{const u=new URL(value,location.href);if(u.hostname==='ecwegscheid.github.io'&&u.pathname.startsWith('/Vereinsverwaltung-Aktuell/'))return new URL(u.pathname.slice('/Vereinsverwaltung-Aktuell/'.length)+u.search+u.hash,window.ECW_SITE_BASE).href;if(u.hostname==='ecwegscheid.github.io'&&/^\/Reservierungssystem\/?$/.test(u.pathname))return new URL('ecw-reservierung-v2955.html'+u.search+u.hash,window.ECW_SITE_BASE).href;return u.href}catch{return value}};
})();

/* Gemeinsamer Versionsstand der aktiven Vereinsverwaltung. version.json führt denselben Stand für den Update-Check. */
window.ECW_APP_VERSION = '3.1.26.171126';
(function () {
  const page = location.pathname.split('/').pop();
  if (/^START_VEREINSVERWALTUNG_|^ecw-versammlungen-v295[56]\.html$/.test(page)) return;

  function showRelease() {
    const label = 'Version ' + window.ECW_APP_VERSION;
    const versionText = /\b(?:Version\s+|V(?=\d))?\d+\.\d+\.\d+(?:\.\d{6})?\b/i;
    document.title = versionText.test(document.title)
      ? document.title.replace(versionText, label)
      : document.title + ' · ' + label;

    const memberVersion = document.getElementById('versionLabel');
    if (memberVersion) {
      memberVersion.textContent = window.ECW_APP_VERSION;
      return;
    }

    const labels = Array.from(document.querySelectorAll(
      '#appVersion, .tournament-version, .tp-header-version, .version-badge, .version, .badge'
    )).filter(node => /^\s*(?:Version\s+|V(?=\d))\d+\.\d+\.\d+/i.test(node.textContent));
    for (const node of labels) node.textContent = node.textContent.replace(versionText, label);
    if (labels.length) return;

    const badge = document.createElement('small');
    badge.textContent = label;
    badge.style.cssText = 'position:fixed;left:6px;bottom:4px;z-index:20;padding:2px 5px;border-radius:4px;background:#18181be6;color:#fff;font:11px system-ui,sans-serif;pointer-events:none';
    if (/^(?:ecw-reservierung-v2955|reservierung-(?:smartphone-test|kalender(?:-test)?|pilot))\.html$/.test(page)) {
      const heading = document.querySelector('header h1, h1');
      if (heading) {
        badge.style.cssText = 'display:block;font:10px system-ui,sans-serif;opacity:.8;margin-top:2px';
        heading.append(badge);
        return;
      }
    }
    document.body.append(badge);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showRelease, {once:true});
  else showRelease();
})();

/* Zeilenumbrüche für Waben unabhängig vom gespeicherten Namen. */
window.ecwTileLabel = function (title, menu) {
  const label = String(title || '').trim();
  switch (menu) {
    case 'documents':
      if (/^vereins[\s-]*dokumente$/i.test(label)) return 'Vereins-\ndokumente';
      if (/^turnier[\s-]*unterlagen$/i.test(label)) return 'Turnier-\nunterlagen';
      break;
    case 'useful':
      if (/^turnier[\s-]*auslosung$/i.test(label)) return 'Turnier-\nauslosung';
      break;
    case 'results':
      if (/^eigene\s+turniere$/i.test(label)) return 'Eigene\nTurniere';
      break;
  }
  return title;
};

/* Auch gespeicherte Smartphone-Direktlinks auf neue Releases prüfen. */
(function () {
  if (!/\/(smartphone-mitglieder|mobile-zugang)\.html$/.test(location.pathname) ||
      !/^https?:$/.test(location.protocol)) return;

  async function checkMobileRelease() {
    const openedUrl = location.href;
    try {
      const manifest = new URL('version.json', window.ECW_SITE_BASE);
      manifest.searchParams.set('check', String(Date.now()));
      const response = await fetch(manifest, {cache: 'no-store'});
      if (!response.ok) return;
      const {version: latest} = await response.json();
      if (!/^\d+\.\d+\.\d+\.\d{6}$/.test(latest) ||
          latest === window.ECW_APP_VERSION ||
          openedUrl !== location.href ||
          document.activeElement?.matches('input, select, textarea')) return;
      const target = new URL(openedUrl);
      if (target.searchParams.get('v') === latest) return;
      target.searchParams.set('v', latest);
      location.replace(target.href);
    } catch {}
  }

  void checkMobileRelease();
  window.addEventListener('pageshow', event => {
    if (event.persisted) void checkMobileRelease();
  });
})();
