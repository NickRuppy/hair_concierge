import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { buildPremiereReviewedPromotion } from "@/lib/product-intake/catalog-enrichment/bondbuilder-reviewed-promotion"
import { canonicalJson } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"

// Build-only, exact reviewed P08 source overlay; no database access.
async function main() {
  const directory = resolve(
    "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-07-premiere",
  )
  const read = async (name: string) => JSON.parse(await readFile(resolve(directory, name), "utf8"))
  const baseline = await read("baseline.json")
  const observation = await read("partner-source.json")
  const packet = buildPremiereReviewedPromotion(baseline, observation.source)
  const hash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex")
  const manifest = {
    version: "bondbuilder-reviewed-promotion-v1",
    reviewed_date: "2026-10-07",
    baseline_preimage_sha256: hash(baseline),
    source_sha256: hash(observation.source),
    original_profile_sha256:
      baseline.products[0].bundle.spec.research_profile.review.profile_sha256,
    decision_reference:
      "Nick 2026-10-07: Première also works without its matching shampoo; branded partner recommended, ordinary shampoo sequence retained.",
    items: [
      {
        research_key: "P08",
        product_id: packet.productId,
        profile_sha256: packet.profile.review.profile_sha256,
        artifact: "P08.json",
        artifact_sha256: hash(packet),
      },
    ],
  }
  for (const [name, value] of [
    ["P08.json", packet],
    ["manifest.json", manifest],
  ] as const) {
    const path = resolve(directory, name),
      body = JSON.stringify(value, null, 2) + "\n"
    try {
      if ((await readFile(path, "utf8")) !== body)
        throw new Error(`immutable_artifact_differs:${name}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      await writeFile(path, body, { flag: "wx" })
    }
  }
  console.log(JSON.stringify(manifest, null, 2))
}
void main()
