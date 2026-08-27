import type { CalcStep } from "@/lib/duct/units";
import { PRECISION, fmtExact } from "@/lib/duct/units";

/* The working, shown.
 *
 * ONE calculation, two presentation levels — not two modes. Everything here is
 * formatted from the same `steps` array the result panel's headline figures
 * come from and the same one the detailed export writes. Nothing recomputes.
 *
 * `=` VERSUS `≈` IS THE POINT OF THIS COMPONENT. A step prints `=` only when
 * the operands as shown reproduce the value as shown. Where π or a square root
 * is involved, the printed operand is a view of something longer, the value
 * was computed from the longer thing, and the step says `≈`. Printing `=`
 * there would be claiming an arithmetic that does not hold — which is exactly
 * the complaint this was built to answer.
 */

export default function CalculationDetails({
  steps,
  expression,
  standard,
  displayed,
}: {
  steps: CalcStep[];
  expression: string;
  standard: string;
  /** The figure the schedule bills, so the last line closes the loop. */
  displayed: string;
}) {
  return (
    <details className="rounded-card border-[1.5px] border-rule bg-page">
      <summary className="cursor-pointer list-none px-4 py-3 text-small font-medium text-heading">
        Calculation details
      </summary>
      <div className="border-t-[1.5px] border-rule px-4 py-4">
        <p className="text-eyebrow uppercase text-accent">{standard}</p>
        <p className="mt-2 break-words font-medium tabular-nums text-heading">{expression}</p>

        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={`${s.label}-${i}`} className="border-t border-rule pt-3 first:border-0 first:pt-0">
              <p className="text-small text-muted">{s.label}</p>
              <p className="mt-0.5 break-words text-small tabular-nums text-body">{s.working}</p>
              <p className="mt-0.5 tabular-nums text-heading">
                <span aria-hidden="true">{s.exact ? "=" : "≈"}</span>
                <span className="sr-only">{s.exact ? "equals" : "approximately"}</span>{" "}
                <span className="font-bold">{fmtExact(s.value, PRECISION.detail)}</span>{" "}
                <span className="text-small text-body">{s.unit}</span>
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-4 border-t-[1.5px] border-rule pt-3 text-small text-body">
          <span className="font-bold text-heading">Displayed result {displayed}.</span> Values above
          are shown to {PRECISION.detail} decimal places; the calculation itself carries full
          precision throughout and is rounded only here, for the screen.
        </p>
      </div>
    </details>
  );
}
