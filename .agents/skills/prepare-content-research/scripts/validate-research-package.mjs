import { existsSync, lstatSync, readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

export const SOURCE_TYPES = new Set([
  "repository_guidance",
  "repository_runtime",
  "repository_product_data",
  "external_scientific",
  "external_regulatory",
  "external_expert_guidance",
  "current_product_source",
  "synthesis",
  "unsupported",
])

const PACKAGE_STATUSES = new Set(["complete", "partial", "blocked"])
const CLAIM_IMPORTANCE_LEVELS = new Set(["primary", "supporting", "context"])
const SUPPORT_LEVELS = new Set([
  "direct",
  "supported_synthesis",
  "uncertain",
  "conflicted",
  "unsupported",
])
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low", "not_assessed"])
const CLAIM_VERIFICATION_STATUSES = new Set([
  "verified",
  "needs_review",
  "rejected",
  "blocked",
  "not_applicable",
])
const UNSUPPORTED_VERIFICATION_STATUSES = new Set(["rejected", "blocked"])
const VERIFICATION_STATUSES = new Set(["verified", "partial", "blocked"])
const SOURCE_POLICY_VERSION = "prepare-content-research-source-policy.v1"
const SOURCE_MANIFEST_VERSION = "prepare-content-research-source-manifest.v1"
const REPOSITORY_SOURCE_TYPES = new Set([
  "repository_guidance",
  "repository_runtime",
  "repository_product_data",
])
const EXTERNAL_SOURCE_TYPES = new Set([
  "external_scientific",
  "external_regulatory",
  "external_expert_guidance",
  "current_product_source",
])
const TOP_LEVEL_KEYS = new Set([
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
  "feedback",
  "persistence_skipped",
])

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function requiredString(value, label, errors) {
  if (typeof value !== "string" || value.trim().length === 0)
    errors.push(`${label} must be a non-empty string`)
}

function requiredArray(value, label, errors) {
  if (!Array.isArray(value)) errors.push(`${label} must be an array`)
}

function enumValue(value, allowed, label, errors) {
  if (!allowed.has(value)) errors.push(`${label} must be one of: ${[...allowed].join(", ")}`)
}

function exactKeys(value, allowed, label, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} contains unknown property: ${key}`)
  }
}

function uniqueArrayValues(value, label, errors) {
  if (!Array.isArray(value)) return
  const seen = new Set()
  for (const entry of value) {
    if (seen.has(entry)) errors.push(`${label} contains duplicate value: ${entry}`)
    seen.add(entry)
  }
}

function stringArrayItems(value, label, errors, { nonEmpty = false } = {}) {
  if (!Array.isArray(value)) return
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || (nonEmpty && entry.trim() === "")) {
      errors.push(`${label}[${index}] must be ${nonEmpty ? "a non-empty string" : "a string"}`)
    }
  }
}

function isValidRfc3339DateTime(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match || Number.isNaN(Date.parse(value))) return false
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const [year, month, day, hour, minute, second] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
  ].map(Number)
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= daysInMonth[month - 1]
}

/**
 * Validates the JSON research package independently of a JSON-schema runtime.
 * Returns actionable errors instead of throwing so callers can render a repair list.
 */
export function validateResearchPackage(packageData) {
  const errors = []
  if (!isObject(packageData)) return { valid: false, errors: ["package must be a JSON object"] }
  exactKeys(packageData, TOP_LEVEL_KEYS, "package", errors)

  for (const key of ["schema_version", "request_id", "created_at"])
    requiredString(packageData[key], key, errors)
  if (packageData.schema_version !== "prepare-content-research.v1") {
    errors.push("schema_version must be prepare-content-research.v1")
  }
  if (
    typeof packageData.created_at === "string" &&
    !isValidRfc3339DateTime(packageData.created_at)
  ) {
    errors.push("created_at must be an RFC 3339 date-time")
  }
  enumValue(packageData.status, PACKAGE_STATUSES, "status", errors)
  if (!isObject(packageData.research_scope)) errors.push("research_scope must be an object")
  if (!isObject(packageData.intake)) errors.push("intake must be an object")
  if (!isObject(packageData.repository)) {
    errors.push("repository must be an object")
  } else {
    exactKeys(
      packageData.repository,
      new Set(["commit_sha", "source_policy_version", "source_manifest_version"]),
      "repository",
      errors,
    )
    requiredString(packageData.repository.commit_sha, "repository.commit_sha", errors)
    requiredString(
      packageData.repository.source_policy_version,
      "repository.source_policy_version",
      errors,
    )
    requiredString(
      packageData.repository.source_manifest_version,
      "repository.source_manifest_version",
      errors,
    )
    if (packageData.repository.source_policy_version !== SOURCE_POLICY_VERSION) {
      errors.push(`repository.source_policy_version must be ${SOURCE_POLICY_VERSION}`)
    }
    if (packageData.repository.source_manifest_version !== SOURCE_MANIFEST_VERSION) {
      errors.push(`repository.source_manifest_version must be ${SOURCE_MANIFEST_VERSION}`)
    }
  }
  for (const key of [
    "findings",
    "claims",
    "sources",
    "material_gaps",
    "conflicts",
    "open_gaps",
    "do_not_claim",
  ])
    requiredArray(packageData[key], key, errors)

  const sourceIds = new Set()
  const sourceTypesById = new Map()
  if (Array.isArray(packageData.sources)) {
    for (const [index, source] of packageData.sources.entries()) {
      const label = `sources[${index}]`
      if (!isObject(source)) {
        errors.push(`${label} must be an object`)
        continue
      }
      exactKeys(
        source,
        new Set([
          "source_id",
          "source_type",
          "repo_path_or_url",
          "title",
          "accessed_at_or_commit",
          "relevant_sections",
        ]),
        label,
        errors,
      )
      for (const key of ["source_id", "repo_path_or_url", "title", "accessed_at_or_commit"])
        requiredString(source[key], `${label}.${key}`, errors)
      requiredArray(source.relevant_sections, `${label}.relevant_sections`, errors)
      stringArrayItems(source.relevant_sections, `${label}.relevant_sections`, errors)
      enumValue(source.source_type, SOURCE_TYPES, `${label}.source_type`, errors)
      if (sourceIds.has(source.source_id)) errors.push(`duplicate source_id: ${source.source_id}`)
      sourceIds.add(source.source_id)
      sourceTypesById.set(source.source_id, source.source_type)
    }
  }

  const externalSourceRefsFromResolvedGaps = new Set()
  if (Array.isArray(packageData.material_gaps)) {
    const gapIds = new Set()
    for (const [index, gap] of packageData.material_gaps.entries()) {
      const label = `material_gaps[${index}]`
      if (!isObject(gap)) {
        errors.push(`${label} must be an object`)
        continue
      }
      exactKeys(
        gap,
        new Set([
          "gap_id",
          "unsupported_question",
          "repo_sources_checked",
          "why_repo_is_insufficient",
          "required_external_source_type",
          "status",
          "external_source_refs",
        ]),
        label,
        errors,
      )
      for (const key of ["gap_id", "unsupported_question", "why_repo_is_insufficient"])
        requiredString(gap[key], `${label}.${key}`, errors)
      requiredArray(gap.repo_sources_checked, `${label}.repo_sources_checked`, errors)
      requiredArray(gap.external_source_refs, `${label}.external_source_refs`, errors)
      stringArrayItems(gap.repo_sources_checked, `${label}.repo_sources_checked`, errors, {
        nonEmpty: true,
      })
      stringArrayItems(gap.external_source_refs, `${label}.external_source_refs`, errors, {
        nonEmpty: true,
      })
      uniqueArrayValues(gap.repo_sources_checked, `${label}.repo_sources_checked`, errors)
      uniqueArrayValues(gap.external_source_refs, `${label}.external_source_refs`, errors)
      enumValue(
        gap.required_external_source_type,
        EXTERNAL_SOURCE_TYPES,
        `${label}.required_external_source_type`,
        errors,
      )
      enumValue(
        gap.status,
        new Set(["resolved", "unresolved", "blocked"]),
        `${label}.status`,
        errors,
      )
      if (gapIds.has(gap.gap_id)) errors.push(`duplicate gap_id: ${gap.gap_id}`)
      gapIds.add(gap.gap_id)
      if (Array.isArray(gap.repo_sources_checked)) {
        if (gap.repo_sources_checked.length === 0)
          errors.push(`${label}.repo_sources_checked requires at least one repository source`)
        for (const sourceRef of gap.repo_sources_checked) {
          if (!sourceIds.has(sourceRef))
            errors.push(`${label}.repo_sources_checked references unknown source_id: ${sourceRef}`)
          else if (!REPOSITORY_SOURCE_TYPES.has(sourceTypesById.get(sourceRef)))
            errors.push(
              `${label}.repo_sources_checked must reference repository sources: ${sourceRef}`,
            )
        }
      }
      if (Array.isArray(gap.external_source_refs)) {
        for (const sourceRef of gap.external_source_refs) {
          if (gap.status === "resolved") externalSourceRefsFromResolvedGaps.add(sourceRef)
          if (!sourceIds.has(sourceRef))
            errors.push(`${label}.external_source_refs references unknown source_id: ${sourceRef}`)
          else if (!EXTERNAL_SOURCE_TYPES.has(sourceTypesById.get(sourceRef)))
            errors.push(
              `${label}.external_source_refs must reference external sources: ${sourceRef}`,
            )
        }
        if (gap.status === "resolved" && gap.external_source_refs.length === 0) {
          errors.push(`${label} status resolved requires at least one external_source_refs entry`)
        }
        if (
          gap.status === "resolved" &&
          !gap.external_source_refs.some(
            (sourceRef) => sourceTypesById.get(sourceRef) === gap.required_external_source_type,
          )
        ) {
          errors.push(
            `${label} resolved gap requires a ${gap.required_external_source_type} source`,
          )
        }
      }
    }
  }

  const claimIds = new Set()
  const claimsById = new Map()
  if (Array.isArray(packageData.claims)) {
    for (const [index, claim] of packageData.claims.entries()) {
      const label = `claims[${index}]`
      if (!isObject(claim)) {
        errors.push(`${label} must be an object`)
        continue
      }
      exactKeys(
        claim,
        new Set([
          "claim_id",
          "statement",
          "importance",
          "source_type",
          "source_refs",
          "support_level",
          "confidence",
          "limitations",
          "verification_status",
        ]),
        label,
        errors,
      )
      for (const key of ["claim_id", "statement"])
        requiredString(claim[key], `${label}.${key}`, errors)
      enumValue(claim.importance, CLAIM_IMPORTANCE_LEVELS, `${label}.importance`, errors)
      enumValue(claim.source_type, SOURCE_TYPES, `${label}.source_type`, errors)
      enumValue(claim.support_level, SUPPORT_LEVELS, `${label}.support_level`, errors)
      enumValue(claim.confidence, CONFIDENCE_LEVELS, `${label}.confidence`, errors)
      enumValue(
        claim.verification_status,
        CLAIM_VERIFICATION_STATUSES,
        `${label}.verification_status`,
        errors,
      )
      requiredArray(claim.source_refs, `${label}.source_refs`, errors)
      requiredArray(claim.limitations, `${label}.limitations`, errors)
      stringArrayItems(claim.source_refs, `${label}.source_refs`, errors, { nonEmpty: true })
      stringArrayItems(claim.limitations, `${label}.limitations`, errors)
      if (claimIds.has(claim.claim_id)) errors.push(`duplicate claim_id: ${claim.claim_id}`)
      claimIds.add(claim.claim_id)
      claimsById.set(claim.claim_id, claim)
      const explicitlyUnsupported =
        claim.source_type === "unsupported" || claim.support_level === "unsupported"
      if (
        !explicitlyUnsupported &&
        (!Array.isArray(claim.source_refs) || claim.source_refs.length === 0)
      ) {
        errors.push(
          `${label} requires at least one source_refs entry unless explicitly unsupported`,
        )
      }
      if (
        explicitlyUnsupported &&
        (!UNSUPPORTED_VERIFICATION_STATUSES.has(claim.verification_status) ||
          claim.support_level !== "unsupported" ||
          claim.source_type !== "unsupported")
      ) {
        errors.push(`${label} is unsupported and cannot be presented as approved`)
      }
      if (Array.isArray(claim.source_refs)) {
        for (const sourceRef of claim.source_refs) {
          if (!sourceIds.has(sourceRef))
            errors.push(`${label} references unknown source_id: ${sourceRef}`)
          else if (
            claim.source_type !== "synthesis" &&
            claim.source_type !== "unsupported" &&
            sourceTypesById.get(sourceRef) !== claim.source_type
          ) {
            errors.push(
              `${label} source_type ${claim.source_type} does not match referenced source type ${sourceTypesById.get(sourceRef)}`,
            )
          }
          if (
            EXTERNAL_SOURCE_TYPES.has(sourceTypesById.get(sourceRef)) &&
            !externalSourceRefsFromResolvedGaps.has(sourceRef)
          ) {
            errors.push(
              `${label} external source is not linked through material_gaps: ${sourceRef}`,
            )
          }
        }
      }
    }
  }

  if (Array.isArray(packageData.findings)) {
    const findingIds = new Set()
    for (const [index, claimId] of packageData.findings.entries()) {
      const label = `findings[${index}]`
      requiredString(claimId, label, errors)
      if (findingIds.has(claimId)) errors.push(`duplicate finding claim_id: ${claimId}`)
      findingIds.add(claimId)
      const claim = claimsById.get(claimId)
      if (!claim) {
        errors.push(`${label} references unknown claim_id: ${claimId}`)
      } else if (claim.source_type === "unsupported" || claim.support_level === "unsupported") {
        errors.push(`${label} cannot reference an unsupported claim: ${claimId}`)
      } else if (claim.verification_status !== "verified") {
        errors.push(`${label} must reference a verified claim: ${claimId}`)
      }
    }
  }

  const verification = packageData.verification
  if (!isObject(verification)) {
    errors.push("verification must be an object")
  } else {
    exactKeys(
      verification,
      new Set(["status", "checked_claim_ids", "blockers", "warnings"]),
      "verification",
      errors,
    )
    enumValue(verification.status, VERIFICATION_STATUSES, "verification.status", errors)
    requiredArray(verification.checked_claim_ids, "verification.checked_claim_ids", errors)
    requiredArray(verification.blockers, "verification.blockers", errors)
    stringArrayItems(verification.checked_claim_ids, "verification.checked_claim_ids", errors, {
      nonEmpty: true,
    })
    stringArrayItems(verification.blockers, "verification.blockers", errors)
    if (verification.warnings !== undefined) {
      requiredArray(verification.warnings, "verification.warnings", errors)
      stringArrayItems(verification.warnings, "verification.warnings", errors)
    }
    if (Array.isArray(verification.checked_claim_ids)) {
      const checkedIds = new Set()
      for (const claimId of verification.checked_claim_ids) {
        if (checkedIds.has(claimId))
          errors.push(`verification.checked_claim_ids contains duplicate claim_id: ${claimId}`)
        checkedIds.add(claimId)
        if (!claimIds.has(claimId))
          errors.push(`verification.checked_claim_ids references unknown claim_id: ${claimId}`)
      }
      if (Array.isArray(packageData.findings)) {
        for (const findingId of packageData.findings) {
          if (!checkedIds.has(findingId)) {
            errors.push(
              `finding claim_id must be included in verification.checked_claim_ids: ${findingId}`,
            )
          }
        }
      }
    }
    if (
      verification.status === "verified" &&
      Array.isArray(verification.blockers) &&
      verification.blockers.length > 0
    ) {
      errors.push("verification.status verified cannot include blockers")
    }
    if (
      verification.status === "blocked" &&
      Array.isArray(verification.blockers) &&
      verification.blockers.length === 0
    ) {
      errors.push("verification.status blocked requires at least one blocker")
    }
    if (packageData.status === "complete" && verification.status !== "verified") {
      errors.push("status complete requires verification.status verified")
    }
    if (packageData.status === "complete" && Array.isArray(packageData.material_gaps)) {
      for (const gap of packageData.material_gaps) {
        if (isObject(gap) && gap.status !== "resolved") {
          errors.push(`status complete cannot include unresolved material gap: ${gap.gap_id}`)
        }
      }
    }
    if (packageData.status === "complete" && Array.isArray(packageData.claims)) {
      for (const claim of packageData.claims) {
        if (isObject(claim) && ["needs_review", "blocked"].includes(claim.verification_status)) {
          errors.push(
            `status complete cannot include outstanding claim verification: ${claim.claim_id}`,
          )
        }
      }
    }
    if (packageData.status === "partial" && verification.status !== "partial") {
      errors.push("status partial requires verification.status partial")
    }
    if (packageData.status === "blocked" && verification.status !== "blocked") {
      errors.push("status blocked requires verification.status blocked")
    }
  }

  if (packageData.feedback !== undefined) {
    if (!isObject(packageData.feedback)) {
      errors.push("feedback must be an object")
    } else {
      exactKeys(
        packageData.feedback,
        new Set(["operator_notes", "downstream_corrections"]),
        "feedback",
        errors,
      )
      if (
        packageData.feedback.operator_notes !== undefined &&
        typeof packageData.feedback.operator_notes !== "string"
      ) {
        errors.push("feedback.operator_notes must be a string")
      }
      if (packageData.feedback.downstream_corrections !== undefined)
        requiredArray(
          packageData.feedback.downstream_corrections,
          "feedback.downstream_corrections",
          errors,
        )
    }
  }

  if (packageData.persistence_skipped !== undefined) {
    if (!isObject(packageData.persistence_skipped)) {
      errors.push("persistence_skipped must be an object")
    } else {
      exactKeys(
        packageData.persistence_skipped,
        new Set(["reason", "intended_path"]),
        "persistence_skipped",
        errors,
      )
      requiredString(packageData.persistence_skipped.reason, "persistence_skipped.reason", errors)
      requiredString(
        packageData.persistence_skipped.intended_path,
        "persistence_skipped.intended_path",
        errors,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a proposed request folder before the workflow writes output. It does
 * not create or overwrite anything, allowing callers to choose a suffix instead.
 */
export function validateOutputPath(
  outputPath,
  { exists = existsSync, allowedRoot = path.resolve("content-research") } = {},
) {
  if (typeof outputPath !== "string" || outputPath.trim() === "")
    return { valid: false, errors: ["output path must be a non-empty string"] }
  if ([".", ".."].includes(outputPath.trim()))
    return { valid: false, errors: ["output path must name a new request folder"] }
  const normalized = path.resolve(outputPath)
  const normalizedRoot = path.resolve(allowedRoot)
  if (normalized === path.parse(normalized).root || normalized === normalizedRoot) {
    return {
      valid: false,
      errors: ["output path must name a request folder, not a filesystem root"],
    }
  }
  if (!normalized.startsWith(`${normalizedRoot}${path.sep}`)) {
    return {
      valid: false,
      errors: [`output path must be a new request folder inside ${normalizedRoot}`],
    }
  }
  const relativeParent = path.relative(normalizedRoot, path.dirname(normalized))
  const pathComponents = relativeParent === "" ? [] : relativeParent.split(path.sep)
  let existingComponent = normalizedRoot
  for (const component of ["", ...pathComponents]) {
    if (component !== "") existingComponent = path.join(existingComponent, component)
    if (!exists(existingComponent)) break
    const componentStat = lstatSync(existingComponent)
    if (componentStat.isSymbolicLink()) {
      return {
        valid: false,
        errors: [`output path cannot traverse symlinked component: ${existingComponent}`],
      }
    }
    if (!componentStat.isDirectory()) {
      return {
        valid: false,
        errors: [`output path parent component is not a directory: ${existingComponent}`],
      }
    }
  }
  if (exists(normalized))
    return {
      valid: false,
      errors: [`output path collision: ${normalized}; choose a timestamped or incremented folder`],
    }
  return { valid: true, errors: [], path: normalized }
}

function runCli() {
  const [packagePath, flag, outputPath] = process.argv.slice(2)
  if (!packagePath) {
    console.error(
      "Usage: validate-research-package.mjs <package.json|-> [--output-path <new-request-folder>]",
    )
    process.exitCode = 2
    return
  }
  let packageData
  try {
    packageData = JSON.parse(readFileSync(packagePath === "-" ? 0 : packagePath, "utf8"))
  } catch (error) {
    console.error(
      `Could not read JSON package ${packagePath === "-" ? "from stdin" : packagePath}: ${error.message}`,
    )
    process.exitCode = 2
    return
  }
  const result = validateResearchPackage(packageData)
  if (flag !== undefined && flag !== "--output-path") result.errors.push(`unknown option: ${flag}`)
  if (flag === "--output-path") {
    if (!outputPath) result.errors.push("--output-path requires a request folder")
    else result.errors.push(...validateOutputPath(outputPath).errors)
  }
  if (!result.valid || result.errors.length > 0) {
    for (const error of result.errors) console.error(`Invalid research package: ${error}`)
    process.exitCode = 1
    return
  }
  console.log(`Research package valid: ${packagePath}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli()
