# -*- coding: utf-8 -*-
"""Generate public/i18n/{fr,es,ar}.json (runtime dictionaries) and docs/i18n-review.csv
from i18n-src/translations.py.   Run:  python3 i18n-src/build.py"""
import csv, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import translations as T

root = os.path.join(os.path.dirname(__file__), '..')
langs = ['fr', 'es', 'ar']
data = {l: {'strings': {}, 'patterns': []} for l in langs}
rows = []   # (section, en, fr, es, ar)

def add(section, en, fr, es, ar):
    for l, v in zip(langs, (fr, es, ar)):
        prev = data[l]['strings'].get(en)
        if prev is not None and prev != v:
            raise SystemExit('conflicting translation for %r (%s): %r vs %r' % (en, l, prev, v))
        data[l]['strings'][en] = v
    rows.append((section, en, fr, es, ar))

for name in ('CHROME', 'FIELDS', 'HOME', 'JETCARD_SIGNUP', 'ALERTS'):
    for r in getattr(T, name):
        add(name.lower(), *r)

# ---- full-site page translations (i18n-src/pages): index into master.json ----
import glob, importlib
pages_dir = os.path.join(os.path.dirname(__file__), 'pages')
sys.path.insert(0, pages_dir)
master = json.load(open(os.path.join(pages_dir, 'master.json'), encoding='utf-8'))
LEGAL_FROM = 1311          # privacy / terms / trust: first-pass, need qualified legal review
for f in sorted(glob.glob(os.path.join(pages_dir, 'b*.py'))):
    mod = importlib.import_module(os.path.basename(f)[:-3])
    for idx, (fr, es, ar) in sorted(mod.B.items()):
        en = master[idx]
        # identical existing entries are fine; a different earlier translation wins (keeps the reviewed one)
        if en in data['fr']['strings'] and data['fr']['strings'][en] != fr:
            continue
        add('legal' if idx >= LEGAL_FROM else 'pages', en, fr, es, ar)
import extra
for en, (fr, es, ar) in extra.E.items():
    if en in data['fr']['strings']:
        continue
    add('extras', en, fr, es, ar)
# fleet-intelligence representative aircraft captions (generated for every category)
for rep in ('Citation CJ3', 'Citation Latitude', 'Challenger 350', 'Gulfstream G450', 'Global 7500'):
    add('extras', 'Representative %s exterior' % rep, 'Extérieur représentatif du %s' % rep, 'Exterior representativo del %s' % rep, 'منظر خارجي نموذجي لطائرة %s' % rep)
    add('extras', 'Representative %s cabin interior' % rep, 'Intérieur de cabine représentatif d’un %s' % rep, 'Interior de cabina representativo de un %s' % rep, 'مقصورة داخلية نموذجية لطائرة %s' % rep)
    add('extras', 'Representative %s cabin plan; configuration varies by aircraft' % rep, 'Plan de cabine représentatif d’un %s ; la configuration varie selon l’appareil' % rep, 'Plano de cabina representativo de un %s; la configuración varía según la aeronave' % rep, 'مخطط مقصورة نموذجي لطائرة %s؛ وتختلف التهيئة بحسب الطائرة' % rep)
    add('extras', 'Representative %s exterior on a restrained dark apron' % rep, 'Extérieur représentatif d’un %s sur une aire sombre et sobre' % rep, 'Exterior representativo de un %s sobre una plataforma oscura y sobria' % rep, 'منظر خارجي نموذجي لطائرة %s على ساحة مظلمة هادئة' % rep)

# route labels "London → Monaco" (display only; the form values stay English)
for a, b in T.ROUTE_PAIRS:
    fa, sa, aa = T.CITIES[a]; fb, sb, ab = T.CITIES[b]
    add('routes', '%s → %s' % (a, b), '%s → %s' % (fa, fb), '%s → %s' % (sa, sb), '%s ← %s' % (aa, ab))
# the same label as it reaches the DOM from globe.js (&rarr; entity becomes the arrow glyph)
for en, (fr, es, ar) in T.COUNTRIES.items():
    add('countries', en, fr, es, ar)
for p in list(T.PATTERNS) + list(extra.P):
    for l, v in zip(langs, p[1:]):
        data[l]['patterns'].append([p[0], v])
    rows.append(('pattern', p[0], p[1], p[2], p[3]))

os.makedirs(os.path.join(root, 'public', 'i18n'), exist_ok=True)
for l in langs:
    with open(os.path.join(root, 'public', 'i18n', l + '.json'), 'w', encoding='utf-8') as f:
        json.dump(data[l], f, ensure_ascii=False, indent=0, sort_keys=False)
os.makedirs(os.path.join(root, 'docs'), exist_ok=True)
with open(os.path.join(root, 'docs', 'i18n-review.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f); w.writerow(['section', 'English (source)', 'French', 'Spanish', 'Arabic']); w.writerows(rows)
print({l: len(data[l]['strings']) for l in langs}, 'patterns:', len(T.PATTERNS))
