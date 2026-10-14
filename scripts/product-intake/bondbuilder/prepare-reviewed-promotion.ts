import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { buildBondbuilderReviewedPromotion } from "@/lib/product-intake/catalog-enrichment/bondbuilder-reviewed-promotion"
import { canonicalJson } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
  const output = resolve(
    root,
    "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06",
  )
  const baseline = JSON.parse(await readFile(resolve(output, "baseline.json"), "utf8"))
  const built = buildBondbuilderReviewedPromotion(baseline)
  async function writeImmutable(path: string, body: string) {
    try {
      const existing = await readFile(path, "utf8")
      if (existing !== body) throw new Error(`immutable_artifact_differs:${path}`)
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body, { flag: "wx" })
  }
  for (const item of built.items) {
    const path = resolve(output, `${item.researchKey}.json`)
    await writeImmutable(path, JSON.stringify(item, null, 2) + "\n")
  }
  const manifest = {
    version: built.version,
    reviewed_date: built.reviewedDate,
    baseline_preimage_sha256: built.preimageSha256,
    items: built.items.map((item) => ({
      research_key: item.researchKey,
      product_id: item.productId,
      profile_sha256: item.profile.review.profile_sha256,
      artifact: `${item.researchKey}.json`,
      artifact_sha256: createHash("sha256").update(canonicalJson(item)).digest("hex"),
    })),
  }
  await writeImmutable(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n")
}

void main()
