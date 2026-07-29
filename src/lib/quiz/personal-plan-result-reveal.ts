const GERMAN_MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const

export const PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS = 2_400
export const PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS = PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS * 3

type RevealTimer = {
  cancel: (handle: number) => void
  schedule: (callback: () => void, delayMs: number) => number
}

export function schedulePersonalPlanResultReveal({
  messageCount,
  onComplete,
  onStep,
  timer,
}: {
  messageCount: number
  onComplete: () => void
  onStep: (index: number) => void
  timer: RevealTimer
}) {
  const handles = Array.from({ length: Math.max(0, messageCount - 1) }, (_, index) =>
    timer.schedule(() => onStep(index + 1), PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS * (index + 1)),
  )
  handles.push(
    timer.schedule(onComplete, PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS * Math.max(1, messageCount)),
  )

  return () => handles.forEach((handle) => timer.cancel(handle))
}

export function claimPersonalPlanResultRevealCompletion(state: { current: boolean }) {
  if (state.current) return false
  state.current = true
  return true
}

function parseDateKey(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new Error(`Invalid date key: ${dateKey}`)
  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatGermanDate(date: Date): string {
  return `${date.getUTCDate()}. ${GERMAN_MONTHS[date.getUTCMonth()]}`
}

export function getBerlinDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Berlin",
    year: "numeric",
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function buildPersonalPlanResultRevealMessages(dateKey: string) {
  const today = parseDateKey(dateKey)
  return [
    {
      after: " startest du mit deinem persönlichen Haarplan.",
      before: "",
      daysFromStart: 0,
      highlight: "Heute",
    },
    {
      after: " kennst du deine Routine ganz genau.",
      before: "Ab ",
      daysFromStart: 7,
      highlight: formatGermanDate(addDays(today, 7)),
    },
    {
      after: " wird dein Haar gesünder und schöner aussehen.",
      before: "Bis ",
      daysFromStart: 28,
      highlight: formatGermanDate(addDays(today, 28)),
    },
  ] as const
}
