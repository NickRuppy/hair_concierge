import type { HairProfile, HairTexture, Concern, Goal } from "@/lib/types"
import { HAIR_TEXTURE_ADJECTIVE, HAIR_THICKNESS_ADJECTIVE } from "@/lib/vocabulary"

const FALLBACK_PROMPTS = [
  "Welche Routine empfiehlst du für lockiges Haar?",
  "Was hilft gegen Spliss?",
  "Kannst du mir ein gutes Shampoo empfehlen?",
  "Wie bekomme ich mehr Volumen?",
]

/* ── Slot 1: Template prompts (one picked based on available profile data) ── */

function getTemplatePrompts(profile: HairProfile): string[] {
  const prompts: string[] = []
  const ht = profile.hair_texture
  const tx = profile.thickness

  if (ht && tx) {
    prompts.push(
      `Welche Pflegeroutine passt am besten zu meinem ${HAIR_TEXTURE_ADJECTIVE[ht]}, ${HAIR_THICKNESS_ADJECTIVE[tx]} Haar?`,
    )
    prompts.push(
      `Was sind die besten Produkte für ${HAIR_TEXTURE_ADJECTIVE[ht]} und ${HAIR_THICKNESS_ADJECTIVE[tx]} Haar?`,
    )
  }
  if (ht) {
    prompts.push(`Welche Pflegeroutine empfiehlst du für ${HAIR_TEXTURE_ADJECTIVE[ht]} Haar?`)
    prompts.push(`Wie style ich ${HAIR_TEXTURE_ADJECTIVE[ht]} Haar am besten?`)
  }
  if (tx) {
    prompts.push(`Worauf sollte ich bei ${HAIR_THICKNESS_ADJECTIVE[tx]} Haar besonders achten?`)
  }

  // Always have at least one generic template
  prompts.push("Welche Pflegeroutine würdest du mir persönlich empfehlen?")

  return prompts
}

/* ── Slots 2-4: Pool prompts tagged by concern / goal / hair type ── */

interface PoolPrompt {
  text: string
  concerns?: Concern[]
  goals?: Goal[]
  hairTextures?: HairTexture[]
}

const POOL_PROMPTS: PoolPrompt[] = [
  // Concern-based
  { text: "Meine Haare sind so trocken — welche Pflege hilft wirklich?", concerns: ["dryness"] },
  { text: "Was kann ich gegen Spliss an den Spitzen tun?", concerns: ["split_ends"] },
  { text: "Wie werde ich Schuppen endlich los?", concerns: ["dandruff"] },
  { text: "Meine Kopfhaut fettet so schnell nach — was hilft?", concerns: ["oily_scalp"] },
  { text: "Wie kann ich Haarausfall vorbeugen?", concerns: ["hair_loss"] },
  {
    text: "Mein Haar ist durch Färben strapaziert — wie repariere ich es?",
    concerns: ["hair_damage", "colored"],
  },
  { text: "Was hilft wirklich gegen Frizz?", concerns: ["frizz"] },
  { text: "Mein Haar wird immer dünner — welche Produkte stärken es?", concerns: ["thinning"] },
  { text: "Wie schütze ich meine Haarfarbe vor dem Verblassen?", concerns: ["colored"] },

  // Goal-based
  { text: "Wie bekomme ich mehr Volumen in meine Haare?", goals: ["volume"] },
  { text: "Was kann ich tun, damit mein Haar schneller wächst?" },
  { text: "Wie definiere ich meine Locken am besten?", goals: ["curl_definition"] },
  { text: "Welche Produkte sorgen für mehr Glanz?", goals: ["shine"] },
  { text: "Wie bringe ich mehr Feuchtigkeit in mein Haar?", goals: ["moisture"] },
  { text: "Was hilft für eine gesunde Kopfhaut?", goals: ["healthy_scalp"] },
  { text: "Wie bekomme ich meine Haare gesünder?", goals: ["healthier_hair"] },
  { text: "Wie reduziere ich Frizz dauerhaft?", goals: ["less_frizz"] },
  { text: "Wie schütze ich meine Farbe am besten?", goals: ["color_protection"] },
  { text: "Was hilft wirklich gegen Spliss und abgebrochene Spitzen?", goals: ["less_split_ends"] },

  // Hair-texture-based
  { text: "Wie style ich Locken ohne Hitze?", hairTextures: ["curly", "coily"] },
  { text: "Wie pflege ich welliges Haar, ohne es zu beschweren?", hairTextures: ["wavy"] },
  { text: "Welche Leave-in-Produkte eignen sich für glattes Haar?", hairTextures: ["straight"] },
  { text: "Welche Schlafschutz-Routine eignet sich für Locken?", hairTextures: ["curly", "coily"] },
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

export function generateSuggestedPrompts(profile: HairProfile | null): string[] {
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
  const unique = shuffle(pool).filter((p) => p.text !== template)

  // Deduplicate
  const seen = new Set<string>([template])
  const picked: string[] = []
  for (const p of unique) {
    if (picked.length >= 3) break
    if (!seen.has(p.text)) {
      seen.add(p.text)
      picked.push(p.text)
    }
  }

  return [template, ...picked]
}
