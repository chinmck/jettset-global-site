/* Jettset × Bio Atelier — Wellness Partnership
   Page-specific behaviour only: the cinematic scroll-pinned hero sequence
   and the destination selector. Shared nav / side-panel / contact-sheet
   wiring lives in script.js and is untouched by this file. All ids are
   `ba*` so nothing here can collide with another page's script.

   Hero sequence — a 3-beat scene, not a presentation (mapped over scroll
   progress p, 0 -> 1, while the section is pinned):
     1. Arrival / stillness — p 0.00-0.08: at rest; the only motion is the
                    CSS idle push in bio-atelier-wellness.css (~2.5% scale)
                    so the frame reads as alive rather than static.
     2. The close-in — p 0.08-0.62: an editorial crop tightening toward
                    her face — scale only, no pan/drift/filter added on
                    top of it. Restraint is the effect.
     3. The reveal  — p 0.50-0.76: the window light blooms across her
                    face (brightness + a little softening blur), the
                    image goes toward abstract light/ivory, and that
                    light IS the brand card's background — no separate
                    fade-to-black step in between.
     4. Brand       — p 0.64-0.80: the card resolves on that same wash;
                    opacity and the eyebrow's letter-spacing are the only
                    things that move.
     5. Hold/Exit   — p 0.80-0.90 holds, 0.90-1.0 crossfades to near-black
                    so unpinning into Chapter Two is never a hard cut. */
(function(){
  'use strict';

  var wrap = document.getElementById('baDoorwayWrap');
  var plate = document.getElementById('baHeroPlate');
  var lightwash = document.getElementById('baLightwash');
  var brandFrame = document.getElementById('baBrandFrame');
  var brandEyebrow = document.getElementById('baBrandEyebrow');
  var fadeout = document.getElementById('baFadeout');
  var cue = document.getElementById('baCue');

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(wrap && plate && lightwash && brandFrame && brandEyebrow && fadeout && cue && !reducedMotion){
    // Smoothstep — every phase below eases through this rather than
    // moving linearly, so nothing in the sequence feels mechanical.
    function ease(t){ return t*t*(3-2*t); }
    // Maps p onto a [from, to] window and eases it to 0..1.
    function phase(p, from, to){ return ease(Math.min(Math.max((p - from) / (to - from), 0), 1)); }

    var ticking = false;

    function render(){
      var rect = wrap.getBoundingClientRect();
      var total = wrap.offsetHeight - window.innerHeight;
      var scrolled = Math.min(Math.max(-rect.top, 0), total);
      var p = total > 0 ? scrolled / total : 0; // 0 -> 1 across the whole pinned run

      // ---- 2. THE CLOSE-IN: an editorial crop tightening, scale only ----
      // No pan, no drift, no added filter here — her face filling the
      // frame is the whole move. transform-origin (in the CSS) is set
      // near her eyeline so this reads as toward her, not the frame centre.
      var zoomP = phase(p, 0.08, 0.62);
      var scale = 1 + zoomP * 0.62; // deliberate enough that she becomes the frame, still no distortion
      plate.style.transform = 'scale(' + scale.toFixed(4) + ')';

      // ---- 3. THE REVEAL: the window light blooms across her, toward ivory ----
      var lightP = phase(p, 0.50, 0.76);
      var brightness = 1 + lightP * 0.6;
      var blur = lightP * 8; // px — softens toward abstract light, never a hard cut
      plate.style.filter = 'brightness(' + brightness.toFixed(3) + ') blur(' + blur.toFixed(2) + 'px)';
      lightwash.style.opacity = lightP;

      // ---- 4. BRAND: resolves on that same light — opacity + letter-spacing only ----
      var brandP = phase(p, 0.64, 0.80);
      brandFrame.style.opacity = brandP;
      brandEyebrow.style.letterSpacing = (0.08 + brandP * 0.24).toFixed(3) + 'em';

      // ---- 5. HOLD (0.80-0.90 implicit) / EXIT: crossfade to near-black ----
      var exitP = phase(p, 0.90, 1.0);
      fadeout.style.opacity = exitP;
      // The brand card recedes with the fade rather than sitting on top of
      // flat black, so the text disappears rather than clipping.
      brandFrame.style.opacity = brandP * (1 - exitP);

      cue.style.opacity = p < 0.04 ? 1 : 0;
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
