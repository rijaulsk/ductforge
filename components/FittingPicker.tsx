"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { RECTANGULAR_KINDS, ROUND_KINDS, SPECS } from "@/lib/duct/formulas";
import type { FittingKind } from "@/lib/duct/types";
import FittingGlyph from "./FittingGlyph";

/* The fitting picker.
 *
 * WHY THIS IS NOT A `<select>` ANY MORE. A native select's list is positioned
 * by the browser, and when the control sits low in the viewport the browser
 * opens it UPWARD — reported, and not something CSS can reach. It also renders
 * options as plain text, so ten fittings arrived as ten words with no picture
 * and no room for the alias that makes them findable.
 *
 * This opens downward, always, because it is our own element. It also carries
 * the glyph and the other name per row, which is the whole point: "Transition"
 * means nothing to somebody who calls it a reducer, and the drawing settles it
 * faster than either word.
 *
 * Keyboard behaviour is the listbox pattern rather than a select's: up/down to
 * move, Enter or Space to take it, Escape to leave it alone. Typing a letter
 * jumps to the next fitting whose name OR alias starts with it, so "r" finds
 * the transition for anyone who learned it as a reducer.
 */

const GROUPS: { label: string; kinds: readonly FittingKind[] }[] = [
  { label: "Rectangular", kinds: RECTANGULAR_KINDS },
  { label: "Round and spiral", kinds: ROUND_KINDS },
];

const ORDER: FittingKind[] = GROUPS.flatMap((g) => [...g.kinds]);

export default function FittingPicker({
  value,
  onChange,
}: {
  value: FittingKind;
  onChange: (kind: FittingKind) => void;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<FittingKind>(value);
  const wrap = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const spec = SPECS[value];

  /* Close on an outside pointer or on Escape. Pointerdown rather than click so
   * the list is gone before whatever was clicked receives its own event. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /* Keep the highlighted row in view when arrowing through a list taller than
   * its own scroll box. */
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-kind="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const commit = (kind: FittingKind) => {
    onChange(kind);
    setActive(kind);
    setOpen(false);
  };

  const step = (by: number) => {
    const i = ORDER.indexOf(active);
    setActive(ORDER[Math.min(ORDER.length - 1, Math.max(0, i + by))]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setActive(value);
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(active);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(ORDER[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(ORDER[ORDER.length - 1]);
    } else if (/^[a-z]$/i.test(e.key)) {
      /* Name OR alias, so "r" reaches the transition. */
      const hit = ORDER.find((k) =>
        [SPECS[k].name, ...SPECS[k].aka].some((n) => n.toLowerCase().startsWith(e.key.toLowerCase())),
      );
      if (hit) setActive(hit);
    }
  };

  return (
    <div ref={wrap} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${uid}-label`}
        onClick={() => {
          setActive(value);
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-3 rounded-card border-[1.5px] border-line bg-page px-3 py-2.5 text-left"
      >
        <span aria-hidden="true" className="shrink-0 text-accent">
          <FittingGlyph kind={value} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-heading">{spec.name}</span>
          {spec.aka.length > 0 && (
            <span className="block truncate text-small text-muted">{spec.aka.join(" · ")}</span>
          )}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={1.8}
          aria-hidden="true"
          className={`shrink-0 text-body transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        /* ALWAYS `top-full`. The whole reason this component exists is that the
         * native list chose its own side and chose wrong; flipping it here on a
         * height heuristic would reintroduce the same surprise. It caps its own
         * height and scrolls instead. */
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={`${uid}-label`}
          tabIndex={-1}
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(60svh,26rem)] overflow-y-auto overscroll-contain rounded-card border-[1.5px] border-line bg-card p-1"
        >
          {GROUPS.map((group) => (
            <li key={group.label}>
              <p className="px-3 pb-1 pt-3 text-eyebrow uppercase text-muted">{group.label}</p>
              <ul role="group">
                {group.kinds.map((kind) => {
                  const s = SPECS[kind];
                  const on = kind === value;
                  return (
                    <li key={kind}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        data-kind={kind}
                        onClick={() => commit(kind)}
                        onPointerEnter={() => setActive(kind)}
                        className={`flex w-full items-center gap-3 rounded-card px-3 py-2 text-left transition-colors duration-200 ease-out ${
                          kind === active ? "bg-sunk" : ""
                        }`}
                      >
                        <span aria-hidden="true" className="shrink-0 text-accent">
                          <FittingGlyph kind={kind} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-heading">{s.name}</span>
                          {s.aka.length > 0 && (
                            <span className="block truncate text-small text-muted">
                              {s.aka.join(" · ")}
                            </span>
                          )}
                        </span>
                        {on && (
                          <Check size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-accent" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <span id={`${uid}-label`} className="sr-only">
        Fitting
      </span>
    </div>
  );
}
