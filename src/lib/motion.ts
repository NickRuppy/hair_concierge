/**
 * Motion tokens (batch 8, plans/discovery-b8-motion-days/plan.md): one spec for the quiz
 * and the discovery flow. The CSS twins are the `--motion-*` custom properties in
 * `src/app/globals.css` — change both together.
 */
export const MOTION_MS = {
  press: 120,
  /** The single delay after a one-tap answer before the flow advances. */
  settle: 200,
  stepIn: 240,
  stepOut: 160,
  screen: 320,
  sheetIn: 350,
  sheetOut: 250,
  list: 220,
  /** No loader, skeleton or „speichert …" label before this. */
  loaderDelay: 300,
  /** Once a loader is visible, it stays at least this long. */
  loaderMinimum: 500,
} as const

export const MOTION_EASE_ENTER = "cubic-bezier(0.32, 0.72, 0, 1)"
export const MOTION_EASE_EXIT = "cubic-bezier(0.4, 0, 1, 1)"
