import type { DiscoveryQuizAnswers } from "@/lib/discovery/quiz-answers"

/**
 * „Quiz-Antworten" (batch 7c, F8): what she answered in the quiz, question by question, at
 * the top of the call. Read-only; an unanswered question reads „—", her main problem is
 * marked where she stated it (or it is her only one).
 */

const TITLE = "Quiz-Antworten"
const KIND_LABEL = { legacy: "Standard-Quiz", personal_plan: "Personal-Plan-Quiz" } as const
const MAIN_LABEL = "Hauptproblem"
const NO_ANSWER = "—"
const NO_LEAD = "Zu diesem Konto gibt es kein Quiz."
const INVALID = "Die Quiz-Antworten sind nicht lesbar."

export function DiscoveryQuizAnswersSection({ quiz }: { quiz: DiscoveryQuizAnswers }) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-baseline gap-3 border-b px-4 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {TITLE}
        </h2>
        {quiz.status === "ready" ? (
          <span className="ml-auto text-[11px] text-muted-foreground">{KIND_LABEL[quiz.kind]}</span>
        ) : null}
      </div>
      {quiz.status !== "ready" ? (
        <p className="px-4 py-3 text-[13px] text-muted-foreground">
          {quiz.status === "no_lead" ? NO_LEAD : INVALID}
        </p>
      ) : (
        <div className="gap-x-8 px-4 py-3 md:columns-2">
          {quiz.groups.map((group) => (
            <div key={group.title} className="mb-3 break-inside-avoid">
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {group.title}
              </h3>
              <dl className="divide-y">
                {group.rows.map((row) => (
                  <div key={row.question} className="flex gap-3 py-1.5">
                    <dt className="w-1/2 shrink-0 text-[12px] leading-5 text-muted-foreground">
                      {row.question}
                    </dt>
                    <dd className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-1 text-[13px] leading-5 text-foreground">
                      {row.answers.length === 0 ? (
                        <span className="text-muted-foreground">{NO_ANSWER}</span>
                      ) : (
                        row.answers.map((answer, index) => (
                          <span key={answer.label}>
                            {answer.main ? (
                              <span className="rounded bg-[var(--brand-plum-ice)] px-1.5 font-bold text-[var(--brand-plum)]">
                                {answer.label}
                                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.08em]">
                                  {MAIN_LABEL}
                                </span>
                              </span>
                            ) : (
                              answer.label
                            )}
                            {index < row.answers.length - 1 ? (
                              <span className="text-muted-foreground"> ·</span>
                            ) : null}
                          </span>
                        ))
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
