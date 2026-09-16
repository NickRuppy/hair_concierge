"use client"

import { useEffect, useState } from "react"
import type { Profile, HairProfile } from "@/lib/types"
import type { BillingSubscriptionRow } from "@/lib/billing/types"
import { HAIR_TEXTURE_LABELS } from "@/lib/vocabulary"

interface UserWithHairProfile extends Profile {
  hair_profiles?: HairProfile[]
  current_billing_subscription?: BillingSubscriptionRow | null
}

const PAGE_SIZE = 50

interface UsersPage {
  users: UserWithHairProfile[]
  total: number
  offset: number
}

export default function AdminUsersPage() {
  const [request, setRequest] = useState({ offset: 0 })
  const [page, setPage] = useState<UsersPage | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  function loadPage(offset: number) {
    setStatus("loading")
    setRequest({ offset })
  }

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadUsers() {
      try {
        let offset = request.offset
        // A deleted account can leave an older page beyond the new final page.
        while (active) {
          const res = await fetch(`/api/admin/users?limit=${PAGE_SIZE}&offset=${offset}`, {
            signal: controller.signal,
            cache: "no-store",
          })
          if (!res.ok) throw new Error("User request failed")
          const data: Omit<UsersPage, "offset"> = await res.json()
          if (!active) return
          const lastOffset = Math.max(0, Math.ceil(data.total / PAGE_SIZE) - 1) * PAGE_SIZE
          if (offset > lastOffset) {
            offset = lastOffset
            continue
          }
          setPage({ ...data, offset })
          setStatus("ready")
          return
        }
      } catch {
        if (active) setStatus("error")
      }
    }

    void loadUsers()
    return () => {
      active = false
      controller.abort()
    }
  }, [request])

  const users = page?.users ?? []
  const total = page?.total ?? 0
  const offset = page?.offset ?? 0
  const lastOffset = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1) * PAGE_SIZE
  const navigationClass =
    "rounded-lg border px-3 py-2 text-sm text-primary hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"

  function getHairSummary(user: UserWithHairProfile): string | null {
    const hp = user.hair_profiles?.[0]
    if (!hp) return null

    const parts: string[] = []
    if (hp.hair_texture) {
      parts.push(
        HAIR_TEXTURE_LABELS[hp.hair_texture as keyof typeof HAIR_TEXTURE_LABELS] ?? hp.hair_texture,
      )
    }
    if (hp.concerns && hp.concerns.length > 0) {
      parts.push(`${hp.concerns.length} Probleme`)
    }
    if (hp.goals && hp.goals.length > 0) {
      parts.push(`${hp.goals.length} Ziele`)
    }
    return parts.length > 0 ? parts.join(" / ") : null
  }

  function getPayPalEmail(user: UserWithHairProfile): string | null {
    const subscriberEmail = user.current_billing_subscription?.provider_subscriber_email?.trim()
    if (!subscriberEmail) return null
    if (subscriberEmail.toLowerCase() === user.email?.trim().toLowerCase()) return null
    return subscriberEmail
  }

  return (
    <div className="min-w-0">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nutzer</h1>
        <span className="text-sm text-muted-foreground">
          {status === "ready" && `${total} Nutzer insgesamt`}
        </span>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Alle registrierten Konten – einschließlich Testkonten und zahlender Nutzer.
      </p>
      {status === "loading" ? (
        <div role="status" className="flex items-center justify-center gap-3 py-12">
          <div
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          />
          <p>Nutzer werden geladen …</p>
        </div>
      ) : status === "error" ? (
        <div role="alert" className="rounded-xl border bg-card p-8 text-center">
          <p>Nutzer konnten nicht geladen werden.</p>
          <p className="mt-2 text-sm text-muted-foreground">Bitte versuche es erneut.</p>
          <button
            type="button"
            className={`${navigationClass} mt-4`}
            onClick={() => loadPage(request.offset)}
          >
            Erneut versuchen
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Noch keine Nutzer vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kontakt</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admin</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Haarprofil
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Erstellt am
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const hasHairProfile = (user.hair_profiles?.length ?? 0) > 0
                  const hairSummary = getHairSummary(user)
                  const paypalEmail = getPayPalEmail(user)
                  return (
                    <tr
                      key={user.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {user.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="space-y-1">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/70">
                              Chaarlie-E-Mail
                            </p>
                            <p>{user.email}</p>
                          </div>
                          {paypalEmail ? (
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/70">
                                PayPal-E-Mail
                              </p>
                              <p>{paypalEmail}</p>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.is_admin
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {user.is_admin ? "Admin" : "Nutzer"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${hasHairProfile ? "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" : "bg-muted text-muted-foreground"}`}
                        >
                          {hasHairProfile ? "Vorhanden" : "Nicht vorhanden"}
                        </span>
                        {hairSummary && <span className="mt-1 block text-xs">{hairSummary}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("de-DE")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <nav
            aria-label="Nutzerseiten"
            className="flex flex-wrap items-center justify-between gap-3 border-t p-4"
          >
            <p className="text-sm text-muted-foreground">
              {offset + 1}–{offset + users.length} von {total} · Seite {offset / PAGE_SIZE + 1} von{" "}
              {Math.ceil(total / PAGE_SIZE)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={navigationClass}
                disabled={offset === 0}
                onClick={() => loadPage(0)}
              >
                Neueste
              </button>
              <button
                type="button"
                className={navigationClass}
                disabled={offset === 0}
                onClick={() => loadPage(Math.max(0, offset - PAGE_SIZE))}
              >
                Zurück
              </button>
              <button
                type="button"
                className={navigationClass}
                disabled={offset >= lastOffset}
                onClick={() => loadPage(offset + PAGE_SIZE)}
              >
                Weiter
              </button>
              <button
                type="button"
                className={navigationClass}
                disabled={offset >= lastOffset}
                onClick={() => loadPage(lastOffset)}
              >
                Älteste
              </button>
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
