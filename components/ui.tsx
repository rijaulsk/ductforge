"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/* The handful of components the design system actually defines, built here
 * rather than pulled from a component library — the system is small and
 * bespoke and a library would drown it.
 *
 * Two rules from the design system are load-bearing and easy to break by
 * accident, so they are enforced in one place:
 *   · Primary buttons are Clay 500 with INK text. White on clay fails
 *     contrast. There is at most one primary button visible at a time —
 *     in this app that is "Add to takeoff", and nothing else may claim it.
 *   · Cards are flat: 1.5px border, 14px radius, no shadow, ever.
 */

export type Variant = "primary" | "secondary" | "tertiary" | "quiet";
export type Size = "sm" | "md";

/* Padding is a separate axis from appearance so a size can be CHOSEN rather
 * than overridden. Two utilities for the same property in one class list
 * resolve by stylesheet order, not by author intent, so `px-5` plus `px-4`
 * would be a coin toss — and forcing it with an important modifier works today
 * but leans on a syntax Tailwind v4 has already deprecated. */
const BASE: Record<Variant, string> = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-clay-500 font-medium text-ink transition duration-200 ease-out hover:bg-clay-400 active:scale-[0.98] active:bg-clay-600 disabled:pointer-events-none disabled:opacity-45",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-line font-medium text-heading transition duration-200 ease-out hover:bg-sunk active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
  tertiary:
    "inline-flex items-center gap-1.5 font-medium text-accent underline-offset-4 transition-colors duration-200 ease-out hover:underline disabled:pointer-events-none disabled:opacity-45",
  quiet:
    "inline-flex items-center gap-1.5 text-body underline-offset-4 transition-colors duration-200 ease-out hover:text-heading hover:underline disabled:pointer-events-none disabled:opacity-45",
};

const PAD: Record<Variant, Record<Size, string>> = {
  primary: { md: "px-6 py-3", sm: "px-4 py-2 text-small" },
  secondary: { md: "px-5 py-2.5", sm: "px-4 py-2 text-small" },
  tertiary: { md: "", sm: "text-small" },
  quiet: { md: "text-small", sm: "text-small" },
};

/** The full class string, for the anchors that have to wear the same clothes
 * without becoming buttons. */
export const variantClasses: Record<Variant, string> = {
  primary: `${BASE.primary} ${PAD.primary.md}`,
  secondary: `${BASE.secondary} ${PAD.secondary.md}`,
  tertiary: BASE.tertiary,
  quiet: `${BASE.quiet} ${PAD.quiet.md}`,
};

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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 text-center lg:text-left">
      <div className="w-full lg:w-auto">
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
