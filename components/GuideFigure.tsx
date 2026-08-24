import { buildView } from "@/lib/draw";
import { RECTANGULAR_KINDS, ROUND_KINDS, SPECS } from "@/lib/duct/formulas";
import type { FigureKind } from "@/lib/guide/types";
import Drawing from "./Drawing";
import FittingGlyph from "./FittingGlyph";

/* The figures the guide explains over.
 *
 * NOT SCREENSHOTS, and the reason matters. A screenshot of the workspace is
 * correct for exactly as long as nobody moves a button, and when it stops being
 * correct it does so silently, in three languages at once, with no build error
 * and no test failure. These are built from the same tokens and the same class
 * strings as the real components — and the drawing figure is produced by the
 * actual drawing engine, so it cannot disagree with what the app renders. They
 * are also theme-aware, sharp at any zoom, weigh nothing, and their callouts
 * translate with the rest of the guide.
 *
 * Markers sit INLINE beside the thing they point at rather than at absolute
 * coordinates: Bengali and Hindi set to different widths than English, and a
 * pinned marker would drift off its target in two languages out of three.
 */

function Marker({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold tabular-nums text-page"
    >
      {n}
    </span>
  );
}

/* Miniatures of the real controls. The class strings are copied from the
 * components on purpose — if the design changes, these are meant to be updated
 * alongside, and a diff that touches one and not the other is visible. */
const pill = "rounded-full border-[1.5px] border-line px-3.5 py-1.5 text-small font-medium";
const pillOn = `${pill} bg-heading text-page`;
const pillOff = `${pill} text-heading`;
const chip = "rounded-full border border-rule px-2.5 py-1 text-small tabular-nums text-body";
const chipOn = "rounded-full border border-line bg-heading px-2.5 py-1 text-small tabular-nums text-page";
const field =
  "rounded-card border-[1.5px] border-line bg-page px-3 py-2 text-small font-medium tabular-nums text-heading";

function Row({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Marker n={n} />
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Figure({ kind }: { kind: FigureKind }) {
  switch (kind) {
    case "standard":
      return (
        <div className="space-y-4">
          <Row n={1}>
            <span className={pillOn}>Metric</span>
            <span className={pillOff}>Imperial</span>
          </Row>
          <Row n={2}>
            <span className={pillOn}>Billing</span>
            <span className={pillOff}>Shop</span>
          </Row>
          <Row n={3}>
            <span className="text-small text-muted">Material and allowances</span>
            <span className={chip}>GI</span>
          </Row>
        </div>
      );

    case "picker":
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Marker n={1} />
            <div className="min-w-0">
              <p className="mb-2 text-small text-muted">Rectangular</p>
              <div className="grid grid-cols-3 gap-2">
                {RECTANGULAR_KINDS.map((k, i) => (
                  <span
                    key={k}
                    className={`flex flex-col items-center gap-1 rounded-card border-[1.5px] px-2 py-2 text-center text-[11px] font-medium ${
                      i === 0 ? "border-line bg-heading text-page" : "border-rule text-heading"
                    }`}
                  >
                    <FittingGlyph kind={k} />
                    {SPECS[k].name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Marker n={2} />
            <div className="min-w-0">
              <p className="mb-2 text-small text-muted">Round and spiral</p>
              <div className="grid grid-cols-3 gap-2">
                {ROUND_KINDS.map((k) => (
                  <span
                    key={k}
                    className="flex flex-col items-center gap-1 rounded-card border-[1.5px] border-rule px-2 py-2 text-center text-[11px] font-medium text-heading"
                  >
                    <FittingGlyph kind={k} />
                    {SPECS[k].name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      );

    case "params":
      return (
        <div className="space-y-4">
          <Row n={1}>
            <span className="flex items-baseline gap-2 text-small font-medium text-heading">
              <span className="text-accent">W</span> Width
            </span>
            <span className={field}>600</span>
            <span className="text-small text-muted">mm</span>
          </Row>
          <Row n={2}>
            <span className="flex items-baseline gap-2 text-small font-medium text-heading">
              <span className="text-accent">R</span> Inside radius
            </span>
            <span className={field}>300</span>
            <span className="text-small text-muted">mm</span>
          </Row>
          <div className="flex items-start gap-3">
            <Marker n={3} />
            <div className="rounded-card border-[1.5px] border-rule bg-sunk px-3 py-2">
              <p className="text-small font-medium text-heading">A = 2(W + H) × L</p>
              <p className="mt-1 text-small tabular-nums text-body">
                2 × (600 + 400) × 3000 = 6 000 000 mm² ={" "}
                <span className="font-bold text-heading">6.000 m²</span>
              </p>
            </div>
          </div>
        </div>
      );

    case "drawing": {
      /* The real engine, on the real default elbow. This figure cannot drift
       * from the app, because it IS the app's output. */
      const scene = buildView(SPECS.elbow.defaults, "blueprint", "metric");
      return (
        <div className="space-y-4">
          <Row n={1}>
            <span className={pillOn}>Blueprint</span>
            <span className={pillOff}>Flat pattern</span>
            <span className={pillOff}>Isometric</span>
          </Row>
          <div className="flex items-start gap-3">
            <Marker n={2} />
            <div className="min-w-0 flex-1 rounded-card border-[1.5px] border-rule bg-page p-2">
              <Drawing scene={scene} title="Example: a 90° elbow, dimensioned" />
            </div>
          </div>
        </div>
      );
    }

    case "quantity":
      return (
        <div className="space-y-4">
          <Row n={1}>
            <span className="text-small font-medium text-heading">Pieces</span>
            <span className={field}>4</span>
          </Row>
          <Row n={2}>
            <span className={chip}>0%</span>
            <span className={chip}>8%</span>
            <span className={chipOn}>12%</span>
            <span className={chip}>15%</span>
            <span className={chip}>20%</span>
          </Row>
          <Row n={3}>
            <span className={pillOn}>From the table</span>
            <span className={pillOff}>24 ga</span>
            <span className={pillOff}>22 ga</span>
          </Row>
        </div>
      );

    case "schedule":
      return (
        <div className="space-y-4">
          <Row n={1}>
            <span className="rounded-full bg-clay-500 px-5 py-2.5 text-small font-medium text-ink">
              + Add to takeoff
            </span>
          </Row>
          <div className="flex items-start gap-3">
            <Marker n={2} />
            <div className="min-w-0 flex-1 border-y-[1.5px] border-rule py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <FittingGlyph kind="elbow" className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-small font-medium text-heading">Elbow ×4</p>
                    <p className="text-small tabular-nums text-body">
                      W 600 · H 400 · R 300 · θ 90°
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {["Edit", "Copy", "Remove"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-rule px-2 py-1 text-[11px] text-body"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case "zones":
      return (
        <div className="space-y-4">
          <Row n={1}>
            <span className="text-small font-medium text-heading">Zone</span>
            <span className={`${field} font-normal`}>AHU-1</span>
          </Row>
          <div className="flex items-start gap-3">
            <Marker n={2} />
            <div className="min-w-0 flex-1 rounded-card border-[1.5px] border-line bg-card px-4 py-3">
              <p className="text-eyebrow uppercase text-accent">Applies to every line</p>
              <p className="mt-1 font-bold text-heading">Material and allowances</p>
              <p className="mt-1 text-small text-body">GI · 25 mm insulation · flanges · hangers</p>
            </div>
          </div>
        </div>
      );

    case "totals":
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Marker n={1} />
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Net area", "24.000", "m²"],
                ["Waste", "2.880", "m²"],
                ["Gross area", "26.880", "m²"],
                ["Weight", "147.84", "kg"],
              ].map(([label, value, unit]) => (
                <div key={label}>
                  <p className="text-eyebrow uppercase text-accent">{label}</p>
                  <p className="mt-1 font-bold tabular-nums text-heading">
                    {value} <span className="text-small font-medium text-body">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Marker n={2} />
            <table className="min-w-0 flex-1 border-collapse text-left text-small">
              <tbody>
                {[
                  ["24 ga", "0.70 mm", "18.240", "6"],
                  ["22 ga", "0.85 mm", "8.640", "3"],
                ].map((r) => (
                  <tr key={r[0]} className="border-b border-rule">
                    <th scope="row" className="py-1.5 pr-3 font-medium tabular-nums text-heading">
                      {r[0]}
                    </th>
                    <td className="py-1.5 pr-3 tabular-nums text-body">{r[1]}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-heading">{r[2]} m²</td>
                    <td className="py-1.5 text-right tabular-nums text-heading">{r[3]} sheets</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Row n={3}>
            <span className={pillOff}>Save</span>
            <span className={pillOff}>CSV</span>
            <span className={pillOff}>Print</span>
          </Row>
        </div>
      );
  }
}

export default function GuideFigure({
  kind,
  callouts,
  label,
}: {
  kind: FigureKind;
  callouts?: string[];
  label: string;
}) {
  return (
    <figure className="mt-6 overflow-hidden rounded-card border-[1.5px] border-line bg-card">
      <div className="border-b-[1.5px] border-rule bg-sunk px-4 py-2">
        <span className="text-eyebrow uppercase text-accent">{label}</span>
      </div>
      <div className="p-5">
        <Figure kind={kind} />
      </div>
      {callouts && callouts.length > 0 && (
        <figcaption className="border-t-[1.5px] border-rule px-5 py-4">
          <ol className="space-y-2">
            {callouts.map((c, i) => (
              <li key={c} className="flex items-start gap-3 text-small">
                <Marker n={i + 1} />
                <span className="pt-0.5">{c}</span>
              </li>
            ))}
          </ol>
        </figcaption>
      )}
    </figure>
  );
}
