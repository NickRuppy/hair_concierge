import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  DISCOVERY_EMAIL_PENDING_LABEL,
  formatDiscoveryTimestamp,
} from "@/components/discovery/cockpit/format"
import { requireAdmin } from "@/lib/auth/require-admin"
import { listDiscoveryCallIntakes, type DiscoveryCockpitAdminClient } from "@/lib/discovery/cockpit"
import { listDiscoveryEnrollmentsForAdmin } from "@/lib/discovery/enrollment"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import { discoveryPublicSiteUrl, projectDiscoveryAdminInvite } from "@/lib/discovery/invite-link"
import { listDiscoveryQuizProgress } from "@/lib/discovery/quiz-progress"
import { discoveryEnrollmentSigningSecret } from "@/lib/discovery/token"
import { createAdminClient } from "@/lib/supabase/admin"

import { DiscoveryInviteForm, DiscoveryInviteRowActions } from "./discovery-invite-controls"

/**
 * The cockpit's front door: every enrollment with the state of its checklist, newest
 * first. Two reads, joined in memory — there are tens of these, not thousands.
 *
 * It is also where invites are made and managed („Neue Einladung", then per row „Link
 * kopieren" / „Link erneuern" / „Widerrufen"). Each row's link is derived here from
 * (id, token_version) with the same signer the CLI uses — nothing extra is stored.
 *
 * Same gate as the cockpit itself: kill switch, then the shared `requireAdmin`, and
 * `notFound()` rather than a 403 for anyone else.
 */

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

const TITLE = "Beratungen"
const EMPTY = "Noch keine Einladungen."
const STATE_REVOKED = "widerrufen"
const STATE_INVITED = "eingeladen"
const STATE_CLAIMED = "eingelöst"
const QUIZ_NONE = "Haarquiz: noch nicht abgeschlossen"
const QUIZ_UNAVAILABLE = "Haarquiz: gerade nicht lesbar"
const QUIZ_COMPLETE = "Haarquiz abgeschlossen"
const CHECKLIST_NONE = "Produkte: noch nicht begonnen"
const CHECKLIST_DRAFT = "Produkte: offen"
const OPEN_LABEL = "Öffnen"

export type DiscoveryCockpitListDependencies = {
  flagEnabled: () => boolean
  requireAdmin: typeof requireAdmin
  createAdminClient: () => DiscoveryCockpitAdminClient
  listEnrollments: typeof listDiscoveryEnrollmentsForAdmin
  listIntakes: typeof listDiscoveryCallIntakes
  listQuizProgress: typeof listDiscoveryQuizProgress
  signingSecret: () => string
  siteUrl: () => string
}

const DEFAULTS: DiscoveryCockpitListDependencies = {
  flagEnabled: isDiscoveryCallToolkitEnabled,
  requireAdmin,
  createAdminClient,
  listEnrollments: listDiscoveryEnrollmentsForAdmin,
  listIntakes: listDiscoveryCallIntakes,
  listQuizProgress: listDiscoveryQuizProgress,
  signingSecret: () => discoveryEnrollmentSigningSecret(),
  siteUrl: () => discoveryPublicSiteUrl(),
}

export function createDiscoveryCockpitListPage(
  overrides: Partial<DiscoveryCockpitListDependencies> = {},
) {
  const deps = { ...DEFAULTS, ...overrides }

  return async function DiscoveryCockpitListPage() {
    if (!deps.flagEnabled()) notFound()
    const auth = await deps.requireAdmin()
    if ("response" in auth) notFound()

    const admin = deps.createAdminClient()
    const [enrollments, intakes] = await Promise.all([
      deps.listEnrollments(admin),
      deps.listIntakes(admin),
    ])
    let quizProgress: Awaited<ReturnType<typeof deps.listQuizProgress>> | null = null
    try {
      quizProgress = await deps.listQuizProgress(enrollments, admin)
    } catch {
      // Progress evidence is read-only. A failed lead read is not evidence that
      // the participant never completed the quiz.
      quizProgress = null
    }
    const intakeByEnrollment = new Map(intakes.map((intake) => [intake.enrollmentId, intake]))
    // Without the signing secret the page still lists everything; only the link
    // controls disappear (the create route answers 503 with the reason).
    let linkContext: { secret: string; siteUrl: string } | null = null
    try {
      linkContext = { secret: deps.signingSecret(), siteUrl: deps.siteUrl() }
    } catch {
      linkContext = null
    }

    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">{TITLE}</h1>
        <DiscoveryInviteForm />
        {enrollments.length === 0 ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {EMPTY}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">E-Mail</th>
                  <th className="px-4 py-3 font-medium">Zugang</th>
                  <th className="px-4 py-3 font-medium">Checkliste</th>
                  <th className="px-4 py-3 font-medium">Finalisiert</th>
                  <th className="px-4 py-3 font-medium">Link</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
                  const intake = intakeByEnrollment.get(enrollment.id) ?? null
                  const quiz = quizProgress?.get(enrollment.id) ?? null
                  return (
                    <tr key={enrollment.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {enrollment.display_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {enrollment.normalized_email ?? DISCOVERY_EMAIL_PENDING_LABEL}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {enrollment.revoked_at
                          ? STATE_REVOKED
                          : enrollment.claimed_at
                            ? STATE_CLAIMED
                            : STATE_INVITED}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>
                          {quiz
                            ? `${QUIZ_COMPLETE}: ${formatDiscoveryTimestamp(quiz.completedAt)}`
                            : quizProgress
                              ? QUIZ_NONE
                              : QUIZ_UNAVAILABLE}
                        </div>
                        <div>
                          {!intake
                            ? CHECKLIST_NONE
                            : intake.state === "submitted"
                              ? `Produkte: abgeschickt ${formatDiscoveryTimestamp(intake.submittedAt)}`
                              : CHECKLIST_DRAFT}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDiscoveryTimestamp(intake?.callFinalizedAt ?? null)}
                      </td>
                      <td className="px-4 py-3">
                        {linkContext && !enrollment.revoked_at ? (
                          <DiscoveryInviteRowActions
                            invite={projectDiscoveryAdminInvite(enrollment, linkContext)}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/beratung/${enrollment.id}`}
                          className="font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline"
                        >
                          {OPEN_LABEL}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
}

export default createDiscoveryCockpitListPage()
