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

Clay is ≤2% of any viewport and appears on exactly **one** element in this app: the
**"Add to takeoff"** button. Nothing else may claim it — not the totals, not a chart series,
not a warning, not the print button. This is stricter than the marketing rule rather than
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
