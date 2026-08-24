import type { Metadata } from "next";
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
      "Duct surface area, sheet weight and gauge for six fittings — billing standard or shop flat pattern, metric or imperial.",
  },
};

/* Set the theme before first paint. Without this the page renders in the
 * default palette and then snaps to the saved one — a white flash on every
 * navigation for anyone working in dark. Deliberately tiny, deliberately
 * inline, and wrapped: a blocked localStorage must not stop the page. */
const themeScript = `try{var t=localStorage.getItem("ductforge.theme.v1");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${satoshi.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-page font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
