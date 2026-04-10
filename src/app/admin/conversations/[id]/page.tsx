"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/providers/toast-provider"
import type { ConversationTurnTrace, MessageRagContext } from "@/lib/types"
import { fehler } from "@/lib/vocabulary"
import { ArrowLeft } from "lucide-react"

interface MessageRow {
  id: string
  role: "user" | "assistant" | "system"
  content: string | null
  created_at: string
  rag_context?: MessageRagContext | null
}

interface ConversationDetail {
  conversation: {
    id: string
    title: string | null
    message_count: number
    created_at: string
    updated_at: string
  }
  messages: MessageRow[]
  traces: ConversationTurnTrace[]
  user: {
    id: string
    full_name: string | null
    email: string
  } | null
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDuration(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—"
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(2)} s`
}

function TraceBadge({
  label,
  tone = "default",
}: {
  label: string
  tone?: "default" | "success" | "danger"
}) {
  const className =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      : tone === "danger"
        ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
        : "bg-muted text-muted-foreground border-border"

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function TraceCard({ traceRecord }: { traceRecord: ConversationTurnTrace }) {
  const trace = traceRecord.trace
  const totalLatency = trace.latencies_ms.total_ms
  const retrievalChunks = trace.retrieval.chunks ?? []
  const matchedProducts = trace.decision_context.matched_products ?? []

  return (
    <details className="mt-3 rounded-xl border border-dashed bg-background/70 p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center gap-2">
          <TraceBadge
            label={trace.status === "completed" ? "Trace ok" : "Trace fehlgeschlagen"}
            tone={trace.status === "completed" ? "success" : "danger"}
          />
          <TraceBadge label={trace.intent} />
          <TraceBadge label={trace.router_decision.retrieval_mode} />
          {trace.product_category ? <TraceBadge label={trace.product_category} /> : null}
          <span className="text-xs text-muted-foreground">
            Gesamt: {formatDuration(totalLatency)}
          </span>
          <span className="text-xs text-muted-foreground">
            Request: {trace.request_id}
          </span>
        </div>
      </summary>

      <div className="mt-4 space-y-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Routing</p>
            <p className="mt-1 font-medium text-foreground">
              {trace.router_decision.needs_clarification ? "Klaerungsrunde" : "Direkte Antwort"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Confidence: {trace.router_decision.confidence.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Slot-Completeness: {(trace.router_decision.slot_completeness * 100).toFixed(0)}%
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Retrieval</p>
            <p className="mt-1 font-medium text-foreground">
              {trace.retrieval.final_context_count} finale Chunks
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Kandidaten vor Rerank: {trace.retrieval.candidate_count_before_rerank}
            </p>
            <p className="text-xs text-muted-foreground">
              Rerankt: {trace.retrieval.reranked_count}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Produkte</p>
            <p className="mt-1 font-medium text-foreground">
              {matchedProducts.length} gematcht
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Routine-Plan: {trace.decision_context.should_plan_routine ? "ja" : "nein"}
            </p>
            <p className="text-xs text-muted-foreground">
              Antwortquellen: {trace.response.sources.length}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Timings</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klassifikation: {formatDuration(trace.latencies_ms.classification_ms)}
            </p>
            <p className="text-xs text-muted-foreground">
              Retrieval: {formatDuration(trace.latencies_ms.retrieval_ms)}
            </p>
            <p className="text-xs text-muted-foreground">
              Prompt: {formatDuration(trace.latencies_ms.prompt_build_ms)}
            </p>
            <p className="text-xs text-muted-foreground">
              Stream: {formatDuration(trace.latencies_ms.stream_read_ms)}
            </p>
          </div>
        </div>

        {trace.router_decision.policy_overrides.length > 0 ? (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Policy Overrides
            </p>
            <div className="flex flex-wrap gap-2">
              {trace.router_decision.policy_overrides.map((override) => (
                <TraceBadge key={override} label={override} />
              ))}
            </div>
          </div>
        ) : null}

        {trace.clarification_questions.length > 0 ? (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Klaerungsfragen
            </p>
            <div className="space-y-2 rounded-lg border bg-card p-3">
              {trace.clarification_questions.map((question) => (
                <p key={question} className="text-sm text-foreground">
                  {question}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Retrieval-Pfad
          </p>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              Subqueries:{" "}
              {trace.retrieval.subqueries.length > 0
                ? trace.retrieval.subqueries.join(" | ")
                : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Metadata-Filter:{" "}
              {trace.retrieval.metadata_filter
                ? JSON.stringify(trace.retrieval.metadata_filter)
                : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fallback: {trace.retrieval.fallback_used ? "ja" : "nein"}
            </p>

            <div className="mt-3 space-y-2">
              {retrievalChunks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Chunks gespeichert.</p>
              ) : (
                retrievalChunks.map((chunk) => (
                  <div key={chunk.chunk_id} className="rounded-md border bg-background p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <TraceBadge label={chunk.source_type} />
                      {chunk.retrieval_path ? <TraceBadge label={chunk.retrieval_path} /> : null}
                      <span className="text-xs text-muted-foreground">
                        Score: {chunk.weighted_similarity.toFixed(4)}
                      </span>
                      {chunk.source_name ? (
                        <span className="text-xs text-muted-foreground">
                          {chunk.source_name}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {chunk.content_preview}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Gematchte Produkte
          </p>
          <div className="rounded-lg border bg-card p-3">
            {matchedProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Produktmatches fuer diesen Turn.</p>
            ) : (
              <div className="space-y-2">
                {matchedProducts.map((product) => (
                  <div key={product.id} className="rounded-md border bg-background p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {product.brand ? `${product.name} von ${product.brand}` : product.name}
                      </span>
                      {product.category ? <TraceBadge label={product.category} /> : null}
                      <span className="text-xs text-muted-foreground">
                        Score: {product.score != null ? product.score.toFixed(1) : "—"}
                      </span>
                    </div>
                    {product.top_reasons.length > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {product.top_reasons.join(" | ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Prompt Snapshot
            </p>
            <p className="text-xs text-muted-foreground">
              Modell: {trace.prompt.model} · Temperatur: {trace.prompt.temperature}
            </p>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs text-foreground">
              {trace.prompt.system_prompt}
            </pre>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Modell-Input
            </p>
            <div className="max-h-72 space-y-2 overflow-auto">
              {trace.prompt.messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="rounded-md border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {message.role}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">
                    {message.content}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Entscheidungskontext
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs text-foreground">
              {JSON.stringify({
                classification: trace.classification,
                router_decision: trace.router_decision,
                category_decision: trace.decision_context.category_decision,
                routine_plan: trace.decision_context.routine_plan,
              }, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Profil Snapshot
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs text-foreground">
              {JSON.stringify({
                hair_profile_snapshot: trace.hair_profile_snapshot,
                memory_context: trace.memory_context,
                response: trace.response,
                error: trace.error,
              }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </details>
  )
}

export default function AdminConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(`/api/admin/conversations/${id}`)
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error || fehler("Laden"))
        }
        setData(await res.json())
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : fehler("Laden", "der Konversation")
        toast({ title: message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const traceByAssistantMessageId = useMemo(() => {
    const map = new Map<string, ConversationTurnTrace>()
    for (const trace of data?.traces ?? []) {
      if (trace.assistant_message_id) {
        map.set(trace.assistant_message_id, trace)
      }
    }
    return map
  }, [data?.traces])

  const orphanTraces = useMemo(
    () => (data?.traces ?? []).filter((trace) => !trace.assistant_message_id),
    [data?.traces]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-muted-foreground">Konversation nicht gefunden.</p>
      </div>
    )
  }

  const { conversation, messages, user: chatUser, traces } = data

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/conversations"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurueck zu Chats
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {conversation.title || "Konversation"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {chatUser?.full_name || "Unbekannt"} ({chatUser?.email}) ·{" "}
              {messages.length} Nachrichten · {formatDateTime(conversation.created_at)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 text-sm">
            <p className="text-muted-foreground">Observability</p>
            <p className="mt-1 font-medium text-foreground">
              {traces.length} gespeicherte Turn-Traces
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Keine Nachrichten vorhanden.
          </p>
        ) : (
          messages.map((msg) => {
            const trace = traceByAssistantMessageId.get(msg.id)

            return (
              <div key={msg.id}>
                <div
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : msg.role === "assistant"
                          ? "bg-muted"
                          : "bg-muted/50 text-xs italic"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium opacity-70">
                        {msg.role === "user"
                          ? "Nutzer"
                          : msg.role === "assistant"
                            ? "TomBot"
                            : "System"}
                      </span>
                      <span className="text-xs opacity-50">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content || "—"}
                    </p>
                    {msg.rag_context?.sources?.length ? (
                      <p className="mt-2 text-xs opacity-60">
                        Quellen gespeichert: {msg.rag_context.sources.length}
                      </p>
                    ) : null}
                  </div>
                </div>
                {trace ? <TraceCard traceRecord={trace} /> : null}
              </div>
            )
          })
        )}
      </div>

      {orphanTraces.length > 0 ? (
        <div className="mt-6 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold">Fehlgeschlagene oder verwaiste Traces</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Diese Traces konnten keiner gespeicherten Assistant-Nachricht zugeordnet werden.
          </p>
          <div className="mt-4 space-y-3">
            {orphanTraces.map((trace) => (
              <TraceCard key={trace.id} traceRecord={trace} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
