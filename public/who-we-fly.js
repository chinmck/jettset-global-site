/* ============================================================
   WHO WE FLY — CHAPTER
   Isolated script. Progressive enhancement ONLY.

   All five audience rows are fully visible and legible from the
   static HTML/CSS alone — hover and keyboard focus already shift
   emphasis via plain :hover / :focus-visible in who-we-fly.css.
   This script adds one more optional trigger: as the section
   scrolls through view, the row nearest the vertical centre of
   the viewport is marked ".is-dominant" the same way. If this
   script fails to load, or reduced motion is requested, nothing
   is lost — every row stays in its default, legible state.
   ============================================================ */

(function whoWeFlySection() {
  var root = document.getElementById("who-we-fly-section");
  if (!root) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var index = document.getElementById("who-we-fly-index");
  var rows = Array.prototype.slice.call(root.querySelectorAll(".who-we-fly-row"));
  if (!index || rows.length === 0 || !("IntersectionObserver" in window)) return;

  var current = null;

  function setDominant(row) {
    if (row === current) return;
    if (current) current.classList.remove("is-dominant");
    row.classList.add("is-dominant");
    current = row;
    index.classList.add("js-has-dominance");
  }

  var observer = new IntersectionObserver(
    function (entries) {
      var best = null;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
      });
      if (best) setDominant(best.target);
    },
    { root: null, rootMargin: "-40% 0px -40% 0px", threshold: [0.25, 0.5, 0.75, 1] }
  );

  rows.forEach(function (row) {
    observer.observe(row);
    row.addEventListener("pointerenter", function () {
      index.classList.remove("js-has-dominance");
    });
    row.addEventListener("focusin", function () {
      index.classList.remove("js-has-dominance");
    });
    row.addEventListener("pointerleave", function () {
      if (current) index.classList.add("js-has-dominance");
    });
  });
})();
