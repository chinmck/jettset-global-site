/* The Global Culture Calendar — shared pure date/calendar helpers.
   CANONICAL SOURCE (CommonJS/UMD). `public/culture/culture-lib.js` is a generated browser copy:
   run `npm run culture:lib` after editing (a test fails if the two drift).
   Dates are ISO YYYY-MM-DD strings in the event's own timezone; "today" is always the
   Europe/London calendar date, never the visitor's own date. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JettsetCulture = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  var WINDOW_MONTHS = 12;

  function parts(iso) { var p = iso.split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function monthKey(y, m) { return y + '-' + pad(m); }
  function monthStart(y, m) { return monthKey(y, m) + '-01'; }
  function monthEnd(y, m) { return monthKey(y, m) + '-' + pad(new Date(Date.UTC(y, m, 0)).getUTCDate()); }
  function addMonths(y, m, n) { var t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; }

  // Today's calendar date in Europe/London (handles GMT/BST automatically).
  function londonToday(now) {
    var d = now || new Date();
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  // Fallback used only if Intl time-zone data is unavailable (very old browsers).
  function todayLocalIso(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function monthLabel(y, m) { return MONTHS[m - 1] + ' ' + y; }

  // The rolling window: the current month and the following 11, oldest first.
  function rollingMonths(todayIso, count) {
    var t = parts(todayIso), out = [], n = count || WINDOW_MONTHS;
    for (var i = 0; i < n; i++) {
      var ym = addMonths(t.y, t.m, i);
      out.push({ year: ym.y, month: ym.m, key: monthKey(ym.y, ym.m), label: monthLabel(ym.y, ym.m), short: SHORT[ym.m - 1], start: monthStart(ym.y, ym.m), end: monthEnd(ym.y, ym.m) });
    }
    return out;
  }
  function rangeLabel(months) {
    if (!months.length) return '';
    var a = months[0], b = months[months.length - 1];
    return a.label + ' – ' + b.label;
  }
  function windowBounds(todayIso, count) {
    var ms = rollingMonths(todayIso, count);
    return { start: ms[0].start, end: ms[ms.length - 1].end };
  }

  // Public = approved and live. Cancelled / withdrawn events never show.
  function isPublic(e) {
    return !!e && e.publication === 'published' && e.status === 'confirmed' &&
      ISO.test(e.startDate || '') && ISO.test(e.endDate || '') && e.startDate <= e.endDate &&
      !!e.slug && !!e.name && !!e.city;
  }
  function overlapsMonth(e, y, m) { return e.startDate <= monthEnd(y, m) && e.endDate >= monthStart(y, m); }

  // Group the approved events by month. An event is listed once, in the month it starts
  // (an event already under way when the window opens is listed in the first month).
  // Events that have ended before today are left out of the current month.
  function eventsByMonth(events, todayIso, count) {
    var months = rollingMonths(todayIso, count);
    var first = months[0].key;
    var buckets = {};
    months.forEach(function (m) { buckets[m.key] = []; });
    (events || []).filter(isPublic).forEach(function (e) {
      if (e.endDate < todayIso) return;
      var key = e.startDate.slice(0, 7);
      if (key < first) key = first;
      if (buckets[key]) buckets[key].push(e);
    });
    months.forEach(function (m) {
      buckets[m.key].sort(function (a, b) { return a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name); });
    });
    return months.map(function (m) { return { month: m, events: buckets[m.key] }; });
  }

  var API_SHORT = SHORT;
  function shortRange(a, b) {
    var s = parts(a), e = parts(b);
    if (a === b) return s.d + ' ' + API_SHORT[s.m - 1];
    if (s.y === e.y && s.m === e.m) return s.d + '–' + e.d + ' ' + API_SHORT[s.m - 1];
    return s.d + ' ' + API_SHORT[s.m - 1] + ' – ' + e.d + ' ' + API_SHORT[e.m - 1];
  }
  function longRange(a, b) {
    var s = parts(a), e = parts(b);
    if (a === b) return s.d + ' ' + MONTHS[s.m - 1] + ' ' + s.y;
    if (s.y === e.y && s.m === e.m) return s.d + '–' + e.d + ' ' + MONTHS[s.m - 1] + ' ' + s.y;
    if (s.y === e.y) return s.d + ' ' + MONTHS[s.m - 1] + ' – ' + e.d + ' ' + MONTHS[e.m - 1] + ' ' + s.y;
    return s.d + ' ' + MONTHS[s.m - 1] + ' ' + s.y + ' – ' + e.d + ' ' + MONTHS[e.m - 1] + ' ' + e.y;
  }
  function longDate(a) { var p = parts(a); return p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y; }


  // ---- carousel position logic (shared by the homepage script and the tests) ----
  // groups = eventsByMonth(...); pos = {mi: month index, ei: event index}
  function firstWithEvents(groups, from, step) {
    var n = groups.length;
    for (var k = 0; k < n; k++) {
      var i = (((from + step * k) % n) + n) % n;
      if (groups[i].events.length) return i;
    }
    return -1;
  }
  // Auto-advance: next event in the month, then the next month that has events (empty months are
  // skipped by the autoplay, though visitors can still select them), then back to the start.
  function nextPosition(groups, pos) {
    var cur = groups[pos.mi];
    if (cur && pos.ei + 1 < cur.events.length) return { mi: pos.mi, ei: pos.ei + 1 };
    var mi = firstWithEvents(groups, pos.mi + 1, 1);
    return mi < 0 ? { mi: pos.mi, ei: 0 } : { mi: mi, ei: 0 };
  }
  function prevPosition(groups, pos) {
    if (pos.ei > 0) return { mi: pos.mi, ei: pos.ei - 1 };
    var mi = firstWithEvents(groups, pos.mi - 1, -1);
    return mi < 0 ? { mi: pos.mi, ei: 0 } : { mi: mi, ei: groups[mi].events.length - 1 };
  }
  function firstPosition(groups) { var mi = firstWithEvents(groups, 0, 1); return { mi: mi < 0 ? 0 : mi, ei: 0 }; }

  return {
    nextPosition: nextPosition, prevPosition: prevPosition, firstPosition: firstPosition,
    WINDOW_MONTHS: WINDOW_MONTHS, MONTHS: MONTHS,
    londonToday: londonToday, todayLocalIso: todayLocalIso,
    rollingMonths: rollingMonths, rangeLabel: rangeLabel, windowBounds: windowBounds,
    isPublic: isPublic, overlapsMonth: overlapsMonth, eventsByMonth: eventsByMonth,
    monthLabel: monthLabel, shortRange: shortRange, longRange: longRange, longDate: longDate,
    monthStart: monthStart, monthEnd: monthEnd, addMonths: addMonths
  };
});
