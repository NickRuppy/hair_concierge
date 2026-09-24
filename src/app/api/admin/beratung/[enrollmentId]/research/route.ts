import type { NextRequest } from "next/server"
import { z } from "zod"

import { loadDiscoveryCockpitItems } from "@/lib/discovery/cockpit"
import {
  assignDiscoveryIntakeItemCatalogProduct,
  attachDiscoveryIntakeItemSubmission,
  createDiscoveryResearchSubmission,
  enqueueDiscoveryResearchJob,
  loadDiscoveryResearchState,
  retryDiscoveryResearchJob,
} from "@/lib/discovery/research"
import {
  DISCOVERY_RESEARCH_STATUS_COPY,
  discoveryResearchStatus,
  discoveryResearchSubmissionInput,
  type DiscoveryResearchStatus,
} from "@/lib/discovery/research-status"
import type { DiscoveryIntakeItem } from "@/lib/discovery/refined-routine"

import {
  discoveryCockpitError,
  discoveryCockpitJson,
  guardDiscoveryCockpitRequest,
  readJsonBody,
  type DiscoveryCockpitRouteDependencies,
} from "../../shared"

/**
 * `POST /api/admin/beratung/<enrollmentId>/research` — „Recherche starten" for one
 * captured product. The cockpit's only write outside decisions/finalize.
 *
 * Gate order, as `/api/admin/beratung/invites`: same-origin (403, CSRF) → kill switch
 * (404) → the shared `requireAdmin` (401/403) → service role → the intake the URL names
 * (404). The item must belong to THAT intake (404 otherwise, never a hint that it exists).
 *
 * What it does is re-decided here from a fresh research read, never taken from the client:
 *
 *   open submission, no live job        → enqueue RPC (queues a job)
 *   latest job failed / blocked          → retry RPC (re-queues that job)
 *   no submission, enough to research    → open one through the scan lane as the
 *                                          participant; its insert trigger queues the job
 *   anything else                        → 409 `not_researchable` with the current status
 *
 * The deployed app only QUEUES: the research runs in Nick's local review center
 * (`npm run products:intake:review-center`), which picks queued jobs up in watch mode.
 *
 *   200 { status: { kind, label, canStartResearch }, identityChanged }  — the item's status
 *       after the write; `identityChanged` tells the cockpit to refresh the whole page
 */

const bodySchema = z.object({ itemId: z.string().uuid() }).strict()

export type DiscoveryResearchRouteDependencies = DiscoveryCockpitRouteDependencies & {
  loadItems?: typeof loadDiscoveryCockpitItems
  loadResearchState?: typeof loadDiscoveryResearchState
  enqueue?: typeof enqueueDiscoveryResearchJob
  retry?: typeof retryDiscoveryResearchJob
  createSubmission?: typeof createDiscoveryResearchSubmission
  attachSubmission?: typeof attachDiscoveryIntakeItemSubmission
  assignCatalogProduct?: typeof assignDiscoveryIntakeItemCatalogProduct
}

function statusBody(status: DiscoveryResearchStatus) {
  return {
    kind: status.kind,
    label: DISCOVERY_RESEARCH_STATUS_COPY[status.kind],
    canStartResearch: status.action !== null,
  }
}

export function createDiscoveryResearchHandler(overrides: DiscoveryResearchRouteDependencies = {}) {
  const {
    loadItems = loadDiscoveryCockpitItems,
    loadResearchState = loadDiscoveryResearchState,
    enqueue = enqueueDiscoveryResearchJob,
    retry = retryDiscoveryResearchJob,
    createSubmission = createDiscoveryResearchSubmission,
    attachSubmission = attachDiscoveryIntakeItemSubmission,
    assignCatalogProduct = assignDiscoveryIntakeItemCatalogProduct,
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

    async function currentStatus(itemId: string) {
      const items = await loadItems(intake.id, admin)
      const item = items.find((entry) => entry.id === itemId) ?? null
      if (!item) return null
      return { item, status: discoveryResearchStatus(item, await loadResearchState(admin, [item])) }
    }

    let before: { item: DiscoveryIntakeItem; status: DiscoveryResearchStatus } | null
    try {
      before = await currentStatus(body.data.itemId)
    } catch (error) {
      console.error("[discovery] research state read failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
    // Scoped to this intake by construction: another intake's item is simply not found.
    if (!before || before.item.source === "none") {
      return discoveryCockpitError("not_found", 404)
    }
    const action = before.status.action
    if (!action) {
      return discoveryCockpitJson(
        { code: "not_researchable", status: statusBody(before.status) },
        409,
      )
    }

    try {
      if (action.type === "enqueue") {
        await enqueue(admin, action.submissionId)
      } else if (action.type === "retry") {
        await retry(admin, action.jobId)
      } else {
        const submission = discoveryResearchSubmissionInput(before.item)
        if (!submission) {
          return discoveryCockpitJson(
            { code: "not_researchable", status: statusBody(before.status) },
            409,
          )
        }
        // A second start for the same item (double click, second tab) lands on the SAME
        // submission: the scan lane is get-or-create per user + EAN, and per user + brand +
        // name. The conditional writes below then let exactly one of them touch the row.
        const created = await createSubmission(admin, { userId: intake.userId, submission })
        const target = { intakeId: intake.id, itemId: before.item.id }
        // `false` = a concurrent start already gave the row an identity. Nothing to undo:
        // the re-read below reports the winner's state instead of ours.
        if (created.kind === "already_in_catalog") {
          // The scan lane found the product in the catalog (and it passed the same scan
          // eligibility): that IS the answer research would give, so it lands on the row the
          // way the checklist would have stored it.
          await assignCatalogProduct(admin, { ...target, productId: created.productId })
        } else {
          await attachSubmission(admin, { ...target, submissionId: created.submissionId })
        }
      }
    } catch (error) {
      // Another start may have done the work in between (e.g. a second tab retried the same
      // job, which the RPC then refuses). If the item has nothing left to start, that is
      // the answer; otherwise the failure stands.
      try {
        const fresh = await currentStatus(before.item.id)
        if (fresh && fresh.status.action === null) return answer(before.item, fresh)
      } catch {
        // Fall through to the original failure.
      }
      console.error(`[discovery] research ${action.type} failed:`, error)
      return discoveryCockpitError("unavailable", 503)
    }

    try {
      const after = await currentStatus(before.item.id)
      if (!after) return discoveryCockpitError("not_found", 404)
      return answer(before.item, after)
    } catch (error) {
      console.error("[discovery] research state re-read failed:", error)
      // The write happened; only the fresh status could not be read. The identity may have
      // changed, so the cockpit refreshes to be safe.
      return discoveryCockpitJson({
        status: {
          kind: "status_unavailable",
          label: DISCOVERY_RESEARCH_STATUS_COPY.status_unavailable,
          canStartResearch: false,
        },
        identityChanged: true,
      })
    }
  }
}

/**
 * The item's status now, plus whether its identity (product or submission) moved since the
 * request began — by this request or a concurrent one. When it did, everything the cockpit
 * rendered for the item (name, verdict, routine binding, decisions, fingerprint) is stale,
 * so the page refreshes as a whole.
 */
function answer(
  before: DiscoveryIntakeItem,
  after: { item: DiscoveryIntakeItem; status: DiscoveryResearchStatus },
) {
  return discoveryCockpitJson({
    status: statusBody(after.status),
    identityChanged:
      before.productId !== after.item.productId ||
      before.productSubmissionId !== after.item.productSubmissionId,
  })
}

export const POST = createDiscoveryResearchHandler()
