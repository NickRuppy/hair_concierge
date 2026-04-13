import type { Goal } from "./concerns-goals"
import type { HairTexture } from "./hair-types"
import type { IconName } from "@/components/ui/icon"

export interface OnboardingGoal {
  key: Goal
  label: string
  description: string
  icon: IconName
}

export const ONBOARDING_GOALS: Record<HairTexture, OnboardingGoal[]> = {
  straight: [
    {
      key: "healthy_scalp",
      label: "Weniger schnell nachfetten",
      description: "Längere Frische zwischen den Wäschen",
      icon: "goal-less-washing",
    },
    {
      key: "less_frizz",
      label: "Anti-Frizz & Geschmeidigkeit",
      description: "Glatter Fall ohne Kräuselung",
      icon: "goal-smoothness",
    },
    {
      key: "shine",
      label: "Mehr Glanz",
      description: "Sichtbar glänzenderes, ruhigeres Finish",
      icon: "goal-shine",
    },
    {
      key: "less_split_ends",
      label: "Weniger Spliss",
      description: "Gesunde Spitzen, weniger Haarbruch",
      icon: "goal-split-ends",
    },
  ],
  wavy: [
    {
      key: "curl_definition",
      label: "Wellen-Definition",
      description: "Gleichmäßige, sichtbare Wellen",
      icon: "goal-definition",
    },
    {
      key: "moisture",
      label: "Leichte Feuchtigkeit",
      description: "Hydration ohne Beschwerung",
      icon: "goal-moisture",
    },
    {
      key: "shine",
      label: "Mehr Glanz",
      description: "Glänzenderes, gesünder wirkendes Haar",
      icon: "goal-shine",
    },
    {
      key: "less_frizz",
      label: "Weniger Frizz",
      description: "Kontrolle ohne Beschwerung",
      icon: "goal-frizz",
    },
    {
      key: "less_split_ends",
      label: "Weniger Spliss",
      description: "Gesunde Spitzen, weniger Haarbruch",
      icon: "goal-split-ends",
    },
  ],
  curly: [
    {
      key: "curl_definition",
      label: "Locken-Clumping",
      description: "Definierte Lockenbündel statt Frizz",
      icon: "goal-definition",
    },
    {
      key: "moisture",
      label: "Intensive Feuchtigkeit",
      description: "Tiefenwirksame Pflege für trockene Locken",
      icon: "goal-moisture",
    },
    {
      key: "shine",
      label: "Mehr Glanz",
      description: "Mehr Reflexion und weniger stumpfer Look",
      icon: "goal-shine",
    },
    {
      key: "less_split_ends",
      label: "Weniger Spliss",
      description: "Gesunde Spitzen, weniger Haarbruch",
      icon: "goal-split-ends",
    },
    {
      key: "less_frizz",
      label: "Weniger Frizz",
      description: "Kontrolle und Definition statt Kräuselung",
      icon: "goal-frizz",
    },
  ],
  coily: [
    {
      key: "moisture",
      label: "Feuchtigkeit versiegeln",
      description: "Feuchtigkeit einschließen und bewahren",
      icon: "goal-moisture",
    },
    {
      key: "healthy_scalp",
      label: "Kopfhaut beruhigen",
      description: "Reizfreie, ausgeglichene Kopfhaut",
      icon: "goal-scalp-health",
    },
    {
      key: "healthier_hair",
      label: "Gesünderes Haar",
      description: "Mehr Widerstandsfähigkeit und weniger Haarbruch",
      icon: "goal-repair",
    },
    {
      key: "less_split_ends",
      label: "Weniger Spliss",
      description: "Gesunde Spitzen, weniger Haarbruch",
      icon: "goal-split-ends",
    },
  ],
}
