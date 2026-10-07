/* ============================================================
   INSIDE THE HOUSE — CHAPTER
   Isolated script. Progressive enhancement ONLY.

   The core interaction (selecting a division, showing its room)
   is implemented entirely in HTML/CSS via a native radio group and
   :checked sibling selectors — see inside-house.css. This script
   never controls visibility and is not required for the section to
   work correctly with JavaScript disabled.

   What it adds, both purely additive:
   1. A polite live-region announcement, so screen-reader users get
      explicit confirmation of which room is now showing, since the
      updated content lives elsewhere in the DOM from the radio that
      changed.
   2. Scrolling the selected division's label into view within the
      mobile horizontal rail (and harmlessly on desktop too, where
      the vertical list has no scroll and this is a no-op). Native
      radio-group keyboard navigation (arrow keys) can move the
      checked state to a division whose label sits outside the
      rail's visible scroll area; this brings it into view without
      requiring any custom scroll logic in the base HTML/CSS.
   ============================================================ */

(function insideHouseSection() {
  var root = document.getElementById("inside-house-section");
  if (!root) return;

  var radios = Array.prototype.slice.call(root.querySelectorAll(".inside-house-radio"));
  if (!radios.length) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var announcer = document.createElement("div");
  announcer.setAttribute("aria-live", "polite");
  announcer.setAttribute("role", "status");
  announcer.style.position = "absolute";
  announcer.style.width = "1px";
  announcer.style.height = "1px";
  announcer.style.overflow = "hidden";
  announcer.style.clip = "rect(0,0,0,0)";
  root.appendChild(announcer);

  radios.forEach(function (radio) {
    radio.addEventListener("keydown", function (event) {
      var direction = 0;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") direction = 1;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") direction = -1;
      if (!direction) return;

      event.preventDefault();
      var currentIndex = radios.indexOf(radio);
      var nextIndex = (currentIndex + direction + radios.length) % radios.length;
      var nextRadio = radios[nextIndex];
      nextRadio.checked = true;
      nextRadio.focus();
      nextRadio.dispatchEvent(new Event("change", { bubbles: true }));
    });

    radio.addEventListener("change", function () {
      if (!radio.checked) return;
      var key = radio.id.replace("inside-house-tab-", "");
      var label = root.querySelector('label[data-for="' + key + '"]');
      var directoryName = label ? label.querySelector(".inside-house-item-name") : null;

      announcer.textContent = directoryName ? "Now showing: " + directoryName.textContent : "";

      if (label && typeof label.scrollIntoView === "function") {
        label.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    });
  });

  /* ============================================================
     RESTRAINED AUTOPLAY (progressive enhancement)
     Rotates through the existing divisions every 5s with a ~500ms crossfade, so visitors discover that the
     numbered tabs can be selected. Everything stays directly selectable. Skipped entirely for visitors who
     prefer reduced motion. The CSS-only radio core above is untouched when this does not run.
     ============================================================ */
  var INTERVAL = 5000;
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motionQuery.matches || !("IntersectionObserver" in window)) return;

  var rail = root.querySelector(".inside-house-directory");
  var grid = root.querySelector(".inside-house-grid");
  var labels = radios.map(function (radio) {
    return root.querySelector('label[for="' + radio.id + '"]');
  });
  if (labels.some(function (l) { return !l; })) return;

  var current = Math.max(0, radios.findIndex(function (r) { return r.checked; }));
  var elapsed = 0;
  var inView = false, hovering = false, focused = false, userPaused = false, stopped = false, tabHidden = document.hidden;
  var internal = false, raf = null, last = 0;

  root.classList.add("ih-enhanced", "ih-autoplay");

  // A thin progress line inside each tab; only the current tab's line is visible (see inside-house.css).
  var bars = labels.map(function (label) {
    var bar = document.createElement("span");
    bar.className = "ih-progress";
    bar.setAttribute("aria-hidden", "true");
    label.appendChild(bar);
    return bar;
  });

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ih-toggle";
  toggle.innerHTML = '<span class="ih-toggle-icon" aria-hidden="true"></span>';
  (rail.parentNode).insertBefore(toggle, rail.nextSibling);

  function running() {
    return inView && !hovering && !focused && !userPaused && !stopped && !tabHidden;
  }

  function paintToggle() {
    var paused = userPaused || stopped;
    toggle.setAttribute("aria-label", paused ? "Resume automatic rotation" : "Pause automatic rotation");
    toggle.setAttribute("title", paused ? "Resume automatic rotation" : "Pause automatic rotation");
    toggle.classList.toggle("is-paused", paused);
    root.classList.toggle("ih-autoplay", !stopped);
  }

  function paintCurrent() {
    labels.forEach(function (label, i) { label.classList.toggle("ih-current", i === current); });
    bars.forEach(function (bar, i) { bar.style.transform = "scaleX(" + (i === current ? Math.min(1, elapsed / INTERVAL) : 0) + ")"; });
  }

  function railTo(index) {
    // Keep the chosen tab visible in the horizontal mobile rail without ever scrolling the page itself.
    var label = labels[index];
    if (!rail || rail.scrollWidth <= rail.clientWidth + 1) return;
    var box = label.getBoundingClientRect(), railBox = rail.getBoundingClientRect();
    var left = rail.scrollLeft + (box.left - railBox.left) - (rail.clientWidth - box.width) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }

  function show(index) {
    current = (index + radios.length) % radios.length;
    internal = true;
    radios[current].checked = true;
    internal = false;
    elapsed = 0;
    paintCurrent();
    railTo(current);
  }

  function frame(now) {
    raf = null;
    if (!running()) return;
    elapsed += now - last; last = now;
    if (elapsed >= INTERVAL) show(current + 1);
    else bars[current].style.transform = "scaleX(" + (elapsed / INTERVAL) + ")";
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    if (running() && raf === null) { last = performance.now(); raf = requestAnimationFrame(frame); }
    root.classList.toggle("ih-paused", !running());
    root.setAttribute("data-ih-state", running() ? "playing" : "paused:" + [inView ? "" : "offscreen", hovering ? "hover" : "", focused ? "focus" : "", userPaused ? "user" : "", stopped ? "selected" : "", tabHidden ? "tab-hidden" : ""].filter(Boolean).join(","));
  }

  // Manual selection (mouse, touch, keyboard arrows) stops rotation on that tab so it can be read.
  radios.forEach(function (radio, i) {
    radio.addEventListener("change", function () {
      if (internal || !radio.checked) return;
      current = i; elapsed = 0; stopped = true;
      paintCurrent(); paintToggle(); sync();
    });
  });

  toggle.addEventListener("click", function () {
    if (stopped) { stopped = false; userPaused = false; elapsed = 0; }
    else userPaused = !userPaused;
    paintCurrent(); paintToggle(); sync();
  });

  root.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hovering = true; sync(); } });
  root.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { hovering = false; sync(); } });
  root.addEventListener("focusin", function () { focused = true; sync(); });
  root.addEventListener("focusout", function (e) { if (!e.relatedTarget || !root.contains(e.relatedTarget)) { focused = false; sync(); } });
  document.addEventListener("visibilitychange", function () { tabHidden = document.hidden; sync(); });

  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting; sync();
  }, { threshold: 0.35 }).observe(root);

  // If the visitor turns on reduced motion while the page is open, hand control back to the plain tabs.
  var onMotionChange = function () {
    if (!motionQuery.matches) return;
    stopped = true; sync();
    root.classList.remove("ih-enhanced", "ih-autoplay");
    toggle.hidden = true;
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);

  paintCurrent(); paintToggle(); sync();
})();
