import type { MetadataRoute } from "next";

/* Installable, and the reason is not novelty.
 *
 * This tool gets used standing in a plant room or on a site with one bar of
 * signal, and it is entirely client-side — the arithmetic, the drawings and the
 * saved takeoffs all live on the device already. A manifest lets someone put it
 * on a home screen and open it like an app, which is where it belongs.
 *
 * `display: standalone` drops the browser chrome; the app's own project bar is
 * the chrome. No offline service worker yet — that is a separate decision, and
 * claiming offline before it is true would be worse than not claiming it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DuctForge — HVAC duct takeoff",
    short_name: "DuctForge",
    description:
      "Duct surface area, GI sheet weight, SMACNA gauge and a BOM schedule for nine fittings — billing standard or shop flat pattern, metric or imperial.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7F3EB",
    theme_color: "#6467F2",
    categories: ["productivity", "utilities", "business"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
