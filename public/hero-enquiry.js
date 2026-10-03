/* Hero journey enquiry bar.
   Not a second form and not a new lead route: it only collects the same four
   details the Journey Visualiser already collects, stashes them under the
   same sessionStorage keys, and hands off to quote.html — the real point of
   enquiry capture, which pre-fills itself from those keys (see the
   "Quote page: apply any pre-fill values" block in script.js).

   From / To are searchable autocomplete fields over the site's existing
   private-jet airport database (data/private-jet-airports.json — the same file
   quote-new.html reads). No second airport list lives here. The chosen airport
   record travels with the enquiry (prefill_qFromAirport / prefill_qToAirport →
   hidden fields on quote.html → the existing Netlify form + webhook payload). */
(function(){
  // Header Contact control (phones): one tap shows Call and WhatsApp.
  (function(){
    var box = document.getElementById('navContact');
    var btn = document.getElementById('navContactBtn');
    var menu = document.getElementById('navContactMenu');
    if(!box || !btn || !menu) return;
    function open(v){
      menu.hidden = !v;
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      box.classList.toggle('is-open', v);
    }
    btn.addEventListener('click', function(){ open(menu.hidden); });
    document.addEventListener('click', function(e){ if(!box.contains(e.target)) open(false); });
    box.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && !menu.hidden){ open(false); btn.focus(); }
    });
    // Opening the language selector closes this one, and vice versa.
    document.addEventListener('click', function(e){
      if(e.target.closest && e.target.closest('.lang-switch-btn')) open(false);
    });
  })();

  var form = document.getElementById('heroEnquiry');
  if(!form) return;

  // Phones: the sound icon floats just above the bar, so it needs the bar's live height.
  (function(){
    var hero = document.getElementById('heroSection');
    if(!hero || !window.ResizeObserver) return;
    new ResizeObserver(function(){
      hero.style.setProperty('--he-h', form.offsetHeight + 'px');
    }).observe(form);
  })();

  var from = document.getElementById('heFrom');
  var to = document.getElementById('heTo');
  var date = document.getElementById('heDate');
  var travellers = document.getElementById('heTravellers');
  var status = document.getElementById('heStatus');
  var list = document.getElementById('heSuggestions');
  var countEl = document.getElementById('heCount');

  // Past dates make no sense for a flight request; the planner leaves the
  // date optional, so this only constrains what can be picked.
  function todayISO(){
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  if(date) date.min = todayISO();

  function t(msg){ return (window.jtI18n && window.jtI18n.t) ? window.jtI18n.t(msg) : msg; }

  function say(message, isError){
    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }
  function mark(input, bad){
    if(!input) return;
    if(bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  /* ---------------- airport data (existing database) ---------------- */
  var DATA_URL = 'data/private-jet-airports.json';
  var airports = null;          // prepared records, restricted ones removed
  var loading = null;
  var loadFailed = false;

  function norm(s){
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function prepare(rec){
    var aliases = Array.isArray(rec.aliases) ? rec.aliases : [];
    return {
      rec: rec,
      code: String(rec.code || '').toLowerCase(),
      name: norm(rec.name),
      city: norm(rec.city),
      country: norm(rec.country),
      region: norm(rec.region),
      aliases: aliases.map(norm)
    };
  }
  function load(){
    if(airports) return Promise.resolve(airports);
    if(!loading){
      loading = fetch(DATA_URL, {credentials:'same-origin'})
        .then(function(r){ if(!r.ok) throw new Error('airports ' + r.status); return r.json(); })
        .then(function(all){
          // Respect restrictions held on the records themselves (e.g. London Heathrow
          // is flagged privateJetRestricted in the database and is never suggested).
          airports = all.filter(function(a){ return !a.privateJetRestricted && !a.restricted; }).map(prepare);
          return airports;
        })
        .catch(function(){ loadFailed = true; loading = null; return null; });
    }
    return loading;
  }

  // Name, city, region, country, code and any stored aliases — every typed word must match somewhere.
  function search(query){
    var q = norm(query);
    if(!q || !airports) return [];
    var tokens = q.split(' ');
    var out = [];
    for(var i = 0; i < airports.length; i++){
      var a = airports[i], score = 0, ok = true;
      for(var k = 0; k < tokens.length && ok; k++){
        var tk = tokens[k], s = 0;
        if(a.code === tk) s = 100;
        else if(a.city === tk || a.aliases.indexOf(tk) > -1) s = 90;
        else if(a.city.indexOf(tk) === 0 || (' ' + a.city).indexOf(' ' + tk) > -1) s = 80;
        else if(a.name.indexOf(tk) === 0 || (' ' + a.name).indexOf(' ' + tk) > -1) s = 70;
        else if(a.aliases.some(function(x){ return x.indexOf(tk) > -1; })) s = 65;
        else if(a.region && a.region.indexOf(tk) > -1) s = 40;
        else if(a.country.indexOf(tk) > -1) s = 30;
        else if(a.city.indexOf(tk) > -1 || a.name.indexOf(tk) > -1) s = 20;
        else ok = false;
        score += s;
      }
      if(ok){
        if(a.city.indexOf(q) === 0 || a.name.indexOf(q) === 0) score += 25;   // whole-phrase prefix
        out.push({a: a, score: score});
      }
    }
    out.sort(function(x, y){ return y.score - x.score || x.a.rec.name.localeCompare(y.a.rec.name); });
    return out.slice(0, 60).map(function(x){ return x.a.rec; });
  }

  // Shown on focus before anything is typed: the airports the planner already features,
  // resolved against the database so name/city/country always come from the database.
  function featured(){
    var codes = (window.jtLocations && window.jtLocations.featuredAirportCodes) || [];
    if(!airports || !codes.length) return [];
    var byCode = {};
    airports.forEach(function(a){ byCode[a.rec.code] = a.rec; });
    return codes.map(function(c){ return byCode[c]; }).filter(Boolean);
  }

  function label(rec){ return rec.name + ' (' + rec.code + ')'; }
  function fullLabel(rec){ return rec.name + ' (' + rec.code + '), ' + rec.city + ', ' + rec.country; }
  function recordPayload(rec){
    return {code: rec.code, name: rec.name, city: rec.city, country: rec.country, source: 'private-jet-airports.json'};
  }

  /* ---------------- combobox ---------------- */
  var activeInput = null;
  var options = [];             // option elements currently shown
  var activeIndex = -1;
  var uid = 0;

  function sel(input){ return input._sel || (input._sel = {rec: null, unconfirmed: false}); }

  function position(input){
    var f = form.getBoundingClientRect();
    var field = input.closest('.jv-field').getBoundingClientRect();
    var phone = window.matchMedia('(max-width:600px)').matches;
    list.style.right = 'auto';
    if(phone){
      list.style.left = '0'; list.style.width = f.width + 'px';
    } else {
      var w = Math.min(Math.max(field.width, 340), 440, f.width);
      var left = Math.min(Math.max(field.left - f.left, 0), Math.max(f.width - w, 0));   // left edge on the active field
      list.style.left = left + 'px'; list.style.width = w + 'px';
    }
    // Never taller than the room above the bar (below the fixed header).
    var room = f.top - 84;
    list.style.maxHeight = Math.max(150, Math.min(room, 340)) + 'px';
  }

  function close(){
    if(!activeInput && list.hidden) return;
    list.hidden = true;
    list.replaceChildren();
    options = []; activeIndex = -1;
    [from, to].forEach(function(i){
      i.setAttribute('aria-expanded', 'false'); i.removeAttribute('aria-activedescendant');
    });
    activeInput = null;
  }

  function setActive(i){
    if(!options.length) return;
    activeIndex = (i + options.length) % options.length;
    options.forEach(function(o, n){ o.setAttribute('aria-selected', n === activeIndex ? 'true' : 'false'); });
    var cur = options[activeIndex];
    activeInput.setAttribute('aria-activedescendant', cur.id);
    cur.scrollIntoView({block: 'nearest'});
  }

  function choose(input, rec){
    var s = sel(input);
    s.rec = rec; s.unconfirmed = false;
    input.value = label(rec);
    mark(input, false); say('');
    close();
    countEl.textContent = '';
    input.focus();
  }
  function chooseTyped(input, text){
    var s = sel(input);
    s.rec = null; s.unconfirmed = true; s.text = text;
    mark(input, false); say('');
    close();
    input.focus();
  }

  function head(text, isError){
    var h = document.createElement('div');
    h.className = 'he-sug-head' + (isError ? ' is-error' : '');
    h.setAttribute('role', 'presentation');
    h.textContent = text;
    return h;
  }

  // opts.head: replaces the default heading; opts.error: style it as a validation message
  function render(input, opts){
    opts = opts || {};
    activeInput = input;
    var value = input.value.trim();
    var rows, headline;
    if(!airports){
      list.replaceChildren(head(loadFailed
        ? 'Airport list unavailable. Type a city or airport and we’ll confirm it with you.'
        : 'Loading airports…'));
      options = []; activeIndex = -1;
    } else {
      rows = value ? search(value) : featured();
      headline = opts.head || (value ? '' : (rows.length ? 'Suggested airports' : 'Start typing a city or airport'));
      var frag = document.createDocumentFragment();
      if(headline) frag.appendChild(head(headline, opts.error));
      options = [];
      rows.forEach(function(rec){
        var o = document.createElement('div');
        o.className = 'he-opt'; o.id = 'heOpt-' + (++uid); o.setAttribute('role', 'option'); o.setAttribute('aria-selected', 'false');
        var name = document.createElement('span'); name.className = 'he-opt-name'; name.textContent = rec.name;
        var sub = document.createElement('span'); sub.className = 'he-opt-sub';
        var loc = document.createElement('span'); loc.className = 'he-opt-loc'; loc.textContent = [rec.city, rec.country].filter(Boolean).join(', ');
        sub.appendChild(loc);
        if(rec.code){
          var code = document.createElement('span'); code.className = 'he-opt-code'; code.textContent = rec.code;
          sub.appendChild(code);
        }
        o.appendChild(name); o.appendChild(sub);
        o._rec = rec;
        frag.appendChild(o); options.push(o);
      });
      if(value && !rows.length){
        frag.appendChild(head('No matching airports found.'));
        var free = document.createElement('div');
        free.className = 'he-opt he-opt-free'; free.id = 'heOpt-' + (++uid); free.setAttribute('role', 'option'); free.setAttribute('aria-selected', 'false');
        free.textContent = 'Continue with “' + value + '”. We’ll confirm the airport with you.';
        free._free = value;
        frag.appendChild(free); options.push(free);
      }
      list.replaceChildren(frag);
      activeIndex = -1;
      countEl.textContent = (value && rows.length) ? (rows.length + (rows.length === 1 ? ' airport found.' : ' airports found.')) : '';
    }
    list.hidden = false;
    [from, to].forEach(function(i){ i.setAttribute('aria-expanded', i === input ? 'true' : 'false'); });
    input.removeAttribute('aria-activedescendant');
    position(input);
    list.scrollTop = 0;
  }

  function show(input, opts){
    render(input, opts);
    if(!airports && !loadFailed){
      load().then(function(){ if(activeInput === input) render(input, opts); });
    }
    // Keep the whole list on screen (phones: the keyboard opening can push it off).
    if(window.matchMedia('(max-width:600px)').matches && list.scrollIntoView) list.scrollIntoView({block: 'nearest'});
  }

  // Warm the airport list while the page is idle so the first focus/typing is never waiting on it.
  if('requestIdleCallback' in window) window.requestIdleCallback(function(){ load(); }, {timeout: 4000});
  else setTimeout(load, 2000);

  [from, to].forEach(function(input){
    input.addEventListener('focus', function(){ say(''); load(); show(input); });
    input.addEventListener('click', function(){ if(list.hidden || activeInput !== input) show(input); });
    input.addEventListener('input', function(){
      var s = sel(input); s.rec = null; s.unconfirmed = false;
      mark(input, false); say('');
      show(input);
    });
    input.addEventListener('keydown', function(e){
      var open = !list.hidden && activeInput === input;
      if(e.key === 'ArrowDown'){ e.preventDefault(); if(!open) show(input); else setActive(activeIndex + 1); }
      else if(e.key === 'ArrowUp'){ if(open){ e.preventDefault(); setActive(activeIndex < 0 ? options.length - 1 : activeIndex - 1); } }
      else if(e.key === 'Enter'){
        if(open && activeIndex > -1){
          e.preventDefault();
          var o = options[activeIndex];
          if(o._rec) choose(input, o._rec); else chooseTyped(input, o._free);
        }
      }
      else if(e.key === 'Escape'){ if(open){ e.preventDefault(); close(); } }
      else if(e.key === 'Tab'){ close(); }
    });
    input.addEventListener('blur', function(){
      // Let a tap on the list register first (touch devices blur the input before click).
      setTimeout(function(){
        if(document.activeElement !== from && document.activeElement !== to && !list.contains(document.activeElement)) close();
      }, 150);
    });
  });

  // Keep the input focused while the list is pressed; choose on click (mouse, touch, pen).
  list.addEventListener('mousedown', function(e){ e.preventDefault(); });
  list.addEventListener('click', function(e){
    var o = e.target.closest('.he-opt');
    if(!o || !activeInput) return;
    if(o._rec) choose(activeInput, o._rec); else chooseTyped(activeInput, o._free);
  });
  document.addEventListener('click', function(e){
    if(!form.contains(e.target)) close();
  });
  window.addEventListener('resize', function(){ if(activeInput && !list.hidden) position(activeInput); });

  [date, travellers].forEach(function(el){
    el.addEventListener('input', function(){ mark(el, false); say(''); });
    el.addEventListener('focus', close);
  });

  /* ---------------- submit → existing quote flow ---------------- */
  function resolve(input){
    // -> {ok, rec | text}; ok:false = the words match airports, so one must be chosen
    var value = input.value.trim();
    var s = sel(input);
    if(s.rec && label(s.rec) === value) return {ok: true, rec: s.rec};
    if(s.unconfirmed && s.text === value) return {ok: true, text: value};
    if(!airports) return {ok: true, text: value};                        // data unavailable: continue, to be confirmed
    return search(value).length ? {ok: false} : {ok: true, text: value}; // nothing matches: continue, to be confirmed
  }

  form.addEventListener('submit', function(event){
    event.preventDefault();
    close();
    var f = from.value.trim();
    var d = to.value.trim();

    if(!f){ mark(from, true); say(t('Please enter where you are travelling from.'), true); from.focus(); return; }
    if(!d){ mark(to, true); say(t('Please enter where you are travelling to.'), true); to.focus(); return; }

    load().then(function(){
      var a = resolve(from), b = resolve(to);
      if(!a.ok){ mark(from, true); from.focus(); show(from, {head: 'Please choose an airport from the list.', error: true}); return; }
      if(!b.ok){ mark(to, true); to.focus(); show(to, {head: 'Please choose an airport from the list.', error: true}); return; }

      var same = (a.rec && b.rec) ? a.rec.code === b.rec.code : norm(f) === norm(d);
      if(same){ mark(to, true); say(t('Choose two different cities or airports.'), true); to.focus(); return; }

      if(date.value && date.min && date.value < date.min){
        mark(date, true); say(t('Please choose a date from today onwards.'), true); date.focus(); return;
      }

      say('');
      // Same keys the Journey Visualiser and Journey Builder write, plus the chosen airport records.
      function put(prefix, r, raw){
        sessionStorage.setItem('prefill_q' + prefix, r.rec ? fullLabel(r.rec) : raw);
        sessionStorage.setItem('prefill_q' + prefix + 'Airport', JSON.stringify(
          r.rec ? recordPayload(r.rec) : {unconfirmed: true, text: raw}));
      }
      put('From', a, f);
      put('To', b, d);
      if(date.value) sessionStorage.setItem('prefill_qDepart', date.value);
      sessionStorage.setItem('prefill_qAdults', travellers.value);
      if(window.jtNavigate) window.jtNavigate('quote.html'); else window.location.href = 'quote.html';
    });
  });
})();
