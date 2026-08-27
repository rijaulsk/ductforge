import Link from "next/link";
import { FITTING_KINDS, SPECS } from "@/lib/duct/formulas";

/* What this page is, in words, server-rendered and permanent.
 *
 * The workspace above renders only after hydration, because it cannot draw a
 * takeoff it has not read out of localStorage yet. That left the page saying
 * literally nothing to a crawler, to a link preview, or to anyone on a slow
 * connection — a calculator that will not tell you what it calculates.
 *
 * So this sits BELOW the tool: the person who came to price a duct still lands
 * on the form, and the page still has something to be found for. Every claim
 * in it is checkable by using the thing directly above it, and the limits are
 * here rather than only on /standards, because the place to admit what a tool
 * does not do is the page that asks to be trusted.
 */

/* Left at every width, like the rest of the app surface — a page that centres
 * its prose and left-aligns its tool reads as two designs stapled together. */
function H2({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-eyebrow uppercase text-accent">{eyebrow}</p>
      <h2 className="mt-3 max-w-3xl text-h2-mobile font-bold text-heading md:text-h2">
        {children}
      </h2>
    </div>
  );
}

export default function AboutTheTool() {
  /* `print:hidden` because this is the page, not the takeoff. Printing used to
   * emit the whole marketing section after the quantity sheet — several pages
   * of "what this is" stapled to a document somebody was about to issue. */
  return (
    <div className="border-t-[1.5px] border-rule print:hidden">
      <div className="mx-auto w-full max-w-canvas px-5 py-14 md:px-8 md:py-20">
        <H2 eyebrow="What this is">A duct takeoff you can check by hand</H2>

        <div className="mt-8 grid gap-x-16 gap-y-10 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <p>
              DuctForge turns a fitting&rsquo;s dimensions into the numbers a ductwork job is
              actually priced on: <strong className="text-heading">surface area</strong> in m² or
              ft², <strong className="text-heading">galvanised sheet weight</strong> in kg or lb,
              the <strong className="text-heading">SMACNA gauge</strong> that size calls for, and a
              bill of materials you can export as CSV or print as a quantity sheet.
            </p>
            <p>
              It runs entirely in your browser. There is no account, nothing is uploaded, and a
              takeoff you start today is still on this device tomorrow. That also means it keeps
              working on a site with one bar of signal.
            </p>
            <p>
              Every figure on screen shows its own arithmetic — the formula with your numbers
              substituted into it — so you can check any line against the calculator on your desk.
              That is the whole design: a quantity nobody can audit is a quantity nobody should
              invoice.
            </p>
            <h3 className="pt-2 text-h3 font-bold text-heading">Where your takeoffs are saved</h3>
            <p>
              In this browser&rsquo;s local storage, on this device, and nowhere else. There is no
              server holding them, which is why they survive a refresh but do not follow you from
              your phone to your desktop, and why clearing your browser data clears them.
            </p>
            <p>
              Every job you start is kept, so a few days of use leaves several in the list — that is
              the takeoffs you made, not a cache. Switch between them in the bar at the top, delete
              one with the bin, or clear the lot from{" "}
              <strong className="text-heading">Material and allowances</strong>. If a job matters,
              use <strong className="text-heading">Save</strong>: it writes a project file you can
              back up, move between machines, or hand to somebody else.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-card border-[1.5px] border-line bg-card p-6">
              <p className="text-eyebrow uppercase text-accent">Two standards, kept apart</p>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="font-bold text-heading">Commercial billing</dt>
                  <dd className="mt-1 text-small">
                    Nominal mean perimeter × centreline length — BOQ / IS 655 / DW 144 practice.
                    What a consultant, client or quantity surveyor accepts on a claim.
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-heading">Shop fabrication</dt>
                  <dd className="mt-1 text-small">
                    The true unfolded blank, with slant hypotenuses, heel arc expansion and gore
                    development. What a sheet metal shop actually cuts.
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-small text-muted">
                The same duct is a different quantity under each. The standard you chose travels
                with every result, every exported row and every printed sheet.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 lg:mt-20">
          <H2 eyebrow="Coverage">Ten fittings, rectangular and round</H2>
          <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {FITTING_KINDS.map((kind) => (
              <li key={kind} className="border-t-[1.5px] border-rule pt-4">
                <p className="font-bold text-heading">{SPECS[kind].name}</p>
                <p className="mt-1 text-small text-body">{SPECS[kind].blurb}</p>
                <p className="mt-2 text-small tabular-nums text-muted">
                  {SPECS[kind].billing.expression}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl">
            Alongside the sheet it will count{" "}
            <strong className="text-heading">insulation area</strong> on the outer face,{" "}
            <strong className="text-heading">flange ends and corner pieces</strong> from the length
            your duct is supplied in, and <strong className="text-heading">hangers</strong> at your
            spacing. Group lines by <strong className="text-heading">zone</strong> — AHU, floor,
            area — and apply your own rate per kg or per m² to turn a quantity into a value.
          </p>
        </div>

        <div className="mt-14 grid gap-x-16 gap-y-10 lg:mt-20 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <H2 eyebrow="Who it&rsquo;s for">Estimators, surveyors and sheet metal shops</H2>
            <p className="mt-6">
              If you price ductwork you are doing this arithmetic already, usually in a spreadsheet
              where the formula is invisible, the measurement standard is implicit, and the gauge is
              a lookup somebody did once. This does the same job with the working shown and both
              standards named.
            </p>
            <p className="mt-4">
              The drawings are there for the same reason. A reducer and a dropper are very different
              objects that look nearly identical as a row of numbers — seeing the fitting is how you
              catch that you picked the wrong one before the quantity reaches a tender.
            </p>
          </div>

          <div className="lg:col-span-6">
            <H2 eyebrow="Limits">What it does not do</H2>
            <ul className="mt-6 space-y-4">
              <li>
                <span className="font-bold text-heading">Gauge is by size only. </span>
                Real SMACNA selection also depends on pressure class and reinforcement spacing, and
                round duct has its own lighter table that this app does not carry. Override the
                gauge on any line where your specification differs.
              </li>
              <li>
                <span className="font-bold text-heading">Sheet counts are a nesting estimate. </span>
                Gross area over one sheet, rounded up, per gauge. It cannot know how your shop nests.
              </li>
              <li>
                <span className="font-bold text-heading">Transitions are concentric. </span>
                Eccentric reducers and cones are not modelled, and the Y-piece excludes its crotch
                plate.
              </li>
              <li>
                <span className="font-bold text-heading">It reads no drawings. </span>
                Dimensions are typed. There is no DWG, DXF or PDF import, because inferring duct
                sizes from a drawing produces confident wrong quantities.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t-[1.5px] border-rule pt-8 lg:mt-20">
          <Link href="/standards" className="text-accent underline-offset-4 hover:underline">
            Every formula, gauge band and constant →
          </Link>
          <Link href="/guide" className="text-accent underline-offset-4 hover:underline">
            How to use it, step by step →
          </Link>
        </div>
      </div>
    </div>
  );
}
