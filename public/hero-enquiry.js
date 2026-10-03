/* Hero journey enquiry bar.
   Not a second form and not a new lead route: it only collects the same four
   details the Journey Visualiser already collects, stashes them under the
   same sessionStorage keys, and hands off to quote.html — the real point of
   enquiry capture, which pre-fills itself from those keys (see the
   "Quote page: apply any pre-fill values" block in script.js). */
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
  var suggestions = document.getElementById('heSuggestions');

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
  function clearSuggestions(){ suggestions.replaceChildren(); }
  function mark(input, bad){
    if(!input) return;
    if(bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  // Same location catalogue and country-suggestion behaviour as the Journey
  // Visualiser (exposed by jettset-world/globe.js as window.jtLocations).
  // If that module hasn't loaded, free text still passes through — the quote
  // form accepts any city or airport, and is where the request is captured.
  function lookup(value){
    var api = window.jtLocations;
    return api ? api.find(value) : null;
  }
  function countryMatches(value){
    var api = window.jtLocations;
    return api ? api.countryLocations(value) : [];
  }
  function offerCountry(input, matches){
    clearSuggestions();
    say(t('Select a city or airport in') + ' ' + t(matches[0].country) + '.', false);
    matches.forEach(function(location){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'jv-location-suggestion';
      b.textContent = location.kind === 'airport'
        ? location.city + ' / ' + location.name + ' (' + location.code + ')'
        : location.name;
      b.addEventListener('click', function(){
        input.value = location.inputValue;
        clearSuggestions();
        say('');
        mark(input, false);
        input.focus();
      });
      suggestions.appendChild(b);
    });
  }

  [from, to, date, travellers].forEach(function(el){
    el.addEventListener('input', function(){ mark(el, false); say(''); clearSuggestions(); });
  });

  form.addEventListener('submit', function(event){
    event.preventDefault();
    clearSuggestions();
    var f = from.value.trim();
    var d = to.value.trim();

    if(!f){ mark(from, true); say(t('Please enter where you are travelling from.'), true); from.focus(); return; }
    if(!d){ mark(to, true); say(t('Please enter where you are travelling to.'), true); to.focus(); return; }

    // A country is not a departure point — offer its cities/airports, as the planner does.
    var fm = !lookup(f) ? countryMatches(f) : [];
    if(fm.length){ mark(from, true); offerCountry(from, fm); from.focus(); return; }
    var dm = !lookup(d) ? countryMatches(d) : [];
    if(dm.length){ mark(to, true); offerCountry(to, dm); to.focus(); return; }

    var a = lookup(f), b = lookup(d);
    var same = (a && b) ? (a.name === b.name) : (f.toLowerCase() === d.toLowerCase());
    if(same){ mark(to, true); say(t('Choose two different cities or airports.'), true); to.focus(); return; }

    if(date.value && date.min && date.value < date.min){
      mark(date, true); say(t('Please choose a date from today onwards.'), true); date.focus(); return;
    }

    say('');
    // Same keys the Journey Visualiser and Journey Builder write.
    sessionStorage.setItem('prefill_qFrom', f);
    sessionStorage.setItem('prefill_qTo', d);
    if(date.value) sessionStorage.setItem('prefill_qDepart', date.value);
    sessionStorage.setItem('prefill_qAdults', travellers.value);
    if(window.jtNavigate) window.jtNavigate('quote.html'); else window.location.href = 'quote.html';
  });
})();
