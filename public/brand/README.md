# DuctForge brand assets

Everything in this folder is **generated** by `scripts/make-logo.mjs` and
`scripts/make-icons.mjs` from one path and two outlined words. Run
`npm run brand` to rebuild it. Do not edit these files by hand and do not add
one that was exported from somewhere else — the whole point is that no two of
them can disagree.

## Which file

| You are placing | Use |
| --- | --- |
| A logo in a row — header, email signature, README, slide footer | `ductforge.svg`, or `ductforge-320/640/1280.png` |
| The same on a dark background | `ductforge-dark.svg`, or `ductforge-dark-*.png` |
| A logo in a square — profile picture, sponsor board, slide corner | `ductforge-stacked.svg`, or `ductforge-stacked-512.png` |
| An app icon, favicon source, social avatar | `ductforge-tile.svg`, `ductforge-tile-512.png`, `ductforge-tile-1024.png` |
| One ink only — stamp, etched plate, single-colour print, embroidery | `ductforge-ink.svg` |
| One ink only, light on dark | `ductforge-cream.svg` |

Prefer the SVG wherever it is accepted. The PNGs exist because plenty of
portals, email clients and slide tools still will not take a vector; they are
sized by **width**, because everywhere a lockup lands has a column width and no
opinion about height.

## Rules

**The mark is never shown without its tile.** The elbow on its own is a shape;
the elbow in its rounded indigo square is the logo. There is no bare-mark asset
in this folder and one should not be added.

**Never rebuild the lockup from parts.** Do not set "DuctForge" as live text
beside the tile — the wordmark is Satoshi Bold *outlined*, and live text beside
it will not match on weight, colour or baseline, and will not travel with the
file. "by DebugSwift" is part of the artwork for the same reason.

**Clear space:** keep the tile's own width free on every side. **Minimum size:**
120px wide for the horizontal lockup, 96px for the stacked one, below which the
byline stops being readable — use the tile alone instead.

**Do not** recolour it, outline it, add a shadow, stretch it, rotate it, or put
the colour version on a background that is not cream, white or the dark theme's
near-black. If a background is difficult, that is what the two one-colour
versions are for.

## Colours

| | Light | Dark |
| --- | --- | --- |
| Tile | Indigo 500 `#6467F2` | Indigo 500 `#6467F2` — fixed, an app icon does not restyle |
| Elbow | Cream `#F7F3EB` | Cream `#F7F3EB` |
| DuctForge | Indigo 600 `#5251DA` | Indigo 400 `#8792FE` |
| by DebugSwift | Slate `#5E5A53` | Mist `#D8D4CD` |

All six are `--ds-*` tokens from `app/globals.css`, so these files and the
app's own inline SVG render the same logo rather than two near-misses.
