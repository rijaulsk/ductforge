/* Scrap, seam and flange allowance.
 *
 * These are the industry bands as they are quoted, not a measurement this app
 * performs. The percentage is a decision the estimator makes and can type over;
 * the presets are there to save typing and to say what each band is normally
 * used for. Every export and the printed sheet carry the figure that was used,
 * because a quantity without its allowance is not a quantity.
 */

export type WastePreset = {
  value: number;
  label: string;
  detail: string;
};

export const WASTE_PRESETS: readonly WastePreset[] = [
  {
    value: 0,
    label: "0% — net BOQ",
    detail: "Pure theoretical area, for direct subcontractor invoicing.",
  },
  {
    value: 8,
    label: "8% — slip & drive",
    detail: "Factory-run straight duct in light gauge, minimal seam scrap.",
  },
  {
    value: 12,
    label: "12% — industry standard",
    detail:
      "SMACNA / TDF / TDC transverse flange roll-forming: a 35 mm flange lip per side plus the longitudinal Pittsburgh seam.",
  },
  {
    value: 15,
    label: "15% — heavy fittings",
    detail: "Complex multi-branch fittings and angle-iron companion flanges.",
  },
  {
    value: 20,
    label: "20% — high wastage",
    detail: "Heavy gauge sheet, awkward nesting, high offcut loss.",
  },
];

export const DEFAULT_WASTE = 12;

export function wasteDetail(value: number): string | null {
  return WASTE_PRESETS.find((p) => p.value === value)?.detail ?? null;
}
