/* Jettset × Bio Atelier — Wellness Partnership
   Page-specific behaviour only: a barely-perceptible hero image drift and
   the destination selector. Shared nav / side-panel / contact-sheet wiring
   lives in script.js and is untouched by this file. All ids are `ba*` so
   nothing here can collide with another page's script.

   The hero is intentionally minimal: full-viewport photo, no copy, no
   overlay, no scroll-jacked sequence. As the guest begins scrolling, the
   image scales from 1 to 1.025 over the wrap's small extra height (40vh)
   — subtle enough to read as "alive," not as an effect. Once that runway
   is scrolled past, Chapter Two simply rises over the hero in normal page
   flow; there is nothing else to hand off. */
(function(){
  'use strict';

  var wrap = document.getElementById('baDoorwayWrap');
  var plate = document.getElementById('baHeroPlate');

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(wrap && plate && !reducedMotion){
    var ticking = false;

    function render(){
      var rect = wrap.getBoundingClientRect();
      var total = wrap.offsetHeight - window.innerHeight;
      var scrolled = Math.min(Math.max(-rect.top, 0), total);
      var p = total > 0 ? scrolled / total : 0; // 0 -> 1 across the drift's small runway
      var scale = 1 + p * 0.025;
      plate.style.transform = 'scale(' + scale.toFixed(4) + ')';
      ticking = false;
    }

    document.addEventListener('scroll', function(){
      if(!ticking){ requestAnimationFrame(render); ticking = true; }
    }, {passive:true});
    window.addEventListener('resize', function(){
      if(!ticking){ requestAnimationFrame(render); ticking = true; }
    }, {passive:true});
    render();
  }

  // Destination selector — London stays fixed as the origin; only the
  // destination, flight time and recommended protocol change.
  var destButtons = document.querySelectorAll('.ba-destselect button');
  var routeEl = document.getElementById('baRoute');
  var timeEl = document.getElementById('baTime');
  var protocolEl = document.getElementById('baProtocol');

  if(destButtons.length && routeEl && timeEl && protocolEl){
    destButtons.forEach(function(btn){
      btn.addEventListener('click', function(){
        destButtons.forEach(function(b){
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        routeEl.textContent = 'London → ' + btn.dataset.baDest;
        timeEl.textContent = btn.dataset.baTime;
        protocolEl.textContent = btn.dataset.baProtocol;
      });
    });
  }
})();
