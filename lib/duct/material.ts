import type { MaterialKey } from "./types";

/* What the sheet is made of.
 *
 * A gauge is a THICKNESS, so the SMACNA band table survives a material change
 * untouched — only the density moves, and with it the weight. That is the whole
 * feature: one number, three places it is stated.
 *
 * Densities are the standard published figures for the alloys these are
 * normally supplied in. They are constants, not measurements, and /standards
 * names all three.
 */

export type Material = {
  key: MaterialKey;
  name: string;
  short: string;
  /** kg/m³ */
  density: number;
  note?: string;
};

export const MATERIALS: Record<MaterialKey, Material> = {
  gi: {
    key: "gi",
    name: "Galvanised steel",
    short: "GI",
    density: 7850,
    note: "Bare steel. The zinc coating adds roughly 1% and is not counted.",
  },
  ss: {
    key: "ss",
    name: "Stainless steel",
    short: "SS",
    density: 8000,
    note: "Austenitic (304 / 316). Ferritic grades run nearer 7700 kg/m³.",
  },
  alu: {
    key: "alu",
    name: "Aluminium",
    short: "Alu",
    density: 2700,
    note: "The gauge table is a steel standard. The THICKNESS is what carries over — aluminium duct is normally specified a gauge or two heavier for the same duty, so check it against your specification.",
  },
};

export const MATERIAL_KEYS: readonly MaterialKey[] = ["gi", "ss", "alu"];

export function material(key: MaterialKey): Material {
  return MATERIALS[key] ?? MATERIALS.gi;
}
