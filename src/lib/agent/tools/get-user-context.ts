import type { HairProfile, UserMemoryEntry } from "@/lib/types"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  hydrateHairProfileForConsumers,
  type RoutineInventoryLike,
} from "@/lib/hair-profile/derived"
import { getVisibleProductUsageItems } from "@/lib/product-usage/shampoo-fallback"
import { loadRoutineItemsForEngine } from "@/lib/recommendation-engine"
import { loadUserMemoryContext } from "@/lib/chat-runtime/user-memory"
import {
  HAIR_TEXTURE_LABELS,
  HAIR_THICKNESS_LABELS,
  PRODUCT_FREQUENCY_LABELS,
  PROTEIN_MOISTURE_LABELS,
  ROUTINE_PRODUCT_LABELS,
  SCALP_TYPE_LABELS,
} from "@/lib/vocabulary"
import type { GuidanceId } from "@/lib/agent/contracts"

export interface MissingProfileField {
  key: "hair_texture" | "shampoo_frequency"
  label: "Haarmuster" | "Shampoo-Rhythmus"
  blocking: false
}

export interface UserContextProjection {
  profile: HairProfile | null
  routine_inventory: RoutineInventoryLike[]
  relevant_memory: UserMemoryEntry[]
  derived_signals: string[]
  suggested_overlays: GuidanceId[]
  missing_profile: MissingProfileField[]
}

const RELEVANT_MEMORY_LIMIT = 6
const MAX_SUGGESTED_OVERLAYS = 4
const MINIMAL_ROUTINE_RE = /\b(simple|minimal|einfach\w*)\b/i
const NEGATED_MINIMAL_ROUTINE_RE =
  /\b(?:kein(?:e|en|er|em)?|keine|nicht|no)\s+(?:\w+\s+){0,2}(simple|minimal|einfach\w*)\b/i
const OVERLAY_PRIORITY: Partial<Record<GuidanceId, number>> = {
  "overlay:hair_loss_or_thinning_guardrail": 100,
  "overlay:dandruff_scalp": 95,
  "overlay:sensitive_scalp": 90,
  "overlay:oily_scalp": 80,
  "overlay:dry_lengths": 75,
  "overlay:frizz_control": 74,
  "overlay:fine_hair": 73,
  "overlay:tangling_detangling": 72,
  "overlay:low_density_weight_sensitive": 69,
  "overlay:curly_hair": 65,
  "overlay:coily_hair": 65,
  "overlay:heat_styling": 60,
  "overlay:mechanical_stress": 58,
  "overlay:buildup_risk": 56,
  "overlay:chemical_or_color_treated": 54,
  "overlay:damage_repair": 52,
  "overlay:protein_moisture_balance": 50,
  "overlay:minimal_routine": 45,
}

function getShampooFrequency(hairProfile: HairProfile | null): HairProfile["shampoo_frequency"] {
  return hairProfile?.shampoo_frequency ?? null
}

function formatRoutineProducts(
  products: NonNullable<HairProfile["current_routine_products"]>,
): string {
  return products.map((product) => ROUTINE_PRODUCT_LABELS[product] ?? product).join(", ")
}

function deriveConcernSignals(hairProfile: HairProfile | null): string[] {
  const signals: string[] = []

  if (hairProfile?.concerns.includes("oily_scalp")) {
    signals.push("Schnell fettender Ansatz")
  }

  if (hairProfile?.concerns.includes("dryness")) {
    signals.push("Trockene Längen")
  }

  if (hairProfile?.concerns.includes("frizz")) {
    signals.push("Frizzige Längen")
  }

  return signals
}

function deriveVisibleSignals(hairProfile: HairProfile | null): string[] {
  const signals: string[] = []

  if (hairProfile?.hair_texture) {
    signals.push(
      `Haarstruktur: ${HAIR_TEXTURE_LABELS[hairProfile.hair_texture] ?? hairProfile.hair_texture}`,
    )
  }

  if (hairProfile?.thickness) {
    signals.push(
      `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`,
    )
  }

  if (hairProfile?.protein_moisture_balance) {
    signals.push(
      `Protein-/Feuchtigkeitsbalance: ${
        PROTEIN_MOISTURE_LABELS[hairProfile.protein_moisture_balance] ??
        hairProfile.protein_moisture_balance
      }`,
    )
  }

  if (hairProfile?.scalp_type) {
    signals.push(`Kopfhaut: ${SCALP_TYPE_LABELS[hairProfile.scalp_type] ?? hairProfile.scalp_type}`)
  }

  const shampooFrequency = getShampooFrequency(hairProfile)
  if (shampooFrequency) {
    signals.push(
      `Shampoo-Rhythmus: ${PRODUCT_FREQUENCY_LABELS[shampooFrequency] ?? shampooFrequency}`,
    )
  }

  signals.push(...deriveConcernSignals(hairProfile))

  if ((hairProfile?.current_routine_products?.length ?? 0) > 0) {
    const currentRoutineProducts = hairProfile?.current_routine_products ?? []
    signals.push(`Aktuelle Routine: ${formatRoutineProducts(currentRoutineProducts)}`)
  }

  return signals
}

function deriveSuggestedOverlays(
  hairProfile: HairProfile | null,
  memoryEntries: UserMemoryEntry[],
): GuidanceId[] {
  const overlays: GuidanceId[] = []
  const seen = new Set<GuidanceId>()
  const addOverlay = (overlay: GuidanceId) => {
    if (seen.has(overlay)) return
    seen.add(overlay)
    overlays.push(overlay)
  }

  if (hairProfile?.thickness === "fine") {
    addOverlay("overlay:fine_hair")
  }

  if (hairProfile?.concerns.includes("oily_scalp")) {
    addOverlay("overlay:oily_scalp")
  }

  if (hairProfile?.concerns.includes("dryness")) {
    addOverlay("overlay:dry_lengths")
  }

  if (hairProfile?.concerns.includes("frizz")) {
    addOverlay("overlay:dry_lengths")
  }

  if (hairProfile?.density === "low") {
    addOverlay("overlay:low_density_weight_sensitive")
  }

  if (hairProfile?.concerns.includes("frizz") || hairProfile?.goals.includes("less_frizz")) {
    addOverlay("overlay:frizz_control")
  }

  if (hairProfile?.concerns.includes("tangling")) {
    addOverlay("overlay:tangling_detangling")
  }

  if (hairProfile?.protein_moisture_balance) {
    addOverlay("overlay:protein_moisture_balance")
  }

  if (
    (hairProfile?.chemical_treatment ?? []).some((treatment) => treatment !== "natural") ||
    hairProfile?.goals.includes("color_protection")
  ) {
    addOverlay("overlay:chemical_or_color_treated")
  }

  if (hairProfile?.concerns.includes("hair_loss") || hairProfile?.concerns.includes("thinning")) {
    addOverlay("overlay:hair_loss_or_thinning_guardrail")
  }

  if (hairProfile?.hair_texture === "curly") {
    addOverlay("overlay:curly_hair")
  }

  if (hairProfile?.hair_texture === "coily") {
    addOverlay("overlay:coily_hair")
  }

  if (hairProfile?.heat_styling && hairProfile.heat_styling !== "never") {
    addOverlay("overlay:heat_styling")
  }

  if (
    (hairProfile?.chemical_treatment ?? []).some((treatment) => treatment !== "natural") ||
    hairProfile?.concerns.includes("hair_damage") ||
    hairProfile?.concerns.includes("breakage") ||
    hairProfile?.concerns.includes("split_ends")
  ) {
    addOverlay("overlay:damage_repair")
  }

  if (
    (hairProfile?.heat_styling && hairProfile.heat_styling !== "never") ||
    Boolean(hairProfile?.styling_tools?.length) ||
    Boolean(hairProfile?.brush_type?.length) ||
    Boolean(hairProfile?.drying_method && hairProfile.drying_method !== "air_dry")
  ) {
    addOverlay("overlay:mechanical_stress")
  }

  if (
    hairProfile?.scalp_condition === "dry_flakes" ||
    hairProfile?.scalp_condition === "irritated"
  ) {
    addOverlay("overlay:sensitive_scalp")
  }

  if (hairProfile?.scalp_condition === "dandruff") {
    addOverlay("overlay:dandruff_scalp")
  }

  if (
    memoryEntries.some(
      (entry) =>
        entry.kind === "preference" &&
        MINIMAL_ROUTINE_RE.test(entry.content) &&
        !NEGATED_MINIMAL_ROUTINE_RE.test(entry.content),
    )
  ) {
    addOverlay("overlay:minimal_routine")
  }

  return rankOverlayIds(overlays).slice(0, MAX_SUGGESTED_OVERLAYS)
}

function rankOverlayIds(ids: GuidanceId[]): GuidanceId[] {
  return ids
    .map((id, index) => ({ id, index }))
    .sort((left, right) => {
      const priorityDelta = (OVERLAY_PRIORITY[right.id] ?? 0) - (OVERLAY_PRIORITY[left.id] ?? 0)
      return priorityDelta === 0 ? left.index - right.index : priorityDelta
    })
    .map((item) => item.id)
}

function deriveMissingProfileFields(hairProfile: HairProfile | null): MissingProfileField[] {
  const missing: MissingProfileField[] = []

  if (!hairProfile?.hair_texture) {
    missing.push({ key: "hair_texture", label: "Haarmuster", blocking: false })
  }

  if (!getShampooFrequency(hairProfile)) {
    missing.push({ key: "shampoo_frequency", label: "Shampoo-Rhythmus", blocking: false })
  }

  return missing
}

export function assertHairProfileQuerySucceeded(result: {
  data: HairProfile | null
  error: { message: string } | null
}): HairProfile | null {
  if (result.error) {
    throw new Error(`hair_profiles lookup failed: ${result.error.message}`)
  }

  return result.data
}

export function buildUserContextProjection(params: {
  hairProfile: HairProfile | null
  routineItems: RoutineInventoryLike[]
  memoryEntries: UserMemoryEntry[]
}): UserContextProjection {
  const relevantMemory = params.memoryEntries.slice(0, RELEVANT_MEMORY_LIMIT)

  return {
    profile: params.hairProfile,
    routine_inventory: getVisibleProductUsageItems(params.routineItems),
    relevant_memory: relevantMemory,
    derived_signals: deriveVisibleSignals(params.hairProfile),
    suggested_overlays: deriveSuggestedOverlays(params.hairProfile, relevantMemory),
    missing_profile: deriveMissingProfileFields(params.hairProfile),
  }
}

export async function getUserContext(userId: string): Promise<UserContextProjection> {
  const admin = createAdminClient()

  const [hairProfileQuery, routineItems, memoryContext] = await Promise.all([
    admin.from("hair_profiles").select("*").eq("user_id", userId).maybeSingle(),
    loadRoutineItemsForEngine(userId),
    loadUserMemoryContext(userId, admin),
  ])

  const rawProfile = assertHairProfileQuerySucceeded(hairProfileQuery)
  const hairProfile = hydrateHairProfileForConsumers(rawProfile ?? null, routineItems)

  return buildUserContextProjection({
    hairProfile,
    routineItems,
    memoryEntries: memoryContext.entries,
  })
}
