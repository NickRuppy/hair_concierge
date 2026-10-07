import type { BondbuilderResearchProfile } from "./contracts"
import type { ApplicationGuidanceProtocolV1 } from "../routines/personal-plan/application/contracts"
import {
  productApplicationPointerV2Schema,
  type ProductApplicationPointerV2,
} from "../routines/personal-plan/application/contracts-v2"
import { composeProductApplicationProtocolsV2 } from "../routines/personal-plan/application/compiler-v2"
import { validateBondbuilderResearchProfile } from "./production-adapter"
import { z } from "zod"

export type BondbuilderProtocolProjection =
  | { status: "hold"; reasons: string[] }
  | {
      status: "resolved"
      pointer: ProductApplicationPointerV2
      protocol: ApplicationGuidanceProtocolV1
      usageProtocol: "verified_product_protocol"
      cadenceHold: string | null
    }

type Timing = NonNullable<BondbuilderResearchProfile["application"]["timing"]["value"]>
function contactTime(timing: Timing | null): ProductApplicationPointerV2["facts"]["contactTime"] {
  if (!timing || timing.purpose === "working_time" || timing.kind === "no_extra_wait") return null
  if (timing.kind === "exact_seconds")
    return timing.seconds > 0 ? { kind: "seconds", seconds: timing.seconds } : null
  if (timing.kind === "minimum_seconds")
    return timing.minimum_seconds > 0
      ? { kind: "minimum_seconds", minimumSeconds: timing.minimum_seconds }
      : null
  if (timing.kind === "range_seconds")
    return timing.minimum_seconds > 0
      ? {
          kind: "range_seconds",
          minimumSeconds: timing.minimum_seconds,
          maximumSeconds: timing.maximum_seconds,
        }
      : null
  return null
}
function duration(seconds: number) {
  return seconds % 60 === 0
    ? String(seconds / 60) + (seconds === 60 ? " Minute" : " Minuten")
    : String(seconds) + " Sekunden"
}
function timingCopy(timing: Timing) {
  if (timing.kind === "exact_seconds")
    return (
      duration(timing.seconds) +
      (timing.purpose === "wait_before_next_step" ? " vollständig warten." : " einwirken lassen.")
    )
  if (timing.kind === "minimum_seconds")
    return "Mindestens " + duration(timing.minimum_seconds) + " einwirken lassen."
  if (timing.kind === "range_seconds")
    return (
      duration(timing.minimum_seconds) +
      " bis " +
      duration(timing.maximum_seconds) +
      " einwirken lassen."
    )
  return null
}
function quantity(count: number, unit: "ml" | "g" | "pump" | "vial" | "drop") {
  const units = {
    ml: "ml",
    g: "g",
    pump: count === 1 ? "Pumpstoß" : "Pumpstöße",
    vial: "Fläschchen",
    drop: "Tropfen",
  }
  return String(count) + " " + units[unit]
}

/** Direction facts own application; formula markers never select a branded workflow. */
export function projectBondbuilderProtocol(
  input: BondbuilderResearchProfile,
  productId: string,
): BondbuilderProtocolProjection {
  const validation = validateBondbuilderResearchProfile(input)
  if (!validation.success) return { status: "hold", reasons: validation.errors }
  const profile = validation.profile
  const app = profile.application
  const hold = (...reasons: string[]): BondbuilderProtocolProjection => ({
    status: "hold",
    reasons,
  })
  if (
    !z.string().uuid().safeParse(productId).success ||
    (profile.identity.product_id !== null && profile.identity.product_id !== productId)
  )
    return hold("product_identity_mismatch")
  if (profile.holds.protocol.length) return hold(...profile.holds.protocol.map((h) => h.code))
  if (app.market_applicability === "unresolved" || !app.direction_source_ids.length)
    return hold("direction_source_applicability_unresolved")
  if (app.market_applicability === "exact_market" && app.source_market !== profile.identity.market)
    return hold("direction_source_market_mismatch")
  const bedtime =
    app.state_modifiers.value?.includes("at_bedtime") === true &&
    app.timing.value?.kind === "overnight" &&
    app.timing.value.purpose === "contact" &&
    app.rinse.value?.treatment_mode === "leave_in" &&
    !app.rinse.value.standalone_treatment_rinse
  if (
    (app.placement.value === "between_washes" ||
      app.state_modifiers.value?.includes("at_bedtime")) &&
    !bedtime
  )
    return hold("unsupported_between_wash_or_bedtime_placement")
  const sequence = app.sequence.value,
    placement = app.placement.value,
    rinse = app.rinse.value,
    state = app.hair_state.value,
    area = app.application_area.value
  if ((!placement && !bedtime) || !sequence || !rinse || !state || !area)
    return hold("missing_exact_application_facts")
  if (
    bedtime &&
    ((placement !== null && placement !== "between_washes") ||
      app.dilution.value ||
      sequence.some((s) => !["apply_treatment", "distribute", "wait"].includes(s.action)) ||
      !sequence.some((s) => s.action === "wait" && !s.optional && s.timing?.kind === "overnight") ||
      app.conditioner.value?.before === "not_allowed" ||
      app.conditioner.value?.minimum_wait_seconds ||
      app.conditioner.value?.after === "required" ||
      app.conditioner.value?.after === "recommended" ||
      app.longer_wear.value?.overnight_allowed === false)
  )
    return hold("bedtime_application_conflict")
  if (
    (placement === "pre_shampoo" && rinse.treatment_mode === "leave_in") ||
    (placement === "post_shampoo" &&
      rinse.treatment_mode === "rinse_out" &&
      !rinse.standalone_treatment_rinse)
  ) {
    return hold("unsupported_placement_rinse_relationship")
  }
  if (
    app.longer_wear.value?.maximum_seconds !== null &&
    app.longer_wear.value?.maximum_seconds !== undefined
  )
    return hold("maximum_wear_requires_supported_projection")
  const directionSources = profile.sources.filter((s) => app.direction_source_ids.includes(s.id))
  if (
    directionSources.some(
      (s) =>
        s.scope !== "product" ||
        !["pack", "manufacturer", "distributor", "retailer"].includes(s.authority),
    )
  )
    return hold("direction_source_not_product_directions")
  const selectedSources = new Set(app.direction_source_ids)
  for (const [field, fact] of Object.entries(app)) {
    // Cadence may retain a limited, unselected-market observation. It is not
    // executed by this protocol and must independently pass its projection.
    if (field === "cadence") continue
    if (
      fact &&
      typeof fact === "object" &&
      "value" in fact &&
      fact.value !== null &&
      !fact.source_ids.every((id) => selectedSources.has(id))
    )
      return hold("application_fact_outside_selected_directions")
  }
  if (sequence.some((s) => !s.source_ids.every((id) => selectedSources.has(id))))
    return hold("sequence_outside_selected_directions")
  const applyIndices = sequence.flatMap((s, i) => (s.action === "apply_treatment" ? [i] : []))
  if (applyIndices.length !== 1 || sequence[applyIndices[0]].optional)
    return hold("unsupported_repeated_or_optional_treatment")
  const applied = applyIndices[0]
  if (bedtime && sequence.some((step, index) => step.action === "wait" && index <= applied))
    return hold("bedtime_wait_before_application")
  const shampoo = sequence.findIndex((s) => s.action === "shampoo" || s.action === "layer_shampoo")
  const firstRinse = sequence.findIndex((s) => s.action === "rinse")
  if (
    (placement === "pre_shampoo" && shampoo <= applied) ||
    (placement === "post_shampoo" && (shampoo < 0 || shampoo >= applied))
  )
    return hold("sequence_placement_conflict")
  if (
    placement === "post_shampoo" &&
    sequence.some((s, i) => i > applied && (s.action === "shampoo" || s.action === "layer_shampoo"))
  )
    return hold("unsupported_treatment_redose_or_rewash")
  if (
    sequence.some((s) => s.action === "layer_shampoo") &&
    (placement !== "pre_shampoo" || rinse.standalone_treatment_rinse)
  )
    return hold("layered_shampoo_rinse_conflict")
  const nextConditioner = sequence.findIndex(
    (s, i) => i > applied && s.action === "apply_conditioner",
  )
  const treatmentSteps = sequence.slice(
    applied + 1,
    placement === "pre_shampoo" ? shampoo : nextConditioner >= 0 ? nextConditioner : undefined,
  )
  if (
    rinse.treatment_mode === "leave_in" &&
    (rinse.standalone_treatment_rinse || treatmentSteps.some((s) => s.action === "rinse"))
  )
    return hold("leave_in_standalone_rinse_conflict")
  if (
    placement === "pre_shampoo" &&
    rinse.standalone_treatment_rinse &&
    (firstRinse <= applied || firstRinse >= shampoo)
  )
    return hold("missing_rinse_before_shampoo")
  const timing = app.timing.value
  if (timing?.kind === "overnight" && !bedtime) return hold("unsupported_overnight_only_timing")
  const contact = contactTime(timing)
  if (
    timing?.purpose === "working_time" ||
    sequence.some((s) => s.timing?.purpose === "working_time")
  )
    return hold("working_time_requires_supported_projection")
  if (
    sequence.some((s) => s.action === "wait" && JSON.stringify(s.timing) !== JSON.stringify(timing))
  )
    return hold("additional_wait_requires_supported_projection")
  if (
    contact &&
    !treatmentSteps.some(
      (s) =>
        s.action === "wait" && JSON.stringify(s.timing) === JSON.stringify(timing) && !s.optional,
    )
  )
    return hold("missing_exact_wait_in_sequence")
  if (
    app.cadence.value?.branches.some(
      (b) => b.timing !== null && JSON.stringify(b.timing) !== JSON.stringify(timing),
    )
  )
    return hold("conditional_contact_time_requires_selection")
  const conditioner = app.conditioner.value
  if (
    conditioner?.before === "not_allowed" &&
    sequence.slice(0, applied).some((s) => s.action === "apply_conditioner")
  )
    return hold("conditioner_before_forbidden")
  if (
    conditioner?.minimum_wait_seconds &&
    (timing?.kind !== "exact_seconds" || timing.seconds < conditioner.minimum_wait_seconds)
  )
    return hold("conditioner_wait_not_preserved")
  if (app.partners.value?.some((p) => p.requirement === "required"))
    return hold("required_companion_not_bound")

  const facts: ProductApplicationPointerV2["facts"] = {
    applicationState: (
      {
        wet: "wet_hair",
        damp: "damp_hair",
        dry: "dry_hair",
        either: "damp_or_dry_hair",
        pre_wash_dry: "pre_wash_dry_hair",
      } as const
    )[state],
    applicationArea:
      area === "root_to_tip" || area === "hair" ? "root_to_tip_hair" : "hair_lengths_ends",
    rinse:
      placement === "pre_shampoo" && !rinse.standalone_treatment_rinse
        ? "follow_with_shampoo"
        : rinse.treatment_mode,
    contactTime: contact,
    amount: null,
    heat: null,
    conditionerPolicy: "not_applicable",
    ...(bedtime
      ? { overnightAllowed: true }
      : app.longer_wear.value
        ? { overnightAllowed: app.longer_wear.value.overnight_allowed }
        : {}),
    ...(conditioner
      ? {
          conditionerSequence: {
            before: conditioner.before === "not_allowed" ? "forbidden" : conditioner.before,
            after: conditioner.after,
            minimumWaitSeconds: conditioner.minimum_wait_seconds,
            ...(conditioner.guidance_reference
              ? { supplementalGuidanceRef: conditioner.guidance_reference }
              : {}),
          },
        }
      : {}),
    ...(placement === "pre_shampoo"
      ? {
          shampooAfterTreatment:
            sequence[shampoo].action === "layer_shampoo"
              ? "layer_without_rinsing"
              : rinse.standalone_treatment_rinse
                ? "rinse_then_shampoo"
                : "wash_as_usual",
        }
      : {}),
  }
  const steps: ProductApplicationPointerV2["exactSteps"] = []
  const distributionCopies: Record<string, string> = {
    "Roots to ends": "Vom Ansatz bis zu den Spitzen verteilen.",
    "Fully saturate dry hair.": "Das trockene Haar vollständig benetzen.",
    "Saturate the hair.": "Das Haar vollständig benetzen.",
    "Distribute through lengths.": "Gleichmäßig in den Längen verteilen.",
    "Work from ends upward.": "Von den Spitzen nach oben einarbeiten.",
    "Massage into lengths.": "In die Längen einmassieren.",
    "Massage into wet lengths.": "In die feuchten Längen einmassieren.",
    "Apply from roots to tips.": "Vom Ansatz bis in die Spitzen verteilen.",
    "Rub a small amount between the hands, then distribute evenly from ends upward.":
      "Gleichmäßig von den Spitzen nach oben verteilen.",
  }
  const distributionCopy = app.distribution.value
    ? distributionCopies[app.distribution.value]
    : null
  if (app.distribution.value && !distributionCopy)
    return hold("distribution_requires_reviewed_translation")
  const dilution = app.dilution.value
  if (dilution) {
    if (!sequence.slice(0, applied).some((s) => s.action === "dilute"))
      return hold("dilution_missing_from_sequence")
    facts.dilution = {
      concentrateAmount: dilution.concentrate.quantity,
      concentrateUnit: dilution.concentrate.unit,
      finishedVolumeMl: dilution.finished_volume_ml,
      containerDe: "vorgesehene Herstellerflasche",
      methodDe: "Mit Wasser bis zum vorgesehenen Endvolumen auffüllen und mischen.",
    }
    steps.push({
      stepKey: "dilute",
      action: "section",
      copyDe:
        quantity(dilution.concentrate.quantity, dilution.concentrate.unit) +
        " in der vorgesehenen Herstellerflasche mit Wasser auf " +
        dilution.finished_volume_ml +
        " ml fertige Mischung auffüllen und mischen.",
    })
  }
  if (app.state_modifiers.value?.includes("thoroughly_towel_dried"))
    steps.push({
      stepKey: "towel-dry",
      action: "dry",
      copyDe: "Nach dem Shampoo gründlich mit dem Handtuch trocknen.",
    })
  if (conditioner?.before === "not_allowed")
    steps.push({
      stepKey: "no-conditioner-before",
      action: "section",
      copyDe: "Vor dieser Behandlung keinen Conditioner verwenden.",
    })
  const stateDe = (
    {
      wet: "nasse",
      damp: "feuchte",
      dry: "trockene",
      either: "feuchte oder trockene",
      pre_wash_dry: "trockene",
    } as const
  )[state]
  const areaDe =
    area === "root_to_tip"
      ? "vom Ansatz bis zu den Spitzen"
      : area === "ends_upward"
        ? "von den Spitzen nach oben"
        : area === "lengths_ends"
          ? "in Längen und Spitzen"
          : "im Haar"
  let dose = ""
  const amount = app.amount.value
  if (amount?.kind === "numeric" || amount?.kind === "starting_dose") {
    facts.amount =
      amount.kind === "numeric"
        ? { kind: "numeric", quantity: amount.amount.quantity, unit: amount.amount.unit }
        : {
            kind: "starting_dose",
            quantity: amount.amount.quantity,
            unit: amount.amount.unit,
            addAsNeeded: amount.add_as_needed,
          }
    dose =
      amount.kind === "starting_dose"
        ? "Mit " +
          quantity(amount.amount.quantity, amount.amount.unit) +
          " beginnen." +
          (amount.add_as_needed ? " Bei Bedarf mehr verwenden." : "") +
          " "
        : quantity(amount.amount.quantity, amount.amount.unit) + " verwenden. "
  }
  if (amount?.kind === "qualitative") {
    const coverage: Record<string, string> = {
      "Saturate hair fully.": "Das Haar vollständig benetzen.",
      "Generous coverage.": "Eine großzügige Menge verwenden.",
      "Apply a generous amount.": "Eine großzügige Menge verwenden.",
      "Use a small amount.": "Eine kleine Menge verwenden.",
    }
    const copy = coverage[amount.instruction]
    if (!copy) return hold("qualitative_amount_requires_reviewed_translation")
    facts.amount = { kind: "source_instruction", copyDe: copy }
    dose = copy + " "
  }
  if (
    bedtime &&
    app.distribution.value ===
      "Rub a small amount between the hands, then distribute evenly from ends upward."
  ) {
    steps.push({
      stepKey: "hands",
      action: "section",
      copyDe: "Vor dem Schlafengehen eine kleine Menge zwischen den Händen verreiben.",
    })
    // That exact distribution instruction already carries the small amount.
    if (amount?.kind === "qualitative" && amount.instruction === "Use a small amount.") dose = ""
  }
  steps.push({
    stepKey: "apply",
    action: "apply_product",
    copyDe:
      (bedtime ? "Vor dem Schlafengehen anwenden. " : "") +
      dose +
      "Auf das " +
      stateDe +
      (app.state_modifiers.value?.includes("unwashed") ? ", ungewaschene" : "") +
      " Haar geben und " +
      areaDe +
      " verteilen.",
  })
  if (distributionCopy)
    steps.push({ stepKey: "distribute", action: "section", copyDe: distributionCopy })
  if (bedtime)
    steps.push({
      stepKey: "overnight",
      action: "wait",
      copyDe: "Über Nacht im Haar lassen. Nicht ausspülen.",
    })
  if (contact && timing)
    steps.push({
      stepKey: "wait",
      action: "wait",
      copyDe: timingCopy(timing)! + (facts.overnightAllowed ? " Auch über Nacht möglich." : ""),
    })
  if (rinse.standalone_treatment_rinse)
    steps.push({
      stepKey: "rinse-treatment",
      action: "rinse",
      copyDe: "Die Behandlung gründlich ausspülen.",
    })
  if (facts.shampooAfterTreatment === "layer_without_rinsing")
    steps.push({
      stepKey: "shampoo-after",
      action: "section",
      copyDe: "Noch nicht ausspülen. Anschließend das Shampoo direkt darüber auftragen.",
    })
  else if (placement === "pre_shampoo")
    steps.push({
      stepKey: "shampoo-after",
      action: "section",
      copyDe: "Anschließend wie gewohnt mit Shampoo waschen und pflegen.",
    })
  if (conditioner?.after === "recommended")
    steps.push({
      stepKey: "conditioner-after",
      action: "section",
      copyDe: "Danach mit Conditioner fortfahren und ihn wie gewohnt ausspülen.",
    })
  else if (conditioner?.after === "optional")
    steps.push({
      stepKey: "conditioner-after",
      action: "section",
      copyDe:
        "Danach kannst du deinen üblichen Conditioner verwenden und diesen wie gewohnt ausspülen. Wenn du keine zusätzliche Pflege brauchst, lässt du diesen Schritt weg.",
    })
  const candidate = productApplicationPointerV2Schema.safeParse({
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "bondbuilder", productId },
    sourceRole: "specialized_bond_treatment",
    role: "bond_repair",
    applicationFamily: bedtime
      ? "overnight_leave_in_treatment"
      : placement === "pre_shampoo"
        ? "pre_shampoo_single_treatment"
        : rinse.treatment_mode === "leave_in"
          ? "post_shampoo_timed_leave_in"
          : "post_shampoo_rinse_out_treatment",
    facts,
    workflowId: "bondbuilder_verified_product",
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: steps,
    cautionCodes: [],
    evidence: directionSources.map((s) => ({
      sourceUrl: s.url,
      sourceType: s.authority === "retailer" ? "retailer" : "manufacturer",
      checkedAt: s.checked_date,
    })),
  })
  if (!candidate.success)
    return hold(...candidate.error.issues.map((i) => i.path.join(".") + ": " + i.message))
  const compiled = composeProductApplicationProtocolsV2(candidate.data, [])
  if (compiled.status !== "resolved") return hold(compiled.reason)
  const cadence = app.cadence.value
  return {
    status: "resolved",
    pointer: candidate.data,
    protocol: compiled.protocols[0],
    usageProtocol: "verified_product_protocol",
    cadenceHold:
      !cadence ||
      cadence.status !== "source_stated" ||
      cadence.branches.length ||
      !app.cadence.source_ids.every((id) => selectedSources.has(id))
        ? "exact_product_cadence_unavailable"
        : null,
  }
}
