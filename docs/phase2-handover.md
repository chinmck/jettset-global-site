# Phase 2 handover — hero enquiry bar + language selector

**Status:** preview only. Draft PR #31 (`feature/phase2-hero-bar-languages`) — **not merged, nothing published.**
**Preview:** https://deploy-preview-31--jettset-global.netlify.app/

## Blocker — hero film edits need the editable source

I inspected the film (`public/images/hero-film.mp4`, 1920×1080, 25.3 s) frame by frame, and the 4K master that sits in git history (`df6121e`, 3840×2160).

| Element | Where it lives | Time in film |
|---|---|---|
| Line "The World Moves Differently Now. So Do We." | **Baked into the video pixels** (white serif on black) | ≈ 20–23 s |
| Jettset logo (end card) | **Baked into the video pixels** | ≈ 23–25.3 s |

Neither is a website overlay, and no layered project or clean end-card-free master exists in the repo, `~/Downloads`, or git history. Per the brief I did **not** paint over them or add an improvised overlay. **Nothing about the film was changed.**

**Source asset needed:** the layered edit (Premiere / After Effects / DaVinci) or a master export without the end card (final ~5 s as plain black). With that, the slogan can be re-set in Canela Text and the logo removed. The site header logo is untouched.

Things to know when the source arrives:
- On **mobile (≤680 px)** the site already hides the film during the slogan window and shows the line as a CSS overlay in Canela Text (`.hero.hero-slogan-frame::before` in `styles.css`). Desktop shows the baked-in version, so the two currently differ. The logo is baked in on both.
- The line you specified is lowercase with no full stops: "the world moves differently now. so do we". The film and the mobile overlay use Title Case with full stops. **Decision needed on casing.**

## 1. Journey enquiry bar — works in the preview

`public/hero-enquiry.css`, `public/hero-enquiry.js`, markup in `public/homepage.html` (and `index.html`, kept identical).

- Slim translucent bar over the film: **From · To · Date · Travellers · "Begin Your Journey"** (existing approved CTA wording).
- Reuses the planner's `.jv-field` styling, the same location datalist, and the planner's country-suggestion behaviour (`globe.js` now exposes `window.jtLocations` so both use one lookup).
- Continues into the **existing quote flow** via the same `prefill_q*` sessionStorage keys the planner/builder use → `quote.html` arrives pre-filled (verified: Paris → Ibiza, date, "3 adultos"). No new form endpoint or lead route. Without JS the form falls back to a plain GET to `quote.html`.
- Validation: both places required, a country is not accepted as a place (suggestions offered, like the planner), the two places must differ, date can't be in the past. Free-text cities outside the catalogue pass through (the planner's own builder offers e.g. Aspen, which isn't in the catalogue).
- Desktop: one line. ≤900 px: two compact rows lifted above the call/WhatsApp icons. 16 px inputs on phones to avoid iOS zoom. Reduced motion: no fade-in.
- **Layout:** bottom-left, alongside the stacked call/WhatsApp buttons, with the bar's bottom edge level with the lower button. No outline; tint is 22 % so the film shows through (measured ≥4.5:1 label contrast over the brightest frames). The right edge stops short of "Sound On" (which wraps rather than growing in longer languages). On phones there is no room beside the stack, so the bar spans the width just above it. The film's separate late "Begin Your Journey →" link was removed — the bar's CTA is the single journey CTA.
- Measured clear of the nav, sound control and contact buttons in EN/FR/ES/AR at 1024, 768, 390 and 375 px, with no horizontal scrolling.

**Copy flagged for approval (new, not in the existing site):** "Please enter where you are travelling from." · "Please enter where you are travelling to." · "Choose two different cities or airports." · "Please choose a date from today onwards." The CTA, field labels and placeholders reuse approved wording.

**Review point:** the bar sits over the lower ~10 % of the film (floor/legs of the subject in most scenes).

## 2. Language selector — English, Français, Español, العربية

`public/i18n.js`, `public/i18n.css`, `public/i18n/{fr,es,ar}.json` (generated), loaded on every page.

- Accessible disclosure selector in the nav (right-hand cell): text labels, no flags, keyboard (Esc/arrows), `aria-expanded`, `aria-current`, works with the mobile menu open.
- English stays the source and the no-JS fallback. Translations are keyed by the **exact English string**, so no page structure or copy is rewritten. Anything without a translation stays English (never machine-guessed at runtime).
- Choice persists across pages (`localStorage`); `?lang=fr|es|ar|en` also works. `<html lang>` updates; Arabic sets `dir="rtl"` with mirrored fixed furniture, Arabic typefaces (Noto Naskh/Sans Arabic), no letter-spacing/uppercase/italics.
- Dynamic text is covered: planner/builder panels, route labels, statuses, passenger counts, form `alert()` validation and confirmation messages.
- Source table: `i18n-src/translations.py` → `python3 i18n-src/build.py` → regenerates the JSON and `docs/i18n-review.csv` (one row per string, FR/ES/AR side by side, for a human translator). Bump `VERSION` in `i18n.js` after editing translations.

### Coverage — this is NOT a complete site translation

| Translated | Status |
|---|---|
| Shared chrome on **all** pages: menu, contact sheet, footer, sound control, buttons | ✅ |
| Homepage (`/`) incl. planner, builder, all sections | ✅ |
| `quote`, `contact`, `jet-card-signup` forms + validation/alerts | ✅ |
| **Not translated (English body copy):** `charter`, `jet-card`, `concierge`, `club`, `legs`, `editions`, `advisory`, `about`, `partners`, `access-partners`, `guest-segments`, `in-motion`, `the-manifest`, `manifest-article`, `london-ibiza`, `aviation-wellness` | ⬜ roughly 8,000+ words of page-specific copy |
| **Deliberately excluded:** `privacy`, `terms`, `trust` (legal — need qualified legal translation), `medical*` (hidden pending partner sign-off; its two sub-pages don't load the language script) | ⬜ |
| The Manifest article text lives in `script.js` as JS data (not translated) | ⬜ |

Strings shared with translated pages (labels, buttons, form fields) are already translated wherever they appear on the untranslated pages.

### Wording that needs a human decision
- **Consent / legal-adjacent lines** (contact-consent checkbox, "your information remains private…") — first-pass only, need legal review before use in FR/ES/AR.
- **Brand and product names kept in English:** Jettset, Jet Card, Club, Legs, Editions, The Manifest, In Motion, **Aviation Wellness** (nav label). "The Jettset House" → "La Maison Jettset" etc. is a translated brand concept — confirm.
- Route/city names are translated for display only (Londres, Mónaco, لندن…); form values and what is sent to the quote form stay English.
- Judgement calls: "Fair Week Route", "Access Partners", "Guest Segments", "Concierge" (Conciergerie / Conserjería / الكونسيرج), "Charter" (Affrètement / Chárter / تأجير الطائرات).
- Native date pickers show the browser's own locale format (not controllable from the page).
- Arabic numerals left as Western digits throughout.
- `quote-new.html` (the redesigned quote page) is not part of this flow; if it replaces `quote.html`, it must read the `prefill_q*` keys.

## Testing done
- Homepage at **1440, 1024, 768, 390, 375 px** (EN; FR/ES/AR spot-checked at 1024, 390, 375): bar layout, wrapping, no horizontal page overflow, clear of nav / sound / contact icons, selector + side menu usable.
- Bar form behaviour (empty / same place / country / past date / valid), hand-off to `quote.html` incl. traveller count and date, language persisted through the hand-off.
- Arabic RTL desktop + mobile; selector menu; side panel.
- No console errors from the site on the Netlify preview (all site requests 200/206/304). Cloudflare Pages is red on `main` as well — pre-existing, unrelated.
