/* Jettset × Bio Atelier — Wellness Partnership
   Page-specific behaviour only: the cinematic scroll-pinned hero sequence
   and the destination selector. Shared nav / side-panel / contact-sheet
   wiring lives in script.js and is untouched by this file. All ids are
   `ba*` so nothing here can collide with another page's script.

   Hero sequence (mapped over scroll progress p, 0 -> 1, while the section
   is pinned):
     1. Opening   — p 0.00-0.05: at rest; the CSS idle push in
                    bio-atelier-wellness.css carries the "feels alive" beat.
     2. Zoom      — p 0.05-0.55: slow cinematic push toward her face.
     3. Light     — p 0.42-0.72: the window light broadens into a soft
                    ivory wash (brightness + a little blur on the photo,
                    the wash's own opacity rising) — never a hard flash.
     4. Brand     — p 0.62-0.80: the ivory card resolves; opacity and the
                    eyebrow's letter-spacing are the only things that move.
     5. Hold/Exit — p 0.80-0.90 holds, 0.90-1.0 crossfades to near-black so
                    unpinning into Chapter Two is never a hard cut. */
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

      // ---- 2. ZOOM: a controlled push toward her face, not a flat scale ----
      var zoomP = phase(p, 0.05, 0.55);
      var scale = 1 + zoomP * 0.42; // cinematic push, capped well short of distortion
      var driftY = zoomP * -14; // a couple of px of upward drift, like a slow dolly rather than a static zoom
      plate.style.transform = 'scale(' + scale.toFixed(4) + ') translateY(' + driftY.toFixed(2) + 'px)';

      // A faint lift in contrast/saturation as she comes into focus — kept
      // subtle; this is restraint, not a filter effect.
      var richness = 1 + zoomP * 0.08;

      // ---- 3. LIGHT: the window light broadens to overtake the frame ----
      var lightP = phase(p, 0.42, 0.72);
      var brightness = 1 + lightP * 0.55;
      var blur = lightP * 7; // px
      plate.style.filter = 'brightness(' + brightness.toFixed(3) + ') saturate(' + richness.toFixed(3) + ') blur(' + blur.toFixed(2) + 'px)';
      lightwash.style.opacity = lightP;

      // ---- 4. BRAND: minimal ivory card — opacity + letter-spacing only ----
      var brandP = phase(p, 0.62, 0.80);
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
