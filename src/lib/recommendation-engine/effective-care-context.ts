import { normalizeRecommendationInput } from "@/lib/recommendation-engine/normalize"
import type {
  CareBalanceConflict,
  CareBalanceProvenanceEntry,
  CurrentTurnCareFact,
  EffectiveCareContext,
  NormalizedProfile,
  NormalizedRoutineInventoryItem,
  ProfileAugmentField,
  ProfileOverrideCareFact,
  RawRecommendationInput,
  RoutineFrequencyCareFact,
  RoutinePresenceCareFact,
} from "@/lib/recommendation-engine/types"

function cloneRoutineItem(
  item: NormalizedRoutineInventoryItem | null,
): NormalizedRoutineInventoryItem | null {
  return item === null ? null : { ...item }
}

function cloneNormalizedProfile(profile: NormalizedProfile): NormalizedProfile {
  return {
    ...profile,
    concerns: [...profile.concerns],
    goals: [...profile.goals],
    stylingTools: profile.stylingTools === null ? null : [...profile.stylingTools],
    chemicalTreatment: [...profile.chemicalTreatment],
    brushType: profile.brushType === null ? null : [...profile.brushType],
    nightProtection: profile.nightProtection === null ? null : [...profile.nightProtection],
    routineInventory: {
      shampoo: cloneRoutineItem(profile.routineInventory.shampoo),
      conditioner: cloneRoutineItem(profile.routineInventory.conditioner),
      leave_in: cloneRoutineItem(profile.routineInventory.leave_in),
      mask: cloneRoutineItem(profile.routineInventory.mask),
      oil: cloneRoutineItem(profile.routineInventory.oil),
      heat_protectant: cloneRoutineItem(profile.routineInventory.heat_protectant),
      bondbuilder: cloneRoutineItem(profile.routineInventory.bondbuilder),
      deep_cleansing_shampoo: cloneRoutineItem(profile.routineInventory.deep_cleansing_shampoo),
      dry_shampoo: cloneRoutineItem(profile.routineInventory.dry_shampoo),
      peeling: cloneRoutineItem(profile.routineInventory.peeling),
    },
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function recordChange(
  params: {
    provenance: CareBalanceProvenanceEntry[]
    conflicts: CareBalanceConflict[]
    fieldPath: string
    savedValue: unknown
    currentTurnValue: unknown
    evidenceQuote: string
  } & Pick<CareBalanceProvenanceEntry, "source" | "factKind">,
) {
  if (valuesEqual(params.savedValue, params.currentTurnValue)) {
    return
  }

  params.provenance.push({
    fieldPath: params.fieldPath,
    source: params.source,
    factKind: params.factKind,
    evidenceQuote: params.evidenceQuote,
  })

  params.conflicts.push({
    fieldPath: params.fieldPath,
    savedValue: params.savedValue,
    currentTurnValue: params.currentTurnValue,
    source: params.source,
    evidenceQuote: params.evidenceQuote,
  })
}

function ensureRoutineItem(
  profile: NormalizedProfile,
  fact: RoutinePresenceCareFact | RoutineFrequencyCareFact,
): NormalizedRoutineInventoryItem {
  const existing = profile.routineInventory[fact.category]
  if (existing !== null) return existing

  const item: NormalizedRoutineInventoryItem = {
    category: fact.category,
    present: true,
    productName: null,
    frequencyBand: null,
    productId: null,
    productSubmissionId: null,
    matchStatus: null,
  }
  profile.routineInventory[fact.category] = item
  return item
}

function augmentArrayField(
  profile: NormalizedProfile,
  field: ProfileAugmentField,
  values: unknown[],
) {
  const current = profile[field]
  const next = Array.isArray(current) ? [...current] : []

  for (const value of values) {
    if (!next.includes(value as never)) {
      next.push(value as never)
    }
  }

  const writableProfile = profile as unknown as Record<ProfileAugmentField, unknown>
  writableProfile[field] = next
}

function applyProfileOverride(profile: NormalizedProfile, fact: ProfileOverrideCareFact) {
  const writableProfile = profile as unknown as Record<string, unknown>
  writableProfile[fact.field] = fact.value
}

export function buildEffectiveCareContext(
  rawInput: RawRecommendationInput,
  currentTurnFacts: CurrentTurnCareFact[] = [],
): EffectiveCareContext {
  const savedProfile = normalizeRecommendationInput(rawInput)
  const profile = cloneNormalizedProfile(savedProfile)
  const provenance: CareBalanceProvenanceEntry[] = []
  const conflicts: CareBalanceConflict[] = []

  for (const fact of currentTurnFacts) {
    if (fact.kind === "context_signal") continue

    if (fact.kind === "profile_override") {
      const savedValue = savedProfile[fact.field]
      applyProfileOverride(profile, fact)
      recordChange({
        provenance,
        conflicts,
        fieldPath: `profile.${String(fact.field)}`,
        savedValue,
        currentTurnValue: fact.value,
        source: fact.source,
        factKind: fact.kind,
        evidenceQuote: fact.evidenceQuote,
      })
      continue
    }

    if (fact.kind === "profile_augment") {
      const savedValue = savedProfile[fact.field]
      augmentArrayField(profile, fact.field, fact.values)
      recordChange({
        provenance,
        conflicts,
        fieldPath: `profile.${fact.field}`,
        savedValue,
        currentTurnValue: profile[fact.field],
        source: fact.source,
        factKind: fact.kind,
        evidenceQuote: fact.evidenceQuote,
      })
      continue
    }

    if (fact.kind === "routine_presence") {
      const savedItem = savedProfile.routineInventory[fact.category]
      const savedPresence = savedItem?.present ?? false

      if (fact.present) {
        ensureRoutineItem(profile, fact)
      } else {
        profile.routineInventory[fact.category] = null
      }

      recordChange({
        provenance,
        conflicts,
        fieldPath: `routine.${fact.category}.present`,
        savedValue: savedPresence,
        currentTurnValue: fact.present,
        source: fact.source,
        factKind: fact.kind,
        evidenceQuote: fact.evidenceQuote,
      })
      continue
    }

    const savedItem = savedProfile.routineInventory[fact.category]
    const item = ensureRoutineItem(profile, fact)
    item.frequencyBand = fact.frequencyBand

    recordChange({
      provenance,
      conflicts,
      fieldPath: `routine.${fact.category}.frequency`,
      savedValue: savedItem?.frequencyBand ?? null,
      currentTurnValue: fact.frequencyBand,
      source: fact.source,
      factKind: fact.kind,
      evidenceQuote: fact.evidenceQuote,
    })
  }

  return {
    normalized: profile,
    currentTurnFacts,
    provenance,
    conflicts,
  }
}
