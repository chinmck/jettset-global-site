/* Jettset × Bio Atelier — Aviation Wellness
   Page-specific behaviour only: a barely-perceptible hero image drift.
   Shared nav / side-panel / contact-sheet wiring, plus the sitewide
   [data-reveal] scroll-entrance used throughout this page's sections,
   both live in script.js and are untouched by this file. All ids here are
   `ba*` so nothing collides with another page's script.

   The hero is intentionally minimal: full-viewport photo, restrained copy
   over the frame, no scroll-jacked sequence. As the guest begins
   scrolling, the image scales from 1 to 1.025 over the wrap's small extra
   height (40vh) — subtle enough to read as "alive," not as an effect.
   Once that runway is scrolled past, Section 02 simply rises over the
   hero in normal page flow. */
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
})();
