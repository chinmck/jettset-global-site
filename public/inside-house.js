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
})();
