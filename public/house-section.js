/* ============================================================
   THE JETTSET HOUSE — CULTURAL FLUENCY CHAPTER
   Isolated script. Only ever queries inside #house-section.
   No global listeners, no globally-scoped helper names beyond
   this IIFE, nothing written outside the section's own DOM.
   ============================================================ */

(function houseSection() {
  var root = document.querySelector(".house-section");
  if (!root) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Scroll reveal: add is-visible once, on first intersection ---- */
  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      root.classList.add("is-visible");
      return;
    }

    root.classList.add("house-reveal-ready");

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            root.classList.add("is-visible");
            observer.unobserve(root);
          }
        });
      },
      { threshold: 0.32 }
    );

    observer.observe(root);
  }

  /* ---- Running cultural index: a slow ledger, not a carousel ----
     Approved curated static set — locked. Do not add dates, "happening
     now"/live-status wording, or any city/event not on this list. */
  var coordinates = [
    "Monaco — Grand Prix Week",
    "Milan — Salone del Mobile",
    "Paris — Fashion Week",
    "Miami — Art Basel",
    "Cannes — Festival Week",
    "Lagos — Art and Culture Season",
    "Dubai — Design Week",
    "London — Frieze Week"
  ];

  function initIndex() {
    var stage = root.querySelector("#house-index-stage");
    if (!stage) return;

    var current = 0;
    stage.textContent = "";
    var items = coordinates.map(function (text) {
      var el = document.createElement("p");
      el.className = "house-index-item";
      el.textContent = text;
      stage.appendChild(el);
      return el;
    });

    items[0].classList.add("is-current");

    if (reduceMotion || coordinates.length < 2) {
      return; // static first item is sufficient; no cycling
    }

    setInterval(function () {
      items[current].classList.remove("is-current");
      current = (current + 1) % items.length;
      items[current].classList.add("is-current");
    }, 3800);
  }

  initReveal();
  initIndex();
})();
