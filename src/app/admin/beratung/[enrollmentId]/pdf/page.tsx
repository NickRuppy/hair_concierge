import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { DiscoveryRoutineDocument } from "@/components/discovery/print/discovery-routine-document"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  buildDiscoveryCockpitView,
  loadDiscoveryCallIntake,
  loadDiscoveryCockpitModel,
  type DiscoveryCockpitAdminClient,
} from "@/lib/discovery/cockpit"
import { loadDiscoveryEnrollment } from "@/lib/discovery/enrollment"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * The participant's routine as a printable A4 document
 * (mockup: `plans/discovery-call-toolkit/evidence/pdf-ansicht.html`).
 *
 * Three promises:
 *
 *  - **Finalised only.** Anything else — no intake, an unfinalised call, a profile that
 *    cannot be read right now — goes back to the cockpit, which is the surface that explains
 *    why. The document never exists in a half-decided state.
 *  - **Same read model, recomputed.** It re-composes through `loadDiscoveryCockpitModel`, the
 *    very composition the cockpit and the decisions route use. It reads; it writes nothing.
 *  - **Drift is said out loud.** „Finalisieren" stored the routine's `sourceHash`. If the
 *    fresh hash differs, the profile or the catalog moved since the call, and the page says
 *    so in a banner above the document instead of silently handing over a re-derived plan.
 *    The banner is screen-only: it is Nick's warning before sending, not the participant's.
 *
 * Gated like the cockpit: the kill switch first, then `requireAdmin`, both answering
 * `notFound()` so an admin surface never confirms its own existence.
 */

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

const DRIFT_TITLE = "Stand hat sich geändert"
const DRIFT_BODY =
  "Dieses Dokument zeigt den aktuellen Stand, nicht den finalisierten. Haarprofil oder Katalog haben sich seit der Finalisierung geändert."
const DRIFT_ACTION = "Vor dem Versenden im Cockpit prüfen und neu finalisieren."
const DRIFT_LINK = "Zurück ins Cockpit"

export type DiscoveryPdfPageDependencies = {
  flagEnabled: () => boolean
  requireAdmin: typeof requireAdmin
  createAdminClient: () => DiscoveryCockpitAdminClient
  loadEnrollment: typeof loadDiscoveryEnrollment
  loadIntake: typeof loadDiscoveryCallIntake
  loadModel: typeof loadDiscoveryCockpitModel
}

const DEFAULTS: DiscoveryPdfPageDependencies = {
  flagEnabled: isDiscoveryCallToolkitEnabled,
  requireAdmin,
  createAdminClient,
  loadEnrollment: loadDiscoveryEnrollment,
  loadIntake: loadDiscoveryCallIntake,
  loadModel: loadDiscoveryCockpitModel,
}

export function createDiscoveryPdfPage(overrides: Partial<DiscoveryPdfPageDependencies> = {}) {
  const deps = { ...DEFAULTS, ...overrides }

  return async function DiscoveryPdfPage({
    params,
  }: {
    params: Promise<{ enrollmentId: string }>
  }) {
    if (!deps.flagEnabled()) notFound()
    const auth = await deps.requireAdmin()
    if ("response" in auth) notFound()

    const admin = deps.createAdminClient()
    const { enrollmentId } = await params
    const cockpitHref = `/admin/beratung/${enrollmentId}`

    const enrollment = await deps.loadEnrollment({ enrollmentId }, admin)
    if (!enrollment) notFound()

    const intake = await deps.loadIntake(enrollmentId, admin)
    // The render gate: no checklist, or a call that is not finalised, has no document.
    if (!intake || !intake.callFinalizedAt) redirect(cockpitHref)

    const model = await deps.loadModel(admin, { intakeId: intake.id, userId: intake.userId })
    if (model.status !== "ready") redirect(cockpitHref)

    const view = buildDiscoveryCockpitView(model)
    const drifted = view.sourceHash !== intake.finalizedSourceHash

    return (
      <>
        {drifted ? <DriftBanner href={cockpitHref} /> : null}
        <DiscoveryRoutineDocument
          name={enrollment.name}
          view={view}
          finalizedAt={intake.callFinalizedAt}
        />
      </>
    )
  }
}

function DriftBanner({ href }: { href: string }) {
  return (
    <section className="mb-4 rounded-xl border border-[var(--status-danger-text)] bg-[var(--status-danger-bg)] p-4 print:hidden">
      <p className="text-sm font-bold text-[var(--status-danger-text)]">{DRIFT_TITLE}</p>
      <p className="mt-1 text-[13px] leading-5 text-foreground">{DRIFT_BODY}</p>
      <p className="mt-1 text-[13px] leading-5 text-foreground">{DRIFT_ACTION}</p>
      <a href={href} className="mt-2 inline-block text-[13px] font-bold underline">
        {DRIFT_LINK}
      </a>
    </section>
  )
}

export default createDiscoveryPdfPage()
