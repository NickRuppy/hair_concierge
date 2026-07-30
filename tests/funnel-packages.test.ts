import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_FUNNEL_PACKAGE_KEY,
  getFunnelPackageByKey,
  getFunnelPackageBySlug,
  resolveDefaultFunnelPackage,
  resolveOfferVariantForSession,
  validateFunnelPackages,
} from "../src/lib/funnel/packages"
import {
  getQuizVariant,
  isLandingCompatibleQuizVariant,
  validateFunnelQuizVariants,
} from "../src/funnels/quizzes/registry"

test("resolves the default organic package", () => {
  const funnelPackage = resolveDefaultFunnelPackage()

  assert.equal(funnelPackage.key, DEFAULT_FUNNEL_PACKAGE_KEY)
  assert.equal(funnelPackage.slug, null)
  assert.equal(funnelPackage.offerVariant, "guided-story")
  assert.equal(funnelPackage.quizVariant, "legacy-quiz-v1")
})

test("resolves the active Meta routine package separately from organic", () => {
  const organicPackage = resolveDefaultFunnelPackage()
  const metaPackage = getFunnelPackageBySlug("routine")

  assert.equal(metaPackage?.key, "meta_routine_v1")
  assert.equal(metaPackage?.channel, "meta")
  assert.equal(metaPackage?.status, "active")
  assert.notEqual(metaPackage?.key, organicPackage.key)
  assert.equal(metaPackage?.landingVariant, organicPackage.landingVariant)
  assert.equal(metaPackage?.offerVariant, organicPackage.offerVariant)
})

test("resolves the placeholder campaign package by slug", () => {
  const funnelPackage = getFunnelPackageBySlug("scalp-check")
  assert.equal(funnelPackage?.key, "scalp_check_placeholder")
  assert.equal(funnelPackage?.status, "placeholder")
})

test("resolves the gated personal-plan quiz placeholder package by slug", () => {
  const funnelPackage = getFunnelPackageBySlug("haarplan")

  assert.deepEqual(funnelPackage, {
    key: "meta_personal_plan_v1",
    slug: "haarplan",
    channel: "meta",
    status: "placeholder",
    landingVariant: "personal-plan-quiz",
    quizVariant: "personal-plan-quiz-v1",
    offerVariant: "personal-plan-v1",
  })
})

test("every package selects a registered landing-compatible quiz variant", () => {
  for (const funnelPackage of [resolveDefaultFunnelPackage(), getFunnelPackageBySlug("haarplan")]) {
    assert.ok(funnelPackage)
    const quizVariant = getQuizVariant(funnelPackage.quizVariant)
    assert.ok(quizVariant, funnelPackage.key)
    assert.ok(quizVariant.landingVariants.includes(funnelPackage.landingVariant), funnelPackage.key)
  }
})

test("package definitions reject unknown or landing-incompatible quiz variants", () => {
  const base = resolveDefaultFunnelPackage()
  assert.throws(
    () => validateFunnelPackages([{ ...base, quizVariant: "unknown-quiz-v1" }]),
    /Unknown quiz variant/,
  )
  assert.throws(
    () =>
      validateFunnelPackages([
        { ...base, landingVariant: "personal-plan-quiz", quizVariant: "legacy-quiz-v1" },
      ]),
    /not compatible with landing variant/,
  )
})

test("the route-delivered shared quiz accepts generated landings but not embedded quiz landings", () => {
  const legacyQuiz = getQuizVariant("legacy-quiz-v1")
  const personalPlanQuiz = getQuizVariant("personal-plan-quiz-v1")
  assert.ok(legacyQuiz)
  assert.ok(personalPlanQuiz)
  assert.equal(isLandingCompatibleQuizVariant(legacyQuiz, "landing-b"), true)
  assert.equal(isLandingCompatibleQuizVariant(legacyQuiz, "personal-plan-quiz"), false)
  assert.equal(isLandingCompatibleQuizVariant(personalPlanQuiz, "default"), false)
})

test("owner quiz registry rejects unsupported quiz kinds and invalid delivery mappings", () => {
  assert.throws(
    () =>
      validateFunnelQuizVariants([
        {
          id: "unsupported-quiz-v1",
          quizKind: "unknown",
          delivery: { kind: "route", route: "/quiz" },
          landingVariants: ["default"],
        },
      ]),
    /Unsupported quiz kind/,
  )
  assert.throws(
    () =>
      validateFunnelQuizVariants([
        {
          id: "broken-quiz-v1",
          quizKind: "legacy",
          delivery: { kind: "embedded", landingVariant: "default" },
          landingVariants: ["other-landing"],
        },
      ]),
    /Invalid embedded delivery seam/,
  )
})

test("unknown package keys and slugs do not fall back silently", () => {
  assert.equal(getFunnelPackageByKey("unknown"), null)
  assert.equal(getFunnelPackageBySlug("unknown"), null)
})

test("structured package definitions reject duplicate keys and slugs", () => {
  const base = resolveDefaultFunnelPackage()
  assert.throws(() => validateFunnelPackages([base, { ...base }]), /Duplicate funnel package key/)
  assert.throws(
    () =>
      validateFunnelPackages([
        base,
        { ...base, key: "another_package", slug: "same-slug" },
        { ...base, key: "third_package", slug: "same-slug" },
      ]),
    /Duplicate funnel package slug/,
  )
})

test("stored session offer variant wins over the current package mapping", () => {
  assert.equal(
    resolveOfferVariantForSession({
      packageKey: "default_organic",
      offerVariant: "default",
    }),
    "default",
  )
})

test("a session without a stored offer uses its package mapping", () => {
  assert.equal(
    resolveOfferVariantForSession({ packageKey: "meta_routine_v1", offerVariant: null }),
    "guided-story",
  )
})
