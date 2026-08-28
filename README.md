# DuctForge

HVAC ductwork takeoff and surface-area calculator. Enter a fitting's dimensions, get its
surface area, GI sheet weight, SMACNA gauge and a BOM schedule you can export.

Ten fittings — straight duct, transition, elbow, offset, collar and Y-piece in rectangular, plus
round duct, a gored round elbow, a concentric cone and a square-to-round — measured to either of
two standards:

- **Commercial billing** — nominal mean perimeter × centreline length. The quantity a client,
  consultant or quantity surveyor accepts on an invoice.
- **Shop fabrication** — the true unfolded blank, including slant hypotenuses, heel arc
  expansion and wrapper triangulation. What a fabricator actually cuts.

Metric or imperial, switchable at any time. Every fitting is drawn three ways: a dimensioned
blueprint, the flat pattern with cut and fold lines, and an isometric view.

Alongside the sheet it counts insulation area, flange ends and corner pieces, and hangers; groups
lines by zone (AHU, floor, area); and applies your own rate per kg or per m² to turn quantities
into a value. There is a step-by-step guide in [English](https://ductforge.debugswift.com/guide),
[বাংলা](https://ductforge.debugswift.com/guide/bn) and
[हिन्दी](https://ductforge.debugswift.com/guide/hi).

## Running it

```
npm install
npm run dev     # localhost:3005
```

```
npm run check       # 3224 assertions over the engine and the drawing geometry
npm run lint
npm run typecheck
npm run build
```

## What it does not do

Stated here rather than discovered later:

- Gauge is selected from the **largest single dimension only**. Real SMACNA selection also
  depends on pressure class and reinforcement spacing. Every line can override it by hand.
- **Round duct is graded on the rectangular gauge table**, because that is the table this app
  has. SMACNA publishes a separate, generally lighter one for round and spiral — a cylinder is
  stiffer than a flat panel — so round comes out over-specified.
- It **reads no drawings**. Dimensions are typed. There is no DWG, DXF or PDF import, because
  inferring duct sizes from a 2D drawing produces confident wrong quantities.
- Sheet counts are a **nesting estimate** — gross area over one 1200 × 2400 mm (4 × 8 ft)
  sheet, rounded up, per gauge. They ignore offcut reuse.
- Weight is **bare steel** at 7850 kg/m³: no galvanising coating, stiffeners, flanges, gaskets
  or fixings.
- Reducers and cones are **concentric**. Eccentric transitions are not modelled.
- A gored round elbow's **blanks total about 1% more than its area**: a gored bend is a chain of
  mitred cylinders and the formula is a smooth torus. The difference is part of what the waste
  allowance covers.
- The Y-piece shop formula is a **stated interpretation** of an under-specified source, and
  excludes the crotch plate.

Every one of these is on the `/standards` page too, alongside every formula and constant the
calculator uses — generated from the same code that computes the takeoff, so it cannot fall out
of step.

## Where things live

```
lib/duct/     the arithmetic — framework-free, and the only place it happens
lib/draw/     scene geometry in millimetres, projected into a fixed viewBox
lib/export/   CSV, project JSON, downloads
lib/guide/    the guide's content, one typed shape per language
components/   the workspace
app/standards the reference page, generated from lib/duct
app/guide     the guide, in English, Bengali and Hindi
scripts/      the two verification scripts behind `npm run check`
docs/         how the DebugSwift design system applies to an app surface
```

Nothing is uploaded anywhere. Takeoffs live in `localStorage` on the device, and can be
exported as JSON to move between machines.
