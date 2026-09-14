import assert from "node:assert/strict"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  TEMPLATE_BASE_VARIANTS,
  checkFunnelFiles,
  createFunnelPackage,
  main,
  parseFunnelArgs,
  writeFunnelRegistries,
} from "../scripts/funnels/new-package.mjs"

const repoRoot = fileURLToPath(new URL("..", import.meta.url))

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "chaarlie-funnel-generator-"))
  mkdirSync(path.join(root, "src/funnels/landing"), { recursive: true })
  mkdirSync(path.join(root, "src/funnels/offers"), { recursive: true })
  mkdirSync(path.join(root, "src/funnels/quizzes"), { recursive: true })
  writeFileSync(
    path.join(root, "src/funnels/landing/default.tsx"),
    "export default function Default() {}\n",
  )
  writeFileSync(
    path.join(root, "src/funnels/offers/organic-plan-v1.tsx"),
    "export default function OrganicPlanV1() {}\n",
  )
  writeFileSync(
    path.join(root, "src/funnels/packages.json"),
    `${JSON.stringify(
      [
        {
          key: "default_organic",
          slug: null,
          channel: "organic",
          status: "active",
          landingVariant: "default",
          quizVariant: "legacy-quiz-v1",
          offerVariant: "organic-plan-v1",
        },
      ],
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    path.join(root, "src/funnels/quizzes/registry.json"),
    `${JSON.stringify([
      {
        id: "legacy-quiz-v1",
        quizKind: "legacy",
        delivery: { kind: "route", route: "/quiz" },
        landingVariants: ["default"],
      },
      {
        id: "personal-plan-quiz-v1",
        quizKind: "personal_plan",
        delivery: { kind: "embedded", landingVariant: "personal-plan-quiz" },
        landingVariants: ["personal-plan-quiz"],
      },
    ])}\n`,
  )
  writeFunnelRegistries(root)
  return root
}

test("generator reuses shared variants and creates a new shared-quiz landing when needed", () => {
  const root = createFixture()
  try {
    const offerOnly = createFunnelPackage(
      {
        key: "default_landing_offer_b",
        slug: "default-landing-offer-b",
        landingVariant: "default",
        quizVariant: "legacy-quiz-v1",
        offerVariant: "offer-b",
        channel: "meta",
        status: "placeholder",
      },
      root,
    )
    assert.deepEqual(offerOnly.created, ["src/funnels/offers/offer-b.tsx"])

    const landingOnly = createFunnelPackage(
      {
        key: "landing_b_offer_b",
        slug: "landing-b-offer-b",
        landingVariant: "landing-b",
        quizVariant: "legacy-quiz-v1",
        offerVariant: "offer-b",
        channel: "meta",
        status: "placeholder",
      },
      root,
    )
    assert.deepEqual(landingOnly.created, ["src/funnels/landing/landing-b.tsx"])

    const packages = JSON.parse(readFileSync(path.join(root, "src/funnels/packages.json"), "utf8"))
    assert.equal(packages[1].landingVariant, "default")
    assert.equal(packages[1].quizVariant, "legacy-quiz-v1")
    assert.equal(packages[1].offerVariant, "offer-b")
    assert.equal(packages[2].landingVariant, "landing-b")
    assert.equal(packages[2].quizVariant, "legacy-quiz-v1")
    assert.doesNotThrow(() => checkFunnelFiles(root))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("generator rejects duplicate packages and invalid identifiers", () => {
  const root = createFixture()
  try {
    const input = {
      key: "package_a",
      slug: "package-a",
      landingVariant: "default",
      quizVariant: "legacy-quiz-v1",
      offerVariant: "organic-plan-v1",
      channel: "meta",
      status: "placeholder",
    }
    createFunnelPackage(input, root)
    assert.throws(() => createFunnelPackage(input, root), /Package key already exists/)
    assert.throws(
      () => createFunnelPackage({ ...input, key: "Package B", slug: "package-b" }, root),
      /snake_case/,
    )
    assert.throws(() => parseFunnelArgs(["--chanel", "meta"]), /Unknown argument: --chanel/)
    assert.throws(
      () => createFunnelPackage({ ...input, quizVariant: "unknown-quiz-v1" }, root),
      /Unknown quiz variant/,
    )
    assert.throws(
      () => createFunnelPackage({ ...input, landingVariant: "personal-plan-quiz" }, root),
      /not compatible with landing variant/,
    )
    assert.throws(
      () =>
        createFunnelPackage(
          { ...input, quizVariant: "personal-plan-quiz-v1", landingVariant: "default" },
          root,
        ),
      /not compatible with landing variant/,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("funnel check rejects stale generated registries", () => {
  const root = createFixture()
  try {
    writeFileSync(path.join(root, "src/funnels/landing/registry.generated.ts"), "stale\n")
    assert.throws(() => checkFunnelFiles(root), /Landing registry is stale/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("generator emits valid offer component identifiers without generating quiz code", () => {
  const root = createFixture()
  try {
    createFunnelPackage(
      {
        key: "numeric_variant",
        slug: "numeric-variant",
        landingVariant: "default",
        quizVariant: "legacy-quiz-v1",
        offerVariant: "a-1",
        channel: "meta",
        status: "placeholder",
      },
      root,
    )
    const offerRegistry = readFileSync(
      path.join(root, "src/funnels/offers/registry.generated.ts"),
      "utf8",
    )
    assert.match(offerRegistry, /import OfferVariant0 from "\.\/a-1"/)
    assert.doesNotThrow(() => checkFunnelFiles(root))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("generator requires a registered landing-compatible quiz variant", () => {
  const root = createFixture()
  try {
    assert.throws(
      () =>
        createFunnelPackage(
          {
            key: "missing_quiz",
            slug: "missing-quiz",
            landingVariant: "default",
            offerVariant: "offer-b",
            channel: "meta",
            status: "placeholder",
          },
          root,
        ),
      /Missing required --quiz/,
    )
    assert.deepEqual(parseFunnelArgs(["--quiz", "legacy-quiz-v1"]), {
      key: undefined,
      slug: undefined,
      landingVariant: undefined,
      quizVariant: "legacy-quiz-v1",
      offerVariant: undefined,
      channel: "meta",
      status: "placeholder",
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("funnel check write mode repairs stale registries", () => {
  const root = createFixture()
  try {
    writeFileSync(path.join(root, "src/funnels/landing/registry.generated.ts"), "stale\n")
    main(["--check", "--write"], root)
    assert.doesNotThrow(() => checkFunnelFiles(root))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function relativeImportTargets(source: string) {
  return [...source.matchAll(/from "(\.\/[^"]+)"/g)].map((match) => match[1])
}

test("scaffolded wrappers import variants that exist in the real funnel tree", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "chaarlie-funnel-scaffold-"))
  try {
    cpSync(path.join(repoRoot, "src/funnels"), path.join(root, "src/funnels"), { recursive: true })
    const result = createFunnelPackage(
      {
        key: "throwaway_scaffold",
        slug: "throwaway-scaffold",
        landingVariant: "throwaway-landing",
        quizVariant: "legacy-quiz-v1",
        offerVariant: "throwaway-offer",
        channel: "meta",
        status: "placeholder",
      },
      root,
    )
    assert.deepEqual(result.created, [
      "src/funnels/landing/throwaway-landing.tsx",
      "src/funnels/offers/throwaway-offer.tsx",
    ])

    for (const created of result.created) {
      const createdPath = path.join(root, created)
      const targets = relativeImportTargets(readFileSync(createdPath, "utf8"))
      assert.equal(targets.length, 1, created)
      for (const target of targets) {
        const targetPath = path.resolve(path.dirname(createdPath), `${target}.tsx`)
        assert.ok(existsSync(targetPath), `${created} imports missing ${target}.tsx`)
        assert.ok(
          existsSync(path.join(repoRoot, path.relative(root, targetPath))),
          `${created} import target ${target}.tsx is not in the repository`,
        )
      }
    }
    assert.match(
      readFileSync(path.join(root, result.created[1]), "utf8"),
      new RegExp(`from "\\./${TEMPLATE_BASE_VARIANTS.offer}"`),
    )
    assert.doesNotThrow(() => checkFunnelFiles(root))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("generator refuses to scaffold when a template base variant is missing", () => {
  const root = createFixture()
  try {
    rmSync(path.join(root, "src/funnels/offers/organic-plan-v1.tsx"))
    writeFunnelRegistries(root)
    assert.throws(
      () =>
        createFunnelPackage(
          {
            key: "orphan_offer",
            slug: "orphan-offer",
            landingVariant: "default",
            quizVariant: "legacy-quiz-v1",
            offerVariant: "orphan-offer",
            channel: "meta",
            status: "placeholder",
          },
          root,
        ),
      /template base src\/funnels\/offers\/organic-plan-v1\.tsx is missing/,
    )
    assert.ok(!existsSync(path.join(root, "src/funnels/offers/orphan-offer.tsx")))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
