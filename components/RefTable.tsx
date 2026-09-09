import type { ReactNode } from "react";

/* A data table that becomes a list of rows when it stops fitting.
 *
 * WHY THIS EXISTS. Six tables in this app were `overflow-x-auto` with an
 * explicit `min-w-[36rem]`–`min-w-[46rem]`, which is a decision to hide part of
 * a table behind a sideways swipe on every phone. Measured at 320px, they hid
 * 62px (material by gauge), 311px (materials, waste allowances), 439px (the
 * gauge bands) and 471px (every fitting's formulas) of themselves.
 *
 * A horizontal scrollbar nested inside a vertically scrolling page is the one
 * affordance a phone reader will not go looking for: there is no arrow, the
 * scrollbar is drawn only while it moves, and the cut edge looks like the end
 * of the table rather than the middle of it. On `/standards` the hidden column
 * was the shop formula — half the reason the page exists.
 *
 * So below the width where the table fits, the same rows render as a stack:
 * the first column becomes each entry's heading and the rest become
 * label/value pairs. One set of rows feeds both, so the two cannot drift —
 * which is the bug that writing the phone version by hand would eventually
 * reintroduce.
 *
 * `from` is the breakpoint at which the real table appears, and it is per
 * table rather than global because these are not the same shape: two figure
 * columns fit on a large phone, six columns of gauge bands do not fit before
 * a laptop.
 */

export type RefRow = {
  key: string;
  /** The first column: what the row is. Becomes the heading when stacked. */
  head: ReactNode;
  /** The remaining columns, in the order `cols` lists them after the first. */
  cells: ReactNode[];
};

/** Where the table form starts. Below it, the rows stack. */
type From = "xs" | "md" | "lg";

const SHOW: Record<From, { table: string; list: string }> = {
  xs: { table: "hidden xs:block", list: "xs:hidden" },
  md: { table: "hidden md:block", list: "md:hidden" },
  lg: { table: "hidden lg:block", list: "lg:hidden" },
};

const TH = "border-b-[1.5px] border-line py-3 pr-4 text-left text-small font-medium text-body";
const TD = "border-b border-rule py-3 pr-4 align-top";

export default function RefTable({
  caption,
  cols,
  rows,
  from = "xs",
  minWidthClass,
  rightAlign = [],
  dense = false,
  className,
}: {
  /** Announced to screen readers; visually the section heading already says it. */
  caption: string;
  /** Column labels. The first names the row heading column. */
  cols: string[];
  rows: RefRow[];
  from?: From;
  /** A literal `min-w-[…]` class for the table form, where columns need room to
   * stay readable. It must be passed as a whole class string and not built from
   * a value here: Tailwind generates utilities by scanning source text, so a
   * class assembled at runtime is a class that was never compiled. */
  minWidthClass?: string;
  /** Indices into `cols` (0-based, including the heading column) to right-align. */
  rightAlign?: number[];
  /** Figures: put the label and the value on one line when stacked. Prose and
   * formulas want the label above the value instead. */
  dense?: boolean;
  className?: string;
}) {
  const [headCol, ...figureCols] = cols;
  const right = (i: number) => (rightAlign.includes(i) ? " text-right" : "");

  return (
    <div className={className}>
      {/* `overflow-x-auto` survives as a safety net for the sliver of widths
        * between `from` and the table's own minimum — not as the mechanism. */}
      <div className={`${SHOW[from].table} overflow-x-auto`}>
        <table className={`w-full border-collapse${minWidthClass ? ` ${minWidthClass}` : ""}`}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className={`${TH}${right(0)}`}>
                {headCol}
              </th>
              {figureCols.map((c, i) => (
                <th key={c} scope="col" className={`${TH}${right(i + 1)}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className={`${TD} font-bold text-heading${right(0)}`}>
                  {r.head}
                </th>
                {r.cells.map((cell, i) => (
                  <td key={figureCols[i]} className={`${TD} text-body${right(i + 1)}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul
        className={`${SHOW[from].list} divide-y-[1.5px] divide-rule border-y-[1.5px] border-rule`}
      >
        {rows.map((r) => (
          <li key={r.key} className="py-3">
            <p className="font-bold text-heading">{r.head}</p>
            <dl className={dense ? "mt-2 grid gap-y-1 text-small" : "mt-2 space-y-2 text-small"}>
              {r.cells.map((cell, i) =>
                dense ? (
                  <div key={figureCols[i]} className="flex justify-between gap-3">
                    <dt className="text-muted">{figureCols[i]}</dt>
                    <dd className="tabular-nums text-heading">{cell}</dd>
                  </div>
                ) : (
                  <div key={figureCols[i]}>
                    <dt className="text-muted">{figureCols[i]}</dt>
                    <dd className="mt-0.5 text-body">{cell}</dd>
                  </div>
                ),
              )}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
