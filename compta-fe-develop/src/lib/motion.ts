import type { Transition } from "motion/react";

/** Soft physical spring for sliding/morphing active selection (~180–300ms settle). */
export const selectionSpring: Transition = {
  type: "spring",
  stiffness: 480,
  damping: 38,
  mass: 0.8,
};

/** Near-instant transition when prefers-reduced-motion is on. */
export const selectionReduced: Transition = {
  type: "tween",
  duration: 0.08,
  ease: "easeOut",
};

export const colorTransitionMs = 160;
export const iconScaleTransitionMs = 150;
export const pressScaleTransitionMs = 90;
