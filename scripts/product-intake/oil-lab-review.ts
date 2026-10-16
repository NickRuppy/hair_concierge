import { randomUUID } from "node:crypto"
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadProductIntakeSubmissionDetail } from "../../packages/product-intake-core/src/repository"
import {
  buildOilLabReviewPackage,
  readOilLabPackage,
  type OilLabReviewPackage,
} from "@/lib/oil-research/lab-package"
import { stableOilReviewJson } from "@chaarlie/product-intake-core"
import { withOilReviewHandoff, type OilLabReviewReceipt } from "@/lib/oil-research/review-state"
import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"

type Client = Pick<SupabaseClient, "rpc" | "from">
export const OIL_LAB_IMPORT_RPC = "product_intake_import_oil_lab_review"
export const OIL_LAB_READBACK_RPC = "product_intake_get_oil_lab_handoff"
export function oilLabBundleDirectory(): string {
  return (
    process.env.OIL_RESEARCH_LAB_BUNDLE_DIR ??
    join(process.cwd(), ".local/oil-research-lab/bundles")
  )
}

/** Writes an immutable local review package. All remote operations are SELECTs. */
export async function exportOilLabReview(input: {
  client: Client
  submissionId: string
  directory?: string
}) {
  const detail = await loadProductIntakeSubmissionDetail(input.client, input.submissionId)
  if (!detail) throw new Error("Oil intake submission not found")
  const bundle = buildOilLabReviewPackage(detail)
  const directory = input.directory ?? oilLabBundleDirectory()
  mkdirSync(directory, { recursive: true })
  const path = join(
    directory,
    `${bundle.intakeReviewSnapshot.submissionId}-${bundle.packageFingerprint}.json`,
  )
  const serialized = JSON.stringify(bundle, null, 2) + "\n"
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== serialized)
      throw new Error("Immutable oil Lab package path has different content")
  } else {
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, serialized, { flag: "wx", mode: 0o600 })
      const file = openSync(temporary, "r")
      try {
        fsyncSync(file)
      } finally {
        closeSync(file)
      }
      // Linking publishes a complete file atomically and never replaces another revision.
      try {
        linkSync(temporary, path)
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== "EEXIST" ||
          readFileSync(path, "utf8") !== serialized
        )
          throw error
      }
      const directoryFd = openSync(directory, "r")
      try {
        fsyncSync(directoryFd)
      } finally {
        closeSync(directoryFd)
      }
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary)
    }
  }
  return {
    path,
    packageFingerprint: bundle.packageFingerprint,
    snapshotFingerprint: bundle.snapshotFingerprint,
  }
}
function matchesReceipt(result: unknown, receipt: OilLabReviewReceipt): boolean {
  const row = Array.isArray(result) ? result[0] : result
  if (!row || typeof row !== "object") return false
  const value = row as Record<string, unknown>
  return (
    value.receipt_id === receipt.receiptId &&
    value.package_fingerprint === receipt.packageFingerprint &&
    value.snapshot_fingerprint === receipt.snapshotFingerprint &&
    value.review_revision === receipt.reviewRevision
  )
}
async function readback(
  client: Client,
  bundle: OilLabReviewPackage,
  receipt: OilLabReviewReceipt,
): Promise<unknown> {
  const result = await client.rpc(OIL_LAB_READBACK_RPC, {
    p_submission_id: bundle.intakeReviewSnapshot.submissionId,
    p_receipt_id: receipt.receiptId,
  })
  if (result.error) throw result.error
  if (
    result.data !== null &&
    !(Array.isArray(result.data) && result.data.length === 0) &&
    !matchesReceipt(result.data, receipt)
  )
    throw new Error("Oil handoff read-back conflicts with current receipt")
  return matchesReceipt(result.data, receipt) ? result.data : null
}
export async function importOilLabReview(input: {
  client: Client
  bundlePath: string
  storePath?: string
  apply: boolean
  confirm: boolean
}): Promise<unknown> {
  const bundle = readOilLabPackage(input.bundlePath)
  const assertCurrent = async () => {
    const detail = await loadProductIntakeSubmissionDetail(
      input.client,
      bundle.intakeReviewSnapshot.submissionId,
    )
    if (
      !detail ||
      buildOilLabReviewPackage(detail).packageFingerprint !== bundle.packageFingerprint
    )
      throw new Error("Oil Lab package is stale; export and review the current intake revision")
  }
  // A dry run reads the current remote truth but never journals or writes a decision.
  if (!input.apply) {
    await assertCurrent()
    return { dry_run: true, packageFingerprint: bundle.packageFingerprint, publication: false }
  }
  if (!input.confirm) throw new Error("Oil Lab import requires --apply --confirm")
  return withOilReviewHandoff(
    {
      storePath: input.storePath,
      bundlePath: input.bundlePath,
      packageFingerprint: bundle.packageFingerprint,
    },
    async (receipt) => {
      const prior = await readback(input.client, bundle, receipt)
      if (prior) return prior
      await assertCurrent()
      try {
        const response = await input.client.rpc(OIL_LAB_IMPORT_RPC, {
          p_submission_id: bundle.intakeReviewSnapshot.submissionId,
          p_receipt: receipt,
          p_snapshot: bundle.intakeReviewSnapshot,
          p_snapshot_json: stableOilReviewJson(bundle.intakeReviewSnapshot),
          p_snapshot_fingerprint: bundle.snapshotFingerprint,
          p_package_fingerprint: bundle.packageFingerprint,
        })
        if (response.error) throw response.error
        if (!matchesReceipt(response.data, receipt))
          throw new Error("Oil handoff returned an unbound acknowledgement")
        return response.data
      } catch (error) {
        // A timeout is an unknown outcome. Only exact DB read-back can seal the local receipt.
        try {
          const recovered = await readback(input.client, bundle, receipt)
          if (recovered) return recovered
        } catch (readbackError) {
          throw new AggregateError(
            [error, readbackError],
            "Oil handoff RPC and read-back both failed",
            { cause: error },
          )
        }
        throw error
      }
    },
  )
}
export async function oilLabReviewMain(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (flagBool(args, "help") || !args.positional.length) {
    console.log(
      "oil-lab-review export --submission-id UUID [--out-dir DIR]\noil-lab-review import --bundle FILE [--store FILE] [--apply --confirm]\nExport reads current intake; import records properties review only. It never publishes products.",
    )
    return
  }
  const client = createSupabaseClientFromEnv()
  if (args.positional[0] === "export")
    printJson(
      await exportOilLabReview({
        client,
        submissionId: requireFlag(args, "submission-id"),
        directory: flag(args, "out-dir") ?? undefined,
      }),
    )
  else if (args.positional[0] === "import")
    printJson(
      await importOilLabReview({
        client,
        bundlePath: resolve(requireFlag(args, "bundle")),
        storePath: flag(args, "store") ?? undefined,
        apply: flagBool(args, "apply"),
        confirm: flagBool(args, "confirm"),
      }),
    )
  else throw new Error("Expected oil-lab-review export or import")
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  oilLabReviewMain().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
