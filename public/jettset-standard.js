/* ============================================================
   THE JETTSET STANDARD — CHAPTER
   Isolated script. Progressive enhancement ONLY.

   Every standard is fully visible, legible and understandable
   from the static HTML/CSS alone — hover and keyboard focus
   already shift emphasis between rows with zero JavaScript,
   via plain :hover / :focus-visible in jettset-standard.css.

   This script adds exactly one more emphasis trigger: as the
   section scrolls through view, the row nearest the vertical
   centre of the viewport gets marked ".is-dominant" the same
   way hover/focus already do. If this script fails to load, or
   the person has requested reduced motion, nothing is lost —
   every row simply stays in its default, fully-legible state.
   ============================================================ */

(function jettsetStandardSection() {
  var root = document.getElementById("jettset-standard-section");
  if (!root) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var ledger = document.getElementById("jettset-standard-ledger");
  var rows = Array.prototype.slice.call(root.querySelectorAll(".jettset-standard-row"));
  if (!ledger || rows.length === 0 || !("IntersectionObserver" in window)) return;

  var current = null;

  function setDominant(row) {
    if (row === current) return;
    if (current) current.classList.remove("is-dominant");
    row.classList.add("is-dominant");
    current = row;
    ledger.classList.add("js-has-dominance");
  }

  var observer = new IntersectionObserver(
    function (entries) {
      // Pick whichever observed row has the largest visible ratio
      // nearest viewport centre; ties resolved by intersectionRatio.
      var best = null;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (!best || entry.intersectionRatio > best.intersectionRatio) {
          best = entry;
        }
      });
      if (best) setDominant(best.target);
    },
    {
      root: null,
      // Narrow band around vertical centre of the viewport.
      rootMargin: "-40% 0px -40% 0px",
      threshold: [0.25, 0.5, 0.75, 1]
    }
  );

  rows.forEach(function (row) {
    observer.observe(row);
  });

  // Hovering or focusing a row manually takes priority over scroll —
  // release the scroll-driven state so the two mechanisms never fight.
  rows.forEach(function (row) {
    row.addEventListener("pointerenter", function () {
      ledger.classList.remove("js-has-dominance");
    });
    row.addEventListener("focusin", function () {
      ledger.classList.remove("js-has-dominance");
    });
    row.addEventListener("pointerleave", function () {
      if (current) ledger.classList.add("js-has-dominance");
    });
  });
})();
