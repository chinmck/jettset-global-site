# Phase 2 handover — hero enquiry bar + language selector

**Status:** preview only. Draft PR #31 (`feature/phase2-hero-bar-languages`) — **not merged, nothing published.**
**Preview:** https://deploy-preview-31--jettset-global.netlify.app/

## Hero film — edited per Visual Brand Book v03

The original `public/images/hero-film.mp4` is **unchanged** (SHA-256 `e33ef8dd…05822a`). Two new exports replace the earlier interim one:

- `public/images/hero-film-v3.mp4` — 1920×1080 (desktop / landscape), 3.6 MB
- `public/images/hero-film-v3-mobile.mp4` — 720×1280 portrait (phones and any portrait screen), 2.0 MB

The homepage uses the portrait file when the screen is ≤680px wide or portrait (a small inline script sets the source, because Chrome ignores `media` on `<source>`); otherwise the landscape file. There was no separate mobile video before: phones used the same 16:9 file, centre-cropped. The portrait cut uses exactly that centre crop, so the footage framing is unchanged.

- **Cut:** the first frame of the old end card (baked slogan, then logo from ≈23.3 s) is at 19.667 s (frame 472). Footage stops at 19.625 s and eases to **Carbon `#111315`** over its last second.
- **End card (in the video, not a website overlay):** solid Carbon, exact wording in two lines — "The world moves differently now." / "So do we." — in **Source Serif 4 Display** (60 pt optical size, regular), **Chalk `#F1F0EC`**, 64/68 at 1080 (the brand book's display size). Carbon holds ~0.7 s, the words fade in over 1.3 s, hold ~3.2 s, fade out over 0.8 s. No logo, buttons or other copy. Total 25.7 s.
- **Loop:** the last frame and first frame are the same flat Carbon, and the footage fades up from it over 0.7 s — no flash or pause.
- **Checked by frame analysis (both files):** from 19.667 s every frame is a flat Carbon field plus only the new text; the logo and old wording are in no frame.
- **Audio:** original audio kept, fading out over its last ~2 s.
- **Source limitation (mobile):** on the portrait file the 16:9 footage is a fixed centre crop (~31% of the width), as before, so in some shots the subject sits off-centre or is cut. A better portrait reframe needs the editable source/master. On the portrait end card the first sentence wraps to two lines ("The world moves / differently now." / "So do we.") because a 32-character line cannot fit at readable size on a phone; the wording and sentence order are unchanged.
- **Cleanup:** the earlier interim `hero-film-v2.mp4` and the old mobile-only slogan overlay (CSS/JS) are removed.
- **Language:** the end card is baked in English only, as the old card was. Root `index.html` + `images/hero-film.{mp4,webm}` is a legacy copy that the deploy doesn't serve; it still contains the old end card and was left untouched.
- **Fonts:** Source Serif 4 was downloaded from Google Fonts for rendering; Manrope loads from Google Fonts on the homepage.

## 1. Journey enquiry bar — works in the preview

`public/hero-enquiry.css`, `public/hero-enquiry.js`, markup in `public/homepage.html` (and `index.html`, kept identical).

- Slim translucent bar over the film: **From · To · Date · Travellers · "Begin Your Journey"** (existing approved CTA wording).
- Reuses the planner's `.jv-field` styling, the same location datalist, and the planner's country-suggestion behaviour (`globe.js` now exposes `window.jtLocations` so both use one lookup).
- Continues into the **existing quote flow** via the same `prefill_q*` sessionStorage keys the planner/builder use → `quote.html` arrives pre-filled (verified: Paris → Ibiza, date, "3 adultos"). No new form endpoint or lead route. Without JS the form falls back to a plain GET to `quote.html`.
- Validation: both places required, a country is not accepted as a place (suggestions offered, like the planner), the two places must differ, date can't be in the past. Free-text cities outside the catalogue pass through (the planner's own builder offers e.g. Aspen, which isn't in the catalogue).
- Desktop: one line. ≤900 px: two compact rows lifted above the call/WhatsApp icons. 16 px inputs on phones to avoid iOS zoom. Reduced motion: no fade-in.
- **Typography/colour (brand book v03):** Manrope for fields, labels, CTA, Sound On and the header Contact control; Chalk `#F1F0EC` text; Carbon `#111315` tint. The CTA has a fine 1px Bronze `#8E755A` line (fills Bronze on hover), compact (28px desktop, 26px phones), bold 9px Manrope.
- **Layout (refined, discreet):** desktop/tablet — bottom-left beside the stacked call/WhatsApp buttons, bottom edge level with the lower button, ~57px tall (was ~75px). No outline; background is a light gradient (6% at the top edge to 26% at the bottom) with a 3px blur, so the film reads through it. Labels 8.5px at 86%, values 13px at 95%. The CTA is 30px tall, 9px semibold, with a fine 50%-gold hairline (fills gold on hover). Right edge stops short of "Sound On" (which wraps rather than growing).
- **Phones (≤600px):** the fixed call/WhatsApp stack is replaced by a small **Contact** control in the header (beside the language selector); tap shows Call and WhatsApp (Esc / outside tap closes; reuses the existing "Contact", "Call", "WhatsApp" strings, so no new copy). The bar is two compact columns (From|To, Date|Travellers) with a slim CTA beneath, about 113px tall (was 145), more transparent, with a compact single-line CTA (26px, bold, fine muted-champagne line), sitting just above Sound On. The film's separate late "Begin Your Journey →" link stays removed — the bar's CTA is the single journey CTA.
- **Legibility note:** over the film's brightest bottom-strip frames, raw type contrast is roughly 3.4–3.8:1 (about 7:1 on typical frames); a soft dark text-shadow carries the rest. That is lower than the earlier 22%-tint version, a deliberate trade for transparency. If you want 4.5:1 everywhere, raise the gradient's lower stop.
- Measured clear of the nav, sound control and contact buttons in EN/FR/ES/AR at 1440, 1024, 768, 390 and 375px, with no horizontal scrolling.

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
