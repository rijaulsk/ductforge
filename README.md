# DuctForge

HVAC ductwork takeoff and surface-area calculator. Enter a fitting's dimensions, get its
surface area, GI sheet weight, SMACNA gauge and a BOM schedule you can export.

Six fittings — straight duct, reducer, elbow, dropper, collar, Y-piece — measured to either of
two standards:

- **Commercial billing** — nominal mean perimeter × centreline length. The quantity a client,
  consultant or quantity surveyor accepts on an invoice.
- **Shop fabrication** — the true unfolded blank, including slant hypotenuses, heel arc
  expansion and wrapper triangulation. What a fabricator actually cuts.

Metric or imperial, switchable at any time. Every fitting is drawn three ways: a dimensioned
blueprint, the flat pattern with cut and fold lines, and an isometric view.

## Running it

```
npm install
npm run dev     # localhost:3005
```

```
npm run check       # 2474 assertions over the engine and the drawing geometry
npm run lint
npm run typecheck
npm run build
```

## What it does not do

Stated here rather than discovered later:

- Gauge is selected from the **largest single dimension only**. Real SMACNA selection also
  depends on pressure class and reinforcement spacing. Every line can override it by hand.
- Sheet counts are a **nesting estimate** — gross area over one 1200 × 2400 mm (4 × 8 ft)
  sheet, rounded up, per gauge. They ignore offcut reuse.
- Weight is **bare steel** at 7850 kg/m³: no galvanising coating, stiffeners, flanges, gaskets
  or fixings.
- Reducers are **concentric**. Eccentric transitions are not modelled.
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
components/   the workspace
app/standards the reference page, generated from lib/duct
scripts/      the two verification scripts behind `npm run check`
docs/         how the DebugSwift design system applies to an app surface
```

Nothing is uploaded anywhere. Takeoffs live in `localStorage` on the device, and can be
exported as JSON to move between machines.
