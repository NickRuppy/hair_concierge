import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  collectShampooFocusV15EvidenceRefIds,
  validateShampooFocusV15Overlay,
  validateShampooFocusV15Dataset,
} from "@/lib/shampoo/focus-v15"

const pilotRoot = join(process.cwd(), "plans/scan-db-expansion/research/shampoo-v14/pilot")

function json(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
}

function basis(id: string) {
  const root = join(pilotRoot, id)
  const source = json(join(root, "source-packet.json"))
  const adjudication = json(join(root, "adjudication.json"))
  const finalProperties = adjudication.finalProperties as Record<string, { value: unknown }>
  return {
    productId: id,
    formulaFingerprintSha256: (source.formula as { sha256_normalized_inci: string })
      .sha256_normalized_inci,
    canonicalInci: (source.formula as { normalized_inci_string: string }).normalized_inci_string,
    canonicalOrderedInci: (source.formula as { normalized_ordered_inci: string[] })
      .normalized_ordered_inci,
    adjudicationBytes: readFileSync(join(root, "adjudication.json")),
    priorV14: {
      primary: finalProperties.focusPrimary?.value,
      secondary: finalProperties.focusSecondary?.value,
    },
    evidenceRefIds: collectShampooFocusV15EvidenceRefIds(source, adjudication),
  }
}

test("accepts each of the five frozen v1.5 overlays when bound to its exact v1.4 basis", () => {
  for (const id of [
    "elvital-hydra-hyaluronic",
    "syoss-intense-keratin",
    "head-shoulders-classic-clean",
    "isana-sensitiv",
    "isana-2in1-volumen",
  ]) {
    const overlay = json(join(pilotRoot, id, "focus-v15.json"))
    assert.deepEqual(validateShampooFocusV15Overlay(overlay, basis(id)), { ok: true })
  }
})

test("rejects an obsolete or unknown focus, duplicate secondary focus, and incomplete evidence", () => {
  const id = "elvital-hydra-hyaluronic"
  const overlay = json(join(pilotRoot, id, "focus-v15.json"))
  const effective = overlay.effectiveV15 as Record<string, unknown>

  assert.equal(
    validateShampooFocusV15Overlay(
      { ...overlay, effectiveV15: { ...effective, primary: "gentle" } },
      basis(id),
    ).ok,
    false,
  )
  assert.equal(
    validateShampooFocusV15Overlay(
      { ...overlay, effectiveV15: { ...effective, secondary: ["shine", "shine"] } },
      basis(id),
    ).ok,
    false,
  )
  assert.equal(
    validateShampooFocusV15Overlay(
      { ...overlay, effectiveV15: { ...effective, evidenceRefs: [] } },
      basis(id),
    ).ok,
    false,
  )
})

test("rejects identity, formula, exact adjudication bytes, and prior v1.4 drift", () => {
  const id = "elvital-hydra-hyaluronic"
  const overlay = json(join(pilotRoot, id, "focus-v15.json"))
  const stableBasis = basis(id)

  for (const changed of [
    { ...overlay, productId: "wrong-product" },
    { ...overlay, formulaFingerprintSha256: "0".repeat(64) },
    { ...overlay, priorV14: { ...(overlay.priorV14 as object), primary: "repair" } },
  ])
    assert.equal(validateShampooFocusV15Overlay(changed, stableBasis).ok, false)

  assert.equal(
    validateShampooFocusV15Overlay(overlay, {
      ...stableBasis,
      adjudicationBytes: Buffer.from("different exact bytes"),
    }).ok,
    false,
  )
})

test("rejects invalid care direction and claim role", () => {
  const id = "elvital-hydra-hyaluronic"
  const overlay = json(join(pilotRoot, id, "focus-v15.json"))
  assert.equal(
    validateShampooFocusV15Overlay(
      { ...overlay, careDirection: { ...(overlay.careDirection as object), verdict: "invalid" } },
      basis(id),
    ).ok,
    false,
  )
  assert.equal(
    validateShampooFocusV15Overlay({ ...overlay, claimRole: "claims_only" }, basis(id)).ok,
    false,
  )
})

test("rejects formula facts at the wrong canonical INCI position and unresolved evidence refs", () => {
  const id = "elvital-hydra-hyaluronic"
  const overlay = json(join(pilotRoot, id, "focus-v15.json"))
  const effective = overlay.effectiveV15 as Record<string, unknown>
  const facts = effective.formulaFacts as Array<Record<string, unknown>>

  assert.equal(
    validateShampooFocusV15Overlay(
      {
        ...overlay,
        effectiveV15: {
          ...effective,
          formulaFacts: [{ ...facts[0], ingredient: "Invented Ingredient" }],
        },
      },
      basis(id),
    ).ok,
    false,
  )
  assert.equal(
    validateShampooFocusV15Overlay(
      {
        ...overlay,
        effectiveV15: { ...effective, evidenceRefs: ["formula.does_not_exist"] },
      },
      basis(id),
    ).ok,
    false,
  )
})

test("rejects duplicate dataset product and path joins", () => {
  const product = { id: "elvital-hydra-hyaluronic", path: "elvital-hydra-hyaluronic" }
  const result = validateShampooFocusV15Dataset(
    { version: "shampoo-v14-pilot-manifest-v1", products: [product, product] },
    () => ({ ok: true }),
  )
  assert.equal(result.ok, false)
})

test("rejects empty, oversized, and unsafe dataset manifests", () => {
  const member = (id: string, path = id) => ({ id, path })
  const manifests = [
    { version: "shampoo-v14-pilot-manifest-v1", products: [] },
    {
      version: "shampoo-v14-pilot-manifest-v1",
      products: Array.from({ length: 6 }, (_, index) => member(`product-${index}`)),
    },
    {
      version: "shampoo-v14-pilot-manifest-v1",
      products: [member("safe-product", "../pilot")],
    },
    {
      version: "shampoo-v14-pilot-manifest-v1",
      products: [member("Unsafe Product")],
    },
  ]

  for (const manifest of manifests) {
    assert.equal(validateShampooFocusV15Dataset(manifest, () => ({ ok: true })).ok, false)
  }
})
