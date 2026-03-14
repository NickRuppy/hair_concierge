import type { Goal } from "./concerns-goals"
import type { HairTexture } from "./hair-types"

export interface OnboardingGoal {
  key: Goal
  label: string
  description: string
  emoji: string
}

export const ONBOARDING_GOALS: Record<HairTexture, OnboardingGoal[]> = {
  straight: [
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
    {
      key: "shine",
      label: "Mehr Glanz",
      description: "Sichtbar glaenzenderes, ruhigeres Finish",
      emoji: "🌟",
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
      key: "shine",
      label: "Mehr Glanz",
      description: "Glaenzenderes, gesuender wirkendes Haar",
      emoji: "✨",
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
      key: "shine",
      label: "Mehr Glanz",
      description: "Mehr Reflexion und weniger stumpfer Look",
      emoji: "✨",
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
      key: "healthier_hair",
      label: "Gesuenderes Haar",
      description: "Mehr Widerstandsfaehigkeit und weniger Haarbruch",
      emoji: "🛡️",
    },
  ],
}
