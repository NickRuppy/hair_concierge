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
      key: "volume",
      label: "Mehr Volumen & Lift",
      description: "Ansatzvolumen ohne Beschwerung",
      emoji: "🌿",
    },
    {
      key: "healthy_scalp",
      label: "Weniger schnell nachfetten",
      description: "Laengere Frische zwischen den Waeschen",
      emoji: "⏳",
    },
    {
      key: "less_frizz",
      label: "Anti-Frizz & Geschmeidigkeit",
      description: "Glatter Fall ohne Kraeuselung",
      emoji: "✨",
    },
  ],
  wavy: [
    {
      key: "curl_definition",
      label: "Wellen-Definition",
      description: "Gleichmaessige, sichtbare Wellen",
      emoji: "🌊",
    },
    {
      key: "moisture",
      label: "Leichte Feuchtigkeit",
      description: "Hydration ohne Beschwerung",
      emoji: "💧",
    },
    {
      key: "curl_definition",
      label: "Beach-Waves Textur",
      description: "Natuerlicher, undone Look",
      emoji: "🏖️",
    },
  ],
  curly: [
    {
      key: "curl_definition",
      label: "Locken-Clumping",
      description: "Definierte Lockenbuendel statt Frizz",
      emoji: "🔄",
    },
    {
      key: "moisture",
      label: "Intensive Feuchtigkeit",
      description: "Tiefenwirksame Pflege fuer trockene Locken",
      emoji: "💦",
    },
    {
      key: "curl_definition",
      label: "Locken strecken",
      description: "Laengere, locker fallende Curls",
      emoji: "📏",
    },
  ],
  coily: [
    {
      key: "moisture",
      label: "Feuchtigkeit versiegeln",
      description: "Feuchtigkeit einschliessen und bewahren",
      emoji: "🔒",
    },
    {
      key: "healthy_scalp",
      label: "Kopfhaut beruhigen",
      description: "Reizfreie, ausgeglichene Kopfhaut",
      emoji: "🌱",
    },
    {
      key: "moisture",
      label: "Maximale Geschmeidigkeit",
      description: "Weichheit und einfacheres Entwirren",
      emoji: "🧈",
    },
  ],
}
