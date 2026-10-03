/* Jettset language layer — English, French, Spanish, Arabic.

   Design: the pages stay exactly as authored (English is the source of truth
   and the no-JS fallback). This script swaps text for approved translations
   held in /i18n/<lang>.json, keyed by the exact English string, so no page
   structure or copy is rewritten. Anything without an entry is left in
   English rather than machine-guessed — see window.jtI18n.missing().

   - Selected language persists across pages (localStorage 'jt-lang'); ?lang=xx
     in the URL also selects and saves it.
   - Arabic sets <html dir="rtl" lang="ar">.
   - Text nodes, inline-mixed elements, and the attributes placeholder,
     aria-label, alt, title, plus <title>/meta description are translated;
     content injected later by page scripts is caught by a MutationObserver;
     alert() messages (form validation / confirmations) are translated too. */
(function(){
  'use strict';

  var SUPPORTED = ['en','fr','es','ar'];
  var UI = {
    en:{name:'English', code:'EN', label:'Language', pick:'Select language'},
    fr:{name:'Français', code:'FR', label:'Langue', pick:'Choisir la langue'},
    es:{name:'Español', code:'ES', label:'Idioma', pick:'Elegir idioma'},
    ar:{name:'العربية', code:'AR', label:'اللغة', pick:'اختر اللغة'}
  };
  var STORE = 'jt-lang';
  var VERSION = '4';
  var ATTRS = ['placeholder','aria-label','alt','title'];
  var SKIP = {SCRIPT:1, STYLE:1, NOSCRIPT:1, SVG:1, CANVAS:1, TEXTAREA:1, TEMPLATE:1, CODE:1, PRE:1};
  var INLINE = {A:1, SPAN:1, STRONG:1, EM:1, B:1, I:1, BR:1, SMALL:1, SUP:1, SUB:1, ABBR:1, TIME:1, MARK:1, U:1, WBR:1};

  var html = document.documentElement;
  var lang = 'en';
  var dict = {strings:{}, patterns:[]};
  var compiled = [];
  var seen = {};          // every translatable key met on this page -> true if translated
  var observer = null;
  var readyResolve;
  window.jtI18nReady = new Promise(function(r){ readyResolve = r; });

  function norm(s){ return s.replace(/\s+/g,' ').trim(); }
  function safeGet(){ try{ return localStorage.getItem(STORE); }catch(e){ return null; } }
  function safeSet(v){ try{ localStorage.setItem(STORE, v); }catch(e){} }

  function pickInitial(){
    var q = null;
    try{ q = new URLSearchParams(window.location.search).get('lang'); }catch(e){}
    if(q && SUPPORTED.indexOf(q) > -1){ safeSet(q); return q; }
    var s = safeGet();
    return (s && SUPPORTED.indexOf(s) > -1) ? s : 'en';
  }

  /* ---------- lookup ---------- */
  // Template for pattern entries: $1..$9 insert captured groups (translated if
  // the group itself has an entry, e.g. a country name); {$1?one|many} switches
  // on whether group 1 is exactly "1".
  function expand(tpl, m){
    var out = tpl.replace(/\{\$(\d)\?([^|}]*)\|([^}]*)\}/g, function(_, n, one, many){ return (m[+n] === '1') ? one : many; });
    return out.replace(/\$(\d)/g, function(_, n){
      var g = m[+n]; if(g == null) return '';
      var t = dict.strings[norm(g)];
      return t != null ? t : g;
    });
  }
  function lookup(key){
    if(lang === 'en') return null;
    var k = norm(key);
    if(!k) return null;
    var hit = dict.strings[k];
    if(hit == null){
      for(var i = 0; i < compiled.length; i++){
        var m = compiled[i][0].exec(k);
        if(m){ hit = expand(compiled[i][1], m); break; }
      }
    }
    seen[k] = (hit != null);
    return hit == null ? null : hit;
  }
  function record(key){ var k = norm(key); if(k && !(k in seen)) seen[k] = false; }

  /* ---------- text nodes ---------- */
  function applyText(node){
    var raw = node.nodeValue, orig;
    if(node.__jtTr != null && raw === node.__jtTr) orig = node.__jtOrig;
    else { orig = raw; node.__jtOrig = raw; node.__jtTr = null; }
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(orig);
    if(!m[2]) return;
    var tr = lookup(m[2]);
    if(lang === 'en') record(m[2]);
    var out = (tr == null) ? orig : (m[1] + tr + m[3]);
    if(out !== raw){ node.nodeValue = out; }
    node.__jtTr = (out !== orig) ? out : null;
  }

  /* ---------- inline-mixed elements (text + <a>/<span>/<br>…) ---------- */
  function isInlineOnly(el){
    for(var c = el.firstChild; c; c = c.nextSibling){
      if(c.nodeType === 1){
        if(!INLINE[c.tagName] || !isInlineOnly(c)) return false;
      }
    }
    return true;
  }
  function hasElementChild(el){
    for(var c = el.firstChild; c; c = c.nextSibling){ if(c.nodeType === 1) return true; }
    return false;
  }
  function applyUnit(el){
    var cur = el.innerHTML, orig;
    if(el.__jtTrHTML != null && cur === el.__jtTrHTML) orig = el.__jtOrigHTML;
    else { orig = cur; el.__jtOrigHTML = cur; el.__jtTrHTML = null; }
    var key = norm(orig);
    var tr = lookup(key);
    if(lang === 'en') record(key);
    if(tr == null) return false;
    if(tr !== cur) el.innerHTML = tr;
    el.__jtTrHTML = el.innerHTML;
    return true;
  }

  /* ---------- attributes ---------- */
  function applyAttrs(el){
    for(var i = 0; i < ATTRS.length; i++){
      var a = ATTRS[i];
      if(!el.hasAttribute(a)) continue;
      var store = el.__jtAttr || (el.__jtAttr = {});
      var raw = el.getAttribute(a), rec = store[a], orig;
      if(rec && rec.tr != null && raw === rec.tr) orig = rec.orig;
      else { orig = raw; rec = store[a] = {orig:raw, tr:null}; }
      var tr = lookup(orig);
      if(lang === 'en') record(orig);
      var out = (tr == null) ? orig : tr;
      if(out !== raw) el.setAttribute(a, out);
      rec.tr = (out !== orig) ? out : null;
    }
    if(el.tagName === 'INPUT' && /^(submit|button)$/i.test(el.type) && el.value){
      var rv = el.value, vr = el.__jtVal;
      var vo = (vr && vr.tr != null && rv === vr.tr) ? vr.orig : rv;
      var vt = lookup(vo); if(lang === 'en') record(vo);
      var vout = vt == null ? vo : vt;
      if(vout !== rv) el.value = vout;
      el.__jtVal = {orig:vo, tr:(vout !== vo ? vout : null)};
    }
  }

  /* ---------- tree walk ---------- */
  function walk(node){
    if(node.nodeType === 3){ applyText(node); return; }
    if(node.nodeType !== 1) return;
    if(SKIP[node.tagName.toUpperCase()] || node.hasAttribute('data-no-i18n')) return;
    applyAttrs(node);
    if(hasElementChild(node) && isInlineOnly(node) && node.textContent.trim()){
      if(applyUnit(node)) return;
    }
    for(var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function applyDocMeta(){
    if(document.__jtTitle == null) document.__jtTitle = document.title;
    var t = lookup(document.__jtTitle);
    if(lang === 'en') record(document.__jtTitle);
    document.title = t == null ? document.__jtTitle : t;
    var meta = document.querySelector('meta[name="description"]');
    if(meta){
      if(meta.__jtOrig == null) meta.__jtOrig = meta.getAttribute('content') || '';
      var mt = lookup(meta.__jtOrig);
      if(lang === 'en') record(meta.__jtOrig);
      meta.setAttribute('content', mt == null ? meta.__jtOrig : mt);
    }
  }

  function applyAll(){
    if(observer) observer.disconnect();
    walk(document.body);
    applyDocMeta();
    observe();
  }

  /* ---------- live content (anything page scripts add or rewrite later) ---------- */
  function observe(){
    if(!observer){
      observer = new MutationObserver(function(records){
        observer.disconnect();
        records.forEach(function(r){
          var tgt = r.target && (r.target.nodeType === 1 ? r.target : r.target.parentElement);
          if(tgt && tgt.closest && tgt.closest('[data-no-i18n]')) return;   // the selector itself
          if(r.type === 'childList'){
            r.addedNodes.forEach(function(n){ walk(n); });
            if(r.target && r.target.nodeType === 1 && r.addedNodes.length){ reunit(r.target); }
          } else if(r.type === 'characterData'){
            var n = r.target;
            if(!(n.__jtTr != null && n.nodeValue === n.__jtTr)){
              applyText(n);
              if(n.parentElement) reunit(n.parentElement);
            }
          } else if(r.type === 'attributes'){
            applyAttrs(r.target);
          }
        });
        observe();
      });
    }
    observer.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS});
  }
  // If a script rewrote part of a mixed-inline element, re-check it as a unit.
  function reunit(el){
    if(el === document.body || SKIP[el.tagName.toUpperCase()]) return;
    if(hasElementChild(el) && isInlineOnly(el) && el.textContent.trim()) applyUnit(el);
  }

  /* ---------- dictionary ---------- */
  function load(l){
    if(l === 'en') return Promise.resolve({strings:{}, patterns:[]});
    return fetch('/i18n/' + l + '.json?v=' + VERSION, {credentials:'same-origin'})
      .then(function(r){ if(!r.ok) throw new Error('dictionary ' + r.status); return r.json(); })
      .catch(function(){ return {strings:{}, patterns:[]}; });
  }
  function compile(d){
    compiled = (d.patterns || []).map(function(p){ return [new RegExp(p[0]), p[1]]; });
  }

  /* ---------- html lang / dir ---------- */
  function setDocLang(l){
    html.setAttribute('lang', l);
    html.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    html.setAttribute('data-lang', l);
  }

  function setLanguage(l, opts){
    if(SUPPORTED.indexOf(l) < 0) l = 'en';
    return load(l).then(function(d){
      lang = l; dict = d; compile(d); seen = {};
      setDocLang(l);
      if(!opts || opts.persist !== false) safeSet(l);
      applyAll();
      syncSelector();
      document.dispatchEvent(new CustomEvent('jt:languagechange', {detail:{lang:l}}));
    });
  }

  /* ---------- alert() messages ---------- */
  var nativeAlert = window.alert;
  window.alert = function(message){
    var tr = (typeof message === 'string') ? lookup(message) : null;
    return nativeAlert.call(window, tr == null ? message : tr);
  };

  /* ---------- selector ---------- */
  var sw, btn, menu;
  function buildSelector(){
    var nav = document.getElementById('mainNav');
    if(!nav || document.getElementById('langSwitch')) return;
    sw = document.createElement('div');
    sw.className = 'lang-switch'; sw.id = 'langSwitch'; sw.setAttribute('data-no-i18n', '');

    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'lang-switch-btn';
    btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'langMenu');
    btn.innerHTML = '<span class="lang-switch-code"></span><span class="lang-switch-caret" aria-hidden="true"></span>';

    menu = document.createElement('ul');
    menu.className = 'lang-switch-menu'; menu.id = 'langMenu'; menu.hidden = true;
    SUPPORTED.forEach(function(l){
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'lang-switch-opt';
      b.setAttribute('lang', l); b.setAttribute('data-lang-opt', l);
      b.textContent = UI[l].name;
      li.appendChild(b); menu.appendChild(li);
    });
    sw.appendChild(btn); sw.appendChild(menu); (nav.querySelector('.nav-tools') || nav).appendChild(sw);

    btn.addEventListener('click', function(){ toggle(menu.hidden); });
    menu.addEventListener('click', function(e){
      var o = e.target.closest('[data-lang-opt]');
      if(!o) return;
      toggle(false); btn.focus();
      setLanguage(o.getAttribute('data-lang-opt'));
    });
    document.addEventListener('click', function(e){ if(!sw.contains(e.target)) toggle(false); });
    sw.addEventListener('keydown', function(e){
      var opts = [].slice.call(menu.querySelectorAll('button'));
      var i = opts.indexOf(document.activeElement);
      if(e.key === 'Escape'){ if(!menu.hidden){ toggle(false); btn.focus(); } }
      else if(e.key === 'ArrowDown'){ e.preventDefault(); if(menu.hidden) toggle(true); else opts[(i + 1) % opts.length].focus(); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); if(!menu.hidden) opts[(i - 1 + opts.length) % opts.length].focus(); }
      else if(e.key === 'Tab' && !menu.hidden){ toggle(false); }
    });
    syncSelector();
  }
  function toggle(open){
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    sw.classList.toggle('is-open', open);
    if(open){ var cur = menu.querySelector('[aria-current="true"]') || menu.querySelector('button'); if(cur) cur.focus(); }
  }
  function syncSelector(){
    if(!btn) return;
    var u = UI[lang];
    btn.querySelector('.lang-switch-code').textContent = u.code;
    btn.setAttribute('aria-label', u.label + ': ' + u.name);
    menu.setAttribute('aria-label', u.pick);
    [].forEach.call(menu.querySelectorAll('[data-lang-opt]'), function(o){
      if(o.getAttribute('data-lang-opt') === lang) o.setAttribute('aria-current', 'true'); else o.removeAttribute('aria-current');
    });
  }

  /* ---------- public API (also used for review: jtI18n.missing()) ---------- */
  window.jtI18n = {
    lang: function(){ return lang; },
    set: setLanguage,
    t: function(s){ var r = lookup(s); return r == null ? s : r; },
    missing: function(){ return Object.keys(seen).filter(function(k){ return !seen[k]; }); },
    keys: function(){ return Object.keys(seen); },
    refresh: applyAll
  };

  function boot(){
    // Selector stylesheet + RTL rules (kept out of every page's <head>).
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/i18n.css?v=' + VERSION;
    document.head.appendChild(css);

    lang = pickInitial();
    setDocLang(lang);
    buildSelector();
    if(lang === 'ar') ensureArabicFont();
    load(lang).then(function(d){
      dict = d; compile(d); applyAll(); syncSelector();
      readyResolve();
    });
  }
  function ensureArabicFont(){
    if(document.getElementById('jt-ar-font')) return;
    var l = document.createElement('link');
    l.id = 'jt-ar-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500&family=Noto+Sans+Arabic:wght@400;500&display=swap';
    document.head.appendChild(l);
  }
  document.addEventListener('jt:languagechange', function(e){ if(e.detail.lang === 'ar') ensureArabicFont(); });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
