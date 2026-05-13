import { loadGuidance } from "@/lib/agent/guidance/load-guidance"
import { isGuidanceId } from "@/lib/agent/contracts"
import type { GuidanceId, GuidanceKind } from "@/lib/agent/contracts"
import type { UserContextProjection } from "@/lib/agent/tools/get-user-context"
import type { ConversationState } from "@/lib/types"

export interface AgenticConsultationBriefItem {
  id: GuidanceId
  kind: GuidanceKind
  title: string
  content: string
}

export interface AgenticConsultationBrief {
  charter: string[]
  routine_staging: string[]
  product_vs_education: string[]
  profile_overlays: AgenticConsultationBriefItem[]
  candidate_guidance: AgenticConsultationBriefItem[]
}

export interface BuildAgenticConsultationBriefParams {
  message: string
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>
  userContext: UserContextProjection
  conversationState?: ConversationState | null
}

const CHARTER = [
  "Be a knowledgeable, warm hair-care advisor.",
  "Answer the current user delta first.",
  "Educate before recommending products when the user shows conceptual curiosity.",
  "When the user explicitly asks for safe cosmetic products, fulfill the request and steer softly if another lever is stronger.",
  "Keep deterministic tool outputs authoritative for product names, ranking, claims, routine steps, and hard safety policies.",
  "Ask at most one blocking follow-up.",
  "Do not expose internal tool, trace, state, policy, or guidance labels to the user.",
] as const

const ROUTINE_STAGING = [
  "For broad routine asks, start with basics: shampoo, conditioner, and one highest-impact extra lever.",
  "After basics, ask whether the user wants to go toward goals or problems.",
  "For goal-oriented routine turns, show only the top goal levers.",
  "For problem-oriented routine turns, show only the top problem levers.",
  "For category follow-ups inside a routine thread, explain the category role first unless the user explicitly asks for concrete products.",
] as const

const PRODUCT_VS_EDUCATION = [
  "Conceptual category interest: answer educationally without select_products. Examples: 'ist Leave-in gut?', 'brauche ich eine Maske?', 'was bringt Conditioner?'",
  "Explicit product ask: call select_products. Examples: 'welches Produkt?', 'kannst du etwas empfehlen?', 'was soll ich kaufen?', 'A oder B?'",
  "Explicit safe weak-lever category ask: call select_products and recommend with caveat. Example: shampoo for shine can get shampoo picks plus a soft steer toward conditioner or leave-in as stronger shine levers.",
  "Usage ask: answer application, dosage, order, and technique before considering a new product selection.",
] as const

const CATEGORY_TOPIC_BY_KEYWORD: Array<{
  id: string
  patterns: RegExp[]
}> = [
  { id: "topic:shampoo", patterns: [/\bshampoo\b/i] },
  {
    id: "topic:conditioner",
    patterns: [/\bconditioner\b/i, /\bspuelung\b/i, /\bspulung\b/i],
  },
  { id: "topic:leave_in", patterns: [/\bleave[-_ ]?in\b/i, /\bleavein\b/i] },
  { id: "topic:mask", patterns: [/\bmaske\b/i, /\bkur\b/i, /\bhaarkur\b/i] },
  {
    id: "topic:hair_oiling",
    patterns: [/\boel\b/i, /\bol\b/i, /\boil\b/i, /\bhaaroel\b/i, /\bhaarol\b/i],
  },
  {
    id: "topic:bond_builder",
    patterns: [
      /\bbond[-_ ]?builder\b/i,
      /\bbond[-_ ]?repair\b/i,
      /\bk18\b/i,
      /\bkr18\b/i,
      /\bolaplex\b/i,
      /\bepres\b/i,
    ],
  },
  {
    id: "topic:deep_cleansing",
    patterns: [
      /\btiefenreinigung\b/i,
      /\btiefenreinigungsshampoo\b/i,
      /\bdeep[-_ ]?cleansing\b/i,
      /\breinigungsshampoo\b/i,
      /\bclarifying\b/i,
      /\breset\b/i,
    ],
  },
  {
    id: "topic:dry_shampoo",
    patterns: [/\btrockenshampoo\b/i, /\bdry[-_ ]?shampoo\b/i],
  },
  {
    id: "topic:peeling",
    patterns: [/\bpeeling\b/i, /\bkopfhaut[-_ ]?peeling\b/i, /\bscalp[-_ ]?(?:scrub|exfoliat)/i],
  },
]

const ROUTINE_RE = /\b(routine|basis|basics|anpassen|umstellen|vereinfach|aufbauen|schritte?)\b/i
const BROAD_CATEGORY_OVERVIEW_RE =
  /\b(andere|weiter\w*|zusaetzlich|zusatzlich|noch|ergaenz\w*|erganz\w*)\b.*\b(produkt\w*|kategorie\w*|shampoo|routine)\b|\b(?:was|welche?s?)?\s*(?:sollte|soll|kann|koennte|konnte|könnte)\s+ich\s+noch\s+(?:hinzuf(?:u|ue)g\w*|ergaenz\w*|erganz\w*|dazunehmen|nehmen)\b|\bwhat\s+else\s+(?:should|can|could)\s+i\s+(?:add|use|try)\b|\banything\s+else\s+(?:to\s+)?(?:add|use|try)\b/i
const MAX_GUIDANCE_CHARS = 1200

export async function buildAgenticConsultationBrief(
  params: BuildAgenticConsultationBriefParams,
): Promise<AgenticConsultationBrief> {
  const profileOverlayIds = params.userContext.suggested_overlays.filter(isSupportedBriefGuidanceId)
  const candidateIds = deriveCandidateGuidanceIds(params)
  const [profileOverlays, candidateGuidance] = await Promise.all([
    loadGuidance(profileOverlayIds),
    loadGuidance(candidateIds),
  ])

  return {
    charter: [...CHARTER],
    routine_staging: [...ROUTINE_STAGING],
    product_vs_education: [...PRODUCT_VS_EDUCATION],
    profile_overlays: profileOverlays.items.map(compactGuidanceItem),
    candidate_guidance: candidateGuidance.items.map(compactGuidanceItem),
  }
}

function deriveCandidateGuidanceIds(params: BuildAgenticConsultationBriefParams): GuidanceId[] {
  const ids: GuidanceId[] = []
  const text = [
    params.message,
    params.conversationState?.active_topic ?? "",
    params.conversationState?.routine_layer ?? "",
    params.conversationState?.last_product_category ?? "",
  ].join("\n")
  const normalizedText = normalizeText(text)

  if (
    ROUTINE_RE.test(normalizedText) ||
    BROAD_CATEGORY_OVERVIEW_RE.test(normalizedText) ||
    params.conversationState?.active_topic === "routine"
  ) {
    ids.push("playbook:build_or_fix_routine")
  }

  for (const topic of CATEGORY_TOPIC_BY_KEYWORD) {
    if (topic.patterns.some((pattern) => pattern.test(normalizedText))) {
      if (isGuidanceId(topic.id)) {
        ids.push(topic.id)
      }
    }
  }

  return unique(ids)
}

function compactGuidanceItem(item: {
  id: GuidanceId
  kind: GuidanceKind
  title: string
  content: string
}): AgenticConsultationBriefItem {
  return {
    ...item,
    content: item.content.trim().slice(0, MAX_GUIDANCE_CHARS),
  }
}

function unique(ids: GuidanceId[]): GuidanceId[] {
  return Array.from(new Set(ids))
}

function isSupportedBriefGuidanceId(id: GuidanceId): boolean {
  return id.startsWith("overlay:")
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}
