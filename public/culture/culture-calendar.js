/* The Global Culture Calendar — homepage feature.
   A rolling 12-month window (the current Europe/London month and the next 11), shown one month at a
   time. The featured event, the date-ordered timeline and the month always describe the same thing.
   Data: GET /api/culture/events (approved events only); falls back to the bundled snapshot. */
(function () {
  var root = document.getElementById('cultureCalendar');
  var lib = window.JettsetCulture;
  if (!root || !lib) return;

  var $ = function (id) { return document.getElementById(id); };
  var rangeEl = $('ccRange'), monthEl = $('ccMonth'), mPrev = $('ccMonthPrev'), mNext = $('ccMonthNext'), monthsEl = $('ccMonths'),
      feature = $('ccFeature'), cityEl = $('ccCity'), eventEl = $('ccEvent'), metaEl = $('ccMeta'), discover = $('ccDiscover'),
      empty = $('ccEmpty'), timeline = $('ccTimeline'), track = $('ccTrack'), dates = $('ccDates'),
      prev = $('ccPrev'), next = $('ccNext'), pauseBtn = $('ccPause'), live = $('ccLive');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INTERVAL = 6500;
  var groups = [], pos = { mi: 0, ei: 0 }, builtMonth = -1;
  var timer = null, userPaused = false, hovering = false, offscreen = false, hidden = false, fadeTimer = null;

  var today = (function () { try { return lib.londonToday(); } catch (e) { return lib.todayLocalIso(); } })();
  var months = lib.rollingMonths(today);
  rangeEl.textContent = lib.rangeLabel(months);
  monthEl.textContent = months[0].label;

  function eventUrl(e) { return '/culture/events/' + encodeURIComponent(e.slug); }
  function plural(n) { return n + (n === 1 ? ' event' : ' events'); }

  // ---- month strip (all 12 months of the window) ----
  function buildMonths() {
    monthsEl.textContent = '';
    months.forEach(function (m, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cc-mbtn'; b.setAttribute('data-i', i);
      var n = groups[i] ? groups[i].events.length : 0;
      b.setAttribute('aria-label', m.label + ', ' + plural(n));
      var t = document.createElement('span'); t.textContent = m.short; b.appendChild(t);
      if (i === 0 || m.month === 1) { var y = document.createElement('span'); y.className = 'cc-yr'; y.setAttribute('aria-hidden', 'true'); y.textContent = '’' + String(m.year).slice(2); b.appendChild(y); }
      if (n) b.classList.add('has-events');
      b.addEventListener('click', function () { goMonth(i, true); schedule(); });
      monthsEl.appendChild(b);
    });
  }

  // ---- timeline for the active month ----
  function buildTimeline(mi) {
    dates.textContent = '';
    groups[mi].events.forEach(function (e, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cc-date-btn';
      b.setAttribute('aria-label', e.name + ', ' + e.city + ', ' + lib.longRange(e.startDate, e.endDate));
      var dot = document.createElement('span'); dot.className = 'cc-dot'; dot.setAttribute('aria-hidden', 'true');
      var r = document.createElement('span'); r.className = 'cc-date-range'; r.textContent = lib.shortRange(e.startDate, e.endDate);
      var n = document.createElement('span'); n.className = 'cc-date-name'; n.textContent = e.name;
      b.appendChild(dot); b.appendChild(r); b.appendChild(n);
      b.addEventListener('click', function () { goEvent(mi, i, true); schedule(); });
      li.appendChild(b); dates.appendChild(li);
    });
    builtMonth = mi;
  }

  function setMonthChrome(mi) {
    var m = months[mi];
    monthEl.textContent = m.label;
    var btns = monthsEl.querySelectorAll('.cc-mbtn');
    for (var k = 0; k < btns.length; k++) {
      if (k === mi) { btns[k].setAttribute('aria-current', 'true'); btns[k].classList.add('is-active'); }
      else { btns[k].removeAttribute('aria-current'); btns[k].classList.remove('is-active'); }
    }
    mPrev.disabled = mi === 0; mNext.disabled = mi === months.length - 1;
  }

  function render(byUser, monthChanged) {
    var g = groups[pos.mi], e = g.events[pos.ei];
    setMonthChrome(pos.mi);
    var has = g.events.length > 0;
    empty.hidden = has; feature.hidden = !has; timeline.hidden = !has;
    if (!has) {
      empty.textContent = 'No approved events in ' + months[pos.mi].label + ' yet.';
      builtMonth = pos.mi; dates.textContent = '';
      if (byUser) live.textContent = empty.textContent;
      return;
    }
    if (builtMonth !== pos.mi) buildTimeline(pos.mi);
    var many = g.events.length > 1 || groupsWithEvents() > 1;
    prev.hidden = next.hidden = !many; pauseBtn.hidden = !many || reduceMotion;
    function apply() {
      var items = dates.querySelectorAll('.cc-date-btn');
      for (var k = 0; k < items.length; k++) { if (k === pos.ei) items[k].setAttribute('aria-current', 'true'); else items[k].removeAttribute('aria-current'); }
      cityEl.textContent = e.city;
      eventEl.textContent = e.name;
      metaEl.textContent = lib.longRange(e.startDate, e.endDate) + (e.venue ? ' · ' + e.venue : '');
      discover.href = eventUrl(e);
      discover.setAttribute('aria-label', 'Discover ' + e.name + ', ' + e.city);
      feature.classList.remove('is-fading');
    }
    clearTimeout(fadeTimer);
    if (reduceMotion || monthChanged === 'instant') apply();
    else { feature.classList.add('is-fading'); fadeTimer = setTimeout(apply, 520); }   // soft crossfade, never a flash
    var items0 = dates.querySelectorAll('.cc-date-btn'), btn = items0[pos.ei];
    if (btn && track.scrollWidth > track.clientWidth + 2) {
      var li = btn.parentNode;
      track.scrollTo({ left: Math.max(0, li.offsetLeft - (track.clientWidth - li.offsetWidth) / 2), behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    if (byUser) live.textContent = months[pos.mi].label + ': ' + e.city + ' — ' + e.name + ', ' + lib.longRange(e.startDate, e.endDate);
  }

  function groupsWithEvents() { var n = 0; groups.forEach(function (g) { if (g.events.length) n++; }); return n; }
  function goMonth(mi, byUser) { pos = { mi: Math.max(0, Math.min(months.length - 1, mi)), ei: 0 }; render(byUser, 'month'); }
  function goEvent(mi, ei, byUser) { pos = { mi: mi, ei: ei }; render(byUser); }
  function step(dir, byUser) { pos = dir > 0 ? lib.nextPosition(groups, pos) : lib.prevPosition(groups, pos); render(byUser); }

  function canRun() { return !reduceMotion && groupsWithEvents() > 0 && (groupsWithEvents() > 1 || groups[pos.mi].events.length > 1) && !userPaused && !hovering && !offscreen && !hidden; }
  function schedule() { clearInterval(timer); timer = null; if (canRun()) timer = setInterval(function () { step(1, false); }, INTERVAL); }

  function build(list) {
    groups = lib.eventsByMonth(list, today);
    buildMonths();
    pos = lib.firstPosition(groups);
    render(false, 'instant');
    schedule();
  }

  mPrev.addEventListener('click', function () { goMonth(pos.mi - 1, true); schedule(); });
  mNext.addEventListener('click', function () { goMonth(pos.mi + 1, true); schedule(); });
  prev.addEventListener('click', function () { step(-1, true); schedule(); });
  next.addEventListener('click', function () { step(1, true); schedule(); });
  pauseBtn.addEventListener('click', function () {
    userPaused = !userPaused;
    pauseBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    pauseBtn.setAttribute('aria-label', userPaused ? 'Resume automatic rotation' : 'Pause automatic rotation');
    schedule();
  });
  root.addEventListener('mouseenter', function () { hovering = true; schedule(); });
  root.addEventListener('mouseleave', function () { hovering = false; schedule(); });
  root.addEventListener('focusin', function () { hovering = true; schedule(); });
  root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { hovering = false; schedule(); } });
  document.addEventListener('visibilitychange', function () { hidden = document.hidden; schedule(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { offscreen = !en[0].isIntersecting; schedule(); }, { threshold: 0.2 }).observe(root);

  // Keyboard: ←/→ on the month strip change month; ←/→ on the timeline change event.
  monthsEl.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault(); goMonth(pos.mi + (e.key === 'ArrowRight' ? 1 : -1), true); schedule();
    var b = monthsEl.querySelectorAll('.cc-mbtn')[pos.mi]; if (b) b.focus();
  });
  timeline.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1, true); schedule();
    var b = dates.querySelectorAll('.cc-date-btn')[pos.ei]; if (b) b.focus();
  });

  // Touch swipe (horizontal intent only; vertical page scrolling is untouched).
  var sx = 0, sy = 0, tracking = false;
  root.addEventListener('touchstart', function (e) { if (e.touches.length !== 1 || e.target.closest('.cc-months')) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (!tracking) return; tracking = false;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { step(dx < 0 ? 1 : -1, true); schedule(); }
  }, { passive: true });

  function fromApi(r) { if (!r.ok) throw new Error('api ' + r.status); return r.json(); }
  fetch('/api/culture/events', { credentials: 'same-origin' }).then(fromApi)
    .catch(function () { return fetch('data/culture/events.json', { credentials: 'same-origin' }).then(fromApi); })
    .then(function (data) { build(data.events || []); })
    .catch(function () { build([]); });   // never leave the section blank: shows the calm empty state
})();
