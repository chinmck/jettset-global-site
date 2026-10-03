/* The Global Culture Calendar — shared pure helpers (browser global `JettsetCulture`, also
   importable from Node for tests and the page generator). Dates are ISO YYYY-MM-DD strings in
   the event's own timezone and are never converted to the visitor's timezone. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JettsetCulture = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var ISO = /^\d{4}-\d{2}-\d{2}$/;

  function parts(iso) { var p = iso.split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function monthKey(y, m) { return y + '-' + pad(m); }
  function monthStart(y, m) { return monthKey(y, m) + '-01'; }
  function monthEnd(y, m) {
    var last = new Date(Date.UTC(y, m, 0)).getUTCDate();   // day 0 of next month
    return monthKey(y, m) + '-' + pad(last);
  }
  function addMonths(y, m, n) { var t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; }

  // Published = reviewed and live. Cancelled / postponed events never show in the carousel.
  function isPublic(e) {
    return !!e && e.publication === 'published' && e.status === 'confirmed' &&
      ISO.test(e.startDate || '') && ISO.test(e.endDate || '') && e.startDate <= e.endDate &&
      !!e.slug && !!e.name && !!e.city;
  }

  function overlapsMonth(e, y, m) { return e.startDate <= monthEnd(y, m) && e.endDate >= monthStart(y, m); }

  // The events for the month being shown. Today's month if it has any, otherwise the next month
  // (within a year) that does, so the section never reads as empty. Returns {year, month, events}.
  function eventsForDisplay(events, todayIso) {
    var t = parts(todayIso);
    var list = (events || []).filter(isPublic);
    for (var i = 0; i < 12; i++) {
      var ym = addMonths(t.y, t.m, i);
      var inMonth = list.filter(function (e) { return overlapsMonth(e, ym.y, ym.m); })
        .sort(function (a, b) { return a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name); });
      if (inMonth.length) return { year: ym.y, month: ym.m, events: inMonth };
    }
    return { year: t.y, month: t.m, events: [] };
  }

  function monthLabel(y, m) { return MONTHS[m - 1] + ' ' + y; }

  var SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  // "14–18 OCT", "29 OCT – 2 NOV", "23 OCT" (single day)
  function shortRange(a, b) {
    var s = parts(a), e = parts(b);
    if (a === b) return s.d + ' ' + SHORT[s.m - 1];
    if (s.y === e.y && s.m === e.m) return s.d + '–' + e.d + ' ' + SHORT[s.m - 1];
    return s.d + ' ' + SHORT[s.m - 1] + ' – ' + e.d + ' ' + SHORT[e.m - 1];
  }
  // "14–18 October 2026", "29 October – 2 November 2026"
  function longRange(a, b) {
    var s = parts(a), e = parts(b);
    if (a === b) return s.d + ' ' + MONTHS[s.m - 1] + ' ' + s.y;
    if (s.y === e.y && s.m === e.m) return s.d + '–' + e.d + ' ' + MONTHS[s.m - 1] + ' ' + s.y;
    if (s.y === e.y) return s.d + ' ' + MONTHS[s.m - 1] + ' – ' + e.d + ' ' + MONTHS[e.m - 1] + ' ' + s.y;
    return s.d + ' ' + MONTHS[s.m - 1] + ' ' + s.y + ' – ' + e.d + ' ' + MONTHS[e.m - 1] + ' ' + e.y;
  }
  function longDate(a) { var p = parts(a); return p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y; }

  function todayLocalIso(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  return {
    isPublic: isPublic, overlapsMonth: overlapsMonth, eventsForDisplay: eventsForDisplay,
    monthLabel: monthLabel, shortRange: shortRange, longRange: longRange, longDate: longDate,
    todayLocalIso: todayLocalIso, monthStart: monthStart, monthEnd: monthEnd
  };
});
