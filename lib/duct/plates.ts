import type { FlatFrame, FlatHoled, FlatOval, FlatRing } from "./types";

/* The flat pieces' geometry, where an input can describe something impossible.
 *
 * A hole wider than its plate, an opening bigger than its frame: every one of
 * these is a thing people type while they are halfway through changing a size.
 * Left alone, the area goes negative and the drawing turns inside out.
 *
 * So each is limited HERE, once, and the formula, the working line and all
 * three drawings read the limited value from this file. That is the point of it
 * being one file: a clamp written twice is two clamps, and the day they differ
 * the drawing shows one plate and the total bills another. The working line
 * says when a limit was applied, so it is never silent.
 */

/** The hole in a ring, no wider than the ring. */
export const ringHole = (f: FlatRing): number => Math.min(f.d2, f.d1);

/** The round hole in a rectangular plate, no wider than the plate's short side. */
export const plateHole = (f: FlatHoled): number => Math.min(f.d, f.w, f.h);

/** The opening in a frame, no bigger than the frame on either axis. */
export const frameOpening = (f: FlatFrame): { w: number; h: number } => ({
  w: Math.min(f.w2, f.w),
  h: Math.min(f.h2, f.h),
});

/**
 * A flat oval, read the way round it was typed.
 *
 * The SHORT side is the diameter of the two round ends and the long side is
 * the overall length, whichever of W and H the user put them in — an oval
 * entered as 400 × 800 is the same plate as 800 × 400 stood on end, not an
 * impossible one. `straight` is the length of the flat middle between the two
 * half circles; zero when W = H, which is a circle.
 */
export const ovalParts = (f: FlatOval): { long: number; short: number; straight: number } => {
  const long = Math.max(f.w, f.h);
  const short = Math.min(f.w, f.h);
  return { long, short, straight: long - short };
};
