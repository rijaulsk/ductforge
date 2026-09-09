"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BASE, PAD, type Size, type Variant } from "./variants";

/* The handful of components the design system actually defines, built here
 * rather than pulled from a component library — the system is small and
 * bespoke and a library would drown it.
 *
 * The class strings themselves live in `variants.ts`, which carries no
 * "use client" — a Server Component reading them through THIS module got
 * `undefined`, because a client module's exports reach the server as
 * references rather than values. See the header there.
 *
 * `variantClasses` is deliberately NOT re-exported from here. Re-exporting it
 * would still route a server importer through this client boundary and hand
 * back the same `undefined`, while looking like it worked. Anything that needs
 * the class strings imports `./variants` directly.
 */

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const pad = PAD[variant][size];
  return (
    <button
      type="button"
      {...rest}
      className={`${BASE[variant]}${pad ? ` ${pad}` : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "aside";
}) {
  return (
    <Tag
      className={`rounded-card border-[1.5px] border-line bg-card p-5 md:p-6${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </Tag>
  );
}

/** §2: 13/16 medium, uppercase, +6% tracking — above every panel title. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-eyebrow uppercase text-accent${className ? ` ${className}` : ""}`}>
      {children}
    </p>
  );
}

/**
 * LEFT-ALIGNED AT EVERY WIDTH, and that is a deliberate divergence from the
 * marketing site — see docs/app-surface.md.
 *
 * The site centres its content below `lg`, which is right for prose. This is
 * not prose. A schedule's columns, a dimension label beside its box, a figure
 * against its unit — none of those can centre, so centring only the HEADINGS
 * produced a screen where half the text was centred and half was not. That
 * mixture is what reads as broken, not the left edge.
 */
export function PanelHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-h3 font-bold text-heading">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

/**
 * The segmented control this app uses everywhere instead of a select or a
 * switch: every option is visible, the state is announced by aria-pressed
 * rather than by colour alone, and it is one tap on a phone.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-3.5 py-1.5 text-small" : "px-5 py-2.5";
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`rounded-full border-[1.5px] font-medium transition duration-200 ease-out ${pad} ${
              on
                ? "border-line bg-heading text-page"
                : "border-line text-heading hover:bg-sunk"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A figure with its label — the results strip's repeating unit. */
export function Stat({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
}) {
  return (
    <div>
      <p className="text-eyebrow uppercase text-accent">{label}</p>
      <p className="mt-2 text-h3 font-bold tabular-nums text-heading">
        {value}
        {unit && <span className="ml-1 text-small font-medium text-body">{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-small text-body">{sub}</p>}
    </div>
  );
}

/** An assumption, a simplification or a caveat. Always a word, never a colour
 * on its own — the design system bans status-by-hue and so does colour-blind
 * safety. */
export function Note({ children, label = "Note" }: { children: ReactNode; label?: string }) {
  return (
    <p className="text-small text-body">
      <span className="font-bold text-heading">{label}:</span> {children}
    </p>
  );
}
