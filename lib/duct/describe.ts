import { SPECS } from "./formulas";
import type { Fitting } from "./types";
import { type UnitSystem, fmtLength } from "./units";

/** A fitting's dimensions on one line, in the order the form asks for them:
 * "W 600 · H 400 · L 3000". Used in the schedule, the printed sheet and every
 * row's accessible name, so a line is identifiable without opening it. */
export function describeFitting(f: Fitting, us: UnitSystem): string {
  const spec = SPECS[f.kind];
  const source = f as unknown as Record<string, number>;
  return spec.fields
    .map((field) => {
      const raw = source[field.key] ?? 0;
      return `${field.symbol} ${field.angle ? `${raw}°` : fmtLength(raw, us)}`;
    })
    .join(" · ");
}
