/* V2.9.6 – Rein optische Markierung des gewählten Verwaltungsbereichs.
   Keine Änderungen an Berechtigungen, Navigation oder Firebase. */
(function(){
  'use strict';
  var side=document.querySelector('#admin .admin-side');
  if(!side) return;
  side.addEventListener('click',function(event){
    var button=event.target.closest('button');
    if(!button || !side.contains(button) || !button.hasAttribute('data-menu-icon')) return;
    side.querySelectorAll('button.ecw-menu-active').forEach(function(el){
      el.classList.remove('ecw-menu-active');
      el.removeAttribute('aria-current');
    });
    button.classList.add('ecw-menu-active');
    button.setAttribute('aria-current','page');
  });
})();
