import type { HairTexture } from "./hair-types"

export interface OnboardingGoal {
  key: string
  label: string
  description: string
  emoji: string
}

export const ONBOARDING_GOALS: Record<HairTexture, OnboardingGoal[]> = {
  straight: [
    {
      key: "volumen",
      label: "Mehr Volumen & Lift",
      description: "Ansatzvolumen ohne Beschwerung",
      emoji: "🌿",
    },
    {
      key: "nachfetten",
      label: "Weniger schnell nachfetten",
      description: "Laengere Frische zwischen den Waeschen",
      emoji: "⏳",
    },
    {
      key: "anti-frizz",
      label: "Anti-Frizz & Geschmeidigkeit",
      description: "Glatter Fall ohne Kraeuselung",
      emoji: "✨",
    },
  ],
  wavy: [
    {
      key: "definition",
      label: "Wellen-Definition",
      description: "Gleichmaessige, sichtbare Wellen",
      emoji: "🌊",
    },
    {
      key: "feuchtigkeit",
      label: "Leichte Feuchtigkeit",
      description: "Hydration ohne Beschwerung",
      emoji: "💧",
    },
    {
      key: "beach-waves",
      label: "Beach-Waves Textur",
      description: "Natuerlicher, undone Look",
      emoji: "🏖️",
    },
  ],
  curly: [
    {
      key: "clumping",
      label: "Locken-Clumping",
      description: "Definierte Lockenbuendel statt Frizz",
      emoji: "🔄",
    },
    {
      key: "feuchtigkeit",
      label: "Intensive Feuchtigkeit",
      description: "Tiefenwirksame Pflege fuer trockene Locken",
      emoji: "💦",
    },
    {
      key: "strecken",
      label: "Locken strecken",
      description: "Laengere, locker fallende Curls",
      emoji: "📏",
    },
  ],
  coily: [
    {
      key: "versiegeln",
      label: "Feuchtigkeit versiegeln",
      description: "Feuchtigkeit einschliessen und bewahren",
      emoji: "🔒",
    },
    {
      key: "kopfhaut",
      label: "Kopfhaut beruhigen",
      description: "Reizfreie, ausgeglichene Kopfhaut",
      emoji: "🌱",
    },
    {
      key: "geschmeidigkeit",
      label: "Maximale Geschmeidigkeit",
      description: "Weichheit und einfacheres Entwirren",
      emoji: "🧈",
    },
  ],
}
