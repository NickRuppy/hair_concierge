"use client"

import type {
  AgentCompareJudgmentDraft,
  AgentCompareJudgmentRecord,
  AgentCompareResponse,
  AgentCompareUserOption,
  AgentCompareUserSnapshot,
  CompareRunResult,
} from "@/lib/agent/compare/types"
import { AGENT_COMPARE_PROMPT_TEMPLATES } from "@/lib/agent/compare/prompt-packs"
import { useEffect, useState, useTransition } from "react"

type JudgmentHistoryEntry = AgentCompareJudgmentDraft & {
  userId: string
  userLabel: string
  prompt: string
  createdAt: string
}

type BootstrapResponse = {
  users: AgentCompareUserOption[]
  selectedUser: AgentCompareUserSnapshot | null
}

const REASON_OPTIONS: Array<AgentCompareJudgmentDraft["primary_reason"]> = [
  "natuerlicher",
  "nuetzlicher",
  "vorsichtiger",
  "personalisierter",
  "anderes",
]

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm leading-6 text-foreground">{value}</p>
    </div>
  )
}

function formatTracePrice(price: number, currency: string | null): string {
  return `${price.toFixed(2).replace(".", ",")} ${currency ?? "EUR"}`
}

function ProductTracePanel({ result }: { result: CompareRunResult }) {
  const trace = result.product_trace
  if (!trace) return null

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-label text-muted-foreground">Produktentscheidung</p>
        <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-foreground">
          {trace.decision}
        </span>
        {trace.category ? (
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {trace.category}
          </span>
        ) : null}
      </div>

      {trace.profile_basis.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Profilbasis</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trace.profile_basis.map((basis) => (
              <li key={basis}>{basis}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Kategorie-Logik</p>
        <p className="text-sm leading-6 text-foreground">{trace.category_guidance}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TraceRow label="Product policy" value={trace.product_response_policy ?? "none"} />
        <TraceRow label="Policy reason" value={trace.policy_reason ?? "none"} />
      </div>

      {trace.missing_info.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Fehlende Blocker</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trace.missing_info.map((item) => (
              <li key={item.key}>
                {item.label}: {item.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {trace.unsupported_requested_signals.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Nicht belegte Anfrage</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trace.unsupported_requested_signals.map((signal) => (
              <li key={`${signal.field}-${signal.value}-${signal.reason}`}>
                {signal.field}={signal.value}: {signal.user_message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {trace.products.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tool-Produkte</p>
          <ul className="space-y-2 text-sm text-foreground">
            {trace.products.map((product) => (
              <li key={product.product_id} className="rounded-md border bg-background p-2">
                <div className="font-medium">
                  {product.rank}. {product.name}
                  {product.brand ? (
                    <span className="font-normal text-muted-foreground"> · {product.brand}</span>
                  ) : null}
                  {typeof product.price_eur === "number" ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {formatTracePrice(product.price_eur, product.currency)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground">{product.fit_reason}</p>
                {product.caveat ? (
                  <p className="mt-1 text-muted-foreground">Caveat: {product.caveat}</p>
                ) : null}
                {product.supported_claims.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sichere Angaben:{" "}
                    {product.supported_claims.map((claim) => claim.label).join(" · ")}
                  </p>
                ) : null}
                {product.unsupported_requested_signals.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Keine sichere Angabe:{" "}
                    {product.unsupported_requested_signals
                      .map((signal) => `${signal.field}=${signal.value}`)
                      .join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function RouteTracePanel({ result }: { result: CompareRunResult }) {
  const trace = result.route_trace
  if (!trace) return null

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-label text-muted-foreground">Route</p>
        <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-foreground">
          {trace.user_job}
        </span>
        {trace.product_category ? (
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {trace.product_category}
          </span>
        ) : null}
        <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {Math.round(trace.confidence * 100)}%
        </span>
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Playbook</p>
          <p className="text-foreground">{trace.required_playbook_id ?? "none"}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Toolplan</p>
          <p className="text-foreground">
            {trace.tool_plan.length > 0 ? trace.tool_plan.join(" -> ") : "kein Tool"}
          </p>
        </div>
      </div>

      {trace.guidance_ids.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Guidance</p>
          <p className="text-sm leading-6 text-foreground">{trace.guidance_ids.join(", ")}</p>
        </div>
      ) : null}

      {trace.concerns.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Concerns</p>
          <p className="text-sm text-foreground">{trace.concerns.join(", ")}</p>
        </div>
      ) : null}

      {trace.active_profile_signals.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Aktive Signale</p>
          <p className="text-sm text-foreground">
            {trace.active_profile_signals
              .map((signal) => `${signal.field}=${signal.value} (${signal.selection_effect})`)
              .join(", ")}
          </p>
        </div>
      ) : null}

      {trace.validation_warnings.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Warnings</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trace.validation_warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ResultCard({ title, result }: { title: string; result: CompareRunResult | null }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
          {result?.latency_ms !== null && result?.latency_ms !== undefined
            ? `${result.latency_ms} ms`
            : "—"}
        </span>
      </div>

      {!result ? (
        <p className="text-sm text-muted-foreground">Noch kein Ergebnis.</p>
      ) : result.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {result.error}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">
            {result.answer || "Keine Antwort erhalten."}
          </div>

          {result.debug_lines.length > 0 ? (
            <div className="space-y-2">
              <p className="type-label text-muted-foreground">Debug</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.debug_lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <RouteTracePanel result={result} />

          <ProductTracePanel result={result} />

          {result.matched_products.length > 0 ? (
            <div className="space-y-2">
              <p className="type-label text-muted-foreground">Produkte</p>
              <ul className="space-y-1 text-sm text-foreground">
                {result.matched_products.map((product) => (
                  <li key={`${product.name}-${product.category ?? "none"}`}>
                    {product.name}
                    {product.category ? (
                      <span className="text-muted-foreground"> · {product.category}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

async function fetchBootstrap(userId?: string): Promise<BootstrapResponse> {
  const search = userId ? `?userId=${encodeURIComponent(userId)}` : ""
  const response = await fetch(`/api/labs/agent-compare${search}`)
  const data = (await response.json()) as BootstrapResponse | { error?: string }

  if (!response.ok) {
    throw new Error(
      "error" in data && typeof data.error === "string"
        ? data.error
        : "Compare-Lab konnte nicht geladen werden",
    )
  }

  return data as BootstrapResponse
}

export function AgentCompareLab() {
  const [users, setUsers] = useState<AgentCompareUserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedUser, setSelectedUser] = useState<AgentCompareUserSnapshot | null>(null)
  const [templateId, setTemplateId] = useState("")
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState<AgentCompareResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [winner, setWinner] = useState<AgentCompareJudgmentDraft["winner"]>("tie")
  const [primaryReason, setPrimaryReason] =
    useState<AgentCompareJudgmentDraft["primary_reason"]>("natuerlicher")
  const [note, setNote] = useState("")
  const [history, setHistory] = useState<JudgmentHistoryEntry[]>([])
  const [isPending, startTransition] = useTransition()
  const [isLoadingUser, startLoadingUser] = useTransition()
  const [isSavingJudgment, startSavingJudgment] = useTransition()

  const currentResult = result?.results.find((entry) => entry.system === "current") ?? null
  const agentResult = result?.results.find((entry) => entry.system === "agent") ?? null
  const selectedUserOption = users.find((user) => user.id === selectedUserId) ?? null

  useEffect(() => {
    startLoadingUser(async () => {
      try {
        const bootstrap = await fetchBootstrap()
        setUsers(bootstrap.users)
        setSelectedUserId((current) => current || bootstrap.users[0]?.id || "")
      } catch (bootstrapError) {
        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Compare-Lab konnte nicht geladen werden",
        )
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null)
      return
    }

    startLoadingUser(async () => {
      try {
        const bootstrap = await fetchBootstrap(selectedUserId)
        setUsers(bootstrap.users)
        setSelectedUser(bootstrap.selectedUser)
      } catch (bootstrapError) {
        setSelectedUser(null)
        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Testnutzer konnte nicht geladen werden",
        )
      }
    })
  }, [selectedUserId])

  async function handleRunCompare() {
    if (!selectedUserId || prompt.trim().length === 0) return

    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/labs/agent-compare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: selectedUserId,
            prompt,
          }),
        })

        const data = (await response.json()) as AgentCompareResponse | { error?: string }
        if (!response.ok) {
          setResult(null)
          setError(
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Compare fehlgeschlagen",
          )
          return
        }

        setResult(data as AgentCompareResponse)
      } catch (runError) {
        setResult(null)
        setError(runError instanceof Error ? runError.message : "Compare fehlgeschlagen")
      }
    })
  }

  function handleUserChange(nextUserId: string) {
    setSelectedUserId(nextUserId)
    setResult(null)
    setError(null)
  }

  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId)
    const template = AGENT_COMPARE_PROMPT_TEMPLATES.find((entry) => entry.id === nextTemplateId)
    if (template) {
      setPrompt(template.prompt)
    }
  }

  function handleSaveJudgment() {
    if (!result || !selectedUser || !selectedUserOption || !currentResult || !agentResult) return

    const createdAt = new Date().toISOString()
    const historyEntry: JudgmentHistoryEntry = {
      userId: selectedUserOption.id,
      userLabel: selectedUserOption.label,
      prompt,
      winner,
      primary_reason: primaryReason,
      note,
      createdAt,
    }

    const record: AgentCompareJudgmentRecord = {
      createdAt,
      user: selectedUserOption,
      prompt,
      context: selectedUser,
      results: {
        current: currentResult,
        agent: agentResult,
      },
      judgment: {
        winner,
        primary_reason: primaryReason,
        note,
      },
    }

    setHistory((current) => [historyEntry, ...current])
    setNote("")

    startSavingJudgment(async () => {
      try {
        const response = await fetch("/api/labs/agent-compare/judgments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(record),
        })

        const data = (await response.json()) as { ok?: boolean; error?: string }
        if (!response.ok) {
          throw new Error(data.error ?? "Urteil konnte nicht gespeichert werden")
        }
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Urteil konnte nicht gespeichert werden",
        )
      }
    })
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[260px,220px,1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-user">
              Testnutzer
            </label>
            <select
              id="agent-compare-user"
              value={selectedUserId}
              onChange={(event) => handleUserChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">Bitte waehlen</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Geladen werden gespeichertes Profil, aktuelle Routine und relevante Memory.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-template">
              Prompt-Vorlage
            </label>
            <select
              id="agent-compare-template"
              value={templateId}
              onChange={(event) => handleTemplateChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">Keine Vorlage</option>
              {AGENT_COMPARE_PROMPT_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Fuellt nur das Texteingabefeld. Der Testnutzer bleibt derselbe.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-prompt">
              Prompt
            </label>
            <textarea
              id="agent-compare-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Vergleich gegen das aktuelle lokale <code>/api/chat</code> und den neuen Agenten.
          </p>
          <button
            type="button"
            onClick={handleRunCompare}
            disabled={isPending || isLoadingUser || !selectedUserId || prompt.trim().length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Vergleiche..." : "Vergleich starten"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="type-label text-muted-foreground">Geladener Kontext</p>

        {!selectedUser ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {isLoadingUser ? "Lade Testnutzer..." : "Noch kein Testnutzer geladen."}
          </p>
        ) : (
          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Profil-Signale</p>
              {selectedUser.derived_signals.length > 0 ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {selectedUser.derived_signals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keine sichtbaren Signale.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Aktuelle Routine</p>
              {selectedUser.routine_inventory.length > 0 ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {selectedUser.routine_inventory.map((item) => (
                    <li key={`${item.category}-${item.product_name ?? "none"}`}>
                      {item.category}
                      {item.product_name ? ` · ${item.product_name}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keine gespeicherte Routine.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Relevante Memory</p>
              {selectedUser.relevant_memory.length > 0 ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {selectedUser.relevant_memory.map((entry) => (
                    <li key={entry.id}>{entry.content}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keine relevanten Memory-Eintraege.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ResultCard title="Aktuelles Chat-System" result={currentResult} />
        <ResultCard title="Neuer Agent" result={agentResult} />
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[180px,220px,1fr,auto]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-winner">
              Gewinner
            </label>
            <select
              id="agent-compare-winner"
              value={winner}
              onChange={(event) =>
                setWinner(event.target.value as AgentCompareJudgmentDraft["winner"])
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="tie">Unentschieden</option>
              <option value="current">Aktuelles System</option>
              <option value="agent">Neuer Agent</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-reason">
              Hauptgrund
            </label>
            <select
              id="agent-compare-reason"
              value={primaryReason}
              onChange={(event) =>
                setPrimaryReason(event.target.value as AgentCompareJudgmentDraft["primary_reason"])
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-note">
              Notiz
            </label>
            <input
              id="agent-compare-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Kurz festhalten, warum."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSaveJudgment}
              disabled={!result || !selectedUser || !selectedUserOption || isSavingJudgment}
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingJudgment ? "Speichere..." : "Urteil speichern"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <p className="type-label text-muted-foreground">Session-Verlauf</p>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Urteile in dieser Browser-Session gespeichert.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={`${entry.createdAt}-${entry.userId}-${entry.winner}`}
                  className="rounded-lg border bg-background p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>{entry.userLabel}</span>
                    <span>·</span>
                    <span>{entry.winner}</span>
                    <span>·</span>
                    <span>{entry.primary_reason}</span>
                  </div>
                  <p className="mt-2 text-foreground">{entry.note || "Keine Notiz."}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{entry.prompt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
