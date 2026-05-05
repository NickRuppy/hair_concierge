import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAgentRuntimePacket,
  buildAgentRoutePacket,
  getRequiredPlaybookForUserJob,
  type AgentRouteClassification,
} from "../src/lib/agent/orchestrator/route-packet"
import type { UserContextProjection } from "../src/lib/agent/tools/get-user-context"
import type { HairProfile } from "../src/lib/types"

function createContext(overrides: Partial<UserContextProjection> = {}): UserContextProjection {
  return {
    profile: {
      hair_texture: "curly",
      concerns: ["dryness"],
      wash_frequency: "every_2_3_days",
    } as HairProfile,
    routine_inventory: [],
    relevant_memory: [],
    derived_signals: [],
    suggested_overlays: ["overlay:dry_lengths"],
    missing_profile: [],
    ...overrides,
  }
}

function createClassification(
  overrides: Partial<AgentRouteClassification> = {},
): AgentRouteClassification {
  return {
    user_job: "product_pick",
    product_category: "shampoo",
    requested_overlay_ids: [],
    requested_topic_ids: [],
    requested_routine_id: null,
    concerns: [],
    active_profile_signals: [],
    confidence: 0.94,
    evidence: ["User asks for a shampoo pick."],
    ambiguity: null,
    ...overrides,
  }
}

test("getRequiredPlaybookForUserJob maps supported jobs to one mandatory playbook", () => {
  assert.equal(getRequiredPlaybookForUserJob("product_pick"), "playbook:recommend_products")
  assert.equal(getRequiredPlaybookForUserJob("compare_or_decide"), "playbook:compare_or_decide")
  assert.equal(getRequiredPlaybookForUserJob("routine_structure"), "playbook:build_or_fix_routine")
  assert.equal(getRequiredPlaybookForUserJob("troubleshoot"), "playbook:troubleshoot_hair_issue")
  assert.equal(getRequiredPlaybookForUserJob("usage"), "playbook:usage_and_application")
  assert.equal(getRequiredPlaybookForUserJob("unsupported_or_unclear"), null)
})

test("buildAgentRoutePacket validates guidance ids and builds product tool plan", () => {
  const packet = buildAgentRoutePacket({
    message: "Welches Shampoo passt zu mir?",
    userContext: createContext(),
    classification: createClassification({
      requested_overlay_ids: ["overlay:fine_hair", "overlay:not_real" as never],
      requested_topic_ids: ["topic:bond_builder", "topic:not_real" as never],
    }),
  })

  assert.equal(packet.required_playbook_id, "playbook:recommend_products")
  assert.deepEqual(packet.guidance_ids, [
    "playbook:recommend_products",
    "overlay:dry_lengths",
    "overlay:fine_hair",
    "topic:bond_builder",
  ])
  assert.deepEqual(packet.tool_plan, ["select_products"])
  assert.equal(packet.product_category, "shampoo")
  assert.match(
    packet.validation_warnings.join("\n"),
    /Unknown requested overlay id: overlay:not_real/,
  )
  assert.match(packet.validation_warnings.join("\n"), /Unknown requested topic id: topic:not_real/)
})

test("buildAgentRoutePacket salvages topic ids from the wrong guidance bucket", () => {
  const packet = buildAgentRoutePacket({
    message: "Wie baue ich CWC in meine Waesche ein?",
    userContext: createContext({ suggested_overlays: [] }),
    classification: createClassification({
      user_job: "usage",
      product_category: null,
      requested_overlay_ids: ["topic:cwc_owc" as never, "playbook:compare_or_decide" as never],
      requested_topic_ids: [],
    }),
  })

  assert.deepEqual(packet.requested_overlay_ids, [])
  assert.deepEqual(packet.requested_topic_ids, ["topic:cwc_owc"])
  assert.deepEqual(packet.guidance_ids, ["playbook:usage_and_application", "topic:cwc_owc"])
  assert.deepEqual(packet.validation_warnings, [])
})

test("buildAgentRoutePacket adds routine guidance only for routine jobs", () => {
  const routinePacket = buildAgentRoutePacket({
    message: "Baue mir eine Lockenroutine mit mehr Definition.",
    userContext: createContext(),
    classification: createClassification({
      user_job: "routine_structure",
      product_category: null,
      requested_routine_id: null,
    }),
  })

  const usagePacket = buildAgentRoutePacket({
    message: "Wie wende ich Shampoo an?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "usage",
      product_category: "shampoo",
      requested_routine_id: "routine:curl_definition",
    }),
  })

  assert.equal(routinePacket.required_playbook_id, "playbook:build_or_fix_routine")
  assert.equal(routinePacket.requested_routine_id, "routine:curl_definition")
  assert.deepEqual(routinePacket.tool_plan, ["build_or_fix_routine"])
  assert.equal(usagePacket.required_playbook_id, "playbook:usage_and_application")
  assert.equal(usagePacket.requested_routine_id, null)
  assert.deepEqual(usagePacket.tool_plan, [])
})

test("buildAgentRoutePacket keeps usage explanatory and routes explicit troubleshooting products", () => {
  const usagePacket = buildAgentRoutePacket({
    message: "Wie soll ich mein Shampoo anwenden?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "usage",
      product_category: "shampoo",
      concerns: ["dry_lengths"],
    }),
  })

  const troubleshootPacket = buildAgentRoutePacket({
    message: "Mein Ansatz fettet schnell, welches Shampoo soll ich nehmen?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "troubleshoot",
      product_category: "shampoo",
      concerns: ["oily_roots"],
    }),
  })

  assert.deepEqual(usagePacket.tool_plan, [])
  assert.deepEqual(troubleshootPacket.tool_plan, ["select_products"])
  assert.deepEqual(troubleshootPacket.concerns, ["oily_roots"])
})

test("buildAgentRoutePacket infers shampoo for direct selection and comparison wording", () => {
  const comparePacket = buildAgentRoutePacket({
    message: "Vergleich mir bitte die passenden Shampoos.",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: null,
    }),
  })
  const alternatePacket = buildAgentRoutePacket({
    message: "Mein Shampoo macht meine Laengen trocken, welches andere Shampoo passt?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: null,
      concerns: ["dry_lengths"],
    }),
  })

  assert.equal(comparePacket.product_category, "shampoo")
  assert.deepEqual(comparePacket.tool_plan, ["select_products"])
  assert.deepEqual(comparePacket.validation_warnings, [])
  assert.equal(alternatePacket.product_category, "shampoo")
  assert.deepEqual(alternatePacket.tool_plan, ["select_products"])
  assert.deepEqual(alternatePacket.validation_warnings, [])
})

test("buildAgentRoutePacket infers dry shampoo for explicit bridge product asks", () => {
  const prompts = [
    "Ich kann heute nicht waschen, mein Ansatz ist fettig. Welches Trockenshampoo?",
    "Ich brauche Volumen am Ansatz fuer Tag 2.",
    "Ich will kein Aerosol-Spray, aber brauche heute eine kurze Auffrischung am Ansatz.",
    "Ich habe dunkle Haare und bekomme von Trockenshampoo immer weissen Schleier.",
  ]

  for (const message of prompts) {
    const packet = buildAgentRoutePacket({
      message,
      userContext: createContext(),
      classification: createClassification({
        user_job: "product_pick",
        product_category: null,
      }),
    })

    assert.equal(packet.product_category, "dry_shampoo", message)
    assert.deepEqual(packet.tool_plan, ["select_products"], message)
    assert.deepEqual(packet.validation_warnings, [], message)
  }
})

test("buildAgentRoutePacket does not infer dry shampoo from oily scalp alone", () => {
  const packet = buildAgentRoutePacket({
    message: "Ich habe fettige Kopfhaut, was soll ich tun?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "troubleshoot",
      product_category: null,
      concerns: ["oily_roots"],
    }),
  })

  assert.equal(packet.product_category, null)
  assert.deepEqual(packet.tool_plan, [])
  assert.deepEqual(packet.validation_warnings, [])
})

test("buildAgentRoutePacket keeps dry-shampoo troubleshooting mentions guidance-only", () => {
  const inferredPacket = buildAgentRoutePacket({
    message: "Trockenshampoo hat nicht geholfen, mein Ansatz sieht trotzdem fettig aus.",
    userContext: createContext(),
    classification: createClassification({
      user_job: "troubleshoot",
      product_category: null,
      concerns: ["oily_roots"],
    }),
  })
  const classifiedPacket = buildAgentRoutePacket({
    message: "Trockenshampoo hat nicht geholfen, mein Ansatz sieht trotzdem fettig aus.",
    userContext: createContext(),
    classification: createClassification({
      user_job: "troubleshoot",
      product_category: "dry_shampoo",
      concerns: ["oily_roots"],
    }),
  })

  assert.equal(inferredPacket.product_category, "dry_shampoo")
  assert.deepEqual(inferredPacket.tool_plan, [])
  assert.equal(classifiedPacket.product_category, "dry_shampoo")
  assert.deepEqual(classifiedPacket.tool_plan, [])
})

test("buildAgentRoutePacket infers leave-in for replacement comparisons", () => {
  const packet = buildAgentRoutePacket({
    message:
      "Kann ein Leave-in bei mir die Spülung ersetzen oder sollte ich es eher als Extra-Pflege verwenden?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: null,
    }),
  })

  assert.equal(packet.product_category, "leave_in")
  assert.deepEqual(packet.tool_plan, ["select_products"])
  assert.deepEqual(packet.validation_warnings, [])
})

test("buildAgentRoutePacket keeps pure leave-in need decisions conceptual", () => {
  const packet = buildAgentRoutePacket({
    message: "Brauche ich ein Leave-in oder reicht Conditioner?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: null,
    }),
  })

  assert.equal(packet.product_category, null)
  assert.deepEqual(packet.tool_plan, [])
  assert.deepEqual(packet.validation_warnings, [])
})

test("buildAgentRoutePacket keeps classifier-tagged leave-in need decisions conceptual", () => {
  const packet = buildAgentRoutePacket({
    message: "Ich habe trockene Spitzen, aber normalen Ansatz. Brauche ich Leave-in?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "leave_in",
    }),
  })

  assert.equal(packet.product_category, "leave_in")
  assert.deepEqual(packet.tool_plan, [])
  assert.deepEqual(packet.validation_warnings, [])
})

test("buildAgentRoutePacket keeps explanatory mask repair questions off product tools", () => {
  const packet = buildAgentRoutePacket({
    message: "Kann eine Maske Spliss reparieren oder nur kaschieren?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "mask",
    }),
  })

  assert.equal(packet.product_category, "mask")
  assert.deepEqual(packet.tool_plan, [])
  assert.deepEqual(packet.validation_warnings, [])
})

test("buildAgentRoutePacket infers leave-in for explicit leave-in comparisons", () => {
  const packet = buildAgentRoutePacket({
    message: "Vergleich mir bitte ein Spray-Leave-in und eine Creme für meine Haare.",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: null,
    }),
  })

  assert.equal(packet.product_category, "leave_in")
  assert.deepEqual(packet.tool_plan, ["select_products"])
  assert.deepEqual(packet.validation_warnings, [])
})

test("buildAgentRoutePacket derives heat tool signals for leave-in heat requests", () => {
  const packet = buildAgentRoutePacket({
    message: "Welches Leave-in mit Hitzeschutz passt, wenn ich föhne oder glätte?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "leave_in",
    }),
  })

  assert.ok(
    packet.active_profile_signals.some(
      (signal) => signal.field === "styling_tools" && signal.value === "flat_iron",
    ),
  )
  assert.ok(
    packet.active_profile_signals.some(
      (signal) => signal.field === "styling_tools" && signal.value === "blow_dryer",
    ),
  )
})

test("buildAgentRoutePacket extracts fine hair from predicate phrasing", () => {
  const packet = buildAgentRoutePacket({
    message: "Meine Haare sind fein und trocken. Gibt es eine leichte Maske?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "mask",
    }),
  })

  assert.ok(
    packet.active_profile_signals.some(
      (signal) => signal.field === "thickness" && signal.value === "fine",
    ),
  )
})

test("buildAgentRoutePacket keeps conceptual shampoo decisions category-free without noisy warnings", () => {
  const switchPacket = buildAgentRoutePacket({
    message: "Ich habe trockene Spitzen, sollte ich mein Shampoo wechseln?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: null,
      concerns: ["dry_lengths"],
    }),
  })
  const usagePacket = buildAgentRoutePacket({
    message: "Wie soll ich mein Shampoo anwenden?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "usage",
      product_category: null,
    }),
  })

  assert.equal(switchPacket.product_category, null)
  assert.deepEqual(switchPacket.tool_plan, [])
  assert.deepEqual(switchPacket.validation_warnings, [])
  assert.equal(usagePacket.product_category, null)
  assert.deepEqual(usagePacket.tool_plan, [])
  assert.deepEqual(usagePacket.validation_warnings, [])
})

test("buildAgentRoutePacket keeps problem-description change requests in troubleshoot", () => {
  const packet = buildAgentRoutePacket({
    message: "Mein Shampoo macht meine Haare platt, was soll ich ändern?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: null,
      evidence: ["User asks what to change."],
    }),
  })

  assert.equal(packet.user_job, "troubleshoot")
  assert.equal(packet.required_playbook_id, "playbook:troubleshoot_hair_issue")
  assert.deepEqual(packet.tool_plan, [])
})

test("buildAgentRoutePacket keeps concerns scoped to the active user message", () => {
  const directPickPacket = buildAgentRoutePacket({
    message: "Welches Shampoo passt am besten zu mir?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "shampoo",
      concerns: ["frizz", "dry_lengths"],
      evidence: ["User asks for a shampoo pick.", "Profile contains frizz and dry lengths."],
    }),
  })
  const directComparePacket = buildAgentRoutePacket({
    message: "Vergleich mir bitte die passenden Shampoos.",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "shampoo",
      concerns: ["frizz"],
      evidence: ["User asks to compare shampoos.", "Profile contains frizz."],
    }),
  })
  const activeDryLengthPacket = buildAgentRoutePacket({
    message: "Meine Laengen sind trocken, brauche ich ein anderes Shampoo?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "shampoo",
      concerns: ["dry_lengths", "frizz"],
    }),
  })

  assert.deepEqual(directPickPacket.concerns, [])
  assert.deepEqual(directPickPacket.tool_plan, ["select_products"])
  assert.deepEqual(directComparePacket.concerns, [])
  assert.deepEqual(directComparePacket.tool_plan, ["select_products"])
  assert.deepEqual(activeDryLengthPacket.concerns, ["dry_lengths"])
})

test("buildAgentRoutePacket preserves active profile signals from real German shampoo prompts", () => {
  const dryLengthPacket = buildAgentRoutePacket({
    message: "Meine Längen sind trocken, brauche ich ein anderes Shampoo?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "shampoo",
      concerns: ["dry_lengths"],
    }),
  })
  const oilyRootPacket = buildAgentRoutePacket({
    message: "Ich habe schnell fettigen Ansatz, aber trockene Spitzen. Welches Shampoo passt da?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "shampoo",
      concerns: ["oily_roots", "dry_lengths"],
    }),
  })
  const fineHairPacket = buildAgentRoutePacket({
    message: "Welches Shampoo passt zu meinem feinen Haar, wenn der Ansatz schnell fettig wird?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "shampoo",
      concerns: ["oily_roots"],
    }),
  })

  assert.deepEqual(dryLengthPacket.concerns, ["dry_lengths"])
  assert.deepEqual(
    dryLengthPacket.active_profile_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.selection_effect,
    ]),
    [["concerns", "dryness", "redirect"]],
  )
  assert.deepEqual(oilyRootPacket.concerns, ["oily_roots", "dry_lengths"])
  assert.deepEqual(
    oilyRootPacket.active_profile_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.selection_effect,
    ]),
    [
      ["scalp_type", "oily", "override"],
      ["concerns", "dryness", "redirect"],
    ],
  )
  assert.deepEqual(
    fineHairPacket.active_profile_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.selection_effect,
    ]),
    [
      ["thickness", "fine", "override"],
      ["scalp_type", "oily", "override"],
    ],
  )
})

test("buildAgentRoutePacket preserves grounded classifier-only active profile signals", () => {
  const packet = buildAgentRoutePacket({
    message: "Welches Shampoo passt bei wenig Haar?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "shampoo",
      active_profile_signals: [
        {
          field: "density",
          value: "low",
          source: "message",
          selection_effect: "qualifier",
          evidence: "wenig Haar",
        },
      ],
    }),
  })

  assert.ok(
    packet.active_profile_signals.some(
      (signal) =>
        signal.field === "density" &&
        signal.value === "low" &&
        signal.selection_effect === "qualifier",
    ),
  )
  assert.deepEqual(packet.concerns, [])
})

test("buildAgentRoutePacket drops ungrounded classifier active profile concerns", () => {
  const packet = buildAgentRoutePacket({
    message: "Welches Shampoo passt zu mir?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "shampoo",
      active_profile_signals: [
        {
          field: "concerns",
          value: "frizz",
          source: "message",
          selection_effect: "redirect",
          evidence: "Frizz",
        },
      ],
    }),
  })

  assert.deepEqual(packet.active_profile_signals, [])
  assert.deepEqual(packet.concerns, [])
})

test("buildAgentRoutePacket detects fine-hair phrasing in mask requests", () => {
  const packet = buildAgentRoutePacket({
    message: "Meine Haare sind fein und trocken. Gibt es eine leichte Maske?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "mask",
      concerns: ["dry_lengths"],
    }),
  })

  assert.ok(
    packet.active_profile_signals.some(
      (signal) =>
        signal.field === "thickness" &&
        signal.value === "fine" &&
        signal.selection_effect === "override",
    ),
  )
})

test("buildAgentRoutePacket keeps conceptual mask split-end questions answer-only", () => {
  const packet = buildAgentRoutePacket({
    message: "Kann eine Maske Spliss reparieren oder nur kaschieren?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "mask",
      concerns: [],
    }),
  })

  assert.equal(packet.product_category, "mask")
  assert.deepEqual(packet.tool_plan, [])
})

test("buildAgentRoutePacket infers mask for protein-or-moisture type decisions without selecting products", () => {
  const messages = [
    "Brauche ich eine Feuchtigkeitsmaske oder eine Proteinmaske?",
    "Brauche ich Protein oder Feuchtigkeit als Maske?",
    "Brauche ich eine Protein- oder Feuchtigkeitsmaske?",
    "Soll ich eher Protein oder Feuchtigkeit nehmen bei Masken?",
  ]

  for (const message of messages) {
    const packet = buildAgentRoutePacket({
      message,
      userContext: createContext(),
      classification: createClassification({
        user_job: "compare_or_decide",
        product_category: null,
      }),
    })

    assert.equal(packet.product_category, "mask", message)
    assert.deepEqual(packet.tool_plan, [], message)
  }
})

test("buildAgentRoutePacket keeps mask versus other category decisions conceptual", () => {
  const messages = [
    "Brauche ich eher eine Maske oder eine Spülung?",
    "Soll ich eine Maske oder ein Öl nehmen?",
  ]

  for (const message of messages) {
    const packet = buildAgentRoutePacket({
      message,
      userContext: createContext(),
      classification: createClassification({
        user_job: "compare_or_decide",
        product_category: null,
      }),
    })

    assert.equal(packet.product_category, null, message)
    assert.deepEqual(packet.tool_plan, [], message)
  }
})

test("buildAgentRoutePacket detects Blondierung as chemical-treatment qualifier", () => {
  const packet = buildAgentRoutePacket({
    message: "Welche Maske passt nach einer Blondierung?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "mask",
    }),
  })

  assert.ok(
    packet.active_profile_signals.some(
      (signal) =>
        signal.field === "chemical_treatment" &&
        signal.value === "bleached" &&
        signal.selection_effect === "qualifier",
    ),
  )
})

test("buildAgentRoutePacket detects fine hair inside adjective chains", () => {
  const packet = buildAgentRoutePacket({
    message: "Welche Maske passt zu meinen feinen, trockenen, blondierten Haaren?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "mask",
    }),
  })

  assert.ok(
    packet.active_profile_signals.some(
      (signal) =>
        signal.field === "thickness" &&
        signal.value === "fine" &&
        signal.selection_effect === "override",
    ),
  )
  assert.ok(
    packet.active_profile_signals.some(
      (signal) =>
        signal.field === "chemical_treatment" &&
        signal.value === "bleached" &&
        signal.selection_effect === "qualifier",
    ),
  )
})

test("buildAgentRuntimePacket makes profile-deviation notices mandatory render context", () => {
  const route = buildAgentRoutePacket({
    message: "Meine Haare sind fein und trocken. Gibt es eine leichte Maske?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "mask",
    }),
  })

  const packet = buildAgentRuntimePacket({
    route,
    userContext: createContext(),
    guidance: { items: [] },
    selectedProducts: {
      category: "mask",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Die Auswahl folgt den aktuell verfuegbaren Profil- und Produktdaten.",
      profile_basis: [
        "Profil-Hinweis: aktuelle Angabe Haardicke Fein statt gespeichert Mittel",
        "Haardicke: Fein",
      ],
      category_guidance: "Maske ist hier Zusatzpflege fuer Laengen und Spitzen.",
      products: [],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
  })

  assert.ok(
    packet.final_instructions.some((instruction) =>
      instruction.includes("Profil-Hinweis aus selected_products.profile_basis"),
    ),
  )
})

test("buildAgentRoutePacket extracts active signals from common German phrasing variants", () => {
  const sensitivePacket = buildAgentRoutePacket({
    message: "Meine Kopfhaut ist empfindlich, welches Shampoo passt?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "shampoo",
      active_profile_signals: [
        {
          field: "scalp_condition",
          value: "irritated",
          source: "message",
          selection_effect: "qualifier",
          evidence: "Kopfhaut ist empfindlich",
        },
      ],
    }),
  })
  const coloredPacket = buildAgentRoutePacket({
    message: "Welche Shampoos passen, wenn meine Haare gefärbt sind?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "shampoo",
      active_profile_signals: [
        {
          field: "chemical_treatment",
          value: "colored",
          source: "message",
          selection_effect: "qualifier",
          evidence: "Haare gefärbt",
        },
      ],
    }),
  })
  const coloredDativePacket = buildAgentRoutePacket({
    message: "Welche Spuelung passt zu gefaerbten Haaren?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "conditioner",
      active_profile_signals: [
        {
          field: "chemical_treatment",
          value: "colored",
          source: "message",
          selection_effect: "qualifier",
          evidence: "gefaerbten Haaren",
        },
      ],
    }),
  })
  const coloredAdjectivePacket = buildAgentRoutePacket({
    message: "Welche Spuelung passt zu coloriertem, strapaziertem Haar?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: "conditioner",
      active_profile_signals: [],
    }),
  })

  assert.deepEqual(
    sensitivePacket.active_profile_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.selection_effect,
    ]),
    [["scalp_condition", "irritated", "override"]],
  )
  assert.deepEqual(
    coloredPacket.active_profile_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.selection_effect,
    ]),
    [["chemical_treatment", "colored", "qualifier"]],
  )
  assert.deepEqual(
    coloredDativePacket.active_profile_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.selection_effect,
    ]),
    [["chemical_treatment", "colored", "qualifier"]],
  )
  assert.deepEqual(
    coloredAdjectivePacket.active_profile_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.selection_effect,
    ]),
    [["chemical_treatment", "colored", "qualifier"]],
  )
})

test("buildAgentRoutePacket keeps conditioner flattening questions in troubleshoot before product picks", () => {
  const packet = buildAgentRoutePacket({
    message: "Mein Conditioner macht die Haare platt, soll ich wechseln?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "conditioner",
      evidence: ["User asks whether switching makes sense after a problem description."],
    }),
  })

  assert.equal(packet.user_job, "troubleshoot")
  assert.equal(packet.product_category, "conditioner")
  assert.equal(packet.required_playbook_id, "playbook:troubleshoot_hair_issue")
  assert.deepEqual(packet.tool_plan, [])
})

test("buildAgentRoutePacket routes deep cleansing shampoo before generic shampoo", () => {
  const packet = buildAgentRoutePacket({
    message: "Brauche ich ein Tiefenreinigungsshampoo, wenn meine Haare stumpf und belegt wirken?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: null,
      requested_topic_ids: ["topic:deep_cleansing"],
    }),
  })

  assert.equal(packet.product_category, "deep_cleansing_shampoo")
  assert.deepEqual(packet.tool_plan, ["select_products"])
  assert.deepEqual(packet.guidance_ids, [
    "playbook:compare_or_decide",
    "overlay:dry_lengths",
    "topic:deep_cleansing",
  ])
})

test("buildAgentRoutePacket infers conditioner for clear product asks with null classifier category", () => {
  const messages = [
    "Welcher Conditioner passt zu mir?",
    "Welche Spuelung passt zu mir?",
    "Welche Spülung passt zu mir?",
  ]

  for (const message of messages) {
    const packet = buildAgentRoutePacket({
      message,
      userContext: createContext(),
      classification: createClassification({
        user_job: "product_pick",
        product_category: null,
      }),
    })

    assert.equal(packet.product_category, "conditioner", message)
    assert.deepEqual(packet.tool_plan, ["select_products"], message)
  }
})

test("buildAgentRoutePacket infers oil for clear product asks with null classifier category", () => {
  const messages = [
    "Welches Oil passt zu mir?",
    "Welches Oel passt zu mir?",
    "Welches Öl passt zu mir?",
    "Welches Haaroel passt zu mir?",
    "Welches Haaröl passt zu mir?",
  ]

  for (const message of messages) {
    const packet = buildAgentRoutePacket({
      message,
      userContext: createContext(),
      classification: createClassification({
        user_job: "product_pick",
        product_category: null,
      }),
    })

    assert.equal(packet.product_category, "oil", message)
    assert.deepEqual(packet.tool_plan, ["select_products"], message)
  }
})

test("buildAgentRoutePacket infers bondbuilder for named K18 and OLAPLEX comparisons", () => {
  const messages = [
    "Soll ich K18 oder OLAPLEX nehmen?",
    "K18 vs Olaplex - was passt besser?",
    "Welches Bondbuilder Produkt passt zu mir?",
    "Ist Epres oder K18 besser fuer mich?",
  ]

  for (const message of messages) {
    const packet = buildAgentRoutePacket({
      message,
      userContext: createContext(),
      classification: createClassification({
        user_job: "compare_or_decide",
        product_category: null,
      }),
    })

    assert.equal(packet.product_category, "bondbuilder", message)
    assert.deepEqual(packet.tool_plan, ["select_products"], message)
  }
})

test("buildAgentRoutePacket keeps explicit shampoo category ahead of OLAPLEX brand-only wording", () => {
  const packet = buildAgentRoutePacket({
    message: "Welches OLAPLEX Shampoo passt zu mir?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "product_pick",
      product_category: null,
    }),
  })

  assert.equal(packet.product_category, "shampoo")
  assert.deepEqual(packet.tool_plan, ["select_products"])
})

test("buildAgentRoutePacket keeps oily-root oil suitability conceptual", () => {
  const packet = buildAgentRoutePacket({
    message: "Ich habe schnell fettigen Ansatz. Ist Haaroel ueberhaupt sinnvoll?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "oil",
      evidence: ["User asks whether hair oil makes sense for oily roots."],
    }),
  })

  assert.equal(packet.user_job, "compare_or_decide")
  assert.equal(packet.product_category, "oil")
  assert.deepEqual(packet.concerns, ["oily_roots"])
  assert.deepEqual(packet.tool_plan, [])
  assert.deepEqual(packet.validation_warnings, [])
})

test("buildAgentRoutePacket covers the agreed regression route shapes", () => {
  const dryLengthsShampoo = buildAgentRoutePacket({
    message: "Meine Laengen sind trocken, brauche ich ein anderes Shampoo?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "shampoo",
      concerns: ["dry_lengths"],
    }),
  })
  const bondBuilderTopic = buildAgentRoutePacket({
    message: "Brauche ich einen Bond Builder?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "compare_or_decide",
      product_category: "bondbuilder",
      requested_topic_ids: ["topic:bond_builder"],
    }),
  })
  const cwcUsage = buildAgentRoutePacket({
    message: "Wie baue ich CWC in meine Waesche ein?",
    userContext: createContext(),
    classification: createClassification({
      user_job: "usage",
      product_category: null,
      requested_topic_ids: ["topic:cwc_owc"],
    }),
  })
  const straightRoutine = buildAgentRoutePacket({
    message: "Baue mir eine einfache glatte Routine.",
    userContext: createContext({
      profile: { hair_texture: "straight", concerns: [] } as unknown as HairProfile,
      suggested_overlays: [],
    }),
    classification: createClassification({
      user_job: "routine_structure",
      product_category: null,
    }),
  })

  assert.equal(dryLengthsShampoo.required_playbook_id, "playbook:compare_or_decide")
  assert.deepEqual(dryLengthsShampoo.concerns, ["dry_lengths"])
  assert.deepEqual(dryLengthsShampoo.tool_plan, ["select_products"])
  assert.deepEqual(bondBuilderTopic.guidance_ids, [
    "playbook:compare_or_decide",
    "overlay:dry_lengths",
    "topic:bond_builder",
  ])
  assert.deepEqual(cwcUsage.guidance_ids, [
    "playbook:usage_and_application",
    "overlay:dry_lengths",
    "topic:cwc_owc",
  ])
  assert.deepEqual(cwcUsage.tool_plan, [])
  assert.equal(straightRoutine.requested_routine_id, "routine:straight_low_definition")
})
