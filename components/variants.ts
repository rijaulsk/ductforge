/* The button and link appearances, in a module with NO "use client".
 *
 * THIS FILE EXISTS BECAUSE OF A BUG THAT PRODUCED class="mt-8 undefined".
 *
 * These constants used to live in `ui.tsx`, which is a client module. A Server
 * Component that imports a value from a `"use client"` module does not receive
 * the value: the bundler replaces the module with a table of client references,
 * and every export is a proxy the server can pass to the client but cannot
 * read. `variantClasses.primary` was therefore `undefined` on the server —
 * silently, because reading a missing property is not an error.
 *
 * The damage was invisible in review and total in effect: `/standards` and all
 * three `/guide` languages are server-rendered, so every primary and secondary
 * CTA on them rendered with no class at all — no clay fill, no pill, no border,
 * no padding. Eleven calls to action across four pages were plain grey
 * paragraph text, and the one clay element the whole app is allowed simply was
 * not on those pages. Where the class was interpolated the string "undefined"
 * was shipped into the markup.
 *
 * Plain data has no reason to sit behind a client boundary. It lives here, both
 * sides import it, and `ui.tsx` re-exports it so existing imports keep working.
 */

export type Variant = "primary" | "secondary" | "tertiary" | "quiet";
export type Size = "sm" | "md";

/* Two rules from the design system are load-bearing and easy to break by
 * accident, so they are enforced in one place:
 *   · Primary buttons are Clay 500 with INK text. White on clay fails
 *     contrast. There is at most one primary button visible at a time —
 *     in this app that is "Add to takeoff", and nothing else may claim it.
 *   · Cards and controls are flat: 1.5px border, no shadow, ever.
 */
export const BASE: Record<Variant, string> = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-clay-500 font-medium text-ink transition duration-200 ease-out hover:bg-clay-400 active:scale-[0.98] active:bg-clay-600 disabled:pointer-events-none disabled:opacity-45",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-line font-medium text-heading transition duration-200 ease-out hover:bg-sunk active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
  tertiary:
    "inline-flex items-center gap-1.5 font-medium text-accent underline-offset-4 transition-colors duration-200 ease-out hover:underline disabled:pointer-events-none disabled:opacity-45",
  quiet:
    "inline-flex items-center gap-1.5 text-body underline-offset-4 transition-colors duration-200 ease-out hover:text-heading hover:underline disabled:pointer-events-none disabled:opacity-45",
};

/* Padding is a separate axis from appearance so a size can be CHOSEN rather
 * than overridden. Two utilities for the same property in one class list
 * resolve by stylesheet order, not by author intent, so `px-5` plus `px-4`
 * would be a coin toss — and forcing it with an important modifier works today
 * but leans on a syntax Tailwind v4 has already deprecated. */
export const PAD: Record<Variant, Record<Size, string>> = {
  primary: { md: "px-6 py-3", sm: "px-4 py-2 text-small" },
  secondary: { md: "px-5 py-2.5", sm: "px-4 py-2 text-small" },
  tertiary: { md: "", sm: "text-small" },
  quiet: { md: "text-small", sm: "text-small" },
};

/** The full class string, for the anchors that have to wear the same clothes
 * without becoming buttons. Server and client may both read this. */
export const variantClasses: Record<Variant, string> = {
  primary: `${BASE.primary} ${PAD.primary.md}`,
  secondary: `${BASE.secondary} ${PAD.secondary.md}`,
  tertiary: BASE.tertiary,
  quiet: `${BASE.quiet} ${PAD.quiet.md}`,
};
