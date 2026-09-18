# The DebugSwift design system on an app surface

DuctForge is built on the DebugSwift design system, which was written for a marketing site.
This document records **how a dense workspace applies it** — what is unchanged (everything
that matters), what is adapted (density), and the two places where a design review would
otherwise flag correct work as a violation.

Written 24 August 2026, alongside the first build. Amend it in place.

## Unchanged, and not negotiable

- **Colours only from the token tables.** Every value in `app/globals.css` is copied from the
  design system §1. No hex is invented, eyeballed or interpolated. If a colour is needed and
  it is not in the table, the answer is one of the colours that is.
- **Cream page, Ink text, Paper cards** in light; the sanctioned indigo-tinted near-blacks in
  dark. Never `#FFF` as a page, never `#000` as text.
- **Cards are flat.** 1.5 px border, 14 px radius, no shadow, no glass, no gradient mesh.
- **Satoshi only.** Inter is banned.
- **Motion budget**: 200 ms hovers, 250 ms panels, nothing else. No scroll-triggered reveals.
  Drawings redraw instantly and never animate in — a dimension that fades is a dimension you
  cannot read yet.
- **Eyebrow above every panel title.**
- **Left-anchored on desktop, centred below `lg`** (`text-center lg:text-left`), per the owner's
  22 July 2026 mobile-centring call.
- **Banned words**: Elevate, Empower, Unlock, Transform, seamless, leverage.

## Adapted: density

| Rule | Marketing site | DuctForge |
| --- | --- | --- |
| Section padding | 112–144 px desktop | 24–32 px panel padding; the app is one working screen, not a scroll |
| Sections per page | 8–13 | Panels, not sections — configure, drawing, result, schedule, totals, breakdown |
| Every page ends in a CTA band | yes | no — the CTA is the work; `/standards` still ends in one |

## The clay budget, spent on purpose

Clay is ≤2% of any viewport and appears on exactly **one** element in any view: on the page,
the **"Add to takeoff"** button; in a modal dialog that covers the page, that dialog's own
primary action (**Save as PDF**, or the download button, in the export dialog — added 18 Sep
2026). The modal hides the page's button behind it, so there is still only ever one on screen.
Nothing else may claim it — not the totals, not a chart series, not a warning, not the
Export button in the header. This is stricter than the marketing rule rather than
looser, because a workspace has far more controls competing for attention than a landing page
does, and the one action that changes the document has to be the one thing that is orange.

Status never rides on colour alone: notes and caveats carry a **word** (`Note:`, `Standard:`,
`Gauge:`) as well as their styling.

## Dark mode is sanctioned, and how it is wired

Design system §1 provides a dark palette "for tools, dashboards, code blocks — not the
marketing site". This is a tool, so it has one.

**It defaults to LIGHT, whatever the device says** (owner's call, 27 August 2026). It used to
follow `prefers-color-scheme`; that block is deleted rather than overridden, so there is one
source of truth, and `ThemeToggle.currentTheme()` returns light unless `data-theme="dark"`.
The two must agree — when the CSS said light and the JavaScript read the system as dark, the
button offered "switch to light" on a page that already was, and the first press did nothing.
The reason for light is not taste: this tool's output is printed and its drawings are read as
ink on paper, so opening in a palette the reader did not choose is the wrong first impression
of a document.

The mechanism is a **semantic layer**: brand ramps stay in `@theme`, and seven roles
(`--ds-page`, `--ds-card`, `--ds-sunk`, `--ds-line`, `--ds-rule`, `--ds-heading`, `--ds-body`,
`--ds-muted`, `--ds-accent`, plus the isometric face tints and chart series) are re-pointed
under `:root[data-theme="dark"]`. Components write `bg-card border-line text-heading`, never
`bg-paper border-ink text-ink`.

`@theme inline` is load-bearing — without `inline`, Tailwind bakes the resolved value into the
utility at build time and the runtime swap does nothing.

**When adding a component**: if it names a brand colour for a surface, it is wrong. Indigo,
clay and the semantic state colours are still named directly, because they mean the same thing
in both themes.

## Adapted: the phone

Added 9–10 September 2026, after the first Playwright pass at 320px.

**`--breakpoint-xs: 30rem` (480px) exists because every phone is below `sm`.**
Tailwind's smallest default is 640, so "phone" and "small tablet" shared one set of rules
and the rules were written for the roomier one. 480 sits above every common handset
(320, 360, 375, 390, 414, 430) and below the smallest tablet.

**The minimum supported width is 320px** — an iPhone SE 1st gen, and the industry floor.
Everything is asserted at that width: no horizontal page overflow, no sideways-scrolling
sub-container, no input clipping its own value, nothing past the right edge.

**Nothing important hides behind a horizontal scroll.** That was the pattern to remove, not
a tool to reach for: the section nav, the workspace tab bar and six data tables all used it,
between them hiding a top-level link, the Takeoff tab and up to 471px of a reference table.
A horizontal scrollbar nested in a vertically scrolling page is the one affordance a phone
reader will not go looking for. The replacements are, in order of preference: let it wrap
(the nav takes its own row), give it equal columns (the tab bar), or stack it (`RefTable`
turns any table into heading + label/value pairs below its `from` breakpoint).

**Two columns is a `sm` decision, not an `xs` one.** The dimension boxes hold values like
`118.110236` after a unit switch, and a paired cell has only 113px of text room even at 480.

## The drawing on a phone, and why it is a modal

`Drawing`'s labels are a constant 16 viewBox units, which is what keeps a collar's dimensions
and a 6 m run's the same size as each other. The cost is that their size on screen is decided
entirely by how wide the drawing is rendered — 276px inside the workspace card on a 390px
phone, so a label landed at about 4.5px. The drawing was decorative there.

Opening the inline drawing zoomed was the one fix that could not be used: `ZoomPan` takes
`touch-action: none` whenever it is zoomed, and at fit it deliberately leaves `pan-y` so a
vertical swipe still scrolls the page past a drawing you are not using. Opening zoomed would
have re-trapped page scrolling — the 28 Aug bug.

`DrawingDialog` is a `<dialog showModal()>`, because a modal has no page behind it to scroll:
there, the drawing can own every gesture honestly and take the screen's height as well as its
width. Three things it has to keep doing:

- **It portals to `document.body`.** The Viewer sits inside a panel that is `hidden` below
  `lg` whenever another tab is showing, and `display: none` on an ancestor removes a dialog
  from the box tree however high `showModal()` paints it. Without the portal it opened at
  0 × 0 — reproducible in landscape.
- **It syncs on the `close` event, not `cancel`.** Anything can close a dialog; every path
  that React does not hear about leaves `open` true against a closed dialog, after which the
  trigger does nothing, because setting a state that is already true schedules no effect.
- **The box fits the drawing, not the screen.** A surface stretched to full height renders a
  1000 × 300 frame as a 98px band in 625px of empty bordered box.

On a screen under 520px tall — a phone held sideways, and the orientation the note in the
dialog recommends — the eyebrow and the note are hidden and the height budget in
`DrawingDialog` drops to match. The two numbers have to agree; change one, change the other.

## Export: the sheet you set up yourself

Added 18 Sep 2026. Print used to be `window.print()` over one fixed sheet; the owner issues
it to clients by saving it as a PDF and could not remove a single part. The header's CSV,
CSV + working and Print became one **Export** button that opens `ExportDialog`.

- **Everything on the sheet is a switch** — fourteen sections, eleven columns — plus the
  owner's own header text (title, company, client, prepared by, notes) and the page (A4 /
  Letter, portrait / landscape, compact / normal / large). **Defaults are the old sheet
  exactly.** Filled header text always prints; empty never does.
- **The preview is the sheet, not a picture of it.** It renders the same `BoqSheet`, from the
  same options saved on the Project, as the always-mounted print target — at the true paper
  width in millimetres, scaled to fit. Page breaks are dashed guides labelled *approximate*,
  because where a page really breaks is the print dialog's call.
- **The PDF is the browser's Save as PDF**, and the document is retitled after the job for the
  length of the print so the file is named like the CSVs are.
- **`BoqSheet` is ink on paper in both themes** — it is the one component that names `bg-paper`
  and `text-ink` directly, because it is a picture of a printed page, not UI.
- **Sizes in the sheet are `em`** of one root size, so a text-size switch scales the whole
  document with one number.
- The CSV previews wrap rather than scroll sideways, and are in Satoshi, not the browser's
  monospace.

## Two things a design review would otherwise flag

1. **The isometric view is not a "floating 3D shape".** The design system bans floating 3D
   abstract shapes — decorative blobs, the AI-template look. A dimensioned axonometric
   projection of the object being quantified is a technical drawing, and it is drawn the way
   the system requires depth to be drawn: three flat tints of one hue, no gradient, no shadow,
   no lighting. Do not strip it.

2. **There is one deliberate grid break**, as required: the result strip runs the full twelve
   columns beneath a 5/7 split, so the figure both panels above are about is not itself trapped
   in a column. That is the page's one break — do not add a second.

## The §9 anti-AI checklist, as it applies here

| Item | Where it stands |
| --- | --- |
| No gradient mesh / aurora / glass / floating 3D / drop shadows | Clean. The isometric is a drawing, see above |
| Cream base not white, Ink not black | Clean, both themes |
| Clay ≤2% per viewport, one CTA per viewport | One clay element in the whole app |
| Eyebrow + oversized display type | Eyebrow on every panel; display type on `/standards` |
| 12-column asymmetric layout (assessed at 1440 px) | 5/7 split, full-width result strip |
| Exactly one intentional grid break | The result strip |
| At most one dark Indigo 900 band | None used — dark mode is a theme, not a band |
| No scroll-triggered reveals | None anywhere |
| A real number in the first screen | The whole app is the user's own numbers |
| Zero banned words | Checked |
| Every colour traceable to a token | Enforced by `--color-*: initial` wiping Tailwind's palette |
| Verified at 1440 px and 390 px | **Owner reviews visuals** — do not run Playwright unprompted |
