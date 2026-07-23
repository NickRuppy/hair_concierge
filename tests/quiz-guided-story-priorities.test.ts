import assert from "node:assert/strict"
import test from "node:test"

import {
  GUIDED_STORY_COPY_RECORDS,
  GUIDED_STORY_LEGACY_FALLBACK_PRIORITIES,
  GUIDED_STORY_PRIORITY_FAMILIES,
} from "../src/lib/quiz/guided-story-copy"
import {
  rankGuidedStoryPriorities,
  type GuidedStoryPriority,
} from "../src/lib/quiz/guided-story-priorities"
import type { QuizAnswers } from "../src/lib/quiz/types"

function answers(overrides: QuizAnswers): QuizAnswers {
  return {
    structure: "straight",
    thickness: "normal",
    density: "medium",
    hair_length: "medium",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    has_scalp_issue: false,
    concerns: [],
    treatment: ["natur"],
    ...overrides,
  }
}

function variantIds(priorities: GuidedStoryPriority[]): string[] {
  return priorities.map((priority) => priority.variantId)
}

function combinedText(priorities: GuidedStoryPriority[]): string {
  return priorities
    .flatMap((priority) => [priority.title, priority.finding, priority.why, priority.helps])
    .join("\n")
}

test("exports the nine locked priority families", () => {
  assert.deepEqual(
    [...GUIDED_STORY_PRIORITY_FAMILIES],
    [
      "scalp_flakes",
      "scalp_comfort",
      "strength_damage",
      "moisture_dryness",
      "surface_manageability",
      "ends_protection",
      "definition",
      "volume_weight",
      "color_protection",
    ],
  )
})

test("runtime copy includes active family variants plus the approved positive fallback only", () => {
  const runtimeVariantIds: string[] = GUIDED_STORY_COPY_RECORDS.map((record) => record.variantId)

  assert.equal(runtimeVariantIds.length, 25)
  assert.deepEqual(runtimeVariantIds, [
    "scalp_flakes.schuppen",
    "scalp_flakes.trockene_schuppen",
    "scalp_comfort.gereizte_kopfhaut",
    "scalp_comfort.fettige_kopfhaut",
    "scalp_comfort.trockene_kopfhaut",
    "scalp_comfort.ausgeglichene_kopfhaut",
    "strength_damage.haarbruch_schaden_basis",
    "strength_damage.mit_chemischer_behandlung",
    "strength_damage.auffalliger_zugtest",
    "moisture_dryness.trockenheit_basis",
    "moisture_dryness.trocken_rau_behandelt",
    "surface_manageability.frizz",
    "surface_manageability.verknotungen",
    "surface_manageability.frizz_knoten_glanz",
    "surface_manageability.nur_glanz_ziel",
    "ends_protection.spliss_lange_spitzen",
    "definition.wellig_lockig_oder_coily",
    "definition.glattes_haar_definitions_ziel",
    "volume_weight.mehr_volumen_fein_niedrige_dichte",
    "volume_weight.mehr_volumen_allgemein",
    "volume_weight.weniger_volumen_viel_kraftig_texturiert",
    "volume_weight.weniger_volumen_allgemein",
    "color_protection.gefarbt_blondiert",
    "color_protection.naturhaar_farbschutz_ziel",
    "special.keine_konkrete_sorge",
  ])
  assert.equal(runtimeVariantIds.includes("special.gesunderes_haar"), false)
  assert.equal(runtimeVariantIds.includes("special.medizinisch_angrenzender_freitext"), false)
})

test("legacy fallback copy stays separate from the approved matrix records", () => {
  const runtimeVariantIds: string[] = GUIDED_STORY_COPY_RECORDS.map((record) => record.variantId)

  assert.deepEqual(
    GUIDED_STORY_LEGACY_FALLBACK_PRIORITIES.map(({ title, why, helps }) => ({
      title,
      why,
      helps,
    })),
    [
      {
        title: "Eine gute Basis für dein individuelles Haar",
        why: "Aus den verfügbaren Antworten lässt sich kein einzelnes Problem sicher in den Vordergrund stellen.",
        helps:
          "Mit einer einfachen, schonenden Basis starten und nur dort ergänzen, wo ein klarer Wunsch besteht.",
      },
      {
        title: "Geschmeidigkeit bleibt ein sinnvoller Grundbaustein",
        why: "Shampoo und Conditioner bilden auch ohne ein klar priorisiertes Zusatzthema eine vollständige Basis.",
        helps: "Sanft reinigen und die Längen passend zu ihrem Haargefühl konditionieren.",
      },
      {
        title: "Weniger Schritte können vollkommen ausreichen",
        why: "Ein drittes Produkt wäre ohne passende Signale keine ehrliche Personalisierung.",
        helps: "Mit Shampoo und Conditioner beginnen und die Routine später gemeinsam verfeinern.",
      },
    ],
  )
  assert.equal(runtimeVariantIds.includes("legacy.basis"), false)
})

test("selects every active approved variant on its supported path", () => {
  const cases: Array<{ name: string; input: QuizAnswers; expectedVariant: string }> = [
    {
      name: "classic flakes",
      input: answers({
        scalp_type: "fettig",
        has_scalp_issue: true,
        scalp_condition: "schuppen",
      }),
      expectedVariant: "scalp_flakes.schuppen",
    },
    {
      name: "dry flakes",
      input: answers({
        scalp_type: "trocken",
        has_scalp_issue: true,
        scalp_condition: "trockene_schuppen",
      }),
      expectedVariant: "scalp_flakes.trockene_schuppen",
    },
    {
      name: "irritated scalp",
      input: answers({
        scalp_type: "ausgeglichen",
        has_scalp_issue: true,
        scalp_condition: "gereizt",
      }),
      expectedVariant: "scalp_comfort.gereizte_kopfhaut",
    },
    {
      name: "oily scalp",
      input: answers({ scalp_type: "fettig" }),
      expectedVariant: "scalp_comfort.fettige_kopfhaut",
    },
    {
      name: "dry scalp",
      input: answers({ scalp_type: "trocken" }),
      expectedVariant: "scalp_comfort.trockene_kopfhaut",
    },
    {
      name: "balanced scalp",
      input: answers({ scalp_type: "ausgeglichen" }),
      expectedVariant: "scalp_comfort.ausgeglichene_kopfhaut",
    },
    {
      name: "breakage base",
      input: answers({ concerns: ["breakage"] }),
      expectedVariant: "strength_damage.haarbruch_schaden_basis",
    },
    {
      name: "chemical damage",
      input: answers({ concerns: ["hair_damage"], treatment: ["gefaerbt"] }),
      expectedVariant: "strength_damage.mit_chemischer_behandlung",
    },
    {
      name: "abnormal pull test",
      input: answers({ concerns: ["breakage"], pulltest: "snaps" }),
      expectedVariant: "strength_damage.auffalliger_zugtest",
    },
    {
      name: "dryness base",
      input: answers({ concerns: ["dryness"], fingertest: "leicht_uneben" }),
      expectedVariant: "moisture_dryness.trockenheit_basis",
    },
    {
      name: "rough treated dryness",
      input: answers({ concerns: ["dryness"], fingertest: "rau" }),
      expectedVariant: "moisture_dryness.trocken_rau_behandelt",
    },
    {
      name: "frizz",
      input: answers({ concerns: ["frizz"], structure: "wavy" }),
      expectedVariant: "surface_manageability.frizz",
    },
    {
      name: "tangling",
      input: answers({ concerns: ["tangling"], hair_length: "long" }),
      expectedVariant: "surface_manageability.verknotungen",
    },
    {
      name: "frizz and tangling",
      input: answers({ concerns: ["frizz", "tangling"], goals: ["less_frizz"] }),
      expectedVariant: "surface_manageability.frizz_knoten_glanz",
    },
    {
      name: "shine goal only",
      input: answers({ goals: ["shine"], fingertest: "glatt" }),
      expectedVariant: "surface_manageability.nur_glanz_ziel",
    },
    {
      name: "split ends",
      input: answers({ concerns: ["split_ends"], hair_length: "long" }),
      expectedVariant: "ends_protection.spliss_lange_spitzen",
    },
    {
      name: "textured definition",
      input: answers({ structure: "curly", goals: ["curl_definition"] }),
      expectedVariant: "definition.wellig_lockig_oder_coily",
    },
    {
      name: "straight definition",
      input: answers({ structure: "straight", goals: ["curl_definition"] }),
      expectedVariant: "definition.glattes_haar_definitions_ziel",
    },
    {
      name: "fine low-density volume",
      input: answers({ thickness: "fine", density: "low", goals: ["volume"] }),
      expectedVariant: "volume_weight.mehr_volumen_fein_niedrige_dichte",
    },
    {
      name: "general volume",
      input: answers({ goals: ["volume"] }),
      expectedVariant: "volume_weight.mehr_volumen_allgemein",
    },
    {
      name: "high textured less volume",
      input: answers({
        structure: "wavy",
        thickness: "coarse",
        density: "high",
        goals: ["less_volume"],
      }),
      expectedVariant: "volume_weight.weniger_volumen_viel_kraftig_texturiert",
    },
    {
      name: "general less volume",
      input: answers({ goals: ["less_volume"] }),
      expectedVariant: "volume_weight.weniger_volumen_allgemein",
    },
    {
      name: "treated color protection",
      input: answers({ treatment: ["blondiert"], goals: ["color_protection"] }),
      expectedVariant: "color_protection.gefarbt_blondiert",
    },
    {
      name: "natural color protection",
      input: answers({ treatment: ["natur"], goals: ["color_protection"] }),
      expectedVariant: "color_protection.naturhaar_farbschutz_ziel",
    },
    {
      name: "positive no-concern fallback",
      input: answers({}),
      expectedVariant: "special.keine_konkrete_sorge",
    },
  ]

  for (const item of cases) {
    assert.ok(
      variantIds(rankGuidedStoryPriorities(item.input)).includes(item.expectedVariant),
      item.name,
    )
  }
})

test("tier precedence keeps active breakage ahead of a lower-tier matched goal", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      concerns: ["breakage", "frizz"],
      goals: ["less_frizz"],
      structure: "wavy",
    }),
  )

  assert.equal(priorities[0]?.variantId, "strength_damage.haarbruch_schaden_basis")
  assert.equal(priorities[0]?.tier, 1)
  assert.equal(priorities[0]?.isCentral, true)
})

test("matching goals win within the same tier before fixed family order", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      concerns: ["dryness", "frizz"],
      goals: ["less_frizz"],
      structure: "wavy",
    }),
  )

  assert.equal(priorities[0]?.family, "surface_manageability")
  assert.deepEqual(priorities[0]?.matchedConcerns, ["frizz"])
  assert.deepEqual(priorities[0]?.matchedGoals, ["less_frizz"])
})

test("concern coverage wins before fixed tie order", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      scalp_type: "fettig",
      has_scalp_issue: true,
      scalp_condition: "schuppen",
      concerns: ["hair_damage", "breakage"],
    }),
  )

  assert.equal(priorities[0]?.family, "strength_damage")
  assert.deepEqual(priorities[0]?.matchedConcerns, ["hair_damage", "breakage"])
})

test("fixed family order is the last deterministic tie-break", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      concerns: ["split_ends", "dryness"],
      fingertest: "glatt",
      treatment: ["natur"],
    }),
  )

  assert.equal(priorities[0]?.family, "moisture_dryness")
  assert.equal(priorities[1]?.family, "ends_protection")
})

test("supporting priorities keep remaining stated concerns ahead of goal-only findings", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      concerns: ["breakage", "dryness"],
      goals: ["volume"],
      thickness: "fine",
      density: "low",
    }),
  )

  assert.deepEqual(
    priorities.map((priority) => priority.family),
    ["strength_damage", "moisture_dryness", "volume_weight"],
  )
})

test("balanced no-concern profile uses selected goals and an honest positive fallback", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      scalp_type: "ausgeglichen",
      concerns: [],
      goals: ["volume", "shine"],
      thickness: "fine",
      density: "low",
      fingertest: "glatt",
    }),
  )

  assert.deepEqual(variantIds(priorities), [
    "volume_weight.mehr_volumen_fein_niedrige_dichte",
    "surface_manageability.nur_glanz_ziel",
    "scalp_comfort.ausgeglichene_kopfhaut",
  ])
  assert.equal(priorities[2]?.tier, "positive")
})

test("shine never suppresses or rewrites a co-selected less-frizz goal", () => {
  for (const fingertest of ["rau", "glatt"] as const) {
    const priorities = rankGuidedStoryPriorities(
      answers({
        scalp_type: "ausgeglichen",
        concerns: [],
        goals: ["less_frizz", "shine"],
        fingertest,
      }),
    )

    const surface = priorities.find((priority) => priority.family === "surface_manageability")
    assert.equal(surface?.variantId, "surface_manageability.frizz")
    assert.deepEqual(surface?.matchedGoals, ["less_frizz", "shine"])
  }
})

test("sparse no-concern profiles do not repeat positive scalp foundations", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      scalp_type: "ausgeglichen",
      concerns: [],
      goals: ["volume"],
    }),
  )

  assert.equal(priorities.filter((priority) => priority.family === "scalp_comfort").length, 1)
  assert.equal(new Set(priorities.map((priority) => priority.family)).size, 3)
  assert.equal(variantIds(priorities).includes("special.keine_konkrete_sorge"), false)
})

test("healthy scalp goal can centralize a dry or oily scalp state without an active condition", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      scalp_type: "fettig",
      concerns: ["frizz"],
      goals: ["healthy_scalp"],
    }),
  )

  assert.equal(priorities[0]?.variantId, "scalp_comfort.fettige_kopfhaut")
  assert.deepEqual(priorities[0]?.matchedGoals, ["healthy_scalp"])
})

test("scalp condition is read from the separate condition fields, not stale free-form scalp values", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      scalp_type: "ausgeglichen",
      has_scalp_issue: false,
      scalp_condition: "schuppen",
      concerns: ["dryness"],
    }),
  )

  assert.equal(variantIds(priorities).includes("scalp_flakes.schuppen"), false)
  assert.equal(priorities[0]?.family, "moisture_dryness")
})

test("fully incomplete legacy answers return exactly three approved fallback priorities", () => {
  const priorities = rankGuidedStoryPriorities({})

  assert.deepEqual(variantIds(priorities), ["legacy.basis", "legacy.pflege", "legacy.routine"])
  assert.equal(priorities.length, 3)
  assert.equal(
    priorities.every((priority) => priority.isFallback),
    true,
  )
  assert.deepEqual(
    priorities.map(({ title, finding, why, helps }) => ({ title, finding, why, helps })),
    GUIDED_STORY_LEGACY_FALLBACK_PRIORITIES.map(({ title, finding, why, helps }) => ({
      title,
      finding,
      why,
      helps,
    })),
  )
})

test("free-text concerns are not classified into medical or cosmetic routes", () => {
  const priorities = rankGuidedStoryPriorities({
    concerns_other_text: "plötzlich kahle Stelle und starkes Brennen",
  })

  assert.deepEqual(variantIds(priorities), ["legacy.basis", "legacy.pflege", "legacy.routine"])
  assert.equal(priorities.length, 3)
})

test("healthier_hair modifies a supported specific family but never becomes its own family", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      goals: ["healthier_hair"],
      pulltest: "snaps",
      treatment: ["blondiert"],
    }),
  )

  assert.equal(priorities[0]?.family, "strength_damage")
  assert.equal(priorities[0]?.variantId, "strength_damage.auffalliger_zugtest")
  assert.deepEqual(priorities[0]?.matchedGoals, ["healthier_hair"])
})

test("a true four-family profile merges close neighbors so every concern stays visible", () => {
  const priorities = rankGuidedStoryPriorities(
    answers({
      scalp_type: "fettig",
      has_scalp_issue: true,
      scalp_condition: "schuppen",
      concerns: ["hair_damage", "split_ends", "dryness"],
      treatment: ["blondiert"],
      hair_length: "long",
      fingertest: "rau",
    }),
  )

  assert.equal(priorities.length, 3)
  assert.deepEqual(
    priorities.map((priority) => priority.family),
    ["strength_damage", "scalp_flakes", "moisture_dryness"],
  )
  assert.deepEqual(priorities[0]?.mergedVariantIds, [
    "strength_damage.mit_chemischer_behandlung",
    "ends_protection.spliss_lange_spitzen",
  ])

  const text = combinedText(priorities)
  assert.match(text, /geschädigte|bruchanfälliger/)
  assert.match(text, /Schuppen/)
  assert.match(text, /Spliss|Spitzen/)
  assert.match(text, /Trockenheit|trockenen/)
  assert.equal(
    priorities.flatMap((priority) => priority.matchedConcerns).includes("hair_damage"),
    true,
  )
  assert.equal(
    priorities.flatMap((priority) => priority.matchedConcerns).includes("split_ends"),
    true,
  )
  assert.equal(priorities.flatMap((priority) => priority.matchedConcerns).includes("dryness"), true)
})
