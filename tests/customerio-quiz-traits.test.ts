import assert from "node:assert/strict"
import test from "node:test"

import { buildCustomerIoQuizLeadSync } from "../src/lib/customerio/quiz-traits"

test("builds rich Customer.io quiz traits with labels when consent is true", () => {
  const sync = buildCustomerIoQuizLeadSync({
    createdAt: "2026-05-28T10:00:00.000Z",
    email: " Nick@Example.com ",
    leadId: "lead-123",
    marketingConsent: true,
    name: "Nick Rupprecht",
    quizAnswers: {
      structure: "wavy",
      thickness: "fine",
      density: "low",
      fingertest: "leicht_uneben",
      pulltest: "stretches_stays",
      scalp_type: "trocken",
      has_scalp_issue: true,
      scalp_condition: "gereizt",
      concerns: ["dryness", "frizz"],
      concerns_other_text: "please do not send me",
      treatment: ["blondiert"],
      goals: ["moisture", "shine"],
    },
  })

  assert.equal(sync.userId, "nick@example.com")
  assert.equal(sync.identifyTraits.email, "nick@example.com")
  assert.equal(sync.identifyTraits.first_name, "Nick")
  assert.equal(sync.identifyTraits.lead_id, "lead-123")
  assert.equal(sync.identifyTraits.marketing_consent, true)
  assert.equal(sync.identifyTraits.hair_texture, "wavy")
  assert.equal(sync.identifyTraits.hair_texture_label, "Wellig")
  assert.equal(sync.identifyTraits.thickness, "fine")
  assert.equal(sync.identifyTraits.thickness_label, "Fein")
  assert.equal(sync.identifyTraits.density, "low")
  assert.equal(sync.identifyTraits.density_label, "Wenig Haare")
  assert.equal(sync.identifyTraits.cuticle_condition, "leicht_uneben")
  assert.equal(sync.identifyTraits.cuticle_condition_label, "Leicht uneben")
  assert.equal(sync.identifyTraits.protein_moisture_balance, "stretches_stays")
  assert.equal(sync.identifyTraits.protein_moisture_balance_label, "Proteinmangel")
  assert.equal(sync.identifyTraits.scalp_type, "trocken")
  assert.equal(sync.identifyTraits.scalp_type_label, "Trocken")
  assert.equal(sync.identifyTraits.has_scalp_issue, true)
  assert.equal(sync.identifyTraits.scalp_condition, "gereizt")
  assert.equal(sync.identifyTraits.scalp_condition_label, "Gereizte Kopfhaut")
  assert.deepEqual(sync.identifyTraits.concerns, ["dryness", "frizz"])
  assert.deepEqual(sync.identifyTraits.concern_labels, ["Trockenheit", "Frizz"])
  assert.deepEqual(sync.identifyTraits.chemical_treatment, ["blondiert"])
  assert.deepEqual(sync.identifyTraits.chemical_treatment_labels, ["Blondiert"])
  assert.deepEqual(sync.identifyTraits.goals, ["moisture", "shine"])
  assert.deepEqual(sync.identifyTraits.goal_labels, ["Mehr Feuchtigkeit", "Mehr Glanz"])
  assert.equal("concerns_other_text" in sync.identifyTraits, false)
  assert.equal("is_customer" in sync.identifyTraits, false)
  assert.equal(sync.eventName, "quiz_profile_submitted")
  assert.equal(sync.eventProperties.source, "quiz_lead_api")
})

test("skips Customer.io quiz lead sync when consent is false", () => {
  const sync = buildCustomerIoQuizLeadSync({
    createdAt: "2026-05-28T10:00:00.000Z",
    email: "lead@example.com",
    leadId: "lead-456",
    marketingConsent: false,
    name: "Lead",
    quizAnswers: {
      structure: "curly",
      thickness: "coarse",
      density: "high",
      fingertest: "rau",
      pulltest: "snaps",
      scalp_type: "fettig",
      has_scalp_issue: false,
      concerns: ["breakage"],
      treatment: ["natur"],
      goals: ["anti_breakage"],
    },
  })

  assert.equal(sync.shouldIdentify, false)
  assert.equal(sync.shouldTrackProfileSubmitted, false)
  assert.deepEqual(sync.identifyTraits, {})
})
