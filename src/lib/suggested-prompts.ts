import type { HairProfile, HairTexture, Concern, Goal } from "@/lib/types"
import { HAIR_TEXTURE_ADJECTIVE, HAIR_THICKNESS_ADJECTIVE } from "@/lib/vocabulary"
import type { IconName } from "@/components/ui/icon"

export interface SuggestedPrompt {
  text: string
  icon?: IconName
}

const FALLBACK_PROMPTS: SuggestedPrompt[] = [
  { text: "Welche Routine empfiehlst du für lockiges Haar?", icon: "hair-curly" },
  { text: "Was hilft gegen Spliss?", icon: "goal-split-ends" },
  { text: "Kannst du mir ein gutes Shampoo empfehlen?", icon: "product-shampoo" },
  { text: "Wie bekomme ich mehr Volumen?", icon: "goal-volume" },
]

/* ── Slot 1: Template prompts (one picked based on available profile data) ── */

const TEXTURE_ICON: Record<HairTexture, IconName> = {
  straight: "hair-straight",
  wavy: "hair-wavy",
  curly: "hair-curly",
  coily: "hair-coily",
}

function getTemplatePrompts(profile: HairProfile): SuggestedPrompt[] {
  const prompts: SuggestedPrompt[] = []
  const ht = profile.hair_texture
  const tx = profile.thickness

  if (ht && tx) {
    prompts.push({
      text: `Welche Pflegeroutine passt am besten zu meinem ${HAIR_TEXTURE_ADJECTIVE[ht]}, ${HAIR_THICKNESS_ADJECTIVE[tx]} Haar?`,
      icon: TEXTURE_ICON[ht],
    })
    prompts.push({
      text: `Was sind die besten Produkte für ${HAIR_TEXTURE_ADJECTIVE[ht]} und ${HAIR_THICKNESS_ADJECTIVE[tx]} Haar?`,
      icon: TEXTURE_ICON[ht],
    })
  }
  if (ht) {
    prompts.push({
      text: `Welche Pflegeroutine empfiehlst du für ${HAIR_TEXTURE_ADJECTIVE[ht]} Haar?`,
      icon: TEXTURE_ICON[ht],
    })
    prompts.push({
      text: `Wie style ich ${HAIR_TEXTURE_ADJECTIVE[ht]} Haar am besten?`,
      icon: TEXTURE_ICON[ht],
    })
  }
  if (tx) {
    prompts.push({
      text: `Worauf sollte ich bei ${HAIR_THICKNESS_ADJECTIVE[tx]} Haar besonders achten?`,
      icon: "product-shampoo",
    })
  }

  // Always have at least one generic template
  prompts.push({
    text: "Welche Pflegeroutine würdest du mir persönlich empfehlen?",
    icon: "product-shampoo",
  })

  return prompts
}

/* ── Slots 2-4: Pool prompts tagged by concern / goal / hair type ── */

interface PoolPrompt {
  text: string
  icon?: IconName
  concerns?: Concern[]
  goals?: Goal[]
  hairTextures?: HairTexture[]
}

const POOL_PROMPTS: PoolPrompt[] = [
  // Concern-based
  {
    text: "Meine Haare sind so trocken — welche Pflege hilft wirklich?",
    icon: "goal-moisture",
    concerns: ["dryness"],
  },
  {
    text: "Was kann ich gegen Spliss an den Spitzen tun?",
    icon: "goal-split-ends",
    concerns: ["split_ends"],
  },
  {
    text: "Wie werde ich Schuppen endlich los?",
    icon: "scalp-dry",
    concerns: ["dandruff"],
  },
  {
    text: "Meine Kopfhaut fettet so schnell nach — was hilft?",
    icon: "scalp-oily",
    concerns: ["oily_scalp"],
  },
  {
    text: "Wie kann ich Haarausfall vorbeugen?",
    icon: "goal-growth",
    concerns: ["hair_loss"],
  },
  {
    text: "Mein Haar ist durch Färben strapaziert — wie repariere ich es?",
    icon: "goal-color-protection",
    concerns: ["hair_damage", "colored"],
  },
  { text: "Was hilft wirklich gegen Frizz?", icon: "goal-frizz", concerns: ["frizz"] },
  {
    text: "Mein Haar wird immer dünner — welche Produkte stärken es?",
    icon: "goal-growth",
    concerns: ["thinning"],
  },
  {
    text: "Wie schütze ich meine Haarfarbe vor dem Verblassen?",
    icon: "goal-color-protection",
    concerns: ["colored"],
  },

  // Goal-based
  {
    text: "Wie bekomme ich mehr Volumen in meine Haare?",
    icon: "goal-volume",
    goals: ["volume"],
  },
  { text: "Was kann ich tun, damit mein Haar schneller wächst?", icon: "goal-growth" },
  {
    text: "Wie definiere ich meine Locken am besten?",
    icon: "hair-curly",
    goals: ["curl_definition"],
  },
  { text: "Welche Produkte sorgen für mehr Glanz?", icon: "goal-shine", goals: ["shine"] },
  {
    text: "Wie bringe ich mehr Feuchtigkeit in mein Haar?",
    icon: "goal-moisture",
    goals: ["moisture"],
  },
  {
    text: "Was hilft für eine gesunde Kopfhaut?",
    icon: "goal-scalp-health",
    goals: ["healthy_scalp"],
  },
  {
    text: "Wie bekomme ich meine Haare gesünder?",
    icon: "goal-repair",
    goals: ["healthier_hair"],
  },
  { text: "Wie reduziere ich Frizz dauerhaft?", icon: "goal-frizz", goals: ["less_frizz"] },
  {
    text: "Wie schütze ich meine Farbe am besten?",
    icon: "goal-color-protection",
    goals: ["color_protection"],
  },
  {
    text: "Was hilft wirklich gegen Spliss und abgebrochene Spitzen?",
    icon: "goal-split-ends",
    goals: ["less_split_ends"],
  },

  // Hair-texture-based
  {
    text: "Wie style ich Locken ohne Hitze?",
    icon: "hair-curly",
    hairTextures: ["curly", "coily"],
  },
  {
    text: "Wie pflege ich welliges Haar, ohne es zu beschweren?",
    icon: "hair-wavy",
    hairTextures: ["wavy"],
  },
  {
    text: "Welche Leave-in-Produkte eignen sich für glattes Haar?",
    icon: "hair-straight",
    hairTextures: ["straight"],
  },
  {
    text: "Welche Schlafschutz-Routine eignet sich für Locken?",
    icon: "hair-curly",
    hairTextures: ["curly", "coily"],
  },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function matchesProfile(prompt: PoolPrompt, profile: HairProfile): boolean {
  const concerns = profile.concerns ?? []
  const goals = profile.goals ?? []
  const ht = profile.hair_texture

  if (prompt.concerns?.some((c) => concerns.includes(c))) return true
  if (prompt.goals?.some((g) => goals.includes(g))) return true
  if (prompt.hairTextures && ht && prompt.hairTextures.includes(ht)) return true

  return false
}

/* ── Main export ── */

export function generateSuggestedPrompts(profile: HairProfile | null): SuggestedPrompt[] {
  if (
    !profile ||
    (!profile.hair_texture &&
      !profile.thickness &&
      (profile.concerns ?? []).length === 0 &&
      (profile.goals ?? []).length === 0)
  ) {
    return FALLBACK_PROMPTS
  }

  // Slot 1: pick one random template prompt
  const templates = getTemplatePrompts(profile)
  const template = templates[Math.floor(Math.random() * templates.length)]

  // Slots 2-4: pick 3 from the filtered pool
  const matched = POOL_PROMPTS.filter((p) => matchesProfile(p, profile))
  const pool = matched.length >= 3 ? matched : [...matched, ...POOL_PROMPTS]
  const unique = shuffle(pool).filter((p) => p.text !== template.text)

  // Deduplicate
  const seen = new Set<string>([template.text])
  const picked: SuggestedPrompt[] = []
  for (const p of unique) {
    if (picked.length >= 3) break
    if (!seen.has(p.text)) {
      seen.add(p.text)
      picked.push({ text: p.text, icon: p.icon })
    }
  }

  return [template, ...picked]
}
