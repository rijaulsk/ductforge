"use client";

import { useEffect, useRef, useState } from "react";

/* A header that gets out of the way.
 *
 * A sticky header is a standing tax on the viewport: whatever it costs, it
 * costs on every scroll position for the whole session. On the calculator that
 * was two rows, and the complaint was fair — "barely viewable the content".
 *
 * The usual fixes are both bad. Making it static means losing the project name
 * and the nav the moment you scroll. Making it shorter helps a little and still
 * charges rent forever.
 *
 * So it hides when you scroll DOWN and comes back the instant you scroll UP —
 * the pattern every mobile browser uses for its own chrome, for exactly this
 * reason. Reading costs nothing; wanting the header back costs one small
 * upward flick rather than a journey to the top of the page.
 *
 * WHY A TRANSFORM AND NOT `display`. The header stays in the layout at all
 * times and only translates out of view, so nothing below it ever reflows.
 * Toggling its presence would move the whole document by the header's height
 * twice per scroll direction change, which is the jitter this is meant to end.
 *
 * Deliberately not hidden while a disclosure inside it is open — see `held`.
 */
export default function StickyHeader({
  children,
  className = "",
  /** Keep it on screen regardless: a menu is open inside it. */
  held = false,
}: {
  children: React.ReactNode;
  className?: string;
  held?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    /* A threshold, because a scroll event fires for a two-pixel wobble and a
     * header that flickers on trackpad noise is worse than one that never
     * moves. 8px is below the smallest deliberate scroll and above the noise. */
    const THRESHOLD = 8;
    /* Never hide near the top: there is nothing to gain, and the header
     * disappearing as the page begins reads as a glitch. */
    const FREE = 120;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const dy = y - lastY.current;
        if (Math.abs(dy) < THRESHOLD) return;
        lastY.current = y;
        setHidden(y > FREE && dy > 0);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const away = hidden && !held;

  return (
    <div
      className={`sticky top-0 z-40 transition-transform duration-200 ease-out ${className}`}
      style={{ transform: away ? "translateY(-100%)" : "translateY(0)" }}
    >
      {children}
    </div>
  );
}
