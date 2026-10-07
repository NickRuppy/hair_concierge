"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import type { DiscoveryAdminInvite } from "@/lib/discovery/invite-link"

/**
 * The invite half of `/admin/beratung`: create a link, copy it, renew it, revoke it.
 * Every write goes through `/api/admin/beratung/invites` (admin-gated, the CLI's own
 * service functions); the list is re-read with `router.refresh()` afterwards.
 *
 * No message text on purpose — Nick writes his own WhatsApp message, this hands him
 * the link.
 */

export const DISCOVERY_INVITES_ENDPOINT = "/api/admin/beratung/invites"

const CTA =
  "rounded-lg bg-[var(--brand-coral)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
const SECONDARY = "rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"

async function send(method: "POST" | "PATCH", payload: unknown) {
  const response = await fetch(DISCOVERY_INVITES_ENDPOINT, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = (await response.json().catch(() => null)) as {
    invite?: DiscoveryAdminInvite
    error?: string
  } | null
  if (!response.ok || !body?.invite) throw new Error(body?.error ?? "Das hat nicht geklappt.")
  return body.invite
}

export function DiscoveryInviteForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<DiscoveryAdminInvite | null>(null)

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const invite = await send("POST", { name, email: email.trim() || null })
      setCreated(invite)
      setName("")
      setEmail("")
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Das hat nicht geklappt.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-8 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Neue Einladung</h2>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void create()
        }}
      >
        <label className="grid gap-1 text-sm">
          Name
          <input
            className="w-56 rounded-lg border bg-background px-3 py-2"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="grid gap-1 text-sm">
          E-Mail (optional)
          <input
            className="w-64 rounded-lg border bg-background px-3 py-2"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <button className={CTA} disabled={saving || !name.trim()} type="submit">
          {saving ? "Wird erstellt …" : "Einladung erstellen"}
        </button>
      </form>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {created?.url ? <InviteLink label={`Link für ${created.name}`} url={created.url} /> : null}
    </section>
  )
}

export function DiscoveryInviteRowActions({ invite }: { invite: DiscoveryAdminInvite }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<"rotate" | "revoke" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renewedUrl, setRenewedUrl] = useState<string | null>(null)

  if (invite.status === "revoked" || !invite.url) return null

  async function act(action: "rotate" | "revoke") {
    setBusy(true)
    setError(null)
    try {
      const next = await send("PATCH", { action, enrollmentId: invite.enrollmentId })
      setConfirming(null)
      if (action === "rotate") setRenewedUrl(next.url)
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Das hat nicht geklappt.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <CopyButton value={renewedUrl ?? invite.url}>Link kopieren</CopyButton>
        {confirming ? (
          <>
            <button
              className={`${SECONDARY} ${confirming === "revoke" ? "text-destructive" : ""}`}
              disabled={busy}
              onClick={() => void act(confirming)}
              type="button"
            >
              {confirming === "rotate" ? "Alten Link ungültig machen?" : "Wirklich widerrufen?"}
            </button>
            <button
              className={SECONDARY}
              disabled={busy}
              onClick={() => setConfirming(null)}
              type="button"
            >
              Abbrechen
            </button>
          </>
        ) : (
          <>
            <button className={SECONDARY} onClick={() => setConfirming("rotate")} type="button">
              Link erneuern
            </button>
            <button
              className={`${SECONDARY} text-destructive`}
              onClick={() => setConfirming("revoke")}
              type="button"
            >
              Widerrufen
            </button>
          </>
        )}
      </div>
      {renewedUrl ? <InviteLink label="Neuer Link" url={renewedUrl} /> : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function InviteLink({ label, url }: { label: string; url: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{label}:</span>
      <code className="max-w-full break-all rounded bg-muted px-2 py-1 text-xs">{url}</code>
      <CopyButton value={url}>Link kopieren</CopyButton>
    </div>
  )
}

function CopyButton({ children, value }: { children: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={SECONDARY}
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
