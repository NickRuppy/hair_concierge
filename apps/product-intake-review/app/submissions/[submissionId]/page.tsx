import {
  loadProductIntakeQueue,
  loadProductIntakeSubmissionDetail,
  type JsonRecord,
  type ProductIntakeQueueRow,
  type ProductIntakeResearchArtifact,
  type ProductIntakeResearchJob,
  type ProductIntakeReviewDecisionRow,
} from "@chaarlie/product-intake-core"
import Link from "next/link"
import { headers } from "next/headers"

import { assertLocalServiceHeaders, createServiceClient } from "../../api/_lib/service-client"
import { buildReviewPropertyRows } from "./review-property-rows"
import { SubmissionActions } from "./submission-actions"

type DetailPageProps = {
  params: Promise<{
    submissionId: string
  }>
}

export default async function SubmissionDetailPage({ params }: DetailPageProps) {
  const { submissionId } = await params
  const detail = await loadDetail(submissionId)

  if ("error" in detail) {
    return (
      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Produkt-Intake</p>
            <h1>Submission {submissionId}</h1>
          </div>
          <Link className="linkButton" href="/">
            Zur Warteschlange
          </Link>
        </header>

        <section className="panel">
          <p className="stateText errorText">{detail.error}</p>
        </section>
      </main>
    )
  }

  if (!detail.submission) {
    return (
      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Produkt-Intake</p>
            <h1>Submission {submissionId}</h1>
          </div>
          <Link className="linkButton" href="/">
            Zur Warteschlange
          </Link>
        </header>

        <section className="panel">
          <p className="stateText">Submission nicht gefunden.</p>
        </section>
      </main>
    )
  }

  const { submission } = detail
  const { job } = submission
  const packagePath = findLocalPackagePath(job?.progress ?? null, submission.payload)
  const reviewModel = buildReviewModel(
    submission.payload,
    submission.artifacts,
    submission.decisions,
    submission.brand,
  )
  const progress = describeReviewProgress(
    reviewModel,
    job?.status ?? "needs_job",
    job?.stage ?? "none",
  )
  const jobActivity = describeJobActivity(job)
  const workerSnapshot = await loadWorkerQueueSnapshot()

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Produkt-Intake</p>
          <h1>Submission {submissionId}</h1>
        </div>
        <Link className="linkButton" href="/">
          Zur Warteschlange
        </Link>
      </header>

      <section className="panel">
        <div className="panelHeader">
          <h2>Submission</h2>
          <span>{submission.status}</span>
        </div>
        <dl className="detailGrid">
          <div>
            <dt>Submission-ID</dt>
            <dd>{submission.id}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{submission.status}</dd>
          </div>
          <div>
            <dt>Produkt</dt>
            <dd>
              {[submission.brand, submission.product_name].filter(Boolean).join(" · ") ||
                "Ohne Produktname"}
            </dd>
          </div>
          <div>
            <dt>Kategorie</dt>
            <dd>{submission.category}</dd>
          </div>
          <div>
            <dt>Quelle</dt>
            <dd>{submission.source ?? "-"}</dd>
          </div>
          <div>
            <dt>Lokales Paket</dt>
            <dd>{packagePath ?? "Noch nicht im Job-Fortschritt hinterlegt"}</dd>
          </div>
        </dl>
      </section>

      <WorkerQueueSnapshot currentSubmissionId={submission.id} snapshot={workerSnapshot} />

      <section className="panel progressOverviewPanel">
        <div className="panelHeader">
          <h2>Review-Fortschritt</h2>
          <span>
            {reviewModel.publishCompleted
              ? "Abgeschlossen"
              : reviewModel.readyForFinalApproval
                ? "Bereit fuer finalen Handoff"
                : "Naechster Schritt sichtbar"}
          </span>
        </div>
        <div className="milestoneGrid">
          {reviewModel.brandReview ? (
            <MilestoneLane title="Marke" milestones={reviewModel.brandMilestones} />
          ) : null}
          <MilestoneLane title="Bild" milestones={reviewModel.imageMilestones} />
          <MilestoneLane title="Eigenschaften" milestones={reviewModel.propertyMilestones} />
          <MilestoneLane title="Handoff" milestones={reviewModel.handoffMilestones} />
        </div>
        <section className={`jobActivityPanel jobActivity-${jobActivity.tone}`}>
          <div>
            <p className="jobActivityEyebrow">Aktiver Research-Status</p>
            <h3>{jobActivity.label}</h3>
            <p>{jobActivity.description}</p>
            {jobActivity.detail ? <p className="jobActivityDetail">{jobActivity.detail}</p> : null}
          </div>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{job?.status ?? "kein_job"}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{job?.stage ?? "-"}</dd>
            </div>
            <div>
              <dt>Update</dt>
              <dd>{formatTimestamp(job?.updated_at)}</dd>
            </div>
            <div>
              <dt>Worker</dt>
              <dd>{jobActivity.worker}</dd>
            </div>
          </dl>
        </section>
        <SubmissionActions
          finalImageApproved={reviewModel.finalImageApproved}
          brandReview={reviewModel.brandReview}
          imageResearched={Boolean(reviewModel.imageUrl)}
          imageSearchRequested={reviewModel.imageSearchRequested}
          imageSelected={reviewModel.imageSelected}
          jobStage={job?.stage ?? "none"}
          jobId={job?.id ?? null}
          jobStatus={job?.status ?? "needs_job"}
          processedImageNeedsWork={reviewModel.processedImageNeedsWork}
          processedImageReady={reviewModel.processedImageReady}
          propertiesApproved={reviewModel.propertiesApproved}
          propertiesResearched={reviewModel.properties.length > 0}
          publishCompleted={reviewModel.publishCompleted}
          readyForFinalApproval={reviewModel.readyForFinalApproval}
          submissionId={submission.id}
        />
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Statusleiste</h2>
          <span>{progress.percent}%</span>
        </div>
        <div className="progressPanel">
          <div className="progressTrack" aria-label={progress.label}>
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <strong>{progress.label}</strong>
          <p>{progress.description}</p>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Review Schritt 1: Rohbild und Eigenschaften</h2>
            <span>
              Pruefe zuerst, ob Bild und Research fachlich passen. Danach wird das Bild verarbeitet.
            </span>
          </div>
          <span>{reviewModel.ready ? "Review-Daten vorhanden" : "Noch nicht review-bereit"}</span>
        </div>
        <div className="reviewSurface">
          <div className="imageReviewCard">
            <div className="reviewSectionHeader">
              <h3>Bildvorschlag</h3>
              <span>{reviewModel.imageDecision ?? "Noch nicht entschieden"}</span>
            </div>
            {reviewModel.imageUrl ? (
              <>
                <div className="productImageFrame">
                  <img src={reviewModel.imageUrl} alt={reviewModel.imageAlt} />
                </div>
                <div className="reviewMeta">
                  <a href={reviewModel.imageUrl} target="_blank" rel="noreferrer">
                    Bildquelle oeffnen
                  </a>
                  {reviewModel.imageSourceUrl ? (
                    <a href={reviewModel.imageSourceUrl} target="_blank" rel="noreferrer">
                      Produktquelle oeffnen
                    </a>
                  ) : null}
                  <span>Confidence: {formatConfidence(reviewModel.imageConfidence)}</span>
                </div>
                <p className="reviewNote">
                  {reviewModel.imageEvidence ?? "Kein Bildhinweis hinterlegt."}
                </p>
              </>
            ) : (
              <p className="stateText">
                Noch kein Bildvorschlag gefunden. Starte Research oder fordere ein anderes Bild an.
              </p>
            )}
            {reviewModel.processedImageUrl ? (
              <div className="processedImageBlock">
                <div className="reviewSectionHeader">
                  <h3>Verarbeitetes Bild</h3>
                  <span>
                    {reviewModel.processedImageReady
                      ? "Bereit fuer Schritt 2"
                      : "Bild-QA braucht Arbeit"}
                  </span>
                </div>
                <div className="productImageFrame processedImageFrame">
                  <img
                    src={reviewModel.processedImageUrl}
                    alt={`Verarbeitetes Bild: ${reviewModel.imageAlt}`}
                  />
                </div>
                {reviewModel.processedQaUrl ? (
                  <>
                    <div className="reviewSectionHeader qaSectionHeader">
                      <h3>Magenta-QA</h3>
                      <span>Schatten, Halo und Reste pruefen</span>
                    </div>
                    <div className="productImageFrame processedImageFrame qaImageFrame">
                      <img
                        src={reviewModel.processedQaUrl}
                        alt={`Magenta-QA: ${reviewModel.imageAlt}`}
                      />
                    </div>
                  </>
                ) : null}
                <p className="reviewNote">{reviewModel.processedImageNote}</p>
              </div>
            ) : reviewModel.imageSelected ? (
              <div className="processedImageBlock pendingBlock">
                <strong>Bildverarbeitung wartet</strong>
                <p>
                  Das Rohbild ist freigegeben. Sobald der Worker gelaufen ist, erscheint hier das
                  verarbeitete Bild fuer den finalen Check.
                </p>
              </div>
            ) : null}
          </div>

          <div className="propertyReviewCard">
            <div className="reviewSectionHeader">
              <h3>Eigenschaften</h3>
              <span>{reviewModel.productDecision ?? "Noch nicht final freigegeben"}</span>
            </div>
            {reviewModel.properties.length > 0 ? (
              <dl className="propertyList">
                {reviewModel.properties.map((property) => (
                  <div key={property.label}>
                    <dt>{property.label}</dt>
                    <dd>{property.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="stateText">
                Noch keine lesbaren Eigenschaften im Research-Payload. Worker erneut laufen lassen.
              </p>
            )}
          </div>
        </div>

        <div className="sourceStrip">
          <strong>Research-Zusammenfassung</strong>
          <p>{reviewModel.summary ?? "Keine Zusammenfassung im aktuellen Job."}</p>
          {reviewModel.sources.length > 0 ? (
            <ul>
              {reviewModel.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title || source.url}
                  </a>
                  {source.evidence ? <span>{source.evidence}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Aktueller Job</h2>
          <span>{job ? job.updated_at : "Kein Job"}</span>
        </div>
        {job ? (
          <dl className="detailGrid">
            <div>
              <dt>Job-ID</dt>
              <dd>{job.id}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{job.status}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{job.stage}</dd>
            </div>
            <div>
              <dt>Versuche</dt>
              <dd>
                {job.attempt_count} / {job.max_attempts}
              </dd>
            </div>
            <div>
              <dt>Worker-Lock</dt>
              <dd>{job.locked_by ? `${job.locked_by} seit ${job.locked_at}` : "-"}</dd>
            </div>
            <div>
              <dt>Letzter Fehler</dt>
              <dd>{job.last_error ?? "-"}</dd>
            </div>
          </dl>
        ) : (
          <p className="stateText">Noch kein Research-Job fuer diese Submission.</p>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Fortschritt</h2>
          <span>Job-JSON</span>
        </div>
        <pre className="jsonBlock">{formatJson(job?.progress ?? {})}</pre>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Research-Artefakte</h2>
          <span>{submission.artifacts.length} Eintraege</span>
        </div>
        {submission.artifacts.length === 0 ? (
          <p className="stateText">
            Noch keine Research-Artefakte. Starte Research und den Worker.
          </p>
        ) : (
          <div className="tableWrap">
            <table className="compactTable">
              <thead>
                <tr>
                  <th>Typ</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Erstellt</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {submission.artifacts.map((artifact) => (
                  <tr key={artifact.id}>
                    <td>{artifact.kind}</td>
                    <td>{artifact.status}</td>
                    <td>{artifact.confidence ?? "-"}</td>
                    <td>{artifact.created_at}</td>
                    <td>
                      <pre className="inlineJson">{formatJson(artifact.payload)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Review-Kommentare</h2>
          <span>{submission.decisions.length} Eintraege</span>
        </div>
        {submission.decisions.length === 0 ? (
          <p className="stateText">Noch keine Kommentare oder Review-Entscheidungen.</p>
        ) : (
          <div className="tableWrap">
            <table className="compactTable">
              <thead>
                <tr>
                  <th>Feld</th>
                  <th>Entscheidung</th>
                  <th>Kommentar</th>
                  <th>Status</th>
                  <th>Zeit</th>
                </tr>
              </thead>
              <tbody>
                {submission.decisions.map((decision) => (
                  <tr key={decision.id}>
                    <td>{decision.field_path}</td>
                    <td>{decision.decision}</td>
                    <td>{decision.comment ?? "-"}</td>
                    <td>{decision.resolved_at ? "geloest" : "offen"}</td>
                    <td>{decision.reviewed_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Raw Submission</h2>
          <span>Payload</span>
        </div>
        <pre className="jsonBlock">{formatJson(submission.payload ?? {})}</pre>
      </section>
    </main>
  )
}

type WorkerQueueSnapshotResult = {
  rows: ProductIntakeQueueRow[]
  error: string | null
  generatedAt: string
}

const WORKER_VISIBLE_SLOTS = 2
const activeWorkerStatuses = new Set(["running", "publish_preflight", "publishing"])
const waitingWorkerStatuses = new Set(["queued", "waiting_for_rework"])

function WorkerQueueSnapshot({
  currentSubmissionId,
  snapshot,
}: {
  currentSubmissionId: string
  snapshot: WorkerQueueSnapshotResult
}) {
  const activeRows = snapshot.rows.filter((row) => activeWorkerStatuses.has(row.job?.status ?? ""))
  const waitingRows = snapshot.rows.filter(isClaimableWaitingRow).sort(sortByWorkerClaimOrder)
  const currentRow = snapshot.rows.find((row) => row.submission_id === currentSubmissionId) ?? null
  const currentWaitingIndex = waitingRows.findIndex(
    (row) => row.submission_id === currentSubmissionId,
  )
  const currentWaitingRow = currentWaitingIndex >= 0 ? waitingRows[currentWaitingIndex] : null
  const nextRows = uniqueQueueRows([
    ...waitingRows.slice(0, WORKER_VISIBLE_SLOTS),
    ...(currentWaitingRow ? [currentWaitingRow] : []),
  ])
  const currentStatus = describeCurrentWorkerSnapshot(
    currentRow,
    currentWaitingIndex,
    activeRows.length,
  )

  return (
    <section className="panel workerSnapshotPanel" aria-labelledby="worker-snapshot-heading">
      <div className="panelHeader">
        <div>
          <h2 id="worker-snapshot-heading">Worker-Arbeitsstatus</h2>
          <span>
            {activeRows.length} / {WORKER_VISIBLE_SLOTS} Slots aktiv · {waitingRows.length} warten
          </span>
        </div>
        <span>{formatTimestamp(snapshot.generatedAt)}</span>
      </div>
      {snapshot.error ? <p className="stateText errorText">{snapshot.error}</p> : null}
      {!snapshot.error ? (
        <div className="workerSnapshotBody">
          <div className="workerSnapshotSummary">
            <strong>{currentStatus.headline}</strong>
            <p>{currentStatus.explanation}</p>
            {currentStatus.detail ? (
              <p className="workerCurrentStatus">{currentStatus.detail}</p>
            ) : null}
          </div>
          <div className="workerSnapshotColumns">
            <WorkerSnapshotList
              currentSubmissionId={currentSubmissionId}
              emptyText="Keine laufenden Worker-Jobs."
              rows={activeRows.slice(0, WORKER_VISIBLE_SLOTS)}
              title="Aktuell arbeitet der Worker an"
            />
            <WorkerSnapshotList
              currentSubmissionId={currentSubmissionId}
              emptyText="Keine wartenden Jobs."
              rows={nextRows}
              title="Naechste Jobs"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function describeCurrentWorkerSnapshot(
  row: ProductIntakeQueueRow | null,
  waitingIndex: number,
  activeCount: number,
) {
  const job = row?.job
  if (!job) {
    return {
      headline:
        activeCount > 0
          ? `Aktuell arbeitet der Worker an ${activeCount} Aufgabe(n).`
          : "Der Worker arbeitet gerade an keiner Aufgabe.",
      explanation: "Dieser Submission ist noch kein Research-Job zugeordnet.",
      detail: null,
    }
  }

  const stage = `Stage: ${job.stage}`
  const updated = `Update: ${formatTimestamp(job.updated_at)}`
  const queuePosition =
    waitingIndex >= 0 ? `Wartelistenplatz: ${waitingIndex + 1}` : "Wartelistenplatz: wird berechnet"

  switch (job.status) {
    case "queued":
    case "waiting_for_rework":
      return {
        headline: "Dieser Job ist eingereiht und wartet auf den naechsten Worker-Poll.",
        explanation:
          "Noch nicht vom Worker abgeholt. Sobald ein Slot frei ist, wechselt der Status zu running.",
        detail: `${queuePosition} · ${stage} · ${updated}`,
      }
    case "running":
    case "publish_preflight":
    case "publishing":
      return {
        headline: "Dieser Job wird gerade vom Worker bearbeitet.",
        explanation:
          "Ein Worker-Lock ist sichtbar. Diese Seite aktualisiert sich automatisch, bis Review oder Fehler erscheint.",
        detail: `Worker: ${job.locked_by ?? "unbekannt"} · ${stage} · ${updated}`,
      }
    case "waiting_for_review":
      return {
        headline: "Worker ist fertig - Review ist bereit.",
        explanation: "Der Job wurde abgearbeitet und wartet jetzt auf deine Review-Entscheidung.",
        detail: `${stage} · ${updated}`,
      }
    case "blocked":
    case "failed":
      return {
        headline: "Worker-Lauf ist blockiert oder fehlgeschlagen.",
        explanation:
          job.last_error ??
          "Der Grund steht im aktiven Research-Status. Retry oder Rework reiht den Job erneut ein.",
        detail: `${stage} · ${updated}`,
      }
    case "done":
      return {
        headline: "Worker-Job ist abgeschlossen.",
        explanation: "Fuer diesen Job ist keine Worker-Aktion mehr offen.",
        detail: `${stage} · ${updated}`,
      }
    default:
      return {
        headline: "Worker-Status pruefen.",
        explanation:
          "Der Job hat einen Status, der noch nicht eindeutig im Review Center erklaert ist.",
        detail: `Status: ${job.status} · ${stage} · ${updated}`,
      }
  }
}

function WorkerSnapshotList({
  currentSubmissionId,
  emptyText,
  rows,
  title,
}: {
  currentSubmissionId: string
  emptyText: string
  rows: ProductIntakeQueueRow[]
  title: string
}) {
  return (
    <div className="workerSnapshotList">
      <strong>{title}</strong>
      {rows.length === 0 ? <p>{emptyText}</p> : null}
      {rows.map((row) => (
        <article
          className={`workerSnapshotCard${row.submission_id === currentSubmissionId ? " workerSnapshot-current" : ""}`}
          key={row.submission_id}
        >
          <div>
            <span className={`chip chip-${row.job?.status ?? "needs_job"}`}>
              {row.job?.status ?? "needs_job"}
            </span>
            {row.submission_id === currentSubmissionId ? (
              <span className="workerCurrentBadge">Aktueller Job</span>
            ) : null}
          </div>
          <Link className="productLink" href={`/submissions/${row.submission_id}`}>
            <strong>
              {[row.brand, row.product_name].filter(Boolean).join(" · ") || "Ohne Produktname"}
            </strong>
            <span>
              {row.category} · {row.job?.stage ?? "none"}
            </span>
          </Link>
          <p>{queueRowStatusText(row)}</p>
        </article>
      ))}
    </div>
  )
}

async function loadWorkerQueueSnapshot(): Promise<WorkerQueueSnapshotResult> {
  try {
    assertLocalServiceHeaders(await headers())
    const rows = await loadProductIntakeQueue(createServiceClient(), { limit: 100 })
    return { rows, error: null, generatedAt: new Date().toISOString() }
  } catch (caught) {
    return {
      rows: [],
      error:
        caught instanceof Error
          ? caught.message
          : "Worker-Warteschlange konnte nicht geladen werden.",
      generatedAt: new Date().toISOString(),
    }
  }
}

function uniqueQueueRows(rows: ProductIntakeQueueRow[]) {
  const seen = new Set<string>()
  const unique: ProductIntakeQueueRow[] = []
  for (const row of rows) {
    if (seen.has(row.submission_id)) continue
    seen.add(row.submission_id)
    unique.push(row)
  }
  return unique
}

function isClaimableWaitingRow(row: ProductIntakeQueueRow) {
  const job = row.job
  if (!job) return false
  if (!waitingWorkerStatuses.has(job.status)) return false
  if (job.attempt_count >= job.max_attempts) return false
  return new Date(job.next_run_at).getTime() <= Date.now()
}

function sortByWorkerClaimOrder(left: ProductIntakeQueueRow, right: ProductIntakeQueueRow) {
  const leftJob = left.job
  const rightJob = right.job
  if (!leftJob || !rightJob) return 0
  if (rightJob.priority !== leftJob.priority) return rightJob.priority - leftJob.priority
  const nextRunDiff =
    new Date(leftJob.next_run_at).getTime() - new Date(rightJob.next_run_at).getTime()
  if (nextRunDiff !== 0) return nextRunDiff
  return new Date(leftJob.created_at).getTime() - new Date(rightJob.created_at).getTime()
}

function queueRowStatusText(row: ProductIntakeQueueRow) {
  const job = row.job
  if (!job) return "Noch kein Research-Job."
  const lock = job.locked_by ? ` · Lock: ${job.locked_by}` : ""
  switch (job.status) {
    case "queued":
    case "waiting_for_rework":
      return `Noch nicht vom Worker abgeholt · Wartet seit ${formatTimestamp(job.updated_at)}`
    case "running":
    case "publish_preflight":
    case "publishing":
      return `Vom Worker abgeholt · ${formatTimestamp(job.locked_at ?? job.updated_at)}${lock}`
    case "waiting_for_review":
      return `Worker fertig · Review bereit seit ${formatTimestamp(job.updated_at)}`
    case "blocked":
    case "failed":
      return `Gestoppt · ${job.last_error ?? `Update ${formatTimestamp(job.updated_at)}`}`
    default:
      return `Update ${formatTimestamp(job.updated_at)}${lock}`
  }
}

function MilestoneLane({
  title,
  milestones,
}: {
  title: string
  milestones: Array<{ label: string; status: "done" | "active" | "pending" }>
}) {
  return (
    <div className="milestoneLane">
      <strong>{title}</strong>
      <ol>
        {milestones.map((milestone) => (
          <li className={`milestone milestone-${milestone.status}`} key={milestone.label}>
            <span aria-hidden="true" />
            {milestone.label}
          </li>
        ))}
      </ol>
    </div>
  )
}

function describeJobActivity(job: ProductIntakeResearchJob | null) {
  if (!job) {
    return {
      tone: "idle",
      label: "Noch nicht eingereiht",
      description: "Fuer diese Submission gibt es noch keinen aktiven Research-Job.",
      detail: null,
      worker: "-",
    } as const
  }

  const detail = job.last_error ?? progressMessage(job.progress)
  const worker = job.locked_by
    ? `${job.locked_by} seit ${formatTimestamp(job.locked_at)}`
    : "Kein aktiver Lock"

  switch (job.status) {
    case "queued":
      if (job.stage === "image_judging") {
        return {
          tone: "waiting",
          label: "Bildverarbeitung wartet auf Worker",
          description:
            "Das Rohbild ist freigegeben; der Worker muss jetzt das finale Review-Bild erstellen.",
          detail,
          worker,
        } as const
      }
      return {
        tone: "waiting",
        label: "Wartet auf Worker",
        description:
          "Der Research-Job ist eingereiht. Sobald der Worker frei ist, wird er aufgenommen.",
        detail,
        worker,
      } as const
    case "waiting_for_rework":
      return {
        tone: "waiting",
        label: "Rework wartet auf Worker",
        description:
          "Deine Korrekturen sind gespeichert und das Produkt ist fuer einen neuen Research-Lauf eingereiht.",
        detail,
        worker,
      } as const
    case "running":
      if (job.stage === "image_judging") {
        return {
          tone: "running",
          label: "Bildverarbeitung laeuft",
          description:
            "Der Worker verarbeitet das Bild lokal und aktualisiert diese Seite automatisch.",
          detail,
          worker,
        } as const
      }
      return {
        tone: "running",
        label: "Worker arbeitet gerade",
        description:
          "Codex recherchiert Quellen, Bild und Eigenschaften. Diese Seite aktualisiert sich automatisch.",
        detail,
        worker,
      } as const
    case "publish_preflight":
      return {
        tone: "running",
        label: "Publish-Preflight laeuft",
        description: "Der finale Handoff wird fachlich geprueft.",
        detail,
        worker,
      } as const
    case "publishing":
      return {
        tone: "running",
        label: "Supabase-Handoff laeuft",
        description:
          "Produkt, Bild-Link, User-Verknuepfung und Benachrichtigung werden geschrieben.",
        detail,
        worker,
      } as const
    case "waiting_for_review":
      return {
        tone: "ready",
        label: "Research erfolgreich - bereit fuer Review",
        description: "Der Worker ist fertig. Pruefe Bild und Eigenschaften im Review.",
        detail,
        worker,
      } as const
    case "blocked":
      return {
        tone: "blocked",
        label: "Research blockiert",
        description:
          "Der Worker konnte nicht sauber abschliessen. Der Grund steht hier und im Job-Fortschritt.",
        detail,
        worker,
      } as const
    case "failed":
      return {
        tone: "blocked",
        label: "Research fehlgeschlagen",
        description:
          "Der letzte Lauf ist fehlgeschlagen. Retry oder Rework kann ihn erneut einreihen.",
        detail,
        worker,
      } as const
    case "done":
      return {
        tone: "ready",
        label: "Job abgeschlossen",
        description: "Dieser Job ist abgeschlossen.",
        detail,
        worker,
      } as const
    default:
      return {
        tone: "idle",
        label: "Kein aktiver Research",
        description: "Der aktuelle Job ist nicht aktiv.",
        detail,
        worker,
      } as const
  }
}

async function loadDetail(submissionId: string) {
  try {
    assertLocalServiceHeaders(await headers())
    const submission = await loadProductIntakeSubmissionDetail(createServiceClient(), submissionId)
    return { submission }
  } catch (caught) {
    return {
      error:
        caught instanceof Error ? caught.message : "Detailansicht konnte nicht geladen werden.",
    }
  }
}

function findLocalPackagePath(
  progress: Record<string, unknown> | null,
  payload: Record<string, unknown> | null,
) {
  for (const source of [progress, payload]) {
    if (!source) continue
    for (const key of ["local_package_path", "package_path", "research_package_path"]) {
      const value = source[key]
      if (typeof value === "string" && value.length > 0) return value
    }
  }
  return null
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function progressMessage(progress: JsonRecord | null) {
  for (const key of ["message", "next_action", "blocker", "reason"]) {
    const value = progress?.[key]
    if (typeof value === "string" && value.trim().length > 0) return value
  }
  const blockers = progress?.blockers
  if (Array.isArray(blockers)) {
    const text = blockers.filter((item): item is string => typeof item === "string").join("; ")
    if (text.trim().length > 0) return text
  }
  return null
}

function buildReviewModel(
  payload: JsonRecord | null,
  artifacts: ProductIntakeResearchArtifact[],
  decisions: ProductIntakeReviewDecisionRow[],
  submittedBrand: string | null,
) {
  const finalPayload = recordValue(payload?.final)
  const product = recordValue(finalPayload?.product)
  const brandReview = buildBrandReview(submittedBrand, payload, finalPayload, decisions)
  const imageArtifact = artifacts.find((artifact) => artifact.kind === "image_candidate")
  const latestProcessedImageArtifact = artifacts.find(isProcessedImageArtifact)
  const propertyArtifact = artifacts.find((artifact) => artifact.kind === "property_synthesis")
  const publicationArtifact = artifacts.find((artifact) => artifact.kind === "publication_preview")
  const publishCompleted = artifacts.some((artifact) => {
    if (artifact.kind !== "publish_result" || artifact.status !== "done") return false
    return (
      Boolean(stringValue(artifact.payload.approved_product_id)) &&
      "notification" in artifact.payload
    )
  })
  const publishFailed = artifacts.some(
    (artifact) => artifact.kind === "publish_result" && artifact.status === "failed",
  )
  const imageCandidateCreatedAt = imageArtifact?.created_at
  const rawImageDecisionRow = latestDecisionRowAtOrAfter(
    decisions,
    "raw.image",
    imageCandidateCreatedAt,
  )
  const rawImageDecision = rawImageDecisionRow?.decision ?? null
  const rawImageRejected = rawImageDecision === "image_rejected"
  const legacyImageDecision =
    latestDecisionRowAtOrAfter(decisions, "final.image", imageCandidateCreatedAt)?.decision ?? null
  const rawImageApproved =
    rawImageDecision === "approved" ||
    rawImageDecision === "image_approved" ||
    legacyImageDecision === "image_approved"
  const imageCandidateCreatedTime = imageCandidateCreatedAt
    ? new Date(imageCandidateCreatedAt).getTime()
    : null
  const processedImageCreatedTime = latestProcessedImageArtifact
    ? new Date(latestProcessedImageArtifact.created_at).getTime()
    : 0
  const processedImageValid =
    Boolean(latestProcessedImageArtifact) &&
    rawImageApproved &&
    !rawImageRejected &&
    (imageCandidateCreatedTime === null ||
      processedImageCreatedTime >= imageCandidateCreatedTime) &&
    (!rawImageDecisionRow ||
      processedImageCreatedTime >= new Date(rawImageDecisionRow.reviewed_at).getTime())
  const processedImageArtifact = processedImageValid ? latestProcessedImageArtifact : undefined
  const processedImageReady =
    processedImageArtifact !== undefined && isReadyProcessedImageArtifact(processedImageArtifact)
  const processedImageNeedsWork = processedImageArtifact !== undefined && !processedImageReady
  const finalImageDecision = latestDecisionAfter(
    decisions,
    "final.image",
    processedImageReady ? processedImageArtifact?.created_at : undefined,
  )
  const propertiesDecision = latestDecision(decisions, "final.properties")
  const artifactImageUrl = stringValue(imageArtifact?.payload.image_url)
  const productImageUrl = stringValue(product?.image_url)
  const imageUrl = productImageUrl ?? artifactImageUrl
  const imageSourceUrl =
    firstString(imageArtifact?.source_urls) ??
    firstString(arrayValue(imageArtifact?.payload.source_urls)) ??
    stringValue(imageArtifact?.payload.source_url)
  const categorySpecs = recordValue(finalPayload?.category_specs)

  const properties = buildReviewPropertyRows(
    product,
    categorySpecs,
    arrayValue(finalPayload?.identifiers) ?? [],
  )
  const imageSelected = rawImageApproved
  const imageSearchRequested = rawImageDecision === "image_rejected"
  const finalImageApproved = finalImageDecision === "image_approved"
  const propertiesApproved =
    propertiesDecision === "approved" ||
    latestDecision(decisions, "final.product") === "publish_approved"
  const brandApproved = !brandReview || brandReview.approved
  const readyForFinalApproval = finalImageApproved && propertiesApproved && brandApproved

  return {
    ready: Boolean(finalPayload),
    imageUrl,
    imageAlt:
      [
        stringValue(product?.canonical_brand),
        stringValue(product?.product_line),
        stringValue(product?.clean_name),
      ]
        .filter(Boolean)
        .join(" ") || "Produktbild",
    imageSourceUrl,
    imageConfidence: imageArtifact?.confidence ?? null,
    imageEvidence: stringValue(imageArtifact?.payload.evidence),
    imageDecision: rawImageDecision ?? legacyImageDecision,
    imageSearchRequested,
    imageSelected,
    processedImageUrl: stringValue(processedImageArtifact?.payload.public_review_url),
    processedQaUrl: stringValue(processedImageArtifact?.payload.qa_review_url),
    processedImageReady,
    processedImageNeedsWork,
    processedImageNote:
      qualityGateReason(processedImageArtifact) ??
      stringValue(processedImageArtifact?.payload.notes) ??
      "Lokales Review-Bild wurde verarbeitet und wartet auf finalen Bildcheck.",
    finalImageApproved,
    brandReview,
    publishCompleted,
    publishFailed,
    productDecision: propertiesDecision ?? latestDecision(decisions, "final.product"),
    propertiesApproved,
    readyForFinalApproval,
    summary:
      stringValue(publicationArtifact?.payload.summary) ??
      stringValue(propertyArtifact?.payload.summary),
    sources: sourceRows(finalPayload?.sources),
    properties,
    imageMilestones: [
      milestone("Bild recherchiert", Boolean(imageUrl)),
      milestone("Bild ausgewaehlt", imageSelected, Boolean(imageUrl) && !imageSelected),
      milestone("Bild verarbeitet", processedImageReady, imageSelected && !processedImageReady),
      milestone(
        "Finalbild freigegeben",
        finalImageApproved,
        processedImageReady && !finalImageApproved,
      ),
    ],
    brandMilestones: brandReview
      ? [
          milestone("Marke vorgeschlagen", true),
          milestone("Marke freigegeben", brandReview.approved, !brandReview.approved),
        ]
      : [],
    propertyMilestones: [
      milestone("Eigenschaften recherchiert", properties.length > 0),
      milestone(
        "Eigenschaften freigegeben",
        propertiesApproved,
        properties.length > 0 && !propertiesApproved,
      ),
    ],
    handoffMilestones: [
      milestone(
        "Produkt freigegeben",
        publishCompleted,
        readyForFinalApproval && !publishCompleted,
      ),
    ],
  }
}

function isProcessedImageArtifact(artifact: ProductIntakeResearchArtifact) {
  return artifact.kind === "processed_image"
}

function isReadyProcessedImageArtifact(artifact: ProductIntakeResearchArtifact) {
  return (
    artifact.kind === "processed_image" &&
    artifact.status === "pending_review" &&
    booleanValue(artifact.payload.final_image_ready) === true &&
    booleanValue(artifact.payload.transparent_background_detected) === true
  )
}

function qualityGateReason(artifact: ProductIntakeResearchArtifact | undefined) {
  const qualityGate = recordValue(artifact?.payload.quality_gate)
  return stringValue(qualityGate?.reason)
}

function milestone(label: string, done: boolean, active = false) {
  return {
    label,
    status: done ? "done" : active ? "active" : "pending",
  } as const
}

function sourceRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const record = recordValue(item)
    const url = stringValue(record?.url)
    if (!url) return []
    return [
      {
        url,
        title: stringValue(record?.title),
        evidence: stringValue(record?.evidence),
      },
    ]
  })
}

function buildBrandReview(
  submittedBrand: string | null,
  payload: JsonRecord | null,
  finalPayload: JsonRecord | null | undefined,
  decisions: ProductIntakeReviewDecisionRow[],
) {
  const product = recordValue(finalPayload?.product)
  const canonicalBrand = stringValue(product?.canonical_brand)
  const productLine = stringValue(product?.product_line)
  const cleanName = stringValue(product?.clean_name)
  const brandDecision = latestDecisionRow(decisions, "product.canonical_brand")
  const lineDecision = latestDecisionRow(decisions, "product.product_line")
  const cleanNameDecision = latestDecisionRow(decisions, "product.clean_name")
  const approvedBrand = brandValueFromDecision(brandDecision)
  const approvedLine = decisionStringValue(lineDecision, "product_line")
  const approvedCleanName = decisionStringValue(cleanNameDecision, "clean_name")
  const proposedBrand = approvedBrand ?? canonicalBrand ?? normalizeBrandProposal(submittedBrand)
  const proposedLine = approvedLine ?? (lineDecision?.decision === "approved" ? null : productLine)
  const proposedProductName =
    approvedCleanName ??
    cleanName ??
    normalizeBrandProposal(stringValue(payload?.product_name_text)) ??
    "Unbekannter Produktname"

  if (!proposedBrand) return null
  if (canonicalBrand && !brandDecision) return null

  return {
    proposedBrand,
    proposedLine,
    proposedProductName,
    candidates: brandCandidateRows(payload, finalPayload),
    approved:
      brandDecision?.decision === "approved" &&
      Boolean(approvedBrand) &&
      lineDecision?.decision === "approved" &&
      cleanNameDecision?.decision === "approved" &&
      Boolean(approvedCleanName),
    evidence: canonicalBrand
      ? "Diese Schreibweise liegt bereits im Research-Payload."
      : "Die Marke ist noch nicht in der kanonischen Tabelle aufgeloest. Pruefe die Schreibweise, bevor der Worker sie fuer diesen Product-Intake verwendet.",
  }
}

function brandValueFromDecision(decision: ProductIntakeReviewDecisionRow | null | undefined) {
  if (!decision || decision.decision !== "approved") return null
  const reviewerValue = recordValue(decision.reviewer_value)
  const proposedValue = recordValue(decision.proposed_value)
  return (
    stringValue(reviewerValue?.canonical_brand) ??
    stringValue(reviewerValue?.canonicalName) ??
    stringValue(proposedValue?.canonical_brand) ??
    stringValue(proposedValue?.canonicalName)
  )
}

function decisionStringValue(
  decision: ProductIntakeReviewDecisionRow | null | undefined,
  key: string,
) {
  if (!decision || decision.decision !== "approved") return null
  const reviewerValue = recordValue(decision.reviewer_value)
  const proposedValue = recordValue(decision.proposed_value)
  return stringValue(reviewerValue?.[key]) ?? stringValue(proposedValue?.[key])
}

function brandCandidateRows(
  payload: JsonRecord | null,
  finalPayload: JsonRecord | null | undefined,
) {
  const candidates =
    arrayValue(recordValue(payload?.brand_resolution_context)?.nearby_brand_options) ??
    arrayValue(recordValue(finalPayload?.brand_resolution_context)?.nearby_brand_options) ??
    []
  return candidates.flatMap((item) => {
    const record = recordValue(item)
    const brand =
      stringValue(record?.canonical_brand) ??
      stringValue(record?.canonicalName) ??
      stringValue(record?.brand) ??
      stringValue(record?.label)
    if (!brand) return []
    return [
      {
        brand,
        line: stringValue(record?.product_line) ?? stringValue(record?.line),
      },
    ]
  })
}

function normalizeBrandProposal(value: string | null) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function latestDecision(decisions: ProductIntakeReviewDecisionRow[], fieldPath: string) {
  return latestDecisionRow(decisions, fieldPath)?.decision ?? null
}

function latestDecisionRow(decisions: ProductIntakeReviewDecisionRow[], fieldPath: string) {
  return decisions.find((decision) => decision.field_path === fieldPath) ?? null
}

function latestDecisionRowAtOrAfter(
  decisions: ProductIntakeReviewDecisionRow[],
  fieldPath: string,
  after: string | undefined,
) {
  if (!after) return latestDecisionRow(decisions, fieldPath)
  const afterTime = new Date(after).getTime()
  return (
    decisions.find((decision) => {
      if (decision.field_path !== fieldPath) return false
      return new Date(decision.reviewed_at).getTime() >= afterTime
    }) ?? null
  )
}

function latestDecisionAfter(
  decisions: ProductIntakeReviewDecisionRow[],
  fieldPath: string,
  after: string | undefined,
) {
  if (!after) return null
  const afterTime = new Date(after).getTime()
  return (
    decisions.find((decision) => {
      if (decision.field_path !== fieldPath) return false
      return new Date(decision.reviewed_at).getTime() >= afterTime
    })?.decision ?? null
  )
}

function recordValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : null
}

function firstString(value: unknown[] | null | undefined) {
  return (
    value?.find((item): item is string => typeof item === "string" && item.trim().length > 0) ??
    null
  )
}

function formatConfidence(value: number | null) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "-"
}

function describeReviewProgress(
  reviewModel: ReturnType<typeof buildReviewModel>,
  jobStatus: string,
  jobStage: string,
) {
  if (reviewModel.publishCompleted) return describePublishedProgress()
  if (reviewModel.publishFailed) {
    return {
      percent: 90,
      label: "Finaler Handoff fehlgeschlagen",
      description:
        "Der Supabase-Handoff wurde versucht, aber nicht abgeschlossen. Der letzte Fehler steht in den Research-Artefakten.",
    }
  }
  if (reviewModel.readyForFinalApproval) {
    return {
      percent: 90,
      label: "Bereit fuer finalen Supabase-Handoff",
      description:
        "Bild und Eigenschaften sind freigegeben. Der naechste Klick schreibt Produkt, Link und Benachrichtigung.",
    }
  }
  return describeJobProgress(jobStatus, jobStage, {
    imageSearchRequested: reviewModel.imageSearchRequested,
    imageSelected: reviewModel.imageSelected,
    processedImageNeedsWork: reviewModel.processedImageNeedsWork,
    processedImageReady: reviewModel.processedImageReady,
  })
}

function describeJobProgress(
  status: string,
  stage: string,
  state: {
    imageSearchRequested: boolean
    imageSelected: boolean
    processedImageNeedsWork: boolean
    processedImageReady: boolean
  },
) {
  if (stage === "image_judging") {
    if (status === "queued") {
      return {
        percent: 55,
        label: "Bildverarbeitung ist eingereiht",
        description:
          "Das Rohbild ist freigegeben; der Worker erstellt als naechstes das verarbeitete Bild.",
      }
    }
    if (status === "running") {
      return {
        percent: 65,
        label: "Bildverarbeitung laeuft",
        description:
          "Der Worker entfernt den Hintergrund, normalisiert die Groesse und baut die QA-Vorschau.",
      }
    }
  }
  if (state.processedImageReady && !state.imageSearchRequested) {
    return {
      percent: 75,
      label: "Verarbeitetes Bild pruefen",
      description:
        "Das finale Review-Bild ist erstellt. Pruefe es und gib es frei, wenn es sauber ist.",
    }
  }
  if (state.processedImageNeedsWork) {
    return {
      percent: 65,
      label: "Bild-QA braucht ein besseres Bild",
      description:
        "Der Worker hat das Bild verarbeitet, aber die Qualitaetspruefung hat Schatten, Reflexionen oder Reste gefunden.",
    }
  }

  switch (status) {
    case "queued":
      return {
        percent: 15,
        label: "Research ist eingereiht",
        description: "Der naechste Worker-Lauf nimmt diesen Produktauftrag auf.",
      }
    case "running":
      if (state.imageSearchRequested) {
        return {
          percent: 45,
          label: "Bildsuche laeuft",
          description: "Der Worker sucht gerade nach einem besseren Produktbild.",
        }
      }
      return {
        percent: 45,
        label: "Research laeuft",
        description: "Codex sammelt Quellen, Eigenschaften und Bildkandidaten.",
      }
    case "waiting_for_rework":
      if (state.imageSearchRequested) {
        return {
          percent: 35,
          label: "Bildsuche ist eingereiht",
          description:
            "Das Bild ist abgelehnt; der Worker sucht als naechstes einen besseren Bildvorschlag.",
        }
      }
      return {
        percent: 35,
        label: "Rework ist eingereiht",
        description:
          "Nick-Kommentare sind gespeichert; der Worker ueberarbeitet das ganze Produkt.",
      }
    case "waiting_for_review":
      if (state.imageSearchRequested) {
        return {
          percent: 75,
          label: "Neuen Bildvorschlag pruefen",
          description:
            "Der Worker ist fertig. Pruefe den neuen Bildvorschlag und die aktualisierten Eigenschaften.",
        }
      }
      return {
        percent: 75,
        label: "Bereit fuer Review",
        description: "Pruefe Bild, Eigenschaften und finalen Handoff, dann starte Preflight.",
      }
    case "blocked":
      return {
        percent: 60,
        label: "Blockiert",
        description: "Ein Blocker steht im Job-Fortschritt. Klaere ihn oder starte Retry/Rework.",
      }
    case "failed":
      return {
        percent: 60,
        label: "Fehlgeschlagen",
        description: "Der letzte Worker-Lauf ist fehlgeschlagen. Retry ist moeglich.",
      }
    case "done":
      return {
        percent: 100,
        label: "Abgeschlossen",
        description: "Der Job ist abgeschlossen.",
      }
    default:
      return {
        percent: 0,
        label: "Noch kein Research-Job",
        description: "Starte Research, damit das Produkt in die Worker-Warteschlange kommt.",
      }
  }
}

function describePublishedProgress() {
  return {
    percent: 100,
    label: "Produkt freigegeben",
    description: "Finaler Supabase-Handoff ist abgeschlossen.",
  }
}
