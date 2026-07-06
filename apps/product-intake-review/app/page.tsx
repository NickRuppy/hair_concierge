"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type QueueRow = {
  submissionId: string
  jobId: string | null
  brand: string
  productName: string
  category: string
  submissionStatus: string
  jobStatus: string
  jobStage: string
  priority: number
  attemptCount: number
  maxAttempts: number
  updatedAt: string
  lockedAgeMinutes: number | null
  nextAction: string
}

type QueueResponse = {
  rows: QueueRow[]
  source: string
  generatedAt: string
}

type QueueFilter = "active" | "done" | "all"

const statusLabels: Record<string, string> = {
  needs_job: "Ohne Job",
  queued: "Eingereiht",
  running: "Laeuft",
  waiting_for_review: "Review bereit",
  blocked: "Blockiert",
  failed: "Fehler",
  done: "Erledigt",
  cancelled: "Abgebrochen",
  exhausted: "Versuche aufgebraucht",
}

const retryableStatuses = new Set(["blocked", "failed"])
const completedSubmissionStatuses = new Set(["approved"])
const queueFilters: Array<{ label: string; value: QueueFilter }> = [
  { label: "Aktiv", value: "active" },
  { label: "Erledigt", value: "done" },
  { label: "Alle", value: "all" },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function effectiveStatus(row: QueueRow) {
  if (isCompletedQueueRow(row)) return "done"

  if (
    row.maxAttempts > 0 &&
    row.attemptCount >= row.maxAttempts &&
    !["done", "cancelled", "waiting_for_review"].includes(row.jobStatus)
  ) {
    return "exhausted"
  }

  return row.jobStatus
}

function isCompletedQueueRow(row: QueueRow) {
  return completedSubmissionStatuses.has(row.submissionStatus) || row.jobStatus === "done"
}

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  const [queuingSubmissionId, setQueuingSubmissionId] = useState<string | null>(null)
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("active")

  async function loadQueue() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/queue", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`Queue konnte nicht geladen werden (${response.status}).`)
      }
      setQueue((await response.json()) as QueueResponse)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unbekannter Fehler.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadQueue()
  }, [])

  const counts = useMemo(() => {
    const rows = queue?.rows ?? []
    return rows.reduce<Record<string, number>>((accumulator, row) => {
      const status = effectiveStatus(row)
      accumulator[status] = (accumulator[status] ?? 0) + 1
      return accumulator
    }, {})
  }, [queue])

  const filteredRows = useMemo(() => {
    const rows = queue?.rows ?? []
    if (queueFilter === "all") return rows
    if (queueFilter === "done") return rows.filter(isCompletedQueueRow)
    return rows.filter((row) => !isCompletedQueueRow(row))
  }, [queue, queueFilter])

  const filterCounts = useMemo(() => {
    const rows = queue?.rows ?? []
    const done = rows.filter(isCompletedQueueRow).length
    return {
      active: rows.length - done,
      all: rows.length,
      done,
    } satisfies Record<QueueFilter, number>
  }, [queue])

  async function retryJob(jobId: string) {
    setRetryingJobId(jobId)

    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" })
      if (!response.ok) {
        throw new Error(`Retry fehlgeschlagen (${response.status}).`)
      }
      const result = (await response.json()) as {
        job: Pick<QueueRow, "jobId" | "jobStatus" | "jobStage" | "nextAction" | "updatedAt">
      }
      setQueue((current) => {
        if (!current) return current
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          rows: current.rows.map((row) =>
            row.jobId === jobId
              ? {
                  ...row,
                  jobStatus: result.job.jobStatus,
                  jobStage: result.job.jobStage,
                  nextAction: result.job.nextAction,
                  updatedAt: result.job.updatedAt,
                }
              : row,
          ),
        }
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retry fehlgeschlagen.")
    } finally {
      setRetryingJobId(null)
    }
  }

  async function queueSubmission(submissionId: string) {
    setQueuingSubmissionId(submissionId)

    try {
      const response = await fetch(`/api/submissions/${submissionId}/queue`, { method: "POST" })
      if (!response.ok) {
        throw new Error(`Einreihen fehlgeschlagen (${response.status}).`)
      }
      const result = (await response.json()) as {
        job: Pick<QueueRow, "jobId" | "jobStatus" | "jobStage" | "nextAction" | "updatedAt">
      }
      setQueue((current) => {
        if (!current) return current
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          rows: current.rows.map((row) =>
            row.submissionId === submissionId
              ? {
                  ...row,
                  jobId: result.job.jobId,
                  jobStatus: result.job.jobStatus,
                  jobStage: result.job.jobStage,
                  nextAction: result.job.nextAction,
                  updatedAt: result.job.updatedAt,
                }
              : row,
          ),
        }
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Einreihen fehlgeschlagen.")
    } finally {
      setQueuingSubmissionId(null)
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Interne Ops</p>
          <h1>Produkt-Intake Warteschlange</h1>
        </div>
        <button className="primaryButton" type="button" onClick={() => void loadQueue()}>
          Aktualisieren
        </button>
      </header>

      <section className="statusStrip" aria-label="Systemstatus">
        <div>
          <span className="label">App</span>
          <strong>Online</strong>
        </div>
        <div>
          <span className="label">Quelle</span>
          <strong>
            {queue?.source === "placeholder" ? "Platzhalter" : (queue?.source ?? "-")}
          </strong>
        </div>
        <div>
          <span className="label">Letzter Refresh</span>
          <strong>{queue ? formatDate(queue.generatedAt) : "-"}</strong>
        </div>
        <div>
          <span className="label">Worker</span>
          <strong>Heartbeat spaeter</strong>
        </div>
      </section>

      <section className="summaryGrid" aria-label="Queue Status">
        {Object.entries(statusLabels).map(([status, label]) => (
          <div className="summaryCell" key={status}>
            <span>{label}</span>
            <strong>{counts[status] ?? 0}</strong>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>
            {queueFilter === "done"
              ? "Erledigte Eintraege"
              : queueFilter === "all"
                ? "Alle Eintraege"
                : "Aktive Eintraege"}
          </h2>
          <span>{filteredRows.length} Zeilen</span>
        </div>

        <div className="queueFilters" aria-label="Queue Filter">
          {queueFilters.map((filter) => (
            <button
              className={`filterButton${queueFilter === filter.value ? " filterButton-active" : ""}`}
              key={filter.value}
              type="button"
              onClick={() => setQueueFilter(filter.value)}
            >
              {filter.label} ({filterCounts[filter.value]})
            </button>
          ))}
        </div>

        {isLoading ? <p className="stateText">Warteschlange wird geladen...</p> : null}
        {error ? <p className="stateText errorText">{error}</p> : null}
        {!isLoading && !error && queue?.rows.length === 0 ? (
          <p className="stateText">Keine offenen Produkt-Intake-Eintraege.</p>
        ) : null}
        {!isLoading && !error && (queue?.rows.length ?? 0) > 0 && filteredRows.length === 0 ? (
          <p className="stateText">Keine Eintraege in diesem Filter.</p>
        ) : null}

        {!isLoading && !error && filteredRows.length ? (
          <>
            <div className="queueList">
              {filteredRows.map((row) => {
                const status = effectiveStatus(row)

                return (
                  <article className="queueCard" key={row.submissionId}>
                    <div className="queueCardMain">
                      <span className={`chip chip-${status}`}>
                        {statusLabels[status] ?? status}
                      </span>
                      <Link className="productLink" href={`/submissions/${row.submissionId}`}>
                        <strong>{row.brand}</strong>
                        <span>{row.productName}</span>
                      </Link>
                      <span className="muted">
                        {row.category} · {row.submissionStatus} · {row.submissionId}
                      </span>
                    </div>
                    <div className="queueCardMeta">
                      <span>Stage: {row.jobStage}</span>
                      <span>
                        Versuche: {row.attemptCount}
                        {row.maxAttempts ? ` / ${row.maxAttempts}` : ""}
                      </span>
                      <span>Update: {formatDate(row.updatedAt)}</span>
                      <strong>{row.nextAction}</strong>
                    </div>
                    <div className="queueCardActions">
                      <Link className="smallButton" href={`/submissions/${row.submissionId}`}>
                        Review oeffnen
                      </Link>
                      {row.jobStatus === "needs_job" ? (
                        <button
                          className="smallButton secondaryButton"
                          type="button"
                          disabled={queuingSubmissionId === row.submissionId}
                          onClick={() => void queueSubmission(row.submissionId)}
                        >
                          {queuingSubmissionId === row.submissionId
                            ? "Reiht ein..."
                            : "Job anlegen"}
                        </button>
                      ) : row.jobId && retryableStatuses.has(row.jobStatus) ? (
                        <button
                          className="smallButton secondaryButton"
                          type="button"
                          disabled={retryingJobId === row.jobId}
                          onClick={() => void retryJob(row.jobId ?? "")}
                        >
                          {retryingJobId === row.jobId ? "Reiht ein..." : "Retry"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Review</th>
                    <th>Submission</th>
                    <th>Produkt</th>
                    <th>Kategorie</th>
                    <th>Submission-Status</th>
                    <th>Job</th>
                    <th>Stage</th>
                    <th>Prio</th>
                    <th>Versuche</th>
                    <th>Lock</th>
                    <th>Update</th>
                    <th>Naechste Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.submissionId}>
                      <td>
                        <Link
                          className="smallButton secondaryButton"
                          href={`/submissions/${row.submissionId}`}
                        >
                          Review oeffnen
                        </Link>
                      </td>
                      <td>
                        <Link href={`/submissions/${row.submissionId}`}>{row.submissionId}</Link>
                      </td>
                      <td>
                        <Link className="productLink" href={`/submissions/${row.submissionId}`}>
                          <strong>{row.brand}</strong>
                          <span>{row.productName}</span>
                        </Link>
                      </td>
                      <td>{row.category}</td>
                      <td>{row.submissionStatus}</td>
                      <td>
                        <span className={`chip chip-${effectiveStatus(row)}`}>
                          {statusLabels[effectiveStatus(row)] ?? effectiveStatus(row)}
                        </span>
                      </td>
                      <td>{row.jobStage}</td>
                      <td>{row.priority}</td>
                      <td>
                        {row.attemptCount}
                        {row.maxAttempts ? ` / ${row.maxAttempts}` : ""}
                      </td>
                      <td>{row.lockedAgeMinutes === null ? "-" : `${row.lockedAgeMinutes} min`}</td>
                      <td>{formatDate(row.updatedAt)}</td>
                      <td>
                        {row.jobStatus === "needs_job" ? (
                          <button
                            className="smallButton"
                            type="button"
                            disabled={queuingSubmissionId === row.submissionId}
                            onClick={() => void queueSubmission(row.submissionId)}
                          >
                            {queuingSubmissionId === row.submissionId
                              ? "Reiht ein..."
                              : "Job anlegen"}
                          </button>
                        ) : row.jobId && retryableStatuses.has(row.jobStatus) ? (
                          <button
                            className="smallButton"
                            type="button"
                            disabled={retryingJobId === row.jobId}
                            onClick={() => void retryJob(row.jobId ?? "")}
                          >
                            {retryingJobId === row.jobId ? "Reiht ein..." : "Retry"}
                          </button>
                        ) : (
                          row.nextAction
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}
