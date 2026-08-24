import type { Metadata } from "next";
import AboutTheTool from "@/components/AboutTheTool";
import SiteFooter from "@/components/SiteFooter";
import Workspace from "@/components/Workspace";

/* The workspace is the app, and it is the first thing on the page: anyone who
 * opens this has a duct to price, and a splash screen would be a click between
 * them and it.
 *
 * What sits BELOW it is server-rendered and permanent — see AboutTheTool for
 * why. The workspace itself cannot render until it has read the saved takeoff
 * out of localStorage, so without this the page's HTML said nothing at all
 * about what the tool does.
 *
 * The canonical is declared here rather than in the layout so it cannot leak
 * onto /standards or /guide as a default. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Page() {
  return (
    <>
      <Workspace />
      <AboutTheTool />
      <SiteFooter />
    </>
  );
}
