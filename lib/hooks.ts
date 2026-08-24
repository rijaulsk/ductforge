"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * True only after hydration.
 *
 * Anything read from localStorage has to render as its server value on the
 * first pass or React throws a hydration mismatch, so the workspace renders a
 * static placeholder until this flips. It is deliberately `useSyncExternalStore`
 * and not an effect with setState: the effect version is exactly what the
 * `react-hooks/set-state-in-effect` lint rule exists to stop, and it renders
 * one extra frame.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
