/**
 * GlassJar design tokens — single source of truth.
 * These mirror the CSS custom properties in globals.css.
 * Use CSS vars in Tailwind classes; use these in JS where you need
 * a raw value (e.g. framer-motion color transitions, canvas drawing).
 */

export const colors = {
  accent:          "#3BB273",
  accentMuted:     "#2e9460",
  accentSubtle:    "#3BB27320",
  secondary:       "#EB5E28",
  secondaryMuted:  "#c94d1e",
  secondarySubtle: "#EB5E2820",

  // Light mode surfaces
  light: {
    bg:           "#FFFCF2",
    bgCard:       "#F5F2E4",
    bgElevated:   "#EDEADC",
    border:       "#D8D5C8",
    borderSubtle: "#E8E5D8",
    textPrimary:  "#1A1A1A",
    textSecondary:"#5A5A5A",
    textMuted:    "#8A8A8A",
  },

  // Dark mode surfaces
  dark: {
    bg:           "#0B0C0F",
    bgCard:       "#111318",
    bgElevated:   "#181B22",
    border:       "#1E2230",
    borderSubtle: "#161820",
    textPrimary:  "#E8E6E0",
    textSecondary:"#8A8A96",
    textMuted:    "#4A4A58",
  },

  // Semantic
  success: "#3BB273",
  error:   "#E53935",
  warning: "#F59E0B",
  pending: "#F59E0B",
} as const;

export const duration = {
  fast:   150,
  base:   250,
  slow:   400,
} as const;

/** Framer Motion transition presets */
export const transitions = {
  spring: {
    type: "spring",
    stiffness: 400,
    damping: 28,
  },
  springGentle: {
    type: "spring",
    stiffness: 200,
    damping: 24,
  },
  easeOut: {
    type: "tween",
    ease: [0.16, 1, 0.3, 1],
    duration: duration.base / 1000,
  },
  fast: {
    type: "tween",
    ease: [0.16, 1, 0.3, 1],
    duration: duration.fast / 1000,
  },
} as const;

/** Common Framer Motion variants */
export const variants = {
  fadeIn: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: transitions.easeOut },
  },
  fadeUp: {
    hidden:  { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: transitions.easeOut },
  },
  fadeDown: {
    hidden:  { opacity: 0, y: -12 },
    visible: { opacity: 1, y: 0, transition: transitions.easeOut },
  },
  scaleIn: {
    hidden:  { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: transitions.spring },
  },
  slideRight: {
    hidden:  { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: transitions.easeOut },
  },
  staggerChildren: {
    visible: { transition: { staggerChildren: 0.06 } },
  },
} as const;
