import type { MetadataRoute } from "next";
import { GUIDE_LIST, guideLanguages } from "@/lib/guide";
import { SITE_URL } from "@/lib/site";

/* Two routes, and only two. Add a line here in the SAME change that makes the
 * route resolve — never in anticipation of one. That rule is written down
 * because the sibling repo paid for it: the blog's sitemap sat advertised from
 * the marketing robots.txt for weeks while the route behind it was still a
 * coming-soon placeholder, and submitting a 404 is how a sitemap reference
 * stops being trusted.
 *
 * On the priorities: /standards is the page that can actually be FOUND. The
 * workspace is reached by people who already know about it; "duct surface area
 * formula", "SMACNA gauge chart" and "GI sheet weight per m2" are things people
 * type into a search box, and /standards answers all three from the same code
 * that computes the takeoff. It is weighted accordingly.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const languages = guideLanguages();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/standards`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    /* Each guide is its own entry AND declares the other two as alternates.
     * Listing only English would leave the Bengali and Hindi pages to be found
     * by luck, and they are the two with the least competition for their
     * terms — a Bengali search for duct area has almost nothing in it. */
    ...GUIDE_LIST.map((g) => ({
      url: `${SITE_URL}${g.path}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      alternates: { languages },
    })),
  ];
}
