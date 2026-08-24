import type { Metadata } from "next";
import Link from "next/link";
import {
  GAUGE_BANDS,
  ROUND_GAUGE_CAVEAT,
  SHEET_AREA_FT2,
  SHEET_AREA_M2,
  STEEL_DENSITY_KG_M3,
  bandRange,
  densityDisplay,
} from "@/lib/duct/gauge";
import { FITTING_KINDS, SPECS } from "@/lib/duct/formulas";
import { MATERIALS, MATERIAL_KEYS } from "@/lib/duct/material";
import { fmt } from "@/lib/duct/units";
import { WASTE_PRESETS } from "@/lib/duct/waste";
import SiteFooter from "@/components/SiteFooter";
import Wordmark from "@/components/Wordmark";
import { variantClasses } from "@/components/ui";

/* Everything the calculator believes, written out.
 *
 * This page is generated FROM the same registries the engine computes with —
 * the formulas, the gauge bands, the waste presets. It cannot fall out of date
 * with the app, because there is nothing here to update separately. If a
 * formula changes, this page changes with it.
 *
 * It exists because a takeoff tool asks to be trusted with a number somebody
 * will invoice. The honest way to earn that is to show the arithmetic and to
 * name the simplifications out loud rather than let a user discover them.
 */

export const metadata: Metadata = {
  title: "Standards, formulas and constants",
  description:
    "Every formula DuctForge uses for duct surface area, both the commercial billing standard and the true shop flat pattern, plus the SMACNA gauge bands, sheet densities, waste allowances and the assumptions behind them.",
  alternates: { canonical: "/standards" },
};

const th = "border-b-[1.5px] border-line py-3 pr-4 text-left text-small font-medium text-body";
const td = "border-b border-rule py-3 pr-4 align-top";

function Section({
  eyebrow,
  title,
  lede,
  children,
  band = "page",
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  band?: "page" | "card";
}) {
  return (
    <section className={band === "card" ? "bg-sunk" : ""}>
      <div className="mx-auto w-full max-w-canvas px-5 py-14 md:px-8 md:py-20">
        <div className="text-center lg:text-left">
          <p className="text-eyebrow uppercase text-accent">{eyebrow}</p>
          <h2 className="mt-3 max-w-3xl text-h2-mobile font-bold text-heading md:text-h2 lg:mx-0">
            {title}
          </h2>
          {lede && <p className="mx-auto mt-4 max-w-2xl text-body lg:mx-0">{lede}</p>}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

export default function StandardsPage() {
  return (
    <>
      <header className="border-b-[1.5px] border-line">
        <div className="mx-auto w-full max-w-canvas px-5 py-14 md:px-8 md:py-20">
          <Wordmark size="sm" />
          <div className="mt-10 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="text-eyebrow uppercase text-accent">Reference</p>
              <h1 className="mt-3 text-h1-mobile font-bold text-heading md:text-h1">
                Standards, formulas and constants
              </h1>
              <p className="mt-5 max-w-2xl text-body">
                Everything the calculator does, written out — including what it simplifies. The
                tables below are generated from the same code that computes your takeoff, so they
                cannot drift out of step with it.
              </p>
              <Link href="/" className={`mt-8 ${variantClasses.primary}`}>
                Open the calculator
              </Link>
            </div>
            <div className="lg:col-span-5">
              <div className="rounded-card border-[1.5px] border-line bg-card p-6">
                <p className="text-eyebrow uppercase text-accent">In one line</p>
                <p className="mt-3 text-body">
                  Surface area comes from the fitting&rsquo;s own dimensions. Gross area is that
                  plus the allowance you set. Weight is gross area times the sheet density printed
                  beside it. Multiply the two numbers on screen and you get the third — every time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Section
        eyebrow="The two standards"
        title="One duct, two legitimate quantities"
        lede="A quantity surveyor and a sheet metal shop measure the same fitting differently, and both are right. DuctForge keeps them apart and states which one produced every figure."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-card border-[1.5px] border-line bg-card p-6">
            <p className="text-eyebrow uppercase text-accent">Commercial billing</p>
            <h3 className="mt-2 text-h3 font-bold text-heading">Mean perimeter × centreline</h3>
            <p className="mt-3">
              Nominal measurement to BOQ / IS 655 / DW 144 practice: the perimeter of the duct
              multiplied by the length along its centreline. This is what MEP consultants, clients
              and quantity surveyors accept on an invoice claim.
            </p>
          </div>
          <div className="rounded-card border-[1.5px] border-line bg-card p-6">
            <p className="text-eyebrow uppercase text-accent">Shop fabrication</p>
            <h3 className="mt-2 text-h3 font-bold text-heading">The true unfolded blank</h3>
            <p className="mt-3">
              The flat sheet a fabricator actually cuts, including slant hypotenuses on transitions,
              heel arc expansion on bends and wrapper triangulation. It is a cutting quantity, not a
              billing one.
            </p>
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-small text-body">
          They do not always differ, and where they agree it is worth knowing why. A straight duct
          has no slant and no arc, so both give the same area. An elbow does too — its
          2·cheek + heel + throat development simplifies exactly to mean perimeter × centreline arc,
          which is Pappus&rsquo;s theorem rather than a coincidence. A dropper goes the other way:
          its shop blank is <em>smaller</em> than its billed area, because the side cheeks are
          parallelograms and shearing a parallelogram adds no area.
        </p>
      </Section>

      <Section
        band="card"
        eyebrow="Formulas"
        title="Every fitting, both standards"
        lede="W and H are the duct's width and height, L its length, R the inside (throat) radius, θ the included angle, O a dropper's offset and F a collar's flange lip."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Fitting
                </th>
                <th scope="col" className={th}>
                  Commercial billing
                </th>
                <th scope="col" className={th}>
                  Shop fabrication
                </th>
              </tr>
            </thead>
            <tbody>
              {FITTING_KINDS.map((kind) => {
                const spec = SPECS[kind];
                return (
                  <tr key={kind}>
                    <th scope="row" className={`${td} font-bold text-heading`}>
                      {spec.name}
                      <span className="block text-small font-normal text-muted">{spec.blurb}</span>
                    </th>
                    <td className={`${td} text-small tabular-nums text-body`}>
                      {spec.billing.expression}
                    </td>
                    <td className={`${td} text-small tabular-nums text-body`}>
                      {spec.shop.expression}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="mt-10 text-h3 font-bold text-heading">What each one assumes</h3>
        <ul className="mt-4 space-y-3">
          {FITTING_KINDS.filter((k) => SPECS[k].note).map((kind) => (
            <li key={kind} className="max-w-3xl">
              <span className="font-bold text-heading">{SPECS[kind].name}: </span>
              <span className="text-body">{SPECS[kind].note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        eyebrow="Gauge"
        title="Sheet gauge by largest dimension"
        lede="The common size-only shortcut from the SMACNA duct construction standards. The metric and imperial bands are two published tables rather than conversions of each other — 12 inches is 304.8 mm — so a job is graded on the table matching its own units."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Gauge
                </th>
                <th scope="col" className={th}>
                  Thickness
                </th>
                <th scope="col" className={th}>
                  Largest dimension (metric)
                </th>
                <th scope="col" className={th}>
                  Largest dimension (imperial)
                </th>
                <th scope="col" className={`${th} text-right`}>
                  kg/m²
                </th>
                <th scope="col" className={`${th} text-right`}>
                  lb/ft²
                </th>
              </tr>
            </thead>
            <tbody>
              {GAUGE_BANDS.map((band) => (
                <tr key={band.gauge}>
                  <th scope="row" className={`${td} font-bold tabular-nums text-heading`}>
                    {band.gauge} ga
                  </th>
                  <td className={`${td} tabular-nums text-body`}>{fmt(band.thicknessMm, 2)} mm</td>
                  <td className={`${td} tabular-nums text-body`}>{bandRange(band, "metric")}</td>
                  <td className={`${td} tabular-nums text-body`}>{bandRange(band, "imperial")}</td>
                  <td className={`${td} text-right tabular-nums text-body`}>
                    {fmt(densityDisplay(band.thicknessMm, "metric"), 2)}
                  </td>
                  <td className={`${td} text-right tabular-nums text-body`}>
                    {fmt(densityDisplay(band.thicknessMm, "imperial"), 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-3xl text-body">
          <span className="font-bold text-heading">This is a simplification, and it matters. </span>
          Real gauge selection also depends on the duct&rsquo;s pressure class and on reinforcement
          spacing. Treat the table as a starting point, check it against the project specification,
          and override the gauge by hand on any line where the spec differs — the calculator carries
          the override through to the weight, the sheet count and the export.
        </p>
        <p className="mt-4 max-w-3xl text-body">
          Densities are not transcribed, they are derived: thickness × {STEEL_DENSITY_KG_M3} kg/m³,
          which reproduces the published table exactly. That is bare metal — it excludes any
          coating, stiffeners, flange steel, gaskets and fixings.
        </p>
        <p className="mt-4 max-w-3xl text-body">
          <span className="font-bold text-heading">Round duct carries an extra caveat. </span>
          {ROUND_GAUGE_CAVEAT}
        </p>

        <h3 className="mt-10 text-h3 font-bold text-heading">Material</h3>
        <p className="mt-3 max-w-3xl text-body">
          A gauge is a <em>thickness</em>, so the band table above survives a change of material
          untouched — only the density moves, and with it the weight.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Material
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Density
                </th>
                <th scope="col" className={th}>
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {MATERIAL_KEYS.map((key) => (
                <tr key={key}>
                  <th scope="row" className={`${td} whitespace-nowrap font-bold text-heading`}>
                    {MATERIALS[key].name}
                  </th>
                  <td className={`${td} text-right tabular-nums text-body`}>
                    {MATERIALS[key].density} kg/m³
                  </td>
                  <td className={`${td} text-small text-body`}>{MATERIALS[key].note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        band="card"
        eyebrow="Also counted"
        title="Insulation, flanges and hangers"
        lede="Three quantities an estimator has to price alongside the sheet. Every one of them is DERIVED from the geometry you already typed — none is a new measurement, and each is off until you switch it on."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-card border-[1.5px] border-line bg-card p-6">
            <p className="text-eyebrow uppercase text-accent">Insulation</p>
            <h3 className="mt-2 text-h3 font-bold text-heading">The billing formula, on a fatter duct</h3>
            <p className="mt-3">
              The same billing formula re-run with every cross-section dimension grown by twice the
              thickness. Lagging a 600 × 400 duct with 25 mm measures it as 650 × 450.
            </p>
            <p className="mt-3 text-small text-body">
              The centreline never moves. A rectangular elbow&rsquo;s R is its <em>throat</em>
              radius, so it shrinks by the thickness while the width grows by twice it — get that
              backwards and insulating a bend silently lengthens it. A round elbow&rsquo;s R is
              already a centreline radius, so it is left alone.
            </p>
          </div>
          <div className="rounded-card border-[1.5px] border-line bg-card p-6">
            <p className="text-eyebrow uppercase text-accent">Flanges</p>
            <h3 className="mt-2 text-h3 font-bold text-heading">Two ends per piece</h3>
            <p className="mt-3">
              Every piece is counted with a flange at each end, and a straight run is as many pieces
              as the supplied length divides into — a 6 m run of 1.2 m duct is five pieces, so ten
              ends.
            </p>
            <p className="mt-3 text-small text-body">
              Two flanges meet at every joint and both are material you buy, which is why this
              counts ends rather than joints. Corner pieces are four per rectangular end; a round
              flange has none.
            </p>
          </div>
          <div className="rounded-card border-[1.5px] border-line bg-card p-6">
            <p className="text-eyebrow uppercase text-accent">Hangers</p>
            <h3 className="mt-2 text-h3 font-bold text-heading">One per piece, plus spacing</h3>
            <p className="mt-3">
              One support for every piece, plus one more for each further full spacing of centreline
              run.
            </p>
            <p className="mt-3 text-small text-body">
              A rule of thumb rather than a structural calculation. Real hanger spacing depends on
              duct size, weight and the building — check it against the specification.
            </p>
          </div>
        </div>
        <p className="mt-8 max-w-3xl text-body">
          Rates are the same idea in reverse: your figure per {""}
          <span className="whitespace-nowrap">kg or per m²</span>, applied to the quantities above.
          This app has no prices of its own and never will.
        </p>
      </Section>

      <Section
        band="card"
        eyebrow="Allowances"
        title="Scrap, seam and flange"
        lede="The allowance is your decision, not a measurement. These are the bands as the trade quotes them; any line can carry its own figure, and every export states which was used."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Allowance
                </th>
                <th scope="col" className={th}>
                  Where it applies
                </th>
              </tr>
            </thead>
            <tbody>
              {WASTE_PRESETS.map((p) => (
                <tr key={p.value}>
                  <th scope="row" className={`${td} whitespace-nowrap font-bold tabular-nums text-heading`}>
                    {p.label}
                  </th>
                  <td className={`${td} text-body`}>{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        eyebrow="Sheets"
        title="Why the sheet count is only an estimate"
        lede={`Gross area divided by one commercial sheet — ${SHEET_AREA_M2} m² (1200 × 2400 mm) or ${SHEET_AREA_FT2} ft² (4 × 8 ft) — rounded up, and counted separately for each gauge.`}
      >
        <ul className="max-w-3xl space-y-3 text-body">
          <li>
            <span className="font-bold text-heading">Per gauge, never in total. </span>
            22 ga cannot be cut out of a 24 ga sheet, so a single combined sheet count would be a
            number you could not take to a merchant.
          </li>
          <li>
            <span className="font-bold text-heading">It ignores nesting. </span>
            A real shop reuses offcuts across fittings, and some blanks — cheeks and trapezoids
            especially — do not tile. The true figure moves in both directions.
          </li>
          <li>
            <span className="font-bold text-heading">Seam laps are in the allowance, not the drawing. </span>
            The flat patterns show the developed blank only. Pittsburgh seam and flange lip material
            is covered numerically by the waste percentage, so drawing it as well would count it
            twice.
          </li>
        </ul>
      </Section>

      <section className="border-t-[1.5px] border-line">
        <div className="mx-auto w-full max-w-canvas px-5 py-14 text-center md:px-8 md:py-20 lg:text-left">
          <p className="text-eyebrow uppercase text-accent">Back to work</p>
          <h2 className="mt-3 text-h2-mobile font-bold text-heading md:text-h2">
            Price the job.
          </h2>
          <Link href="/" className={`mt-7 ${variantClasses.primary}`}>
            Open the calculator
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
