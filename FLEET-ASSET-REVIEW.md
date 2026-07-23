# Fleet Intelligence Provisional Asset Review

Internal production documentation. This file is not linked from or rendered by the public site.

All listed assets have status **PROVISIONAL**. They are launch-stage editorial representations, not technically certified aircraft imagery or guaranteed aircraft configurations. Final replacements require aircraft-specialist and broker validation.

Public page location for every asset: `/charter#fleetIntelligence`

## Replacement standards

- Exterior and interior photography: desktop master/crop `1600 × 1000` (16:10); mobile master/crop `1200 × 900` (4:3).
- Supply AVIF, WebP and high-quality JPG for both desktop and mobile.
- Preserve the current safe central crop, explicit dimensions and responsive `<picture>` behaviour.
- Cabin plans: responsive SVG with a `1280 × 420` viewBox, centred technical linework, readable at desktop and mobile sizes, and an explicit representative/typical configuration disclaimer.
- No visible logos, misleading certification language or claims of guaranteed configuration.

## Asset register

| Category / view | Current filenames | Representative aircraft | Status | Known accuracy concerns | Replacement dimensions and crop | Alt text |
|---|---|---|---|---|---|---|
| Light Jet — Exterior | `light-exterior-{desktop,mobile}.{avif,webp,jpg}` | Citation CJ3 | PROVISIONAL | Window count/spacing; cockpit glazing; fuselage proportions | Desktop 1600×1000 16:10; mobile 1200×900 4:3; retain aircraft and landing gear within both safe crops | Representative Citation CJ3 exterior on a restrained dark apron |
| Light Jet — Interior | `light-interior-{desktop,mobile}.{avif,webp,jpg}` | Citation CJ3 | PROVISIONAL | Cabin proportions, window rhythm, seating and material details require model-specific validation | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve aisle and primary seating | Representative Citation CJ3 cabin interior |
| Light Jet — Cabin | `light-cabin-plan.svg` | Citation CJ3 | PROVISIONAL | Representative seating only; not an approved or guaranteed configuration | Responsive SVG, 1280×420 viewBox; full plan visible with restrained padding | Representative Citation CJ3 cabin plan; configuration varies by aircraft |
| Midsize Jet — Exterior | `midsize-exterior-{desktop,mobile}.{avif,webp,jpg}` | Citation Latitude | PROVISIONAL | Cockpit glazing; window spacing; wing and tail proportions | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve nose, wing, engines and tail | Representative Citation Latitude exterior on a restrained dark apron |
| Midsize Jet — Interior | `midsize-interior-{desktop,mobile}.{avif,webp,jpg}` | Citation Latitude | PROVISIONAL | Cabin proportions, window spacing, flat-floor character and seating details require validation | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve cabin depth and seating | Representative Citation Latitude cabin interior |
| Midsize Jet — Cabin | `midsize-cabin-plan.svg` | Citation Latitude | PROVISIONAL | Representative club/divan arrangement only; configuration varies | Responsive SVG, 1280×420 viewBox; full plan visible with restrained padding | Representative Citation Latitude cabin plan; configuration varies by aircraft |
| Super-Midsize Jet — Exterior | `super-midsize-exterior-{desktop,mobile}.{avif,webp,jpg}` | Challenger 350 | PROVISIONAL | Window count; nose/cockpit geometry; winglets; engine placement | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve nose, winglets, engines and tail | Representative Challenger 350 exterior on a restrained dark apron |
| Super-Midsize Jet — Interior | `super-midsize-interior-{desktop,mobile}.{avif,webp,jpg}` | Challenger 350 | PROVISIONAL | Cabin width/height, window rhythm, seating zones and fixtures require validation | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve cabin zones and aisle | Representative Challenger 350 cabin interior |
| Super-Midsize Jet — Cabin | `super-midsize-cabin-plan.svg` | Challenger 350 | PROVISIONAL | Representative two-zone arrangement only; configuration varies | Responsive SVG, 1280×420 viewBox; full plan visible with restrained padding | Representative Challenger 350 cabin plan; configuration varies by aircraft |
| Heavy Jet — Exterior | `heavy-exterior-{desktop,mobile}.{avif,webp,jpg}` | Gulfstream G450 | PROVISIONAL | Cockpit glazing; wing geometry; landing gear; window spacing | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve nose, oval windows, wings, engines and gear | Representative Gulfstream G450 exterior on a restrained dark apron |
| Heavy Jet — Interior | `heavy-interior-{desktop,mobile}.{avif,webp,jpg}` | Gulfstream G450 | PROVISIONAL | Cabin proportions, oval windows, seating zones and fixtures require validation | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve multiple zones and window character | Representative Gulfstream G450 cabin interior |
| Heavy Jet — Cabin | `heavy-cabin-plan.svg` | Gulfstream G450 | PROVISIONAL | Representative multi-zone arrangement only; configuration varies | Responsive SVG, 1280×420 viewBox; full plan visible with restrained padding | Representative Gulfstream G450 cabin plan; configuration varies by aircraft |
| Ultra Long Range — Exterior | `ultra-long-range-exterior-{desktop,mobile}.{avif,webp,jpg}` | Global 7500 | PROVISIONAL | Fuselage length; window spacing; wing geometry; engines; tail proportions | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve long fuselage, wings, engines and tail | Representative Global 7500 exterior on a restrained dark apron |
| Ultra Long Range — Interior | `ultra-long-range-interior-{desktop,mobile}.{avif,webp,jpg}` | Global 7500 | PROVISIONAL | Cabin scale, windows, zone count, seating and fixtures require model-specific validation | Desktop 1600×1000 16:10; mobile 1200×900 4:3; preserve cabin depth and distinct zones | Representative Global 7500 cabin interior |
| Ultra Long Range — Cabin | `ultra-long-range-cabin-plan.svg` | Global 7500 | PROVISIONAL | Representative multi-zone arrangement only; configuration varies | Responsive SVG, 1280×420 viewBox; full plan visible with restrained padding | Representative Global 7500 cabin plan; configuration varies by aircraft |

## Production replacement checklist

- Validate cockpit glazing, fuselage, wings, engine placement, tail, landing gear, window count and spacing against the exact representative model.
- Validate cabin proportions, windows, seating, fixtures and zone arrangement with approved reference material.
- Confirm image licensing and usage rights.
- Verify desktop and mobile crops in the existing visual stage before replacement.
- Preserve public wording that recommendations are indicative and aircraft/configurations are representative.
- Retest all categories, tabs, keyboard controls, mobile touch behaviour and enquiry prefill after replacement.
