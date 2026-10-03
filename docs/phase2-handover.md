# Phase 2 handover — hero enquiry bar + language selector

**Status:** preview only. Draft PR #31 (`feature/phase2-hero-bar-languages`) — **not merged, nothing published.**
**Preview:** https://deploy-preview-31--jettset-global.netlify.app/

## Hero film — edited (no longer blocked)

The original `public/images/hero-film.mp4` is **unchanged** (SHA-256 `e33ef8dd…05822a`). The edited film is a new file, `public/images/hero-film-v2.mp4`, and the homepage now points at it.

- **Where the old card starts:** footage runs to 19.625 s; the first frame of the old end card (slogan baked in white serif, followed by the logo from ≈23.3 s) is at **19.667 s** (frame 472). Nothing from that frame onward is used.
- **New cut:** footage 0–19.667 s, easing to black over its last second (a restrained fade-out), then a separate black end card (6 s): black for ~0.7 s, the line fades in over 1.3 s, holds ~3.2 s, fades out over 0.8 s, ends on black. Total 25.7 s.
- **Text:** exactly "the world moves differently now. so do we", set in **Fraunces 500 (optical size 48)**, the homepage's display typeface (`house-section.css`, rgb 245,243,239 headline colour), at an understated off-white (≈ #ECE9E2). No logo, copy, buttons or graphics. It is broken over three lines (the world moves / differently now. / so do we) so the one file also fits phones, where the 16:9 film is centre-cropped to about a quarter of its width.
- **Loop:** the film already opens by fading up from black over ~0.5 s and the new card finishes on black, so the restart is black → fade-up with no flash or hold.
- **Audio:** original audio is kept, fading out over its last ~2 s and padded with silence to the new length.
- **Encode:** H.264 High, 1920×1080, 24 fps, CRF 24, AAC 160 kbps, faststart. 3.6 MB (was 3.4 MB).
- **Site code:** the old mobile-only CSS/JS overlay (`.hero-slogan-frame`, closing/black-hold classes) that re-created the slogan in Canela Text was removed, because the line is now in the film. The late-CTA reveal logic is untouched.
- **Checked:** every frame from 19.667 s onward contains only the new line (frame statistics); the logo and old wording appear in no frame.
- **Not changed / for your decision:**
  - The line is baked into the film in English only; it does not follow the language selector (the old card didn't either).
  - Root `index.html` + `images/hero-film.{mp4,webm}` are a legacy static copy that the Next.js deploy (`public/`) does not serve; they still contain the old end card. I did not touch them. Say if you want them updated or removed.
  - Canela Text (named in the CSS) is loaded from `fonts.cdnfonts.com`, which was returning HTTP 500 during this work; the homepage headlines actually render in Fraunces, hence the choice.

## 1. Journey enquiry bar — works in the preview

`public/hero-enquiry.css`, `public/hero-enquiry.js`, markup in `public/homepage.html` (and `index.html`, kept identical).

- Slim translucent bar over the film: **From · To · Date · Travellers · "Begin Your Journey"** (existing approved CTA wording).
- Reuses the planner's `.jv-field` styling, the same location datalist, and the planner's country-suggestion behaviour (`globe.js` now exposes `window.jtLocations` so both use one lookup).
- Continues into the **existing quote flow** via the same `prefill_q*` sessionStorage keys the planner/builder use → `quote.html` arrives pre-filled (verified: Paris → Ibiza, date, "3 adultos"). No new form endpoint or lead route. Without JS the form falls back to a plain GET to `quote.html`.
- Validation: both places required, a country is not accepted as a place (suggestions offered, like the planner), the two places must differ, date can't be in the past. Free-text cities outside the catalogue pass through (the planner's own builder offers e.g. Aspen, which isn't in the catalogue).
- Desktop: one line. ≤900 px: two compact rows lifted above the call/WhatsApp icons. 16 px inputs on phones to avoid iOS zoom. Reduced motion: no fade-in.
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
