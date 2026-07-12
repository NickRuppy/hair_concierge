import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  checkFunnelFiles,
  createFunnelPackage,
  main,
  parseFunnelArgs,
  writeFunnelRegistries,
} from "../scripts/funnels/new-package.mjs"

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "chaarlie-funnel-generator-"))
  mkdirSync(path.join(root, "src/funnels/landing"), { recursive: true })
  mkdirSync(path.join(root, "src/funnels/offers"), { recursive: true })
  writeFileSync(
    path.join(root, "src/funnels/landing/default.tsx"),
    "export default function Default() {}\n",
  )
  writeFileSync(
    path.join(root, "src/funnels/offers/default.tsx"),
    "export default function Default() {}\n",
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
          offerVariant: "default",
        },
      ],
      null,
      2,
    )}\n`,
  )
  writeFunnelRegistries(root)
  return root
}

test("generator reuses landing and offer variants independently", () => {
  const root = createFixture()
  try {
    const offerOnly = createFunnelPackage(
      {
        key: "default_landing_offer_b",
        slug: "default-landing-offer-b",
        landingVariant: "default",
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
        offerVariant: "offer-b",
        channel: "meta",
        status: "placeholder",
      },
      root,
    )
    assert.deepEqual(landingOnly.created, ["src/funnels/landing/landing-b.tsx"])

    const packages = JSON.parse(readFileSync(path.join(root, "src/funnels/packages.json"), "utf8"))
    assert.equal(packages[1].landingVariant, "default")
    assert.equal(packages[1].offerVariant, "offer-b")
    assert.equal(packages[2].landingVariant, "landing-b")
    assert.equal(packages[2].offerVariant, "offer-b")
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
      offerVariant: "default",
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

test("generator emits valid unique identifiers for numeric and colliding variant names", () => {
  const root = createFixture()
  try {
    createFunnelPackage(
      {
        key: "numeric_variant",
        slug: "numeric-variant",
        landingVariant: "1-a",
        offerVariant: "a-1",
        channel: "meta",
        status: "placeholder",
      },
      root,
    )
    createFunnelPackage(
      {
        key: "colliding_variant",
        slug: "colliding-variant",
        landingVariant: "a1",
        offerVariant: "a1",
        channel: "meta",
        status: "placeholder",
      },
      root,
    )

    const landingRegistry = readFileSync(
      path.join(root, "src/funnels/landing/registry.generated.ts"),
      "utf8",
    )
    const offerRegistry = readFileSync(
      path.join(root, "src/funnels/offers/registry.generated.ts"),
      "utf8",
    )
    assert.match(landingRegistry, /import LandingVariant0 from "\.\/1-a"/)
    assert.match(landingRegistry, /import LandingVariant1 from "\.\/a1"/)
    assert.match(offerRegistry, /import OfferVariant0 from "\.\/a-1"/)
    assert.match(offerRegistry, /import OfferVariant1 from "\.\/a1"/)
    assert.match(
      readFileSync(path.join(root, "src/funnels/landing/1-a.tsx"), "utf8"),
      /function Funnel1ALandingVariant/,
    )
    assert.doesNotThrow(() => checkFunnelFiles(root))
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
