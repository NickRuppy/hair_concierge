import type { NextRequest } from "next/server"
import { z } from "zod"

import {
  loadDiscoveryCallSheet,
  saveDiscoveryCallSheet,
  type DiscoveryCallSheetBrief,
  type DiscoveryCallSheetBriefRevision,
} from "@/lib/discovery/call-sheet"
import {
  generateConsultBrief,
  type ConsultBriefErrorCode,
} from "@/lib/discovery/consult-brief/generate"
import { loadConsultBriefSource } from "@/lib/discovery/consult-brief/source"
import { flushLangfuseSpans } from "@/lib/langfuse/flush-spans"
import { ensureLangfuseTracing, flushLangfuseClient } from "@/lib/openai/client"

import {
  discoveryCockpitError,
  discoveryCockpitJson,
  guardDiscoveryCockpitRequest,
  readJsonBody,
  type DiscoveryCockpitRouteDependencies,
} from "../../shared"

/**
 * `POST /api/admin/beratung/<enrollmentId>/consult-brief` — „Brief erstellen" / „Neu
 * generieren" (consult-agent T3). Gate order as the call-sheet route: same-origin (403, CSRF)
 * → kill switch (404) → the shared `requireAdmin` (401/403) → the intake the URL names (404).
 *
 * Body: `{ expected_state: { source_hash, generated_at, saved_at } | null, force?: boolean }` —
 * the brief state the client last saw (null = it saw none). `saved_at` is the server's stamp on
 * every brief write, so a manual save (which keeps `generated_at`/`source_hash`) still counts
 * as a change.
 *
 *   bad body                          → 400 `invalid_body`
 *   intake not submitted (R14)        → 422 `draft_intake`
 *   no plan to read                   → 503 `no_usable_source` / `temporarily_unavailable`
 *   stored brief ≠ expected_state     → 409 `brief_conflict` + `current` (unless `force`);
 *                                       checked before the LLM call AND again before the write,
 *                                       because the call takes up to a minute
 *   LLM failed / unusable output      → 502 `brief_generation_failed` / `brief_invalid_output`
 *   guardrail lint failed             → 422 `brief_lint_failed` + `findings`
 *   200 `{ callSheet, sourceHash }`   — the stored sheet as the page's parser reads it
 *
 * Every error carries a German `message` and writes NOTHING. On success the stored brief
 * moves into the new one as `previous` (exactly one revision; its own `previous` is dropped),
 * and the write goes through `saveDiscoveryCallSheet` (read-merge-write: score, commitments,
 * feedback stay as stored; a legacy enrollment without a row gets its first one). Only a
 * submitted intake generates (R14); a finalised call still does — the brief is Nick's working
 * copy.
 */

/** Generation is bounded at 55 s per attempt; the OpenAI client retries once. */
export const maxDuration = 180

const briefState = z
  .object({
    source_hash: z.string().max(200).nullable(),
    generated_at: z.string().max(100).nullable(),
    saved_at: z.string().max(100).nullable(),
  })
  .strict()

const bodySchema = z
  .object({ expected_state: briefState.nullable(), force: z.boolean().optional() })
  .strict()

type BriefState = z.infer<typeof briefState>

export type StoredConsultBrief = DiscoveryCallSheetBrief & {
  /** The brief this one replaced (one revision, R15); null on a first generation. */
  previous: DiscoveryCallSheetBriefRevision | null
}

/** The stored brief as a revision: its own `previous` is dropped (never nested). */
function asRevision(brief: DiscoveryCallSheetBrief | null): DiscoveryCallSheetBriefRevision | null {
  if (!brief) return null
  const { sections, generated_at, generated_by, source_hash } = brief
  return { sections, generated_at, generated_by, source_hash }
}

const MESSAGES = {
  draft_intake:
    "Die Checkliste ist noch nicht abgeschickt. Den Brief erst erstellen, wenn sie abgeschickt ist.",
  brief_conflict:
    "Der Brief wurde inzwischen geändert. Bestätigen, um ihn zu überschreiben — die bisherige Fassung bleibt als Revision erhalten.",
  brief_generation_failed:
    "Der Brief konnte gerade nicht erstellt werden. Bitte später erneut versuchen.",
  brief_invalid_output: "Die Antwort des Modells war nicht verwertbar. Bitte erneut generieren.",
  brief_lint_failed:
    "Der erstellte Brief verstößt gegen die Leitplanken und wurde verworfen. Bitte erneut generieren.",
} as const

const ERROR_RESPONSE: Record<
  ConsultBriefErrorCode,
  { code: keyof typeof MESSAGES; status: number }
> = {
  llm_failed: { code: "brief_generation_failed", status: 502 },
  invalid_json: { code: "brief_invalid_output", status: 502 },
  invalid_schema: { code: "brief_invalid_output", status: 502 },
  lint_failed: { code: "brief_lint_failed", status: 422 },
}

/**
 * Makes the generation's Langfuse trace survive the request: the SDK must be started (no
 * instrumentation hook does it — without it the observed client's spans go nowhere), and
 * the span export must settle before the function returns.
 */
async function withLangfuseTracing<T>(work: () => Promise<T>): Promise<T> {
  ensureLangfuseTracing()
  try {
    return await work()
  } finally {
    await flushLangfuseSpans()
    await flushLangfuseClient().catch(() => {})
  }
}

function stateOf(brief: DiscoveryCallSheetBrief | null) {
  return brief
    ? {
        source_hash: brief.source_hash,
        generated_at: brief.generated_at,
        generated_by: brief.generated_by,
        saved_at: brief.saved_at ?? null,
      }
    : null
}

function matchesExpected(stored: DiscoveryCallSheetBrief | null, expected: BriefState | null) {
  if (!stored || !expected) return stored === null && expected === null
  return (
    stored.source_hash === expected.source_hash &&
    stored.generated_at === expected.generated_at &&
    (stored.saved_at ?? null) === expected.saved_at
  )
}

export type DiscoveryConsultBriefRouteDependencies = DiscoveryCockpitRouteDependencies & {
  loadSource?: typeof loadConsultBriefSource
  loadCallSheet?: typeof loadDiscoveryCallSheet
  generate?: typeof generateConsultBrief
  saveCallSheet?: typeof saveDiscoveryCallSheet
  trace?: <T>(work: () => Promise<T>) => Promise<T>
  now?: () => Date
}

export function createDiscoveryConsultBriefHandler(
  overrides: DiscoveryConsultBriefRouteDependencies = {},
) {
  const {
    loadSource = loadConsultBriefSource,
    loadCallSheet = loadDiscoveryCallSheet,
    generate = generateConsultBrief,
    saveCallSheet = saveDiscoveryCallSheet,
    trace = withLangfuseTracing,
    now = () => new Date(),
    ...guardOverrides
  } = overrides

  return async function POST(
    request: NextRequest,
    context: { params: Promise<{ enrollmentId: string }> },
  ) {
    // CSRF first: the admin cookie rides along on a cross-site request too.
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return discoveryCockpitError("cross_origin", 403)
    }
    const { enrollmentId } = await context.params
    const guard = await guardDiscoveryCockpitRequest(enrollmentId, guardOverrides)
    if (!guard.ok) return guard.response
    const { admin, intake } = guard

    const body = bodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return discoveryCockpitError("invalid_body", 400)
    const { expected_state: expected, force = false } = body.data

    // R14: a brief is generated from what she submitted — never from a draft in progress.
    if (intake.state !== "submitted") {
      return discoveryCockpitJson({ code: "draft_intake", message: MESSAGES.draft_intake }, 422)
    }

    const conflict = (stored: DiscoveryCallSheetBrief | null) =>
      discoveryCockpitJson(
        { code: "brief_conflict", message: MESSAGES.brief_conflict, current: stateOf(stored) },
        409,
      )

    let source: Awaited<ReturnType<typeof loadConsultBriefSource>>
    try {
      source = await loadSource(admin, intake, { loadCallSheet })
    } catch (error) {
      console.error("[discovery] consult brief source read failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
    if (source.status !== "ready") return discoveryCockpitError(source.status, 503)
    const { input, sourceHash, callSheet: before } = source

    // Fail fast before spending a minute on the LLM.
    const seen = before?.consultBrief ?? null
    if (!force && !matchesExpected(seen, expected)) return conflict(seen)

    const result = await trace(() => generate(input))
    if ("error" in result) {
      const { code, status } = ERROR_RESPONSE[result.error.code]
      return discoveryCockpitJson(
        {
          code,
          message: MESSAGES[code],
          reason: result.error.code,
          ...(result.error.findings ? { findings: result.error.findings } : {}),
        },
        status,
      )
    }

    // The generation took a while: re-read, so a brief saved meanwhile is neither silently
    // overwritten nor lost as the revision.
    let stored: DiscoveryCallSheetBrief | null
    try {
      stored = (await loadCallSheet(intake.enrollmentId, admin))?.consultBrief ?? null
    } catch (error) {
      console.error("[discovery] consult brief re-read failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
    if (!force && !matchesExpected(stored, expected)) return conflict(stored)

    const brief: StoredConsultBrief = {
      sections: result.brief,
      generated_at: now().toISOString(),
      generated_by: "agent",
      source_hash: sourceHash,
      // Exactly one revision: the stored brief, without its own `previous`.
      previous: asRevision(stored),
    }

    try {
      const callSheet = await saveCallSheet(
        intake.enrollmentId,
        { consult_brief: brief },
        admin,
        now,
      )
      return discoveryCockpitJson({ callSheet, sourceHash })
    } catch (error) {
      console.error("[discovery] consult brief write failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const POST = createDiscoveryConsultBriefHandler()
