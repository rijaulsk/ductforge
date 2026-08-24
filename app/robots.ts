import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* Crawler policy for ductforge.debugswift.com.
 *
 * This file exists BECAUSE DuctForge is a subdomain rather than a proxied
 * subdirectory. debugswift.com/tools and /blog cannot ship a robots.txt — a
 * crawler only ever fetches the one at the domain root, so the marketing repo
 * declares their rules for them. A subdomain is a separate host with its own
 * root, so it must declare its own, and the marketing repo's robots.ts must
 * NOT list this sitemap: it cannot speak for another host.
 *
 * The AI-crawler policy mirrors the marketing site's deliberately. Training
 * bots and retrieval bots are different agents with different tokens, and
 * conflating them is the quiet way to disappear from AI answers:
 * GPTBot/ClaudeBot collect training data, while OAI-SearchBot/Claude-SearchBot/
 * PerplexityBot/Google-Extended fetch pages to ANSWER a live question. Both are
 * allowed, and both are listed explicitly so the decision is visible rather
 * than inherited from the wildcard by accident.
 */
export default function robots(): MetadataRoute.Robots {
  const allow = { allow: "/", disallow: [] as string[] };
  return {
    rules: [
      { userAgent: "*", ...allow },
      /* Retrieval / answer agents. */
      { userAgent: "OAI-SearchBot", ...allow },
      { userAgent: "ChatGPT-User", ...allow },
      { userAgent: "Claude-SearchBot", ...allow },
      { userAgent: "Claude-User", ...allow },
      { userAgent: "PerplexityBot", ...allow },
      { userAgent: "Google-Extended", ...allow },
      /* Training crawlers. */
      { userAgent: "GPTBot", ...allow },
      { userAgent: "ClaudeBot", ...allow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
