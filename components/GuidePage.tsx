import Link from "next/link";
import { GUIDE_LIST } from "@/lib/guide";
import type { Guide } from "@/lib/guide/types";
import AppHeader from "./AppHeader";
import GuideFigure from "./GuideFigure";
import SiteFooter from "./SiteFooter";
import { variantClasses } from "./ui";

/* One component, three languages.
 *
 * The `lang` attribute is set on the article rather than the document, because
 * the chrome around it — the wordmark, the language switcher — is not in the
 * page's language. A screen reader that switches voice for the body and keeps
 * it for the switcher is doing exactly the right thing.
 *
 * The switcher lists each language in its OWN name. "Bengali" is only useful to
 * someone who already reads English; "বাংলা" is useful to the person looking
 * for it.
 */

export default function GuidePage({ guide }: { guide: Guide }) {
  return (
    <>
      <AppHeader
        current="guide"
        labels={guide.nav}
        right={
          <nav aria-label={guide.switcherLabel} className="flex flex-wrap items-center gap-2">
            <span className="hidden text-small text-muted sm:inline">
              {guide.switcherLabel}
            </span>
            {GUIDE_LIST.map((g) => {
              const on = g.locale === guide.locale;
              return (
                <Link
                  key={g.locale}
                  href={g.path}
                  lang={g.htmlLang}
                  hrefLang={g.htmlLang}
                  aria-current={on ? "page" : undefined}
                  className={`shrink-0 rounded-full border-[1.5px] px-3.5 py-1.5 text-small font-medium transition-colors duration-200 ease-out ${
                    on ? "border-line bg-heading text-page" : "border-line text-heading hover:bg-sunk"
                  }`}
                >
                  {g.label}
                </Link>
              );
            })}
          </nav>
        }
      />

      {/* The script class does two things: swaps in a face that HAS glyphs for
        * this writing system, and loosens the leading, because Bengali and
        * Devanagari carry more above and below the baseline than Latin. */}
      <article
        lang={guide.htmlLang}
        className={
          guide.locale === "bn"
            ? "script-bn font-bengali"
            : guide.locale === "hi"
              ? "script-hi font-devanagari"
              : undefined
        }
      >
        <div className="mx-auto w-full max-w-canvas px-5 py-14 md:px-8 md:py-20">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="text-eyebrow uppercase text-accent">{guide.eyebrow}</p>
              <h1 className="mt-3 text-h1-mobile font-bold text-heading md:text-h1">
                {guide.title}
              </h1>
              {guide.lede.map((p) => (
                <p key={p} className="mt-5 max-w-2xl">
                  {p}
                </p>
              ))}
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/" className={variantClasses.primary}>
                  {guide.openApp}
                </Link>
                <Link href="/standards" className={variantClasses.secondary}>
                  {guide.seeStandards}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-sunk">
          <div className="mx-auto w-full max-w-canvas px-5 py-14 md:px-8 md:py-20">
            <h2 className="max-w-3xl text-h2-mobile font-bold text-heading md:text-h2">
              {guide.standardsHeading}
            </h2>
            <p className="mt-4 max-w-2xl">{guide.standardsLede}</p>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {guide.standards.map((s) => (
                <div key={s.name} className="rounded-card border-[1.5px] border-line bg-card p-6">
                  <p className="text-eyebrow uppercase text-accent" lang="en">
                    {s.name}
                  </p>
                  <p className="mt-3">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-canvas px-5 py-14 md:px-8 md:py-20">
          <h2 className="max-w-3xl text-h2-mobile font-bold text-heading md:text-h2">
            {guide.stepsHeading}
          </h2>
          <ol className="mt-10 space-y-8">
            {guide.steps.map((step, i) => (
              <li
                key={step.title}
                className="grid gap-x-6 gap-y-2 border-t-[1.5px] border-rule pt-6 sm:grid-cols-[3rem_1fr]"
              >
                {/* Tabular two-digit numerals in a gutter — the ledger pattern
                  * from the design system, not a filled circle stepper. */}
                <span
                  aria-hidden="true"
                  className="text-h3 font-bold tabular-nums text-muted"
                  lang="en"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="text-h3 font-bold text-heading">{step.title}</h3>
                  {step.body.map((p) => (
                    <p key={p} className="mt-3 max-w-3xl">
                      {p}
                    </p>
                  ))}
                  {step.figure && (
                    <div className="max-w-3xl">
                      <GuideFigure
                        kind={step.figure}
                        callouts={step.callouts}
                        label={guide.figureLabel}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-sunk">
          <div className="mx-auto w-full max-w-canvas px-5 py-14 md:px-8 md:py-20">
            <h2 className="max-w-3xl text-h2-mobile font-bold text-heading md:text-h2">
              {guide.watchHeading}
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {guide.watch.map((w) => (
                <li key={w.title} className="rounded-card border-[1.5px] border-line bg-card p-6">
                  <h3 className="font-bold text-heading">{w.title}</h3>
                  <p className="mt-2 text-small">{w.body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Link href="/" className={variantClasses.primary}>
                {guide.openApp}
              </Link>
            </div>
          </div>
        </div>
      </article>

      <SiteFooter />
    </>
  );
}
