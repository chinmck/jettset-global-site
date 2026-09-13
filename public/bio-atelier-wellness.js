/* Jettset × Bio Atelier — Wellness Partnership
   Page-specific behaviour only: the scroll-pinned door-push hero and the
   destination selector. Shared nav / side-panel / contact-sheet wiring
   lives in script.js and is untouched by this file. All ids are `ba*` /
   `baDest*` so nothing here can collide with another page's script. */
(function(){
  'use strict';

  var wrap = document.getElementById('baDoorwayWrap');
  var plate = document.getElementById('baHeroPlate');
  var gradeCool = document.getElementById('baGradeCool');
  var gradeAccent = document.getElementById('baGradeAccent');
  var jettsetMark = document.getElementById('baJettsetMark');
  var bioMark = document.getElementById('baBioMark');
  var reveal = document.getElementById('baReveal');
  var cue = document.getElementById('baCue');

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(wrap && plate && gradeCool && gradeAccent && jettsetMark && bioMark && reveal && cue && !reducedMotion){
    // Smoothstep, so the grade shift doesn't feel linear/mechanical.
    function ease(t){ return t*t*(3-2*t); }

    function onScroll(){
      var rect = wrap.getBoundingClientRect();
      var total = wrap.offsetHeight - window.innerHeight;
      var scrolled = Math.min(Math.max(-rect.top, 0), total);
      var p = total > 0 ? scrolled / total : 0; // 0 -> 1

      // Phase 1: slow push into the cabin — cool wash holds briefly then fades.
      var pushP = Math.min(p / 0.7, 1);
      plate.style.transform = 'scale(' + (1 + ease(pushP) * 0.16) + ')';
      gradeCool.style.opacity = Math.max(0.28 - ease(Math.min(p/0.5,1)) * 0.28, 0);

      // Phase 2: partner accent wash rises as the threshold is crossed.
      var accentP = ease(Math.min(Math.max((p - 0.35) / 0.45, 0), 1));
      gradeAccent.style.opacity = accentP * 0.5;

      // Phase 3: the Jettset mark recedes.
      jettsetMark.style.opacity = 1 - Math.min(Math.max((p - 0.15) / 0.3, 0), 1);

      // Phase 4: Bio Atelier resolves in its accent colour at the threshold.
      var bioP = Math.min(Math.max((p - 0.6) / 0.35, 0), 1);
      bioMark.style.opacity = bioP;
      bioMark.style.transform = 'translate(-50%,-50%) scale(' + (0.9 + bioP*0.1) + ')';

      // Phase 5: thesis + CTA.
      var revealP = Math.min(Math.max((p - 0.75) / 0.25, 0), 1);
      reveal.style.opacity = revealP;
      reveal.style.transform = 'translateY(' + ((1-revealP)*16) + 'px)';

      cue.style.opacity = p < 0.05 ? 1 : 0;
    }

    document.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onScroll, {passive:true});
    onScroll();
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
