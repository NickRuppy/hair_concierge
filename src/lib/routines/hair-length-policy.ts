import type {
  HairProfile,
  RoutineContext,
  RoutineProductCategory,
  RoutineSlotAdvice,
  RoutineTopicId,
} from "@/lib/types"
import {
  getLengthCareIntensity,
  suppressLengthOnlyCare,
} from "@/lib/recommendation-engine/hair-length"

export function hasHeatExposureNeed(context: RoutineContext): boolean {
  return (
    context.heat_styling === "daily" ||
    context.heat_styling === "several_weekly" ||
    context.drying_method === "blow_dry" ||
    context.drying_method === "blow_dry_diffuser" ||
    (context.styling_tools ?? []).some(
      (tool) =>
        tool === "flat_iron" ||
        tool === "curling_iron" ||
        tool === "blow_dryer" ||
        tool === "diffuser" ||
        tool === "thermal_rollers",
    )
  )
}

function isNeedDrivenCareSlot(
  slot: RoutineSlotAdvice,
  context: RoutineContext,
  activeTopicIds: Set<RoutineTopicId>,
): boolean {
  const concerns = new Set(context.concerns)
  const goals = new Set(context.goals)
  const treatments = new Set(context.chemical_treatment)
  const explicitTopicIds = new Set(context.explicit_topic_ids)

  if (slot.topic_ids.some((topicId) => explicitTopicIds.has(topicId))) return true
  if (slot.topic_ids.includes("lockenrefresh") && activeTopicIds.has("lockenrefresh")) return true
  if (context.has_dryness_damage_signals || context.has_damage_signals) return true
  if (hasHeatExposureNeed(context)) return true
  if (concerns.has("dryness") || concerns.has("frizz") || concerns.has("tangling")) return true
  if (goals.has("moisture") || goals.has("less_frizz") || goals.has("curl_definition")) return true
  if (treatments.has("colored") || treatments.has("bleached")) return true

  return slot.action === "avoid"
}

export function applyHairLengthRoutineCopy(
  slot: RoutineSlotAdvice,
  hairLength: HairProfile["hair_length"],
): RoutineSlotAdvice {
  const intensity = getLengthCareIntensity(hairLength)
  if (intensity === "minimal") {
    return {
      ...slot,
      caveats: [
        ...slot.caveats,
        "Bei sehr kurzem Haar nur eine sehr kleine Menge dort verwenden, wo wirklich Pflege gebraucht wird; wenn nichts trocken wirkt, bleibt der Schritt sehr schlank.",
      ],
    }
  }

  if (intensity === "light") {
    return {
      ...slot,
      caveats: [
        ...slot.caveats,
        "Bei kurzem Haar reicht eine kleine Menge; lieber leicht und sparsam starten.",
      ],
    }
  }

  if (intensity === "elevated" || intensity === "maximum") {
    return {
      ...slot,
      rationale: [
        ...slot.rationale,
        intensity === "maximum"
          ? "Bei sehr langem Haar partienweise arbeiten, damit Längen und Spitzen gleichmäßig erreicht werden."
          : "Bei langem Haar auf gleichmäßige Verteilung in Längen und Spitzen achten.",
      ],
      caveats: [
        ...slot.caveats,
        "Schutz und Entwirren eher über saubere Sektionen und gute Abdeckung steuern, nicht über mehr Repair-Produkte.",
      ],
    }
  }

  return slot
}

export function applyHairLengthRoutinePolicy(
  slot: RoutineSlotAdvice,
  params: {
    hairLength: HairProfile["hair_length"]
    context: RoutineContext
    activeTopicIds: Set<RoutineTopicId>
  },
): RoutineSlotAdvice | null {
  const lengthSensitiveCategories = new Set<RoutineProductCategory>(["leave_in", "mask", "oil"])
  if (
    suppressLengthOnlyCare(params.hairLength) &&
    slot.category !== null &&
    lengthSensitiveCategories.has(slot.category) &&
    !isNeedDrivenCareSlot(slot, params.context, params.activeTopicIds)
  ) {
    return null
  }

  if (
    slot.category === "conditioner" ||
    slot.category === "leave_in" ||
    slot.category === "mask" ||
    slot.category === "oil" ||
    slot.topic_ids.includes("brush_tools") ||
    slot.topic_ids.includes("cwc") ||
    slot.topic_ids.includes("owc")
  ) {
    return applyHairLengthRoutineCopy(slot, params.hairLength)
  }

  return slot
}
