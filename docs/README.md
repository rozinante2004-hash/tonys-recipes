# docs/

- `architecture.mmd` — the picture in `ARCHITECTURE.md`, as Mermaid source. Edit this, not the images.
- `architecture.svg`, `architecture.png` — drawn from it: load `mermaid.min.js` (npm `mermaid@11`) in a
  browser page, `mermaid.render()` the source, save the SVG, and screenshot it at 1.5× for the PNG
  (theme `base`, `flowchart.curve: 'basis'`). GitHub also draws the `.mmd` source directly when it is
  pasted into a ```` ```mermaid ```` block.
