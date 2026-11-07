# Self-hosted typefaces

`Inter`, `Archivo`, `JetBrains Mono` and `Zen Dots`, latin (and latin-ext where
the family has it) subsets. Served from this origin, declared in `/fonts.css`, preloaded
by `index.html`.

Why self-hosted: a `fonts.googleapis.com` stylesheet makes every visitor
contact a third party (IP + User-Agent) before the site has even painted, and
it forces an extra host into the Content-Security-Policy. Both are gone now —
`font-src 'self' data:` and no external font request.

| File | Family | Subset | Covers |
| --- | --- | --- | --- |
| `Inter-latin.woff2` | Inter | latin | body copy, U+0000–00FF |
| `Inter-latin-ext.woff2` | Inter | latin-ext | extended Latin (driver names, accents) |
| `Archivo-latin.woff2` | Archivo | latin | `.display` headings |
| `Archivo-latin-ext.woff2` | Archivo | latin-ext | extended Latin headings |
| `JetBrainsMono-latin.woff2` | JetBrains Mono | latin | `.eyebrow`, `.mono`, timing figures |
| `JetBrainsMono-latin-ext.woff2` | JetBrains Mono | latin-ext | extended Latin mono |
| `ZenDots-latin.woff2` | Zen Dots | latin | driver racing numbers only |

Each file is a **variable** font, so one file per family per subset serves every
weight the stylesheets request (400–950) — no synthetic bold, no per-weight
downloads. `font-display: swap` keeps first paint immediate.

`Zen Dots` is the exception: it is a single static 400 weight, 13.8 KB, used only
for the racing number (`--font-number`) on a driver card and a driver's profile.
It is the same face the reference uses for those numerals. SIL Open Font
License 1.1, so self-hosting is permitted; the licence is in the font's own name
table and no separate file is required.

Regenerate (only needed when adding a family or a weight range):

```bash
node scripts/fetch-fonts.js
```

Netlify caches `/assets/*` for a day, so these are fetched once per visitor.
