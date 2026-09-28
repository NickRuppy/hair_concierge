import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * The call runsheet's own row (`discovery_call_sheets`, consult-runsheet T1): baseline score,
 * re-scores, touchpoints, consult brief, habit commitments, feedback — one per enrollment.
 *
 * Read side only (T3). The JSONB shapes are application contracts the database does not
 * check beyond „is an array", so the parser is defensive: whatever does not match the
 * contract is dropped, and a missing row reads as `null` (every legacy enrollment).
 */

export type DiscoveryCallSheetRescore = {
  score: number
  at: string
  channel: "whatsapp" | "call"
}

export type DiscoveryCallSheetTouchpointKind = "text_checkin" | "rescore_call"

export type DiscoveryCallSheetTouchpoint = {
  kind: DiscoveryCallSheetTouchpointKind
  /** ISO date, `YYYY-MM-DD`. */
  due_on: string
  done_at: string | null
}

export type DiscoveryCallSheetHebel = { title: string; note: string; points: number | null }

export type DiscoveryCallSheetBriefSections = {
  diagnose: string
  hebel: DiscoveryCallSheetHebel[]
  /** Keyed by the step's `decisionKey`. */
  swapReasons: Record<string, string>
  zielLuecken: string[]
  callFragen: string[]
  erwartungen: string[]
}

export type DiscoveryCallSheetBrief = {
  sections: DiscoveryCallSheetBriefSections
  generated_at: string | null
  generated_by: "manual" | "agent"
  source_hash: string | null
}

export type DiscoveryCallSheetHabitCommitment = { id: string; label: string; committed: boolean }

export type DiscoveryCallSheet = {
  baselineScore: number | null
  rescores: DiscoveryCallSheetRescore[]
  touchpoints: DiscoveryCallSheetTouchpoint[]
  consultBrief: DiscoveryCallSheetBrief | null
  habitCommitments: DiscoveryCallSheetHabitCommitment[]
  feedback: string | null
}

export const DISCOVERY_CALL_SHEETS_TABLE = "discovery_call_sheets"
const COLUMNS = "baseline_score, rescores, touchpoints, consult_brief, habit_commitments, feedback"

export const EMPTY_DISCOVERY_BRIEF_SECTIONS: DiscoveryCallSheetBriefSections = {
  diagnose: "",
  hebel: [],
  swapReasons: {},
  zielLuecken: [],
  callFragen: [],
  erwartungen: [],
}

export async function loadDiscoveryCallSheet(
  enrollmentId: string,
  client: SupabaseClient,
): Promise<DiscoveryCallSheet | null> {
  const { data, error } = await client
    .from(DISCOVERY_CALL_SHEETS_TABLE)
    .select(COLUMNS)
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()
  if (error) throw error
  return data ? parseDiscoveryCallSheet(data) : null
}

export function parseDiscoveryCallSheet(row: unknown): DiscoveryCallSheet {
  const record = isRecord(row) ? row : {}
  return {
    baselineScore: scoreOf(record.baseline_score),
    rescores: arrayOf(record.rescores).flatMap((entry) => {
      const score = scoreOf(entry.score)
      const channel =
        entry.channel === "whatsapp" || entry.channel === "call" ? entry.channel : null
      return score !== null && typeof entry.at === "string" && channel
        ? [{ score, at: entry.at, channel }]
        : []
    }),
    touchpoints: arrayOf(record.touchpoints).flatMap((entry) => {
      const kind =
        entry.kind === "text_checkin" || entry.kind === "rescore_call" ? entry.kind : null
      return kind && typeof entry.due_on === "string" && ISO_DATE.test(entry.due_on)
        ? [
            {
              kind,
              due_on: entry.due_on,
              done_at: typeof entry.done_at === "string" ? entry.done_at : null,
            },
          ]
        : []
    }),
    consultBrief: parseBrief(record.consult_brief),
    habitCommitments: arrayOf(record.habit_commitments).flatMap((entry) =>
      typeof entry.id === "string" && typeof entry.label === "string"
        ? [{ id: entry.id, label: entry.label, committed: entry.committed === true }]
        : [],
    ),
    feedback: typeof record.feedback === "string" ? record.feedback : null,
  }
}

function parseBrief(value: unknown): DiscoveryCallSheetBrief | null {
  if (!isRecord(value)) return null
  const sections = isRecord(value.sections) ? value.sections : {}
  const swapReasons = isRecord(sections.swapReasons)
    ? Object.fromEntries(
        Object.entries(sections.swapReasons).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {}
  return {
    sections: {
      diagnose: typeof sections.diagnose === "string" ? sections.diagnose : "",
      hebel: arrayOf(sections.hebel).map((entry) => ({
        title: typeof entry.title === "string" ? entry.title : "",
        note: typeof entry.note === "string" ? entry.note : "",
        points:
          typeof entry.points === "number" && Number.isFinite(entry.points) ? entry.points : null,
      })),
      swapReasons,
      zielLuecken: stringsOf(sections.zielLuecken),
      callFragen: stringsOf(sections.callFragen),
      erwartungen: stringsOf(sections.erwartungen),
    },
    generated_at: typeof value.generated_at === "string" ? value.generated_at : null,
    generated_by: value.generated_by === "agent" ? "agent" : "manual",
    source_hash: typeof value.source_hash === "string" ? value.source_hash : null,
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function scoreOf(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : null
}

function arrayOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
