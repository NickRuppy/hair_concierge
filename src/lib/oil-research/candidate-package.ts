import { readFileSync } from "node:fs"

import { z } from "zod"

import { OIL_INGREDIENT_FLAGS, OIL_PURPOSES, OIL_SUBTYPES } from "@/lib/oil/constants"
import { HAIR_THICKNESSES } from "@/lib/vocabulary"
import { OilResearchEnvelopeSchema, sha256Utf8, type OilResearchEnvelope } from "./contracts"

const Text = z.string().refine((value) => value.trim().length > 0, "Expected nonblank text")
const Digest = z.string().regex(/^[a-f0-9]{64}$/)

const MatchingSuggestionSchema = z
  .object({
    product_oil_eligibility: z.array(
      z
        .object({
          thickness: z.enum(HAIR_THICKNESSES),
          oil_subtype: z.enum(OIL_SUBTYPES),
          oil_purpose: z.enum(OIL_PURPOSES).nullable(),
          ingredient_flags: z.array(z.enum(OIL_INGREDIENT_FLAGS)),
        })
        .strict(),
    ),
    suitable_thicknesses: z.array(z.enum(HAIR_THICKNESSES)),
    field_rationales: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const SourceManifestSchema = z
  .object({
    records: z
      .array(z.object({ path: Text, sha256: Digest }).strict())
      .min(1, "Candidate source manifest requires at least one record"),
  })
  .strict()

const CandidatePackageSchema = z
  .object({
    version: z.literal("oil-lab-candidate-bundle-v1"),
    packageFingerprint: Digest,
    envelopeJson: Text,
    matchingSuggestions: MatchingSuggestionSchema,
    sourceManifest: SourceManifestSchema,
  })
  .strict()

export type OilLabMatchingSuggestions = z.infer<typeof MatchingSuggestionSchema>
export type OilLabCandidateSourceManifest = z.infer<typeof SourceManifestSchema>
export type OilLabCandidatePackage = z.infer<typeof CandidatePackageSchema>

type CandidatePackageBody = Omit<OilLabCandidatePackage, "packageFingerprint">

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalJson(record[key])]),
    )
  }
  return value
}

function candidateFingerprint(bundle: CandidatePackageBody): string {
  return sha256Utf8(JSON.stringify(canonicalJson(bundle)))
}

function assertLocalCandidateEnvelope(envelope: OilResearchEnvelope): void {
  if (
    envelope.research_method.purpose !== "local_research" ||
    envelope.provenance.import_kind !== "local" ||
    envelope.submission_id !== null
  )
    throw new Error("Oil candidate package requires local v0.9 research without an Intake binding")
}

export function parseOilLabCandidatePackage(input: unknown): OilLabCandidatePackage {
  const value = CandidatePackageSchema.parse(input)
  const { packageFingerprint, ...body } = value
  if (packageFingerprint !== candidateFingerprint(body))
    throw new Error("Oil candidate package fingerprint mismatch")

  let parsedEnvelope: unknown
  try {
    parsedEnvelope = JSON.parse(value.envelopeJson)
  } catch {
    throw new Error("Oil candidate package envelope is not JSON")
  }
  assertLocalCandidateEnvelope(OilResearchEnvelopeSchema.parse(parsedEnvelope))
  return structuredClone(value)
}

export function readOilLabCandidatePackage(path: string): OilLabCandidatePackage {
  return parseOilLabCandidatePackage(JSON.parse(readFileSync(path, "utf8")))
}

export function createOilLabCandidatePackage(input: {
  envelope: OilResearchEnvelope
  matchingSuggestions: OilLabMatchingSuggestions
  sourceManifest: OilLabCandidateSourceManifest
}): OilLabCandidatePackage {
  const envelope = OilResearchEnvelopeSchema.parse(input.envelope)
  assertLocalCandidateEnvelope(envelope)
  const body: CandidatePackageBody = {
    version: "oil-lab-candidate-bundle-v1",
    envelopeJson: JSON.stringify(envelope),
    matchingSuggestions: MatchingSuggestionSchema.parse(input.matchingSuggestions),
    sourceManifest: SourceManifestSchema.parse(input.sourceManifest),
  }
  return parseOilLabCandidatePackage({
    ...body,
    packageFingerprint: candidateFingerprint(body),
  })
}
