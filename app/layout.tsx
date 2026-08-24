import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import localFont from "next/font/local";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

/* Satoshi only — Inter is banned (design system §2). One variable file,
 * weights 300–900, self-hosted so no request leaves the origin. */
const satoshi = localFont({
  src: [{ path: "../public/fonts/Satoshi-Variable.woff2", weight: "300 900", style: "normal" }],
  variable: "--font-satoshi",
  display: "swap",
});

/* Satoshi has no Bengali or Devanagari glyphs, so those guides were rendering
 * in whatever the operating system happened to fall back to — Nirmala UI on
 * Windows, at Satoshi's metrics, which is exactly as bad as it sounds. Noto is
 * the right answer: it is designed for these scripts, it has the weights we
 * use, and `next/font/google` downloads it at BUILD time and serves it from
 * this origin, so the page still makes no off-origin request.
 *
 * Only the two guides that need them ever apply these. */
const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-bengali",
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  /* Without this, every openGraph url and canonical resolves relative and Next
   * warns at build. DuctForge is on its own subdomain rather than proxied into
   * debugswift.com, so this is a real origin, not a path prefix. */
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DuctForge — HVAC duct takeoff & sheet metal calculator",
    template: "%s — DuctForge",
  },
  description:
    "Calculate rectangular duct surface area, GI sheet weight and SMACNA gauge for six fittings, to either the commercial billing standard or the true shop flat pattern. Dimensioned drawings, a BOM schedule, and CSV out.",
  applicationName: "DuctForge",
  openGraph: {
    type: "website",
    siteName: "DuctForge",
    title: "DuctForge — HVAC duct takeoff & sheet metal calculator",
    description:
      "Duct surface area, sheet weight and gauge for nine fittings — billing standard or shop flat pattern, metric or imperial.",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "DuctForge", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  /* Matches the two page grounds, so the browser chrome on a phone does not
   * sit as a bright band above a dark app or the other way round. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F3EB" },
    { media: "(prefers-color-scheme: dark)", color: "#10121C" },
  ],
};

/* What this is, for the machines that ask. A calculator with no sign-up and no
 * price is a WebApplication with a zero-cost offer — stating that plainly is
 * both true and the thing a search engine wants to know. */
const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "DuctForge",
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "HVAC estimating",
  operatingSystem: "Any — runs in a web browser",
  description:
    "Calculates rectangular and round duct surface area, GI sheet weight, SMACNA gauge and a BOM schedule for nine fittings, to either the commercial billing standard or the true shop flat pattern.",
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  featureList: [
    "Rectangular and round duct fittings",
    "Commercial billing and shop fabrication measurement standards",
    "Metric and imperial",
    "SMACNA gauge selection and sheet weight",
    "Dimensioned drawings, flat patterns and isometric views",
    "Insulation, flange and hanger quantities",
    "CSV export and a printable BOQ sheet",
  ],
  isAccessibleForFree: true,
  browserRequirements: "Requires JavaScript.",
};

/* Set the theme before first paint. Without this the page renders in the
 * default palette and then snaps to the saved one — a white flash on every
 * navigation for anyone working in dark. Deliberately tiny, deliberately
 * inline, and wrapped: a blocked localStorage must not stop the page. */
const themeScript = `try{var t=localStorage.getItem("ductforge.theme.v1");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${satoshi.variable} ${bengali.variable} ${devanagari.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-page font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
