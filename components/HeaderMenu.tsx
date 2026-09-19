"use client";

import { Menu, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

/* The site links and the theme, folded into one button — on the calculator,
 * on a phone, only.
 *
 * WHY. The calculator's header on a 390 px phone was three rows and 163 px: the
 * logo and the theme, then Calculator · Guide · Standards, then the project
 * name. Every pixel of it is charged again each time the header slides back.
 * The three links are the whole site and must stay one tap away — they do,
 * behind this — but they do not need a row of their own on the one page where
 * the screen is a workspace. The guide and standards pages keep the visible
 * nav: they ARE reading pages, and the links are how you move between them.
 *
 * Closes on an outside tap, Escape, a scroll (the header it hangs from may be
 * sliding away) and, via the links themselves, on navigation.
 */
export default function HeaderMenu({ children }: { children: ReactNode }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${uid}-menu`}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line transition-colors duration-200 ease-out ${
          open ? "bg-heading text-page" : "text-heading hover:bg-sunk"
        }`}
      >
        {open ? <X size={20} strokeWidth={1.6} /> : <Menu size={20} strokeWidth={1.6} />}
        <span className="sr-only">{open ? "Close the menu" : "Menu: guide, standards, theme"}</span>
      </button>
      {open && (
        <div
          id={`${uid}-menu`}
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-card border-[1.5px] border-line bg-page p-2"
          onClick={(e) => {
            /* A link was followed — the menu has done its job. */
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
          <div className="mt-2 flex items-center justify-between gap-3 border-t-[1.5px] border-rule px-2 pt-2">
            <span className="text-small text-body">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
