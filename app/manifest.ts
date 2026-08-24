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
      "Duct surface area, GI sheet weight, SMACNA gauge and a BOM schedule for ten fittings — billing standard or shop flat pattern, metric or imperial.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7F3EB",
    theme_color: "#6467F2",
    categories: ["productivity", "utilities", "business"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      /* Maskable is a separate entry, not a second purpose on the same file:
       * a launcher crops it to its own shape, so it bleeds to the edges and
       * keeps the mark inside the middle 80%. Declaring one icon as both
       * "any maskable" gets it cropped when used as "any". */
      {
        src: "/icons/icon-maskable-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
