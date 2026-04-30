import assert from "node:assert/strict"
import test from "node:test"

import type { HairProfile, UserMemoryEntry } from "../src/lib/types"
import {
  buildUserContextProjection,
  assertHairProfileQuerySucceeded,
} from "../src/lib/agent/tools/get-user-context"

function makeProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "hp_test",
    user_id: "user_test",
    hair_texture: "wavy",
    thickness: "normal",
    density: null,
    concerns: [],
    products_used: null,
    wash_frequency: "every_2_3_days",
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
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    ...overrides,
  }
}

function makeMemoryEntry(overrides: Partial<UserMemoryEntry> = {}): UserMemoryEntry {
  return {
    id: "memory-1",
    user_id: "user_test",
    kind: "preference",
    content: "Bevorzugt eine einfache, simple Routine.",
    normalized_key: "preference:simple_routine",
    source: "chat",
    source_conversation_id: null,
    evidence: null,
    confidence: 0.9,
    metadata: {},
    status: "active",
    superseded_by: null,
    archived_at: null,
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    ...overrides,
  }
}

test("buildUserContextProjection suggests overlays from profile and memory", () => {
  const projection = buildUserContextProjection({
    hairProfile: makeProfile({
      thickness: "fine",
      concerns: ["oily_scalp", "dryness"],
    }),
    routineItems: [],
    memoryEntries: [
      makeMemoryEntry({
        content: "Bevorzugt eine einfache, simple Routine.",
      }),
    ],
  })

  assert.deepEqual(projection.suggested_overlays, [
    "overlay:fine_hair",
    "overlay:oily_scalp",
    "overlay:dry_lengths",
    "overlay:minimal_routine",
  ])
})

test("buildUserContextProjection routes dry flakes away from dandruff overlay", () => {
  const projection = buildUserContextProjection({
    hairProfile: makeProfile({
      scalp_condition: "dry_flakes",
    }),
    routineItems: [],
    memoryEntries: [],
  })

  assert.ok(projection.suggested_overlays.includes("overlay:sensitive_scalp"))
  assert.ok(!projection.suggested_overlays.includes("overlay:dandruff_scalp"))
})

test("buildUserContextProjection exposes visible profile signals for response framing", () => {
  const projection = buildUserContextProjection({
    hairProfile: makeProfile({
      hair_texture: "wavy",
      thickness: "fine",
      protein_moisture_balance: "stretches_stays",
      concerns: ["oily_scalp", "dryness", "frizz"],
      scalp_type: "oily",
      wash_frequency: "every_2_3_days",
      current_routine_products: ["shampoo", "conditioner"],
    }),
    routineItems: [],
    memoryEntries: [],
  })

  assert.ok(projection.derived_signals.includes("Schnell fettender Ansatz"))
  assert.ok(projection.derived_signals.includes("Trockene Laengen"))
  assert.ok(projection.derived_signals.includes("Frizzige Laengen"))
  assert.ok(projection.derived_signals.includes("Protein-/Feuchtigkeitsbalance: Proteinmangel"))
  assert.ok(projection.derived_signals.includes("Aktuelle Routine: Shampoo, Conditioner"))
})

test("buildUserContextProjection surfaces missing profile fields", () => {
  const projection = buildUserContextProjection({
    hairProfile: makeProfile({
      hair_texture: null,
      wash_frequency: null,
    }),
    routineItems: [],
    memoryEntries: [],
  })

  assert.deepEqual(
    projection.missing_profile.map((entry) => entry.key),
    ["hair_texture", "wash_frequency"],
  )
})

test("buildUserContextProjection only derives memory overlays from the visible memory slice", () => {
  const projection = buildUserContextProjection({
    hairProfile: makeProfile(),
    routineItems: [],
    memoryEntries: [
      makeMemoryEntry({ id: "memory-1", content: "Allgemeine Notiz 1." }),
      makeMemoryEntry({ id: "memory-2", content: "Allgemeine Notiz 2." }),
      makeMemoryEntry({ id: "memory-3", content: "Allgemeine Notiz 3." }),
      makeMemoryEntry({ id: "memory-4", content: "Allgemeine Notiz 4." }),
      makeMemoryEntry({ id: "memory-5", content: "Allgemeine Notiz 5." }),
      makeMemoryEntry({ id: "memory-6", content: "Allgemeine Notiz 6." }),
      makeMemoryEntry({
        id: "memory-7",
        content: "Bevorzugt eine einfache Routine mit wenig Aufwand.",
      }),
    ],
  })

  assert.equal(projection.relevant_memory.length, 6)
  assert.ok(!projection.suggested_overlays.includes("overlay:minimal_routine"))
})

test("buildUserContextProjection does not infer minimal routine from negated preference text", () => {
  const projection = buildUserContextProjection({
    hairProfile: makeProfile(),
    routineItems: [],
    memoryEntries: [
      makeMemoryEntry({
        content: "Ich will keine einfache Routine, sondern mehr Optionen.",
      }),
    ],
  })

  assert.ok(!projection.suggested_overlays.includes("overlay:minimal_routine"))
})

test("assertHairProfileQuerySucceeded throws when the profile query fails", () => {
  assert.throws(
    () =>
      assertHairProfileQuerySucceeded({
        data: null,
        error: { message: "database unavailable" },
      }),
    /hair_profiles lookup failed: database unavailable/,
  )
})
