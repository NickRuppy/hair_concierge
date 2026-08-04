import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  AGENT_V2_GUIDANCE_PACKAGE_IDS,
  getAgentV2GuidancePackageEntry,
} from "../src/lib/agent-v2/guidance/package-index"

const skillRoot = ".agents/skills/prepare-content-research"
const schemaPath = `${skillRoot}/assets/research-package.schema.json`
const validatorPath = `${skillRoot}/scripts/validate-research-package.mjs`
const fixtureRoot = "tests/fixtures/prepare-content-research"

async function loadValidator() {
  return import(`../${validatorPath}`)
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>
}

test("prepare-content-research is explicitly invoked and remains research-only", () => {
  const skill = readFileSync(`${skillRoot}/SKILL.md`, "utf8")
  const metadata = readFileSync(`${skillRoot}/agents/openai.yaml`, "utf8")

  assert.match(metadata, /default_prompt:.*\$prepare-content-research/)
  assert.match(metadata, /allow_implicit_invocation:\s*false/)
  assert.match(skill, /(?:no|never|do not).*script/i)
  assert.match(skill, /(?:no|never|do not).*(?:video generation|video prompt|visuals|hooks|CTA)/i)
  assert.match(skill, /ask at most four intake questions/i)
})

test("source manifest maps each AgentV2 package exactly once and only to exact existing paths", () => {
  const manifestPath = `${skillRoot}/references/source-manifest.json`
  assert.ok(existsSync(manifestPath), "source manifest must exist")
  const manifest = readJson(manifestPath) as {
    schema_version?: unknown
    package_index?: unknown
    guidance_root?: unknown
    base_by_purpose?: unknown
    packages?: Record<string, { markdown_path?: unknown; metadata_path?: unknown; route?: unknown }>
    conditional_sources?: {
      runtime_behavior_claims?: { paths?: unknown[] }
      named_product_claims?: { paths?: unknown[] }
      audit_only_sources?: unknown[]
    }
    excluded_primary_sources?: unknown
  }
  assert.equal(typeof manifest.schema_version, "string")
  assert.equal(manifest.package_index, "src/lib/agent-v2/guidance/package-index.ts")
  assert.equal(manifest.guidance_root, "data/agent-v2/guidance")
  assert.ok(manifest.base_by_purpose && typeof manifest.base_by_purpose === "object")
  assert.ok(manifest.conditional_sources && typeof manifest.conditional_sources === "object")
  assert.ok(Array.isArray(manifest.excluded_primary_sources))
  assert.deepEqual(
    Object.keys(manifest.packages ?? {}).sort(),
    [...AGENT_V2_GUIDANCE_PACKAGE_IDS].sort(),
  )

  for (const packageId of AGENT_V2_GUIDANCE_PACKAGE_IDS) {
    const entry = getAgentV2GuidancePackageEntry(packageId)
    const route = manifest.packages?.[packageId]
    assert.ok(entry, `missing package index entry for ${packageId}`)
    assert.ok(route, `missing manifest route for ${packageId}`)
    assert.equal(route.markdown_path, entry.markdownPath)
    assert.equal(route.metadata_path, entry.metadataPath)
    assert.equal(typeof route.route, "string")
    assert.ok(existsSync(route.markdown_path as string), `missing Markdown source for ${packageId}`)
    assert.ok(existsSync(route.metadata_path as string), `missing metadata source for ${packageId}`)
  }

  const primaryRoutes = Object.values(manifest.packages ?? {})
  assert.doesNotMatch(
    JSON.stringify(primaryRoutes),
    /(?:\*\*|data\/agent-guidance|plans\/|docs\/archive\/|src\/)/,
  )
  const exclusions = JSON.stringify(manifest.excluded_primary_sources)
  for (const excludedSurface of ["plans/", "docs/archive/", "data/agent-guidance/", "src/"]) {
    assert.match(exclusions, new RegExp(excludedSurface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  const conditionalPaths = [
    ...(manifest.conditional_sources?.runtime_behavior_claims?.paths ?? []),
    ...(manifest.conditional_sources?.named_product_claims?.paths ?? []),
    ...(manifest.conditional_sources?.audit_only_sources ?? []),
  ]
  for (const conditionalPath of conditionalPaths) {
    assert.equal(typeof conditionalPath, "string")
    assert.doesNotMatch(
      conditionalPath as string,
      /[*?{}]/,
      `conditional path must be exact: ${conditionalPath}`,
    )
    assert.ok(
      existsSync(conditionalPath as string),
      `missing conditional source: ${conditionalPath}`,
    )
  }
})

test("research package schema declares the required provenance contract", () => {
  const schema = readJson(schemaPath) as {
    required?: string[]
    properties?: Record<string, { required?: string[] }>
    $defs?: Record<
      string,
      {
        enum?: string[]
        required?: string[]
        properties?: Record<string, { enum?: string[] }>
      }
    >
  }
  for (const field of [
    "schema_version",
    "request_id",
    "status",
    "created_at",
    "research_scope",
    "intake",
    "repository",
    "findings",
    "claims",
    "sources",
    "material_gaps",
    "conflicts",
    "open_gaps",
    "do_not_claim",
    "verification",
  ]) {
    assert.ok(schema.required?.includes(field), `schema must require ${field}`)
  }
  for (const sourceType of [
    "repository_guidance",
    "repository_runtime",
    "repository_product_data",
    "external_scientific",
    "external_regulatory",
    "external_expert_guidance",
    "current_product_source",
    "synthesis",
    "unsupported",
  ]) {
    assert.ok(
      schema.$defs?.sourceType?.enum?.includes(sourceType),
      `schema must permit ${sourceType}`,
    )
  }
  for (const field of [
    "claim_id",
    "statement",
    "importance",
    "source_type",
    "source_refs",
    "support_level",
    "confidence",
    "limitations",
    "verification_status",
  ]) {
    assert.ok(schema.$defs?.claim?.required?.includes(field), `claim must require ${field}`)
  }
  assert.ok(schema.$defs?.claim?.properties?.verification_status?.enum?.includes("rejected"))
  for (const field of ["commit_sha", "source_policy_version", "source_manifest_version"]) {
    assert.ok(
      schema.properties?.repository?.required?.includes(field),
      `repository must require ${field}`,
    )
  }
})

test("validator accepts valid package and rejects provenance and verification failures", async () => {
  const { validateResearchPackage } = await loadValidator()
  assert.deepEqual(validateResearchPackage(readJson(`${fixtureRoot}/valid-package.json`)), {
    valid: true,
    errors: [],
  })

  const invalidCases: Array<[string, RegExp]> = [
    ["missing-citation.json", /requires at least one source_refs/],
    ["duplicate-ids.json", /duplicate (?:claim|source)_id/],
    ["unsupported-as-approved.json", /unsupported and cannot be presented as approved/],
    ["invalid-verification.json", /verified cannot include blockers/],
    ["unknown-source-ref.json", /unknown source_id/],
  ]
  for (const [fixture, expected] of invalidCases) {
    const result = validateResearchPackage(readJson(`${fixtureRoot}/${fixture}`))
    assert.equal(result.valid, false, fixture)
    assert.match(result.errors.join("\n"), expected, fixture)
  }

  const blendedSourceTypes = readJson(`${fixtureRoot}/valid-package.json`)
  ;(blendedSourceTypes.claims as Array<Record<string, unknown>>)[0].source_type =
    "external_scientific"
  const blendedResult = validateResearchPackage(blendedSourceTypes)
  assert.equal(blendedResult.valid, false)
  assert.match(blendedResult.errors.join("\n"), /does not match referenced source type/)

  const unsupportedFinding = readJson(`${fixtureRoot}/unsupported-as-approved.json`)
  unsupportedFinding.findings = ["claim.one"]
  ;(unsupportedFinding.claims as Array<Record<string, unknown>>)[0].verification_status = "rejected"
  const unsupportedFindingResult = validateResearchPackage(unsupportedFinding)
  assert.equal(unsupportedFindingResult.valid, false)
  assert.match(unsupportedFindingResult.errors.join("\n"), /cannot reference an unsupported claim/)

  const ungatedExternalClaim = readJson(`${fixtureRoot}/valid-package.json`)
  ;(ungatedExternalClaim.sources as Array<Record<string, unknown>>).push({
    source_id: "source.external",
    source_type: "external_scientific",
    repo_path_or_url: "https://example.invalid/study",
    title: "External study",
    accessed_at_or_commit: "2026-08-04",
    relevant_sections: ["Results"],
  })
  ;(ungatedExternalClaim.claims as Array<Record<string, unknown>>).push({
    claim_id: "claim.external",
    statement: "An external claim.",
    importance: "supporting",
    source_type: "external_scientific",
    source_refs: ["source.external"],
    support_level: "direct",
    confidence: "medium",
    limitations: [],
    verification_status: "verified",
  })
  ;(ungatedExternalClaim.verification as Record<string, unknown>).checked_claim_ids = [
    "claim.scalp-first",
    "claim.external",
  ]
  const ungatedExternalResult = validateResearchPackage(ungatedExternalClaim)
  assert.equal(ungatedExternalResult.valid, false)
  assert.match(ungatedExternalResult.errors.join("\n"), /not linked through material_gaps/)

  ungatedExternalClaim.material_gaps = [
    {
      gap_id: "gap.external",
      unsupported_question: "What does current external evidence establish?",
      repo_sources_checked: ["source.shampoo-guidance"],
      why_repo_is_insufficient: "Repository guidance does not contain the scientific result.",
      required_external_source_type: "external_scientific",
      status: "resolved",
      external_source_refs: ["source.external"],
    },
  ]
  assert.deepEqual(validateResearchPackage(ungatedExternalClaim), { valid: true, errors: [] })
  ;(ungatedExternalClaim.material_gaps as Array<Record<string, unknown>>)[0].status = "blocked"
  const blockedGapResult = validateResearchPackage(ungatedExternalClaim)
  assert.equal(blockedGapResult.valid, false)
  assert.match(blockedGapResult.errors.join("\n"), /not linked through material_gaps/)

  const invalidImportance = readJson(`${fixtureRoot}/valid-package.json`)
  ;(invalidImportance.claims as Array<Record<string, unknown>>)[0].importance = "banana"
  assert.match(
    validateResearchPackage(invalidImportance).errors.join("\n"),
    /claims\[0\]\.importance must be one of/,
  )

  const invalidDate = readJson(`${fixtureRoot}/valid-package.json`)
  invalidDate.created_at = "not-a-date"
  assert.match(validateResearchPackage(invalidDate).errors.join("\n"), /RFC 3339 date-time/)
  invalidDate.created_at = "2026-02-30T10:00:00Z"
  assert.match(validateResearchPackage(invalidDate).errors.join("\n"), /RFC 3339 date-time/)
  invalidDate.created_at = "2025-02-29T10:00:00Z"
  assert.match(validateResearchPackage(invalidDate).errors.join("\n"), /RFC 3339 date-time/)
  invalidDate.created_at = "2024-02-29T10:00:00Z"
  assert.equal(validateResearchPackage(invalidDate).valid, true)

  const unknownProperty = readJson(`${fixtureRoot}/valid-package.json`)
  unknownProperty.verifcation = {}
  assert.match(
    validateResearchPackage(unknownProperty).errors.join("\n"),
    /package contains unknown property: verifcation/,
  )
  delete unknownProperty.verifcation
  ;(unknownProperty.claims as Array<Record<string, unknown>>)[0].unexpected = true
  assert.match(
    validateResearchPackage(unknownProperty).errors.join("\n"),
    /claims\[0\] contains unknown property: unexpected/,
  )

  const uncheckedFinding = readJson(`${fixtureRoot}/valid-package.json`)
  ;(uncheckedFinding.claims as Array<Record<string, unknown>>)[0].verification_status =
    "needs_review"
  assert.match(
    validateResearchPackage(uncheckedFinding).errors.join("\n"),
    /must reference a verified claim/,
  )

  const unknownFinding = readJson(`${fixtureRoot}/valid-package.json`)
  unknownFinding.findings = ["claim.absent"]
  assert.match(
    validateResearchPackage(unknownFinding).errors.join("\n"),
    /references unknown claim_id/,
  )

  const invalidPartial = readJson(`${fixtureRoot}/valid-package.json`)
  invalidPartial.status = "partial"
  assert.match(
    validateResearchPackage(invalidPartial).errors.join("\n"),
    /status partial requires verification.status partial/,
  )

  const invalidPersistenceFallback = readJson(`${fixtureRoot}/valid-package.json`)
  invalidPersistenceFallback.persistence_skipped = { reason: "Read-only run" }
  assert.match(
    validateResearchPackage(invalidPersistenceFallback).errors.join("\n"),
    /persistence_skipped.intended_path must be a non-empty string/,
  )

  const unresolvedComplete = readJson(`${fixtureRoot}/valid-package.json`)
  unresolvedComplete.material_gaps = [
    {
      gap_id: "gap.blocked",
      unsupported_question: "What external evidence is required?",
      repo_sources_checked: ["source.shampoo-guidance"],
      why_repo_is_insufficient: "The repository does not answer the question.",
      required_external_source_type: "external_scientific",
      status: "blocked",
      external_source_refs: [],
    },
  ]
  assert.match(
    validateResearchPackage(unresolvedComplete).errors.join("\n"),
    /status complete cannot include unresolved material gap/,
  )

  const outstandingComplete = readJson(`${fixtureRoot}/valid-package.json`)
  outstandingComplete.findings = []
  ;(outstandingComplete.claims as Array<Record<string, unknown>>)[0].verification_status =
    "needs_review"
  assert.match(
    validateResearchPackage(outstandingComplete).errors.join("\n"),
    /status complete cannot include outstanding claim verification/,
  )
})

test("validator exposes collision-safe output path validation without writing packages", async () => {
  const { validateOutputPath } = await loadValidator()
  const directory = mkdtempSync(path.join(tmpdir(), "prepare-content-research-"))
  const externalDirectory = mkdtempSync(path.join(tmpdir(), "prepare-content-research-external-"))
  const collision = path.join(directory, "existing-request")
  const symlink = path.join(directory, "linked-outside")
  writeFileSync(collision, "already saved")
  symlinkSync(externalDirectory, symlink, "dir")
  const pathOptions = { allowedRoot: directory }
  try {
    assert.equal(validateOutputPath(collision, pathOptions).valid, false)
    assert.match(
      validateOutputPath(collision, pathOptions).errors.join("\n"),
      /output path collision/,
    )
    assert.equal(validateOutputPath(path.join(directory, "new-request"), pathOptions).valid, true)
    assert.equal(
      validateOutputPath(path.join(tmpdir(), "outside-request"), pathOptions).valid,
      false,
    )
    assert.match(
      validateOutputPath(path.join(symlink, "new-request"), pathOptions).errors.join("\n"),
      /cannot traverse symlinked component/,
    )
    assert.equal(validateOutputPath(".").valid, false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
    rmSync(externalDirectory, { recursive: true, force: true })
  }
})

test("validator CLI gives nonzero actionable failures and accepts valid fixture", () => {
  const valid = spawnSync("node", [validatorPath, `${fixtureRoot}/valid-package.json`], {
    encoding: "utf8",
  })
  assert.equal(valid.status, 0, valid.stderr)
  assert.match(valid.stdout, /Research package valid/)

  const stdin = spawnSync("node", [validatorPath, "-"], {
    encoding: "utf8",
    input: readFileSync(`${fixtureRoot}/valid-package.json`, "utf8"),
  })
  assert.equal(stdin.status, 0, stdin.stderr)
  assert.match(stdin.stdout, /Research package valid: -/)

  const invalid = spawnSync("node", [validatorPath, `${fixtureRoot}/unknown-source-ref.json`], {
    encoding: "utf8",
  })
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stderr, /unknown source_id/)
})
