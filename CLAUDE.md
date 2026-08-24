# CLAUDE.md — DuctForge

An HVAC ductwork takeoff and surface-area calculator: rectangular duct area, GI sheet weight,
SMACNA gauge and a BOM schedule for six fittings, to either the **commercial billing** standard
or the **true shop flat pattern**, in metric or imperial. Next.js App Router + TypeScript +
Tailwind v4. Built on the DebugSwift design system.

**This is a standalone repo.** It is not part of `E:\debugswift` (the marketing site),
`E:\debugswift-tools` (the proxied free tools) or `E:\debugswift-blog`. Nothing here is proxied
onto debugswift.com, and no work here touches those repos.

## Commands

- `npm run dev` — dev server on **localhost:3005**
- `npm run build` — production build (must pass before a commit is done)
- `npm run lint` · `npm run typecheck`
- `npm run check` — **the correctness gate**: `check:duct` + `check:draw`

## The two things that must never break

### 1. The numbers

`lib/duct/` is framework-free and is the only place arithmetic happens. `npm run check:duct`
runs 300 assertions over it and **must pass before any commit that touches it**: an independent
second transcription of all twelve formulas fuzzed against the engine, hand-computed anchors,
the gauge band edges in both unit systems, the published density table reproduced from
thickness alone, and the rounding rule below.

Non-obvious things it pins, which are properties rather than bugs — do not "fix" them:

- **Straight duct and elbow: billing === shop, exactly.** The elbow's 2·cheek + heel + throat
  development simplifies to mean perimeter × centreline arc. That is Pappus's theorem, not a
  coincidence.
- **Dropper: shop < billing.** The side cheeks are parallelograms and shearing one adds no area.
- **Y-piece: the two standards cross over at Wₙ = W₁/2.** A branch narrower than half the main
  bills for more than it cuts.

**Rounding discipline**: every figure is rounded once, in `compute.ts`, to the precision it is
displayed at, and totals are summed from those rounded line values — so a schedule's total is
exactly the sum of the rows printed above it. Areas are integer thousandths and masses integer
hundredths **of the display unit**. Do not sum full-precision floats and round at the end.

**Units**: everything internal is millimetres and degrees. Imperial is a boundary conversion
only. No formula branches on unit system; a duplicated formula is a formula that will drift.

### 2. The drawings

`lib/draw/` builds a scene in millimetres and projects it into a fixed 1000 × 640 viewBox.
`npm run check:draw` asserts the property that actually fails in practice: a NaN in a
coordinate makes SVG discard the whole path silently, and the viewer renders an empty box with
no error anywhere. 2174 assertions across six fittings × three views × both unit systems, plus
seventeen degenerate geometries.

It does **not** claim the drawings are correct. That is a visual review, and the owner does it.

## Honesty rules (breaking one is a defect, not a style miss)

- **Never invent a number.** Every figure is either the user's own input, arithmetic on it, or a
  published constant that `/standards` names and `check:duct` verifies.
- **Show the arithmetic.** Each result prints the formula with the user's numbers substituted.
  That is why `formulas.ts` returns a substituted string, not just a total.
- **Name the simplifications out loud**, in the UI and not only in a comment: gauge is selected
  from the largest dimension only (real SMACNA also depends on pressure class and reinforcement
  spacing); sheet counts are a nesting estimate; reducers are concentric; the Y-piece shop
  formula is *our stated interpretation* of an under-specified source and excludes the crotch
  plate; weight is bare steel and excludes the galvanising coating.
- **Every export is self-describing.** The CSV and the printed sheet carry every input, the
  standard, the units, the allowance and the assumptions block — from one shared function
  (`assumptions()` in `lib/export/csv.ts`) so the two can never disagree.
- **A saved job is worth more than a tidy schema.** `reviveProject` is a total parser: it never
  throws, and a document missing a field opens with that field's default.

## Design

`docs/app-surface.md` is the rule set — read it before any UI change. The short version: colours
only from the tokens in `app/globals.css`; flat 1.5 px-bordered cards, 14 px radius, no shadows;
Satoshi only; 200 ms motion budget and no scroll reveals; **clay appears on exactly one element
in the entire app** (the "Add to takeoff" button); dark mode is a semantic token swap, so
components write `bg-card`/`border-line`/`text-heading` and never `bg-paper`/`border-ink`.

**Do not run Playwright or take screenshots unprompted** — the owner reviews visuals himself and
will say when.

## Code conventions

- Server Components by default; `use client` only where genuinely interactive. `app/page.tsx` is
  a server shell around one client `Workspace`.
- One `useState` per document plus curried updaters. No reducer — matching the sibling repos.
- Numeric inputs hold the **raw string typed**, parsed only at compute time. `type="text"` with
  `inputMode="decimal"`, never `type="number"`.
- Every `localStorage` access is wrapped in try/catch. It throws in a private window and on a
  full quota, and these calls sit inside keystroke handlers.
- **No new dependencies without stating why.** There is no chart library, no PDF library, no 3D
  library and no test runner: charts are hand-built SVG/CSS, the BOQ sheet is a print
  stylesheet, the isometric view is a twelve-line projection, and the checks are plain node
  scripts. Runtime deps are `next`, `react`, `react-dom`, `lucide-react` and nothing else.
- Pin versions **exactly** — caret ranges hang npm's resolver on this machine for 30+ minutes.
- Non-trivial files open with a header comment stating the decision **and the failure that
  caused it**. That is the house style, not decoration.

## Don't

- Don't add a component library. The system is small; build the few components it defines.
- Don't put arithmetic in a component. It goes in `lib/duct/` where the check script can reach it.
- Don't add a second copy of a formula. `lib/duct/formulas.ts` is the registry that feeds the
  calculator, the working line and `/standards` alike.
- Don't remove the isometric view as a "floating 3D shape" — see `docs/app-surface.md`.
