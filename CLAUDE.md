# CLAUDE.md — DuctForge

An HVAC ductwork takeoff and surface-area calculator: duct area, sheet weight, SMACNA gauge and a
BOM schedule for **ten fittings** — six rectangular, three round, one square-to-round — to either the **commercial
billing** standard or the **true shop flat pattern**, in metric or imperial. Also counts
insulation, flange ends and hangers, groups by zone, and prices at the estimator's own rates.
Next.js App Router + TypeScript + Tailwind v4. Built on the DebugSwift design system.

**This is a standalone repo.** It is not part of `E:\debugswift` (the marketing site),
`E:\debugswift-tools` (the proxied free tools) or `E:\debugswift-blog`. Nothing here is proxied
onto debugswift.com, and no work here touches those repos.

## Where it lives, and why not in the tools repo

Decided 24 August 2026 with the owner. Recorded here because a future session will be tempted to
"restore consistency" by folding this into `/tools`:

- **Address: `ductforge.debugswift.com`** — its own Vercel project, its own repo. A subdomain, not
  a proxied subdirectory. That is why this repo ships its own `app/robots.ts` and `app/sitemap.ts`
  (a separate host must; the proxied repos cannot) and why `E:\debugswift\app\robots.ts` must
  **not** list them. No basePath, no rewrite, nothing touching the production marketing deploy.
  `rijaul.debugswift.com` is the precedent.
- **Not a tenth entry in `E:\debugswift-tools\lib\tools.ts`.** Every tool there carries a
  `relatedService`, and that file states the link to the service page is *"half the point of the
  tools existing."* Those nine are horizontal small wins for the visitor's own business; this is a
  full application for one trade. It also cannot fit their route shape (hero → `max-w-3xl` widget →
  explainer → FAQ → CtaBand), the hub is cream-only with no theme toggle, and that repo's defining
  property is "adding a tool changes nothing in the marketing repo".
- **debugswift.com points here from `/services/web-apps-saas`** as proof of the Custom Web Apps &
  SaaS service — a real application anyone can click and use. Not from the tools hub, not from the
  footer, and **not** from `lib/work.ts`, which is client work only and stays empty.
- **The byline is attribution, not a funnel.** One muted footer line in `components/SiteFooter.tsx`.
  No services list, no diagnosis pitch, no second clay element. Do not grow it into a marketing
  footer — an estimator who feels baited is worth less than one who trusts the numbers.

## Commands

- `npm run dev` — dev server on **localhost:3005**
- `npm run build` — production build (must pass before a commit is done)
- `npm run lint` · `npm run typecheck`
- `npm run check` — **the correctness gate**: `check:duct` + `check:draw`

## The two things that must never break

### 1. The numbers

`lib/duct/` is framework-free and is the only place arithmetic happens. `npm run check:duct`
runs 909 assertions over it and **must pass before any commit that touches it**: an independent
second transcription of all twenty formulas fuzzed against the engine, hand-computed anchors,
the gauge band edges in both unit systems, the published density table reproduced from
thickness alone, the rounding rule below, and a guard that every working line claiming `=`
multiplies out to the value printed beside it.

Non-obvious things it pins, which are properties rather than bugs — do not "fix" them:

- **Straight duct, elbow, round duct and round elbow: billing === shop, exactly.** The elbow's
  2·cheek + heel + throat development simplifies to mean perimeter × centreline arc. That is
  Pappus's theorem, not a coincidence, and it is why every swept constant section here agrees.
- **Offset: shop < billing.** The side cheeks are parallelograms and shearing one adds no area.
- **Y-piece: the two standards cross over at Wₙ = W₁/2.** A branch narrower than half the main
  bills for more than it cuts.
- **Round cone: shop > billing wherever there is a taper, equal where there is not.**
- **A gored bend's blanks total ~1% more than its area.** A gored elbow is a chain of mitred
  cylinders; the formula is a smooth torus. Said out loud in the UI rather than reconciled away.

**`material` is the one argument to `computeEntry` with no default**, and it must stay that way.
Defaulting the allowances to off yields zero, which is visibly nothing. Defaulting the material
to GI yields a *weight* — an aluminium job would print plausible steel figures. Any component
that needs a result takes the whole `Project` (`computeFor`), never `(entries, mode, units)`.

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
no error anywhere. 4902 assertions across ten fittings × three views × both unit systems, plus
twenty-six degenerate geometries — including a cone with no taper, which divides by zero unless
the degenerate branch catches it.

It does **not** claim the drawings are correct. That is a visual review, and the owner does it.

## Honesty rules (breaking one is a defect, not a style miss)

- **Never invent a number.** Every figure is either the user's own input, arithmetic on it, or a
  published constant that `/standards` names and `check:duct` verifies.
- **Show the arithmetic.** Each result prints the formula with the user's numbers substituted.
  That is why `formulas.ts` returns a substituted string, not just a total.
- **Name the simplifications out loud**, in the UI and not only in a comment: gauge is selected
  from the largest dimension only (real SMACNA also depends on pressure class and reinforcement
  spacing); **round duct is graded on the rectangular table**, which over-specifies it; sheet
  counts are a nesting estimate; reducers and cones are concentric; the Y-piece shop formula is
  *our stated interpretation* of an under-specified source and excludes the crotch plate; weight
  is bare metal and excludes any coating.
- **Derived quantities default to OFF.** Insulation, flanges and hangers stay at zero until
  someone sets them. A schedule that arrives with insulation counted at a thickness nobody chose
  contains a number no human decided.
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

## The guide, in three languages

`/guide`, `/guide/bn`, `/guide/hi` — one typed shape (`lib/guide/types.ts`), three content files,
one component. A step added to `en.ts` is a visible hole in the other two rather than a silent
divergence, and all three carry hreflang plus `x-default` and appear in the sitemap.

Written in **native script and conversational register** — Kolkata spoken Bengali, not formal
সাধু ভাষা; bolchaal Hindi-Urdu, not textbook शुद्ध हिन्दी. **Technical nouns stay in English**
(duct, gauge, standard, area, flange, CSV) because that is how the trade actually talks on a
site here; inventing native equivalents would make the guide harder to read for the exact person
it is for. That is a decision, not an omission — do not "finish" the translation.

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
