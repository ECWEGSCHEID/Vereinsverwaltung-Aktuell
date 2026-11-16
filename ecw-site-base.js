/* Internal navigation follows the current repository path. */
(function(){
window.ECW_SITE_BASE=new URL('.',location.href).href;
window.ecwLocalUrl=function(value){try{const u=new URL(value,location.href);if(u.hostname==='ecwegscheid.github.io'&&u.pathname.startsWith('/Vereinsverwaltung-Aktuell/'))return new URL(u.pathname.slice('/Vereinsverwaltung-Aktuell/'.length)+u.search+u.hash,window.ECW_SITE_BASE).href;if(u.hostname==='ecwegscheid.github.io'&&/^\/Reservierungssystem\/?$/.test(u.pathname))return new URL('ecw-reservierung-v2955.html'+u.search+u.hash,window.ECW_SITE_BASE).href;return u.href}catch{return value}};
})();

/* Gemeinsamer Versionsstand der aktiven Vereinsverwaltung. version.json führt denselben Stand für den Update-Check. */
window.ECW_APP_VERSION = '3.1.1.161126';
(function () {
  const page = location.pathname.split('/').pop();
  if (/^START_VEREINSVERWALTUNG_|^ecw-versammlungen-v295[56]\.html$/.test(page)) return;

  function showRelease() {
    const label = 'Version ' + window.ECW_APP_VERSION;
    const versionText = /\b(?:Version\s+|V(?=\d))?\d+\.\d+\.\d+(?:\.\d{6})?\b/i;
    document.title = versionText.test(document.title)
      ? document.title.replace(versionText, label)
      : document.title + ' · ' + label;

    const labels = Array.from(document.querySelectorAll(
      '#appVersion, .tournament-version, .tp-header-version, .version-badge, .version, .badge'
    )).filter(node => /^\s*(?:Version\s+|V(?=\d))\d+\.\d+\.\d+/i.test(node.textContent));
    for (const node of labels) node.textContent = node.textContent.replace(versionText, label);
    if (labels.length) return;

    const badge = document.createElement('small');
    badge.textContent = label;
    badge.style.cssText = 'position:fixed;left:6px;bottom:4px;z-index:20;padding:2px 5px;border-radius:4px;background:#18181be6;color:#fff;font:11px system-ui,sans-serif;pointer-events:none';
    document.body.append(badge);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showRelease, {once:true});
  else showRelease();
})();
