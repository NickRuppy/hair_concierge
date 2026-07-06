import { loadProductIntakeQueue } from "@chaarlie/product-intake-core"
import { NextResponse } from "next/server"

import { assertLocalServiceRoute, createServiceClient } from "../_lib/service-client"

export async function GET(request: Request) {
  try {
    assertLocalServiceRoute(request)
    const rows = await loadProductIntakeQueue(createServiceClient(), {
      includeCompleted: true,
      limit: 100,
    })

    return NextResponse.json({
      rows: rows.map((row) => {
        const job = row.job
        return {
          submissionId: row.submission_id,
          jobId: job?.id ?? null,
          brand: row.brand ?? "Unbekannt",
          productName: row.product_name ?? "Unbenanntes Produkt",
          category: row.category,
          submissionStatus: row.submission_status,
          jobStatus: job?.status ?? "needs_job",
          jobStage: job?.stage ?? "none",
          priority: job?.priority ?? 0,
          attemptCount: job?.attempt_count ?? 0,
          maxAttempts: job?.max_attempts ?? 0,
          updatedAt: job?.updated_at ?? row.updated_at,
          lockedAgeMinutes: job?.locked_at ? lockAgeMinutes(job.locked_at) : null,
          nextAction: nextActionFor(
            job?.status ?? "needs_job",
            job?.attempt_count ?? 0,
            job?.max_attempts ?? 0,
          ),
        }
      }),
      source: "supabase",
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Queue konnte nicht geladen werden.",
        rows: [],
        source: "error",
        generatedAt: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

function lockAgeMinutes(lockedAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(lockedAt).getTime()) / 60000))
}

function nextActionFor(status: string, attemptCount = 0, maxAttempts = 0): string {
  const attemptsExhausted = maxAttempts > 0 && attemptCount >= maxAttempts

  if (attemptsExhausted && !["done", "cancelled", "waiting_for_review"].includes(status)) {
    return "Versuche aufgebraucht"
  }

  switch (status) {
    case "needs_job":
      return "Job anlegen"
    case "queued":
      return "Wartet auf Worker"
    case "running":
      return "Worker beobachten"
    case "waiting_for_review":
      return "Review vorbereiten"
    case "blocked":
    case "failed":
      return "Job erneut einreihen"
    case "done":
      return "Abgeschlossen"
    case "cancelled":
      return "Abgebrochen"
    default:
      return "Status pruefen"
  }
}
