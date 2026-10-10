import assert from "node:assert/strict"
import test from "node:test"

import { deriveDesiredVolumeFromGoals } from "../src/lib/hair-profile/derived"
import {
  PROFILE_FIELD_CONFIG,
  PROFILE_SECTION_META,
  profileHabitsRows,
} from "../src/lib/profile/section-config"
import { buildProfileToolsBlock } from "../src/lib/personal-plan/tools/profile-block"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { diagnosticsV1Schema } from "../src/lib/user-facts/schema"
import type { HairProfile } from "../src/lib/types"

function makeProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "hp_test",
    user_id: "user_test",
    hair_texture: null,
    thickness: null,
    hair_length: null,
    density: null,
    concerns: [],
    products_used: null,
    shampoo_frequency: null,
    heat_styling: null,
    styling_tools: null,
    goals: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: null,
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: null,
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-06-15T00:00:00.000Z",
    updated_at: "2026-06-15T00:00:00.000Z",
    ...overrides,
  }
}

test("profile shows no towel technique as an answered editable value", () => {
  const towelTechniqueField = PROFILE_FIELD_CONFIG.find((field) => field.key === "towel_technique")

  assert.ok(towelTechniqueField)
  assert.deepEqual(towelTechniqueField.editTarget, {
    kind: "refine",
    module: "habits",
  })
  assert.equal(
    towelTechniqueField.getValue(
      makeProfile({
        towel_material: "no_towel",
        towel_technique: null,
      }),
    ),
    "Keine Trocknungstechnik",
  )
})

test("profile quiz section includes editable hair length after density", () => {
  const quizFields = PROFILE_FIELD_CONFIG.filter((field) => field.sectionKey === "quiz")
  const densityIndex = quizFields.findIndex((field) => field.key === "density")
  const hairLengthField = quizFields[densityIndex + 1]

  assert.notEqual(densityIndex, -1)
  assert.equal(hairLengthField?.key, "hair_length")
  assert.equal(hairLengthField.label, "Haarlänge")
  assert.deepEqual(hairLengthField.editTarget, { kind: "quiz" })
  assert.equal(hairLengthField.getValue(makeProfile({ hair_length: "long" })), "Lang")
})

test("profile routine section shows length tip accessory night protection label", () => {
  const nightProtectionField = PROFILE_FIELD_CONFIG.find(
    (field) => field.key === "night_protection",
  )

  assert.ok(nightProtectionField)
  assert.deepEqual(
    nightProtectionField.getValue(makeProfile({ night_protection: ["length_tip_accessory"] })),
    ["Längen-/Spitzenschutz (z. B. HairHOMIE)"],
  )
})

test("profile routine section distinguishes unanswered brush type from explicit none", () => {
  const brushTypeField = PROFILE_FIELD_CONFIG.find((field) => field.key === "brush_type")

  assert.ok(brushTypeField)
  assert.equal(brushTypeField.getValue(makeProfile({ brush_type: null })), null)
  assert.equal(brushTypeField.getValue(makeProfile({ brush_type: [] })), "Keine regelmäßige Bürste")
  assert.deepEqual(brushTypeField.getValue(makeProfile({ brush_type: ["paddle", "round"] })), [
    "Paddle-Bürste",
    "Rundbürste",
  ])
})

test("goals edit derives persisted desired volume from selected goals", () => {
  assert.equal(deriveDesiredVolumeFromGoals(["volume"], null), "more")
  assert.equal(deriveDesiredVolumeFromGoals(["less_volume"], null), "less")
  assert.equal(deriveDesiredVolumeFromGoals(["shine"], null), null)
  assert.equal(deriveDesiredVolumeFromGoals([], null), null)
})

// ---------------------------------------------------------------------------
// Clean-switch task 8: goals, problems and scalp complaints show the quiz's wording
// ---------------------------------------------------------------------------

function field(key: string) {
  const config = PROFILE_FIELD_CONFIG.find((entry) => entry.key === key)
  assert.ok(config, key)
  return config
}

const WAVY_DIAGNOSTICS = {
  texture: "wavy",
  goals: ["volume_balance", "moisture", "shape_definition"],
  currentConcerns: ["lost_shape", "dry_lengths"],
  currentConcernsOtherText: "stumpf nach dem Föhnen",
  scalpOiliness: "oily",
  scalpConcerns: ["irritated", "oily_dandruff"],
  source: { kind: "legacy_quiz", version: 1, leadId: "lead", raw: null },
}

test("goals show the quiz's wording for her hair texture, in the quiz's order", () => {
  const profile = makeProfile({
    hair_texture: "wavy",
    goals: ["volume", "moisture", "curl_definition"],
    desired_volume: "more",
    diagnostics: WAVY_DIAGNOSTICS,
  })
  assert.deepEqual(field("goals").getValue(profile), [
    "Feuchtigkeit ohne Beschweren",
    "Mehr Wellen-Definition",
    "Ausgewogenes Volumen",
  ])
})

test("goals of a row without facts convert through the one legacy rule", () => {
  const profile = makeProfile({
    hair_texture: "curly",
    goals: ["healthier_hair", "color_protection", "less_volume"],
    desired_volume: "less",
  })
  assert.deepEqual(field("goals").getValue(profile), [
    "Mehr Glanz",
    "Weniger Haarbruch und Spliss",
    "Ausgewogenes Volumen",
  ])
  assert.equal(field("goals").getValue(makeProfile()), null)
})

test("problems show the quiz's full wording plus her own note", () => {
  const profile = makeProfile({ hair_texture: "wavy", diagnostics: WAVY_DIAGNOSTICS })
  assert.deepEqual(field("concerns").getValue(profile), [
    "Trockene oder strohige Längen",
    "Meine Wellen verlieren schnell ihre Form",
    "Etwas anderes: stumpf nach dem Föhnen",
  ])
})

test("problems of a row without facts convert through table M", () => {
  const profile = makeProfile({
    hair_texture: "straight",
    concerns: ["dryness", "thinning", "dandruff"],
    scalp_type: "oily",
  })
  assert.deepEqual(field("concerns").getValue(profile), [
    "Trockene oder strohige Längen",
    "Haarausfall oder dünner werdendes Haar",
  ])
  // Fix round 2 (2): no problem is an open answer, never „Nichts davon".
  assert.equal(
    field("concerns").getValue(makeProfile({ hair_texture: "wavy", scalp_type: "oily" })),
    null,
  )
  assert.deepEqual(
    field("concerns").getValue(
      makeProfile({ diagnostics: { ...WAVY_DIAGNOSTICS, currentConcerns: [] } }),
    ),
    ["Etwas anderes: stumpf nach dem Föhnen"],
  )
  assert.equal(
    field("concerns").getValue(
      makeProfile({
        diagnostics: {
          ...WAVY_DIAGNOSTICS,
          currentConcerns: [],
          currentConcernsOtherText: undefined,
        },
      }),
    ),
    null,
  )
})

test("scalp complaints show every picked complaint with the quiz's wording", () => {
  const profile = makeProfile({ hair_texture: "wavy", diagnostics: WAVY_DIAGNOSTICS })
  assert.deepEqual(field("scalp_condition").getValue(profile), [
    "Fettige Schuppen",
    "Gereizte oder empfindliche Kopfhaut",
  ])
  const none = makeProfile({
    diagnostics: { ...WAVY_DIAGNOSTICS, scalpConcerns: [] },
    scalp_type: "oily",
  })
  assert.equal(field("scalp_condition").getValue(none), "Nichts davon")
  assert.equal(field("scalp_condition").getValue(makeProfile()), null)
})

test("a stored Welleneisen shows the combined tool label", () => {
  assert.deepEqual(
    field("styling_tools").getValue(makeProfile({ styling_tools: ["wave_iron", "flat_iron"] })),
    ["Lockenstab / Welleneisen", "Glätteisen"],
  )
})

// ---------------------------------------------------------------------------
// Fix round 2 (2): every Haar-Check field shows the quiz's wording (product owner, 2026-09-30)
// ---------------------------------------------------------------------------

const FULL_DIAGNOSTICS = {
  texture: "curly",
  thickness: "coarse",
  density: "low",
  hairLength: "very_long",
  hairSurface: "slightly_uneven",
  elasticResponse: "stretches_stays",
  chemicalTreatments: ["colored", "lightened"],
  scalpOiliness: "oily",
  scalpConcerns: [],
  currentConcerns: ["dry_lengths"],
  goals: ["moisture"],
  source: { kind: "legacy_quiz", version: 1, leadId: "lead", raw: null },
}

test("every Haar-Check field reads the stored answers in the quiz's wording", () => {
  const profile = makeProfile({
    // The derived columns carry the old vocabulary; the view must not read them.
    hair_texture: "curly",
    cuticle_condition: "slightly_rough",
    protein_moisture_balance: "stretches_stays",
    scalp_type: "oily",
    diagnostics: FULL_DIAGNOSTICS,
  })
  const values = Object.fromEntries(
    PROFILE_FIELD_CONFIG.filter((entry) => entry.sectionKey === "quiz").map((entry) => [
      entry.key,
      entry.getValue(profile),
    ]),
  )
  assert.deepEqual(values, {
    hair_texture: "Lockig",
    thickness: "Dick",
    density: "Wenig Haare",
    hair_length: "Sehr lang",
    cuticle_condition: "Leicht uneben",
    protein_moisture_balance: "Es bleibt gedehnt",
    chemical_treatment: ["Gefärbt oder getönt", "Blondiert oder aufgehellt"],
    scalp_type: "Fettig",
    scalp_condition: "Nichts davon",
    concerns: ["Trockene oder strohige Längen"],
    goals: ["Intensive Feuchtigkeit"],
  })
})

test("the interpretive labels are gone from the Haar-Check view", () => {
  const interpretive = [
    "Proteinmangel",
    "Feuchtigkeitsmangel",
    "Geschädigt",
    "Leicht aufgeraut",
    "Schnell fettend",
  ]
  for (const hairSurface of ["smooth", "slightly_uneven", "rough"]) {
    for (const elasticResponse of ["stretches_bounces", "stretches_stays", "snaps"]) {
      for (const scalpOiliness of ["oily", "balanced", "dry"]) {
        const diagnostics = diagnosticsV1Schema.parse({
          ...FULL_DIAGNOSTICS,
          hairSurface,
          elasticResponse,
          scalpOiliness,
        })
        // The row as the door stores it: the document plus its derived (old-vocabulary) columns.
        const profile = makeProfile({
          ...(deriveDiagnosticsColumns(diagnostics) as Partial<HairProfile>),
          diagnostics,
        })
        const shown = PROFILE_FIELD_CONFIG.filter((entry) => entry.sectionKey === "quiz")
          .flatMap((entry) => entry.getValue(profile) ?? [])
          .join(" | ")
        for (const label of interpretive) assert.ok(!shown.includes(label), `${label} in ${shown}`)
      }
    }
  }
})

test("a row without facts shows its converted columns in the quiz's wording", () => {
  const profile = makeProfile({
    hair_texture: "wavy",
    thickness: "fine",
    cuticle_condition: "rough",
    protein_moisture_balance: "snaps",
    scalp_type: "dry",
    chemical_treatment: ["bleached"],
  })
  assert.equal(field("hair_texture").getValue(profile), "Wellig")
  assert.equal(field("thickness").getValue(profile), "Fein")
  assert.equal(field("cuticle_condition").getValue(profile), "Rau")
  assert.equal(field("protein_moisture_balance").getValue(profile), "Es reißt schnell")
  assert.equal(field("scalp_type").getValue(profile), "Trocken")
  assert.deepEqual(field("chemical_treatment").getValue(profile), ["Blondiert oder aufgehellt"])
  assert.equal(field("density").getValue(profile), null, "unanswered stays open")
})

test("the problems field carries the quiz's question as its title", () => {
  assert.equal(field("concerns").label, "Was beschäftigt dich gerade?")
})

test("the Gewohnheiten rows are named for what they ask", () => {
  const label = (key: string) => PROFILE_FIELD_CONFIG.find((field) => field.key === key)?.label
  assert.equal(label("towel_technique"), "Abtrocknen")
  assert.equal(label("drying_method"), "Trocknen")
  assert.equal(label("heat_styling"), "Hitze-Häufigkeit")
  assert.equal(label("uses_heat_protection"), "Hitzeschutz")
})

test("the plan's drying routes read with the drying page's wording, never the old Diffusor label", () => {
  const dryingMethod = PROFILE_FIELD_CONFIG.find((field) => field.key === "drying_method")
  assert.ok(dryingMethod)
  assert.equal(
    dryingMethod.getValue(null, {
      dryingRoutes: ["air_dry", "ordinary_blow_dry", "diffuser_or_airflow_shaping"],
    }),
    "Lufttrocknen, Gewöhnlich föhnen, Mit Diffusor",
  )
  for (const field of PROFILE_FIELD_CONFIG) {
    const shown = JSON.stringify(
      field.getValue(null, { dryingRoutes: ["diffuser_or_airflow_shaping"] }),
    )
    assert.ok(!shown.includes("formender Luftstrom"), shown)
  }
})

// ---------------------------------------------------------------------------
// Hair Tools Profil (Task 11): Ziele inside Haar-Check, Gewohnheiten and Deine Tools sections
// ---------------------------------------------------------------------------

function sectionFields(sectionKey: string) {
  return PROFILE_FIELD_CONFIG.filter((entry) => entry.sectionKey === sectionKey)
}

test("the goals row lives in the Haar-Check section and keeps its own editor as a row-level link", () => {
  const quizKeys = sectionFields("quiz").map((entry) => entry.key)
  assert.equal(quizKeys.at(-1), "goals", "the Ziele row closes the Haar-Check grid")
  assert.equal(quizKeys.filter((key) => key === "goals").length, 1)
  assert.deepEqual(field("goals").editTarget, { kind: "profile-edit-goals" })
  assert.equal(field("goals").label, "Deine Haarziele")
  assert.equal(field("goals").sectionKey, "quiz")
})

test("there is no Ziele card any more, in either flag state", () => {
  assert.ok(!PROFILE_SECTION_META.some((meta) => (meta.key as string) === "goals"))
  assert.ok(!PROFILE_FIELD_CONFIG.some((entry) => (entry.sectionKey as string) === "goals"))
})

test("Gewohnheiten is its own section with the exact copy and the four rows in order", () => {
  const meta = PROFILE_SECTION_META.find((entry) => entry.key === "habits")
  assert.ok(meta)
  assert.equal(meta.title, "Gewohnheiten")
  assert.equal(meta.description, "Wie du trocknest und stylst, aus deinem Feinschliff.")
  const fields = sectionFields("habits")
  assert.deepEqual(
    fields.map((entry) => [entry.key, entry.label]),
    [
      ["towel_technique", "Abtrocknen"],
      ["drying_method", "Trocknen"],
      ["heat_styling", "Hitze-Häufigkeit"],
      ["uses_heat_protection", "Hitzeschutz"],
    ],
  )
  for (const entry of fields) {
    assert.deepEqual(entry.editTarget, { kind: "refine", module: "habits" }, entry.key)
  }
})

test("the Gewohnheiten rows read exactly what the Styling and Alltag rows of the same name read", () => {
  const profile = makeProfile({
    towel_material: "mikrofaser",
    towel_technique: "gentle_press",
    drying_method: "blow_dry",
    heat_styling: "once_weekly",
    uses_heat_protection: true,
  })
  for (const habit of sectionFields("habits")) {
    const original = PROFILE_FIELD_CONFIG.find(
      (entry) => entry.key === habit.key && entry.sectionKey !== "habits",
    )
    assert.ok(original, habit.key)
    assert.deepEqual(habit.getValue(profile), original.getValue(profile), habit.key)
  }
})

test("Deine Tools is its own section with the exact copy and one owned_tools row", () => {
  const meta = PROFILE_SECTION_META.find((entry) => entry.key === "tools")
  assert.ok(meta)
  assert.equal(meta.title, "Deine Tools")
  assert.equal(meta.description, "Was du schon hast, aus deinem Feinschliff.")
  const fields = sectionFields("tools")
  assert.deepEqual(
    fields.map((entry) => entry.key),
    ["owned_tools"],
  )
  assert.deepEqual(fields[0].editTarget, { kind: "refine", module: "tools" })
})

test("owned_tools lists the reported tool labels, and stays open without a confirmed answer", () => {
  const owned = field("owned_tools")
  const block = buildProfileToolsBlock({
    drying_textiles: ["microfiber_towel"],
    brushes_combs: ["wide_tooth_comb", "round_brush"],
  })
  assert.deepEqual(owned.getValue(null, null, block), [
    "Mikrofaser-Handtuch",
    "Grobzinkiger Kamm",
    "Rundbürste",
  ])
  assert.equal(owned.getValue(null, null, null), null)
  assert.equal(owned.getValue(null, null), null)
  assert.equal(owned.getValue(null, null, buildProfileToolsBlock({ airflow: [] })), "Nichts davon")
})

test("Gewohnheiten collapses Hitze-Häufigkeit and Hitzeschutz into one „Keine Hitze“ row without a heat source", () => {
  const heatFree = profileHabitsRows(
    makeProfile({
      heat_styling: "never",
      towel_material: "mikrofaser",
      towel_technique: "gentle_press",
    }),
    null,
  )
  assert.deepEqual(
    heatFree.map((row) => [row.key, row.label, row.value]),
    [
      ["towel_technique", "Abtrocknen", "Sanft ausdrücken / scrunchen"],
      ["drying_method", "Trocknen", null],
      ["no_heat", "Hitze", "Keine Hitze"],
    ],
  )
  assert.deepEqual(heatFree[2].editTarget, { kind: "refine", module: "habits" })

  // The plan's own answers decide the same way when the legacy column is not written yet.
  const fromPlan = profileHabitsRows(null, { dryingRoutes: ["air_dry"], additionalHeatTools: [] })
  assert.deepEqual(
    fromPlan.map((row) => row.key),
    ["towel_technique", "drying_method", "no_heat"],
  )
})

test("Gewohnheiten keeps all four rows when any heat source is used or not yet known", () => {
  const keys = (rows: ReturnType<typeof profileHabitsRows>) => rows.map((row) => row.key)
  const four = ["towel_technique", "drying_method", "heat_styling", "uses_heat_protection"]
  assert.deepEqual(
    keys(profileHabitsRows(makeProfile({ heat_styling: "once_weekly" }), null)),
    four,
  )
  assert.deepEqual(
    keys(profileHabitsRows(null, { dryingRoutes: ["ordinary_blow_dry"], additionalHeatTools: [] })),
    four,
  )
  assert.deepEqual(
    keys(
      profileHabitsRows(null, { dryingRoutes: ["air_dry"], additionalHeatTools: ["straightener"] }),
    ),
    four,
  )
  assert.deepEqual(
    keys(
      profileHabitsRows(null, {
        dryingRoutes: ["diffuser_or_airflow_shaping"],
        additionalHeatTools: [],
      }),
    ),
    four,
  )
  // Unknown is not „no heat": nothing answered yet keeps the open rows.
  assert.deepEqual(keys(profileHabitsRows(null, null)), four)
  assert.deepEqual(keys(profileHabitsRows(makeProfile(), null)), four)
  assert.deepEqual(keys(profileHabitsRows(null, { dryingRoutes: ["air_dry"] })), four)
})
