# docs/

- `history/` — the working notes' history, split out of `CLAUDE.md` on 11 Nov 2026: `traps.md` (every trap this
  codebase has sprung, v36–v38.27, newest first), `2026-10.md` and `2026-11.md` (every version's note and release
  record; new entries at the top of the current month's file). `CLAUDE.md` keeps the rules and "where things stand".

- `architecture.mmd` — the picture in `ARCHITECTURE.md`, as Mermaid source. Edit this, not the images.
- `architecture.svg`, `architecture.png` — drawn from it: load `mermaid.min.js` (npm `mermaid@11`) in a
  browser page, `mermaid.render()` the source, save the SVG, and screenshot it at 1.5× for the PNG
  (theme `base`, `flowchart.curve: 'basis'`). GitHub also draws the `.mmd` source directly when it is
  pasted into a ```` ```mermaid ```` block.
