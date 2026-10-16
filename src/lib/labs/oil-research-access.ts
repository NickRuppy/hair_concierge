import "server-only"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import {
  OilResearchEnvelopeSchema,
  sha256Utf8,
  type OilResearchEnvelope,
} from "../oil-research/contracts"
import {
  readOilLabPackage,
  oilLabMatchingBlockers,
  oilLabReviewPropertyIds,
  type OilLabReviewPackage,
} from "../oil-research/lab-package"
import {
  readOilLabCandidatePackage,
  type OilLabCandidatePackage,
} from "../oil-research/candidate-package"
import { projectOilForProduction } from "../oil-research/production-adapter"
import {
  mutateOilReview,
  OIL_REVIEW_PROPERTY_IDS,
  readOilReviewState,
  type OilReviewSource,
} from "../oil-research/review-state"

export type OilLabDataset = "default" | "intake" | "candidate"
export type OilLabSource = OilReviewSource & {
  id: string
  dataset: OilLabDataset
  envelope: OilResearchEnvelope | null
  bundle?: OilLabReviewPackage
  candidate?: OilLabCandidatePackage
  filePath: string
  malformedPackage?: { fileName: string; diagnostic: string }
}
function candidateMatchingBlockers(candidate: OilLabCandidatePackage): string[] {
  const suggestions = candidate.matchingSuggestions
  const blockers: string[] = []
  if (
    !Array.isArray(suggestions.product_oil_eligibility) ||
    suggestions.product_oil_eligibility.length === 0
  )
    blockers.push("Matching-Zeilen fehlen")
  if (!Array.isArray(suggestions.suitable_thicknesses) || !suggestions.suitable_thicknesses.length)
    blockers.push("Haardicken-Vorschlag fehlt")
  return blockers
}
export const oilResearchReviewRequestSchema = z
  .object({
    dataset: z.enum(["default", "intake", "candidate"]),
    itemId: z.string().min(1).max(200),
    packageFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    reviewRevision: z.number().int().nonnegative(),
    action: z.enum(["approve_property", "request_rework", "approve_product"]),
    propertyPath: z.string().optional(),
    comment: z.string().max(4000).optional(),
  })
  .strict()
export function oilLabSources(dataset: OilLabDataset): OilLabSource[] {
  const root =
    dataset === "default"
      ? (process.env.OIL_RESEARCH_LAB_CORPUS_DIR ??
        join(process.cwd(), "data/research/oil-inci/v1.0/record-resolution-v0.1/envelopes"))
      : dataset === "intake"
        ? (process.env.OIL_RESEARCH_LAB_BUNDLE_DIR ??
          join(process.cwd(), ".local/oil-research-lab/bundles"))
        : (process.env.OIL_RESEARCH_LAB_CANDIDATE_DIR ??
          join(process.cwd(), "data/research/oil-inci/v1.0/eu-full-profiles-v0.1/bundles"))
  if ((dataset === "intake" || dataset === "candidate") && !existsSync(root)) return []
  const sources = readdirSync(root)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name): OilLabSource => {
      const filePath = join(root, name)
      try {
        const bundle = dataset === "intake" ? readOilLabPackage(filePath) : undefined
        const candidate = dataset === "candidate" ? readOilLabCandidatePackage(filePath) : undefined
        const body =
          bundle?.envelopeJson ?? candidate?.envelopeJson ?? readFileSync(filePath, "utf8")
        const envelope = OilResearchEnvelopeSchema.parse(JSON.parse(body))
        if (
          (dataset === "default" &&
            envelope.research_method.purpose !== "consolidation_serialization") ||
          (dataset === "intake" && envelope.research_method.purpose !== "intake_research")
        )
          throw new Error("Der Methodenstand passt nicht zum ausgewählten Öl-Datensatz.")
        const id =
          bundle?.packageFingerprint ??
          candidate?.packageFingerprint ??
          envelope.profile.product_key
        const packageFingerprint =
          bundle?.packageFingerprint ?? candidate?.packageFingerprint ?? sha256Utf8(body)
        const projection = projectOilForProduction(envelope)
        const blockers =
          projection.status === "property_projection_ready"
            ? []
            : [
                "Die drei Produkteigenschaften sind noch nicht vollständig ableitbar.",
                ...projection.issues,
              ]
        if (bundle) blockers.push(...oilLabMatchingBlockers(bundle))
        if (candidate) blockers.push(...candidateMatchingBlockers(candidate))
        return {
          id,
          key: `${dataset}:${id}`,
          dataset,
          envelope,
          bundle,
          candidate,
          packageFingerprint,
          filePath,
          blockers,
          requiredPropertyIds: bundle
            ? oilLabReviewPropertyIds(bundle)
            : OIL_REVIEW_PROPERTY_IDS.filter((id) => dataset === "candidate" || id !== "matching"),
        }
      } catch (error) {
        // The immutable corpus is one artifact: corruption there remains a hard failure.
        if (dataset === "default") throw error
        const id = `${dataset}-invalid-${sha256Utf8(name).slice(0, 16)}`
        return {
          id,
          key: `${dataset}:${id}`,
          dataset,
          envelope: null,
          packageFingerprint: sha256Utf8(name),
          filePath,
          blockers: [
            dataset === "intake"
              ? "Das Intake-Paket konnte nicht gelesen werden. Exportdatei prüfen oder neu erzeugen."
              : "Das lokale Forschungspaket konnte nicht gelesen werden. Quelldatei prüfen oder neu erzeugen.",
          ],
          requiredPropertyIds: [],
          malformedPackage: {
            fileName: name,
            diagnostic:
              dataset === "intake"
                ? "Ungültiges JSON oder ein unvollständiges Intake-Prüfpaket."
                : "Ungültiges JSON oder ein unvollständiges lokales Forschungspaket.",
          },
        }
      }
    })
  // Restoring a copy of the same content-addressed intake bundle does not create
  // another review revision. Keep one row; immutable corpus duplicates still fail.
  if (dataset === "intake" || dataset === "candidate") {
    const seen = new Set<string>()
    return sources.filter((source) => {
      if (seen.has(source.id)) return false
      seen.add(source.id)
      return true
    })
  }
  if (new Set(sources.map((source) => source.id)).size !== sources.length)
    throw new Error("Doppelte Öl-Prüfstände im Datensatz.")
  return sources
}
export function getOilLabSource(dataset: OilLabDataset, itemId: string) {
  const source = oilLabSources(dataset).find((entry) => entry.id === itemId)
  if (!source) throw new Error("Öl-Prüfstand nicht gefunden.")
  return source
}
export function getOilNativeReview(source: OilLabSource) {
  return readOilReviewState(source)
}
export async function reviewOilResearchItem(input: z.infer<typeof oilResearchReviewRequestSchema>) {
  return mutateOilReview({
    ...input,
    loadSource: () => getOilLabSource(input.dataset, input.itemId),
  })
}
