# Copy punctuation: no long dashes

Public copy does not use em dashes (`—`, `&mdash;`, `—`) and does not use en dashes as punctuation or dividers.
`tests/no-long-dashes.test.mjs` enforces this across `public/` (HTML, JS strings, CSS `content`, JSON and the translation dictionaries).

## Approach (applied by reviewing each match in context)
| Original use | Replacement |
|---|---|
| Joins a clause or continues a thought | comma |
| Introduces a list or an explanation | colon |
| `<strong>Label</strong> — description` definition lines | `Label: description` |
| Paired dashes around an aside | parentheses, or a pair of commas |
| Numbered or section labels (`03 — Touring, Production & Events`), nav label, page titles | vertical divider ` \| ` (matches the site's `Page \| Jettset Global` titles) |
| Place and event pairs (`Monaco Grand Prix — May`) | comma |
| Arabic | the Arabic comma `،` (colon and divider as in English) |
| Calendar title `London — Frieze London` | the decorative dash is removed; city and event already sit on separate lines |

## Kept on purpose (functional, not punctuation)
- Number, date and measurement ranges: `14–18 October`, `4–6 Guests`, `Approx. 15–18 ft`, `20 Oct – 5 Nov`.
- Route notation with spaced en dashes: `London – Nice – Monaco`, `London – Ibiza` (page title), and the translated equivalents.
- Proper names: `Asia Now – Paris Asian Art Fair` (organiser name), `Soummam–Abane Ramdane Airport`.
- Arrows, `≤`, minus signs and the "no value" placeholder in the staff-only Partner Hub.
- Source comments (HTML/CSS/JS comments are not rendered).

If copy changes later, run `node --test tests/no-long-dashes.test.mjs`.
