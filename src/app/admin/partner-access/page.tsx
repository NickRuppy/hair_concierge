"use client"

import { useCallback, useEffect, useState } from "react"

import type {
  PartnerInvitationListItem,
  PartnerInvitationReceipt,
} from "@/lib/partner-access/service"

type Mode = "single" | "batch"

export default function PartnerAccessAdminPage() {
  const [mode, setMode] = useState<Mode>("single")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [batch, setBatch] = useState("")
  const [items, setItems] = useState<PartnerInvitationListItem[]>([])
  const [receipts, setReceipts] = useState<PartnerInvitationReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/partner-access", { cache: "no-store" })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.error ?? "Partnerzugänge konnten nicht geladen werden.")
    setItems(body.invitations ?? [])
  }, [])

  useEffect(() => {
    void load()
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Laden fehlgeschlagen."),
      )
      .finally(() => setLoading(false))
  }, [load])

  function creators() {
    if (mode === "single") return [{ name, email }]
    return batch
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.lastIndexOf(",")
        return separator < 1
          ? { name: "", email: "" }
          : { name: line.slice(0, separator).trim(), email: line.slice(separator + 1).trim() }
      })
  }

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/partner-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creators: creators() }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Erstellen fehlgeschlagen.")
      setReceipts(body.invitations ?? [])
      setName("")
      setEmail("")
      setBatch("")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erstellen fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  async function action(
    actionName: "revoke" | "reactivate" | "rotate" | "send",
    invitationId: string,
  ) {
    setError(null)
    const response = await fetch("/api/admin/partner-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName, invitationId }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) return setError(body?.error ?? "Aktualisieren fehlgeschlagen.")
    await load()
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Partnerzugänge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Persönliche Creator-Links erstellen und verwalten.
          </p>
        </div>
        <div className="flex rounded-lg border p-1">
          {(["single", "batch"] as const).map((value) => (
            <button
              key={value}
              className={`rounded-md px-3 py-1.5 text-sm ${mode === value ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setMode(value)}
              type="button"
            >
              {value === "single" ? "Einzeln" : "Mehrere"}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        {mode === "single" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Name
              <input
                className="rounded-lg border bg-background px-3 py-2"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              E-Mail
              <input
                className="rounded-lg border bg-background px-3 py-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          </div>
        ) : (
          <label className="grid gap-1 text-sm">
            Eine Person pro Zeile: Name, E-Mail
            <textarea
              className="min-h-40 rounded-lg border bg-background px-3 py-2 font-mono text-sm"
              placeholder="Lea Sommer, lea@example.com"
              value={batch}
              onChange={(event) => setBatch(event.target.value)}
            />
          </label>
        )}
        <button
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          disabled={saving}
          onClick={() => void create()}
          type="button"
        >
          {saving
            ? "Wird erstellt …"
            : mode === "single"
              ? "Zugang erstellen"
              : "Zugänge erstellen"}
        </button>
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {receipts.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="font-semibold">Bereit zum Senden</h2>
          {receipts.map((receipt) => (
            <Receipt key={receipt.invitationId} receipt={receipt} />
          ))}
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-semibold">Alle Partnerzugänge</h2>
        {loading ? <p className="mt-3 text-sm text-muted-foreground">Wird geladen …</p> : null}
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <article className="rounded-xl border bg-card p-4" key={item.invitationId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    E-Mail:{" "}
                    {item.emailStatus === "sent"
                      ? "gesendet"
                      : item.emailStatus === "failed"
                        ? "fehlgeschlagen"
                        : "nicht angefordert"}
                  </p>
                </div>
                <Status value={item.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <CopyButton value={item.message}>Nachricht kopieren</CopyButton>
                <CopyButton value={item.url}>Link kopieren</CopyButton>
                <button
                  className="rounded-lg border px-3 py-1.5"
                  onClick={() => void action("send", item.invitationId)}
                  type="button"
                >
                  Per E-Mail senden
                </button>
                <button
                  className="rounded-lg border px-3 py-1.5"
                  onClick={() => void action("rotate", item.invitationId)}
                  type="button"
                >
                  Neuer Link
                </button>
                {item.status === "revoked" ? (
                  <button
                    className="rounded-lg border px-3 py-1.5"
                    onClick={() => void action("reactivate", item.invitationId)}
                    type="button"
                  >
                    Reaktivieren
                  </button>
                ) : (
                  <button
                    className="rounded-lg border px-3 py-1.5 text-destructive"
                    onClick={() => void action("revoke", item.invitationId)}
                    type="button"
                  >
                    Widerrufen
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function Receipt({ receipt }: { receipt: PartnerInvitationReceipt }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <p className="font-semibold">{receipt.name}</p>
      <p className="text-sm text-muted-foreground">{receipt.email}</p>
      <div className="mt-3 flex gap-2">
        <CopyButton value={receipt.message}>Nachricht kopieren</CopyButton>
        <CopyButton value={receipt.url}>Link kopieren</CopyButton>
      </div>
    </article>
  )
}

function CopyButton({ children, value }: { children: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="rounded-lg border px-3 py-1.5"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        })
      }
      type="button"
    >
      {copied ? "Kopiert" : children}
    </button>
  )
}

function Status({ value }: { value: PartnerInvitationListItem["status"] }) {
  const label =
    value === "active"
      ? "Aktiv"
      : value === "claimed"
        ? "Konto erstellt"
        : value === "revoked"
          ? "Widerrufen"
          : "Eingeladen"
  return <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{label}</span>
}
