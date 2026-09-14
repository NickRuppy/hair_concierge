import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

const mutableEnv = process.env as Record<string, string | undefined>

async function importAccess() {
  return import("../src/lib/labs/leave-in-research-access")
}

async function withLabEnvironment(run: () => Promise<void>) {
  const directory = mkdtempSync(path.join(tmpdir(), "leave-in-lab-fixture-"))
  const previousNodeEnv = mutableEnv.NODE_ENV
  const previousReview = mutableEnv.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH
  mutableEnv.NODE_ENV = "development"
  mutableEnv.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH = path.join(directory, "lab-review-state.json")
  try {
    await run()
  } finally {
    mutableEnv.NODE_ENV = previousNodeEnv
    if (previousReview === undefined) delete mutableEnv.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH
    else mutableEnv.LEAVE_IN_RESEARCH_LAB_REVIEW_STATE_PATH = previousReview
    rmSync(directory, { recursive: true, force: true })
  }
}

test("Leave-In fixture loads, validates and covers both batches", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData } = await importAccess()
    const data = getLeaveInResearchLabData()

    // Batch 1 (gold-set, 13) + Batch 2 (unseen-test, 6) = 19.
    assert.equal(data.summary.products, 19)
    assert.equal(data.queueItems.length, 19)
    // gold-set: 11 in-category + 2 excluded. unseen-test: 4 in-category
    // (u1, u4, u5, u6) + 2 excluded (u2, u3). See unseen-test-report.md.
    assert.equal(data.summary.inCategory, 15)
    assert.equal(data.summary.excluded, 4)
    assert.equal(data.summary.reviewCounts.needsReview, 19)
    assert.equal(data.meta.standardVersion, "leave-in-inci-v0.4")
    assert.equal(data.meta.keyVersion, "reference-key-2026-09-05-r4")
    assert.equal(data.meta.derivedFromRun, "reference-key-2026-09-04-r3")

    const goldSet = data.queueItems.filter((item) => item.batch === "gold-set")
    const unseenTest = data.queueItems.filter((item) => item.batch === "unseen-test")
    assert.equal(goldSet.length, 13)
    assert.equal(unseenTest.length, 6)
    assert.deepEqual(
      goldSet.map((item) => item.slot),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    )
    assert.deepEqual(
      unseenTest.map((item) => item.slot),
      [14, 15, 16, 17, 18, 19],
    )
    assert.equal(goldSet.filter((item) => item.excluded).length, 2)
    assert.equal(unseenTest.filter((item) => item.excluded).length, 2)
    for (const item of unseenTest)
      assert.ok(item.productId.startsWith("unseen-0"), `${item.productId} missing unseen-0N prefix`)
  }))

test("Leave-In fixture carries the trimmed v0.4 review surface", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchProductDetail, getLeaveInResearchLabData } = await importAccess()
    const data = getLeaveInResearchLabData()
    const inCategory = data.queueItems.find((item) => !item.excluded)
    const excluded = data.queueItems.find((item) => item.excluded)
    assert.ok(inCategory && excluded)

    const detail = getLeaveInResearchProductDetail(inCategory.productId)
    assert.ok(detail)
    const groupCount = (group: string) =>
      detail.properties.filter((property) => property.group === group).length
    assert.equal(groupCount("g0"), 1)
    // T12: ROLE (usage_role) stops being a scored dimension — 7, was 8.
    assert.equal(groupCount("dimension"), 7)
    assert.equal(groupCount("hinweise"), 1)
    assert.equal(groupCount("care_direction"), 1)
    // T10: product_form joins the separately reviewable profile rows (15, was 14).
    assert.equal(groupCount("profile"), 15)
    // T12: one fewer dimension row — 25, was 26.
    assert.equal(detail.properties.length, 25)

    for (const path of [
      "dimension.conditioning_potential",
      "dimension.hold_route_state",
      "hinweise",
      "profile.repair_support_level",
      "profile.focus.primary",
      "profile.hair_thickness_fit.fine",
      "profile.damage_fit.highly_damaged",
      "profile.texture_fit.coily",
    ]) {
      assert.ok(
        detail.properties.some((property) => property.path === path),
        `missing ${path}`,
      )
    }
    // T1-T4, T9, T11-T12: the dropped dimensions and the dropped fit are gone
    // everywhere. No property path may equal or contain
    // `product_form_architecture` — FORM is not a dimension, not a profile
    // field, not anything reviewable. Same for `usage_role` (T12): no
    // property path anywhere may name it, dimension or profile.
    for (const path of [
      "dimension.slip_combability_potential",
      "dimension.ambient_smoothing_alignment_potential",
      "dimension.dose_sensitivity",
      "dimension.humidity_resistance_evidence_state",
      "dimension.product_form_architecture",
      "dimension.usage_role",
      "profile.scalp_application_fit",
      "profile.specialist_functions.humidity_resistance",
      "demoted.smoothing_shine_qualifier",
      "profile.weight_potential",
      "profile.usage_role",
    ]) {
      for (const item of data.queueItems) {
        const each = getLeaveInResearchProductDetail(item.productId)
        assert.ok(each)
        assert.ok(
          !each.properties.some((property) => property.path === path),
          `slot ${item.slot} still carries ${path}`,
        )
      }
    }
    for (const item of data.queueItems) {
      const each = getLeaveInResearchProductDetail(item.productId)
      assert.ok(each)
      assert.ok(
        !each.properties.some((property) => property.path.includes("product_form_architecture")),
        `slot ${item.slot} has a property path referencing product_form_architecture`,
      )
      // T12: no property path — dimension, profile, or anything else — may
      // contain `usage_role` in any form. ROLE is removed entirely, not
      // renamed; its identity-capture successor (`application_stage`) lives
      // outside `properties[]` altogether, in `identity.applicationStage`.
      assert.ok(
        !each.properties.some((property) => property.path.includes("usage_role")),
        `slot ${item.slot} has a property path referencing usage_role`,
      )
    }

    const excludedDetail = getLeaveInResearchProductDetail(excluded.productId)
    assert.ok(excludedDetail)
    assert.equal(excludedDetail.properties.filter((p) => p.group === "profile").length, 0)
    assert.equal(excludedDetail.canApproveBoundary, true)
    assert.equal(excludedDetail.canApproveProduct, false)
    assert.ok(excludedDetail.g0.rationale.length > 0)
    assert.ok(
      excludedDetail.properties
        .filter((property) => property.group === "dimension")
        .every((property) => property.informational),
      "excluded dimensions must be marked informational",
    )
  }))

test("Leave-In fixture carries no unseen-test adjudication points any more (T18 retired)", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()

    // formula_source_conflict_rule (Kandidat T18 — Vorrangregel bei
    // Formel-Quellkonflikten) was removed 2026-09-12: Nick's binding ruling
    // T18 settles the general precedence rule for future formula-source
    // conflicts as a standing rule (convergence resolution is primary —
    // three or more independent sources with matching formula/F.I.L. codes
    // resolve the conflict directly; conservative-unknown is the fallback
    // otherwise), so it is no longer an open adjudication for a reviewer to
    // decide per record. u1 (slot 14), the one record this banner was ever
    // attached to, is already conformant with the rule via its 2026-09-12
    // re-derivation (rederived/u1-record.json, 3-source convergence —
    // Rossmann, parfumdreams, codecheck). This was the last open banner in
    // the fixture — the gold-set (Batch 1) banners were all retired earlier
    // by T13-T16 (see the retired-registry history in the test below) — so
    // the count now drops from one to zero.
    assert.deepEqual(data.openAdjudications, [])

    const u1 = data.queueItems.find((item) => item.batch === "unseen-test" && item.slot === 14)
    assert.ok(u1)
    assert.deepEqual(u1.openAdjudicationIds, [])
    const u1Detail = getLeaveInResearchProductDetail(u1.productId)
    assert.ok(u1Detail)
    assert.equal(u1Detail.properties.filter((property) => property.adjudication).length, 0)
    // The record itself stays resolved by the re-derivation: no value row
    // carries `unknown` (that fact predates T18's retirement and is
    // independent of it — it is what made u1 already conformant).
    assert.ok(u1Detail.properties.every((property) => property.value !== "unknown"))

    // No product in either batch carries a formula_source_conflict_rule
    // adjudication (or any other) any more — verify the badge is gone from
    // every product, not just that the registry entry is absent.
    for (const item of data.queueItems) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)
      assert.equal(
        detail.properties.filter((property) => property.adjudication).length,
        0,
        `${item.productId} (batch ${item.batch}, slot ${item.slot}) must carry no adjudication`,
      )
    }
  }))

test("Leave-In fixture carries no gold-set adjudication points any more", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const goldSet = data.queueItems.filter((item) => item.batch === "gold-set")
    // T13 (2026-09-10): focus_permissive_vs_conservative is removed. Nick's
    // ruling T13b settles §10.2.1's general-vs-smoothing question as a
    // standing rule (the permissive single-admissible-set reading), so it is
    // no longer an open adjudication for a reviewer to decide per record —
    // the banner count drops from four to three.
    // T14 (2026-09-10): heat_retailer_tier_only is removed. Nick rules both
    // halves it used to flag — Olaplex's (slot 10) via §2.4.1 rule 7's new
    // cross-market claim exception, Cantu's (slot 3) by that exception's own
    // guarding counter-example (its documented US/German formula split fails
    // the identity prong) — so nothing is left open. The banner count drops
    // from three to two.
    // T15 (2026-09-10): neqi_boundary is removed. Nick rules slot 13
    // in-category with HOLD incidental_film; the Maria-Nila-vs-Neqi
    // worked-example pair is codified in §2.3.2/§7.7. The banner count
    // drops from two to one.
    // T16 (2026-09-11): repair_support_level_uncalibrated is removed. §3.1.1's
    // tail-marker rule becomes conditional on the marker's own plausibility;
    // slot 9 (Redken)'s marker is ruled implausible, so it may no longer
    // disqualify the below-marker silane — R2 moves candidate, and slot 9
    // becomes the gold set's first `repair_support_level: medium`. The
    // §10.3.2 `medium` row is now demonstrably reachable, so the "applied but
    // never exercised" adjudication is resolved. The banner count drops from
    // one to zero.
    assert.deepEqual(
      data.openAdjudications.filter((entry) => entry.id !== "formula_source_conflict_rule"),
      [],
    )

    const attachedBySlot = new Map<number, string[]>()
    for (const item of goldSet) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)
      const ids = detail.properties
        .filter((property) => property.adjudication)
        .map((property) => `${property.path}:${property.adjudication!.id}`)
      if (ids.length) attachedBySlot.set(item.slot, ids)
    }

    // T13: no record carries a focus_permissive_vs_conservative adjudication
    // any more — verify the badge is gone from every slot that used to carry
    // it (2, 6, 8 secondary, 10), not just that the registry entry is absent.
    for (const slot of [2, 6, 8, 10]) {
      const ids = attachedBySlot.get(slot) ?? []
      assert.ok(
        !ids.some((id) => id.includes("focus_permissive_vs_conservative")),
        `slot ${slot} still carries the removed focus_permissive_vs_conservative adjudication`,
      )
    }
    // T14: no record carries a heat_retailer_tier_only adjudication any more
    // — verify the badge is gone from both slots that used to carry it
    // (Cantu, 3; Olaplex, 10), not just that the registry entry is absent.
    for (const slot of [3, 10]) {
      const ids = attachedBySlot.get(slot) ?? []
      assert.ok(
        !ids.some((id) => id.includes("heat_retailer_tier_only")),
        `slot ${slot} still carries the removed heat_retailer_tier_only adjudication`,
      )
    }
    // T15: no record carries a neqi_boundary adjudication any more — verify
    // the badge is gone from slot 13 (g0 and hold), not just the registry.
    {
      const ids = attachedBySlot.get(13) ?? []
      assert.ok(
        !ids.some((id) => id.includes("neqi_boundary")),
        "slot 13 still carries the removed neqi_boundary adjudication",
      )
    }
    // T16: no record carries a repair_support_level_uncalibrated adjudication
    // any more — verify the badge is gone from every slot that used to carry
    // it (the bond-claim product and the two repair-positioned products).
    for (const slot of [8, 9, 10]) {
      const ids = attachedBySlot.get(slot) ?? []
      assert.ok(
        !ids.some((id) => id.includes("repair_support_level_uncalibrated")),
        `slot ${slot} still carries the removed repair_support_level_uncalibrated adjudication`,
      )
    }
    // No slot carries any adjudication at all any more.
    assert.equal(attachedBySlot.size, 0)
  }))

test("Leave-In fixture applies the T6 repair rule and the T7 hold capture (gold-set)", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const goldSet = data.queueItems.filter((item) => item.batch === "gold-set")

    for (const item of goldSet) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)

      const repair = detail.properties.find(
        (property) => property.path === "profile.repair_support_level",
      )
      if (item.excluded) {
        assert.equal(repair, undefined, `slot ${item.slot} must emit no lean profile`)
      } else {
        assert.ok(repair, `slot ${item.slot} missing repair_support_level`)
        // T16 (2026-09-11): slot 9 (Redken)'s tail marker is ruled implausible
        // (it sits before the product's own core conditioning architecture),
        // so it may no longer disqualify the below-marker silane route — R2
        // moves none_visible -> candidate and slot 9 becomes the gold set's
        // first `medium` (§10.3.2's medium row: R2 candidate + COND >=
        // moderate). No other record carries a qualifying R2 route above its
        // (plausible) marker and none carries E3+ repair evidence, so every
        // other record still returns `low`.
        assert.equal(
          repair.value,
          item.slot === 9 ? "medium" : "low",
          `slot ${item.slot} repair level`,
        )
      }

      // T7: no product's frozen claims[] carries a C1/C2 hold level.
      const hold = detail.properties.find(
        (property) => property.path === "dimension.hold_route_state",
      )
      assert.ok(hold)
      assert.ok(
        hold.observations.some((entry) => entry.startsWith("manufacturer_hold_level:")),
        `slot ${item.slot} missing manufacturer_hold_level observation`,
      )

      // T1/T2: the absorbed slip observation rides on COND, the smoothing route
      // on the focus row.
      const cond = detail.properties.find(
        (property) => property.path === "dimension.conditioning_potential",
      )
      assert.ok(cond)
      assert.ok(
        cond.observations.some((entry) => entry.startsWith("absorbed_slip_observation.")),
        `slot ${item.slot} missing absorbed slip observation`,
      )
      const focus = detail.properties.find((property) => property.path === "profile.focus.primary")
      if (!item.excluded) {
        assert.ok(focus)
        assert.ok(focus.observations.some((entry) => entry.startsWith("smoothing_route:")))
      }
    }
  }))

test("Leave-In fixture carries a repair_support_level and hold capture on the unseen-test in-category products", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const unseenTest = data.queueItems.filter((item) => item.batch === "unseen-test")

    for (const item of unseenTest) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)

      if (item.excluded) {
        // u2, u3: §2.3.1's emission contract — an excluded unseen-test record
        // carries only G0, the same "no property rows beyond G0" shape the
        // gold set uses for a record with nothing left to review.
        assert.equal(detail.properties.length, 1)
        assert.equal(detail.properties[0]!.path, "g0")
        continue
      }

      const repair = detail.properties.find(
        (property) => property.path === "profile.repair_support_level",
      )
      assert.ok(repair, `${item.productId} missing repair_support_level`)
      // Neither lane's u1-u6 records reach R2 candidate/tested above conditioning
      // >= moderate on this batch — every in-category unseen product is `low`.
      assert.equal(repair.value, "low", `${item.productId} repair level`)

      const hold = detail.properties.find(
        (property) => property.path === "dimension.hold_route_state",
      )
      assert.ok(hold)
      assert.ok(
        hold.observations.some((entry) => entry.startsWith("manufacturer_hold_level:")),
        `${item.productId} missing manufacturer_hold_level observation`,
      )

      const cond = detail.properties.find(
        (property) => property.path === "dimension.conditioning_potential",
      )
      assert.ok(cond)
      assert.ok(
        cond.observations.some((entry) => entry.startsWith("absorbed_slip_observation.")),
        `${item.productId} missing absorbed slip observation`,
      )

      const focus = detail.properties.find((property) => property.path === "profile.focus.primary")
      assert.ok(focus)
      assert.ok(focus.observations.some((entry) => entry.startsWith("smoothing_route:")))
    }
  }))

test("Leave-In fixture annotates echo fields instead of listing them (T8)", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const inCategory = data.queueItems.find((item) => !item.excluded)
    assert.ok(inCategory)
    const detail = getLeaveInResearchProductDetail(inCategory.productId)
    assert.ok(detail)

    const echoed = Object.fromEntries(
      detail.properties
        .filter((property) => property.echo)
        .map((property) => [property.path, property.echo!.field]),
    )
    // T9: humidity_resistance_evidence_state (HUM) carried a seventh echo
    // through T8. HUM is now removed entirely, so there is no seventh echo.
    // T11: product_form_architecture (FORM) is no longer a dimension row at
    // all, so it carries no echo either — the `product_form` context is now
    // an observation on `profile.product_form` itself (see the T10/T11 test
    // below), not a display echo on a FORM row that no longer exists.
    // T12: usage_role (ROLE) carried the fifth echo through T8. ROLE is now
    // removed entirely, on HUM's reasoning, not FORM's — there is no
    // `dimension.usage_role` row left to echo. Its identity-capture
    // successor, `application_stage`, never joins this map: it is not a
    // lean-profile field, echo or otherwise.
    assert.deepEqual(echoed, {
      "dimension.conditioning_potential": "conditioning_level",
      "dimension.weight_residue_potential": "weight_potential",
      "dimension.persistence_removal_class": "persistence",
      "dimension.hold_route_state": "hold_support",
      care_direction: "care_direction",
    })
    // Cautions moved off the review surface and onto the record.
    assert.ok(detail.cautionsDe.length > 0)
    assert.ok(!detail.properties.some((property) => property.path === "profile.cautions_de"))
  }))

test("Leave-In fixture makes product_form the presentation form, independently reviewable (T10, T11)", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const presentationForms = new Set(["spray", "milk", "lotion", "cream", "serum"])

    for (const item of data.queueItems) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)
      const productForm = detail.properties.find(
        (property) => property.path === "profile.product_form",
      )
      // T11: FORM is no longer a dimension row at all — there is nothing
      // named `dimension.product_form_architecture` to find on any record.
      assert.ok(
        !detail.properties.some(
          (property) => property.path === "dimension.product_form_architecture",
        ),
        `slot ${item.slot} still carries a FORM dimension row`,
      )

      if (item.excluded) {
        assert.equal(productForm, undefined, `slot ${item.slot} must emit no lean profile`)
        continue
      }

      // A real, separately reviewable row — not merely an echo annotation.
      assert.ok(productForm, `slot ${item.slot} missing profile.product_form`)
      assert.equal(productForm.group, "profile")
      assert.ok(
        presentationForms.has(String(productForm.value)) || productForm.value === "unknown",
        `slot ${item.slot} product_form "${productForm.value}" is not presentation-form vocabulary`,
      )
      // Never one of the architecture read's own values leaking through.
      assert.ok(
        !["aqueous_solution", "emulsion", "microemulsion", "two_phase"].includes(
          String(productForm.value),
        ),
        `slot ${item.slot} product_form still carries an architecture-read value`,
      )
      assert.ok(
        productForm.reasoningShort.includes("T10"),
        `slot ${item.slot} product_form reasoningShort does not name T10`,
      )
      assert.deepEqual(productForm.derivedFrom, ["identity (pack + product name + directions, E1)"])

      // T11: the architecture read's value is no longer a dimension echo —
      // it rides as a context observation on profile.product_form itself.
      assert.ok(
        productForm.observations.some((entry) =>
          entry.startsWith("reading_conventions.architecture (§3.1.2, trace-only, T11):"),
        ),
        `slot ${item.slot} product_form missing the §3.1.2 architecture-read observation`,
      )
    }

    // Both two_phase products in the gold set present as spray — the
    // observed correlation §7.1/§3.1.2 records, never a derivation rule.
    for (const slot of [1, 4]) {
      const detail = getLeaveInResearchProductDetail(
        data.queueItems.find((item) => item.slot === slot)!.productId,
      )
      const productForm = detail!.properties.find(
        (property) => property.path === "profile.product_form",
      )!
      assert.ok(
        productForm.observations.includes(
          "reading_conventions.architecture (§3.1.2, trace-only, T11): two_phase",
        ),
      )
      assert.equal(productForm.value, "spray")
    }

    // T10: hair_thickness_fit's stale FORM reference is dropped — the fit
    // table never used it, and the presentation word carries no weight.
    const anyDetail = getLeaveInResearchProductDetail(
      data.queueItems.find((item) => !item.excluded)!.productId,
    )!
    const fineFit = anyDetail.properties.find(
      (property) => property.path === "profile.hair_thickness_fit.fine",
    )
    assert.ok(fineFit)
    assert.deepEqual(fineFit.derivedFrom, ["WT"])
  }))

test("Leave-In fixture folds the architecture read into WT's reasoning (T11, gold-set)", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const goldSet = data.queueItems.filter((item) => item.batch === "gold-set")

    for (const item of goldSet) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)
      const wt = detail.properties.find(
        (property) => property.path === "dimension.weight_residue_potential",
      )
      assert.ok(wt, `slot ${item.slot} missing WT`)
      assert.ok(
        wt.label.includes("§3.1.2"),
        `slot ${item.slot} WT label does not name the §3.1.2 reading convention`,
      )
      assert.ok(
        /\[(two_phase|emulsion|solution|anhydrous|microemulsion)/.test(wt.reasoningShort),
        `slot ${item.slot} WT reasoningShort does not carry the folded architecture note`,
      )
    }
  }))

test("Leave-In fixture's WT row names §3.1.2 on the unseen-test products too", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const unseenTest = data.queueItems.filter((item) => item.batch === "unseen-test")

    for (const item of unseenTest) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)
      const wt = detail.properties.find(
        (property) => property.path === "dimension.weight_residue_potential",
      )
      if (item.excluded) {
        assert.equal(wt, undefined, `${item.productId} must emit no dimension rows`)
        continue
      }
      assert.ok(wt, `${item.productId} missing WT`)
      assert.ok(
        wt.label.includes("§3.1.2"),
        `${item.productId} WT label does not name the §3.1.2 reading convention`,
      )
    }
  }))

test("Leave-In fixture keeps rationale verbatim and flags every extraction gap", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    let total = 0
    let gaps = 0
    for (const item of data.queueItems) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)
      for (const property of detail.properties) {
        total += 1
        if (property.rationaleExtractionGap) {
          gaps += 1
          assert.equal(property.rationale, null)
          assert.equal(property.rationaleSource, "json_fields_only")
        } else {
          assert.ok(property.rationale && property.rationale.trim().length > 0)
          assert.ok(property.rationaleSource.length > 0)
        }
      }
    }
    // Gold-set (13 records, T12 trim): 295. Unseen-test (batch 2, 6
    // records — 4 in-category × 25 properties + 2 excluded × 1 property):
    // 102. Total 397.
    assert.equal(total, 397)
    assert.equal(gaps, data.summary.rationaleGaps)
    // `care_direction` on each of the 4 in-category unseen-test products has
    // no per-field prose in the lane-a record itself — but per Nick's
    // 2026-09-12 ruling ("every reviewable row must carry reasoning"),
    // build-unseen-products.mjs recovers it by quoting the researchers' own
    // notes files (u1-notes.md §7; lane-a/notes.md's per-product write-ups)
    // instead of leaving the row blank. Zero gaps remain anywhere.
    assert.equal(gaps, 0)
  }))

test("Leave-In fixture carries a short reasoning line on every property", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const gapText = "— (Begründung fehlt im Quellrecord)"
    let total = 0

    for (const item of data.queueItems) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)
      for (const property of detail.properties) {
        total += 1
        const where = `${item.productId}.${property.path}`
        assert.equal(typeof property.reasoningShort, "string", `${where} reasoningShort type`)
        assert.ok(property.reasoningShort.trim().length > 0, `${where} reasoningShort is empty`)
        assert.ok(
          property.reasoningShort.length <= 260,
          `${where} reasoningShort is ${property.reasoningShort.length} chars`,
        )
        // The short line never invents an explanation for a property whose
        // rationale is missing from the evidence chain.
        if (property.rationaleExtractionGap)
          assert.equal(property.reasoningShort, gapText, `${where} must carry the gap string`)
        else
          assert.notEqual(
            property.reasoningShort,
            gapText,
            `${where} carries the gap string despite having a rationale`,
          )
      }
    }

    // See the rationale-gap test above for the 295 (gold-set) + 102
    // (unseen-test) = 397 breakdown.
    assert.equal(total, 397)
  }))

test("Leave-In fixture captures application_stage as identity data, not a reviewed row (T12)", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const closedStages = new Set(["towel_dry", "dry_hair", "pre_heat", "post_style"])

    for (const item of data.queueItems) {
      const detail = getLeaveInResearchProductDetail(item.productId)
      assert.ok(detail)
      const stage = detail.identity.applicationStage

      if (item.excluded && item.batch === "gold-set") {
        // §2.3.1 (gold-set convention): an excluded record emits no lean
        // profile and no identity capture beyond G0's own boundary
        // evidence.
        assert.equal(
          stage,
          null,
          `slot ${item.slot} excluded gold-set record must carry no applicationStage`,
        )
        continue
      }

      // Every other record carries a non-empty application_stage: every
      // in-category record on either batch (no ambiguous-directions
      // identity conflict fired on either), and — unlike the gold set —
      // every unseen-test record including the two excluded ones (u2, u3),
      // whose own §2.3.1 emission contract requires the complete identity
      // block, including the G1 directions capture, even when excluded
      // (see each record's own review_routing.notes).
      assert.ok(stage, `slot ${item.slot} missing identity.applicationStage`)
      assert.ok(stage.value.length > 0, `slot ${item.slot} identity.applicationStage is empty`)
      for (const value of stage.value) {
        assert.ok(
          closedStages.has(value),
          `slot ${item.slot} applicationStage carries an unknown stage "${value}"`,
        )
      }
      assert.equal(stage.evidenceLevel, "E1")
      assert.equal(stage.evidenceScope, "directions")
      assert.ok(stage.sourceTier.length > 0)
      assert.equal(stage.basis.length, stage.value.length)
      for (const entry of stage.basis) {
        assert.ok(closedStages.has(entry.stage))
        assert.ok(entry.quote.trim().length > 0)
      }

      // application_stage is identity data, never a reviewed dimension or
      // profile row — it must not appear anywhere in `properties[]`.
      assert.ok(
        !detail.properties.some((property) => property.path.includes("application_stage")),
        `slot ${item.slot} has a reviewed property referencing application_stage`,
      )
    }

    // Slot 9's directions carry no literal wetness word — the record takes
    // the minimal-certain reading and records why, rather than guessing or
    // leaving the field empty.
    const softest = getLeaveInResearchProductDetail(
      data.queueItems.find((item) => item.slot === 9)!.productId,
    )!
    assert.deepEqual(softest.identity.applicationStage?.value, ["towel_dry"])
    assert.ok(softest.identity.applicationStage?.note)

    // Slot 5 (EVO) is the richest textually-explicit record: towel-dry
    // application before blow-drying, plus a distinct post-style touch-up.
    const richest = getLeaveInResearchProductDetail(
      data.queueItems.find((item) => item.slot === 5)!.productId,
    )!
    assert.deepEqual(richest.identity.applicationStage?.value, [
      "towel_dry",
      "pre_heat",
      "post_style",
    ])
  }))

test("Leave-In fixture applies the T17 hard-rule-audit items (H1/H2/H6/H9)", async () =>
  withLabEnvironment(async () => {
    const { getLeaveInResearchLabData, getLeaveInResearchProductDetail } = await importAccess()
    const data = getLeaveInResearchLabData()
    const detailFor = (slot: number) =>
      getLeaveInResearchProductDetail(
        data.queueItems.find((item) => item.slot === slot)!.productId,
      )!

    // H1: slot 6 (Curlsmith) and slot 12 (Kevin Murphy, excluded) carry a
    // tail marker so late that everything at or below it is only capped
    // material, fragrance/allergen declarations or a colourant — vacuous
    // under §3.1.1 clause 6. Both route under `tail_marker_vacuous`
    // instead of the retired `very_late_tail_marker`.
    for (const slot of [6, 12]) {
      const detail = detailFor(slot)
      const tailMarker = detail.identity.tailMarker as Record<string, unknown>
      assert.equal(tailMarker.vacuous, true, `slot ${slot} tailMarker.vacuous`)
      assert.ok(
        detail.reviewRouting.triggers.includes("tail_marker_vacuous"),
        `slot ${slot} missing tail_marker_vacuous trigger`,
      )
      assert.ok(
        !detail.reviewRouting.triggers.includes("very_late_tail_marker"),
        `slot ${slot} still carries the retired very_late_tail_marker trigger`,
      )
    }

    // H2: slot 4 (alverde Nutri-Care) loses its allergen-block marker —
    // the block is no longer marker-eligible — and reads `none_visible`
    // under mandatory limit 2.
    const slot4 = detailFor(4)
    const slot4Marker = slot4.identity.tailMarker as Record<string, unknown>
    assert.equal(slot4Marker.value, "none_visible")
    assert.ok(
      slot4.reviewRouting.triggers.includes("tail_marker_none_visible"),
      "slot 4 missing tail_marker_none_visible trigger",
    )
    assert.ok(
      !slot4.reviewRouting.triggers.includes("tail_marker_allergen_block_only"),
      "slot 4 still carries the retired tail_marker_allergen_block_only trigger",
    )

    // H6: slots 3 (Cantu) and 10 (Olaplex) project weight_potential: high
    // with a persistent non-volatile (monomeric-quat) family — the exact
    // WT-high/PERS-not-permanent_cationic inversion the widened buildup
    // rule closes. Both now carry the buildup caution string.
    const buildupString =
      "Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab."
    for (const slot of [3, 10]) {
      const detail = detailFor(slot)
      assert.ok(
        detail.cautionsDe.includes(buildupString),
        `slot ${slot} missing the T17/H6 buildup caution`,
      )
    }
    // Slots 2 and 6 already carried the buildup caution on the pre-T17
    // basis (persistence: permanent_cationic) — the widened rule must not
    // duplicate it.
    for (const slot of [2, 6]) {
      const detail = detailFor(slot)
      assert.equal(
        detail.cautionsDe.filter((entry) => entry === buildupString).length,
        1,
        `slot ${slot} buildup caution must appear exactly once`,
      )
    }

    // H9: slot 13 (Neqi) — Silicone Quaternium-18 (r11) is T15's named
    // substantive conditioning film for HOLD, while §7.10's rank prong
    // independently keeps the same species/rank as `candidate_below_tail`
    // for R2 — a species-reading conflict, surfaced without moving either
    // value.
    const slot13 = detailFor(13)
    assert.ok(
      slot13.reviewRouting.triggers.includes("species_reading_conflict"),
      "slot 13 missing species_reading_conflict trigger",
    )
    const hold13 = slot13.properties.find(
      (property) => property.path === "dimension.hold_route_state",
    )
    const r13 = slot13.properties.find(
      (property) => property.path === "dimension.repair_surface_film",
    )
    assert.ok(hold13 && hold13.value === "incidental_film", "slot 13 HOLD value must be unchanged")
    assert.ok(r13 && r13.value === "none_visible", "slot 13 R2 value must be unchanged")

    // No dimension or profile value on any record moves toward a
    // recommendation under T17 — every touched slot's focus, fits,
    // care_direction and repair_support_level stay exactly what the T16
    // pass left them.
    for (const item of data.queueItems) {
      if (item.excluded) continue
      const detail = getLeaveInResearchProductDetail(item.productId)!
      const repair = detail.properties.find(
        (property) => property.path === "profile.repair_support_level",
      )
      assert.equal(
        repair?.value,
        item.slot === 9 ? "medium" : "low",
        `slot ${item.slot} repair level`,
      )
    }
  }))
