/* The Global Culture Calendar — homepage carousel.
   Reads the published, reviewed events (data/culture/events.json) in the browser; the daily sync
   runs on the server and never feeds this directly. Shows the events of the current month (or the
   next month that has any), advances calmly, and stays in step: featured title, Discover link and
   the selected timeline marker always describe the same event. */
(function () {
  var root = document.getElementById('cultureCalendar');
  var lib = window.JettsetCulture;
  if (!root || !lib) return;

  var $ = function (id) { return document.getElementById(id); };
  var monthEl = $('ccMonth'), feature = $('ccFeature'), cityEl = $('ccCity'), eventEl = $('ccEvent'),
      discover = $('ccDiscover'), timeline = $('ccTimeline'), track = $('ccTrack'), dates = $('ccDates'),
      prev = $('ccPrev'), next = $('ccNext'), pauseBtn = $('ccPause'), live = $('ccLive');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INTERVAL = 6500;
  var shown = [], current = 0, timer = null, userPaused = false, hovering = false, offscreen = false, hidden = false;

  // The month heading follows today's date even if the data cannot be read.
  var today = lib.todayLocalIso();
  var tp = today.split('-');
  monthEl.textContent = lib.monthLabel(+tp[0], +tp[1]);

  function eventUrl(e) { return '/culture/events/' + encodeURIComponent(e.slug) + '/'; }

  function render(i, byUser) {
    var e = shown[i];
    current = i;
    var items = dates.querySelectorAll('.cc-date-btn');
    for (var k = 0; k < items.length; k++) {
      if (k === i) items[k].setAttribute('aria-current', 'true'); else items[k].removeAttribute('aria-current');
    }
    function apply() {
      cityEl.textContent = e.city;
      eventEl.textContent = e.name;
      discover.href = eventUrl(e);
      discover.setAttribute('aria-label', 'Discover ' + e.name + ', ' + e.city);
      feature.classList.remove('is-fading');
    }
    if (reduceMotion || feature.hidden) { apply(); }
    else { feature.classList.add('is-fading'); setTimeout(apply, 520); }   // soft crossfade, never a flash
    // keep the selected marker in view in a scrolling timeline (many events / narrow screens)
    var btn = items[i];
    if (btn && track.scrollWidth > track.clientWidth + 2) {
      var li = btn.parentNode;
      track.scrollTo({ left: Math.max(0, li.offsetLeft - (track.clientWidth - li.offsetWidth) / 2), behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    if (byUser) live.textContent = e.city + ' — ' + e.name + ', ' + lib.longRange(e.startDate, e.endDate);
  }

  function go(i, byUser) { render(((i % shown.length) + shown.length) % shown.length, byUser); }

  function canRun() { return !reduceMotion && shown.length > 1 && !userPaused && !hovering && !offscreen && !hidden; }
  function schedule() {
    clearInterval(timer); timer = null;
    if (canRun()) timer = setInterval(function () { go(current + 1, false); }, INTERVAL);
  }

  function build(view) {
    shown = view.events;
    if (!shown.length) return;   // nothing published: the title, month and CTA remain
    monthEl.textContent = lib.monthLabel(view.year, view.month);
    shown.forEach(function (e, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cc-date-btn';
      b.setAttribute('aria-label', e.name + ', ' + e.city + ', ' + lib.longRange(e.startDate, e.endDate));
      var dot = document.createElement('span'); dot.className = 'cc-dot'; dot.setAttribute('aria-hidden', 'true');
      var r = document.createElement('span'); r.className = 'cc-date-range'; r.textContent = lib.shortRange(e.startDate, e.endDate);
      var n = document.createElement('span'); n.className = 'cc-date-name'; n.textContent = e.name;
      b.appendChild(dot); b.appendChild(r); b.appendChild(n);
      b.addEventListener('click', function () { go(i, true); schedule(); });
      li.appendChild(b); dates.appendChild(li);
    });
    feature.hidden = false; timeline.hidden = false;
    var many = shown.length > 1;
    prev.hidden = next.hidden = !many;
    pauseBtn.hidden = !many || reduceMotion;
    render(0, false);
    schedule();
  }

  prev.addEventListener('click', function () { go(current - 1, true); schedule(); });
  next.addEventListener('click', function () { go(current + 1, true); schedule(); });
  pauseBtn.addEventListener('click', function () {
    userPaused = !userPaused;
    pauseBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    pauseBtn.setAttribute('aria-label', userPaused ? 'Resume automatic rotation' : 'Pause automatic rotation');
    schedule();
  });

  // Pause while the visitor hovers or has focus inside the carousel.
  root.addEventListener('mouseenter', function () { hovering = true; schedule(); });
  root.addEventListener('mouseleave', function () { hovering = false; schedule(); });
  root.addEventListener('focusin', function () { hovering = true; schedule(); });
  root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { hovering = false; schedule(); } });
  document.addEventListener('visibilitychange', function () { hidden = document.hidden; schedule(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { offscreen = !en[0].isIntersecting; schedule(); }, { threshold: 0.2 }).observe(root);
  }

  // Keyboard: arrows move between events when focus is on the timeline.
  timeline.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1, true); schedule(); var b = dates.querySelectorAll('.cc-date-btn')[current]; if (b) b.focus(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1, true); schedule(); var c = dates.querySelectorAll('.cc-date-btn')[current]; if (c) c.focus(); }
  });

  // Touch swipe (horizontal intent only, so vertical page scrolling is untouched).
  var sx = 0, sy = 0, tracking = false;
  root.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (!tracking || shown.length < 2) return; tracking = false;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { go(current + (dx < 0 ? 1 : -1), true); schedule(); }
  }, { passive: true });

  fetch('data/culture/events.json', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error('events ' + r.status); return r.json(); })
    .then(function (data) { build(lib.eventsForDisplay(data.events, today)); })
    .catch(function () { /* the feature degrades to its title, month and CTA */ });
})();
