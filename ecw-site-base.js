/* Internal navigation follows the current repository path. */
(function(){
window.ECW_SITE_BASE=new URL('.',location.href).href;
window.ecwLocalUrl=function(value){try{const u=new URL(value,location.href);if(u.hostname==='ecwegscheid.github.io'&&u.pathname.startsWith('/Vereinsverwaltung-Aktuell/'))return new URL(u.pathname.slice('/Vereinsverwaltung-Aktuell/'.length)+u.search+u.hash,window.ECW_SITE_BASE).href;if(u.hostname==='ecwegscheid.github.io'&&/^\/Reservierungssystem\/?$/.test(u.pathname))return new URL('ecw-reservierung-v2955.html'+u.search+u.hash,window.ECW_SITE_BASE).href;return u.href}catch{return value}};
})();
