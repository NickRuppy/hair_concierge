"use client"

import React, { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/landing/site-footer"
import {
  parsePublicContractDeclaration,
  publicDeclarationReceiptText,
  publicDeclarationStatement,
  type PublicContractDeclarationReceipt,
  type PublicDeclarationKind,
} from "@/lib/billing/public-contract-declaration"

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-base font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
const labelClass = "block text-[13px] font-semibold text-[var(--text-heading)]"

export function PublicContractDeclarationForm({ mode }: { mode: "cancellation" | "withdrawal" }) {
  const withdrawal = mode === "withdrawal"
  const [kind, setKind] = useState<PublicDeclarationKind>(
    withdrawal ? "withdrawal" : "ordinary_cancellation",
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<PublicContractDeclarationReceipt | null>(null)
  const attempt = useRef<{ key: string; content: string } | null>(null)
  const inFlight = useRef(false)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (receipt) title.current?.focus()
  }, [receipt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const form = new FormData(event.currentTarget)
    const fields = {
      kind,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      contract: String(form.get("contract") ?? ""),
      requestedEnd: withdrawal ? null : String(form.get("requestedEnd") ?? ""),
      reason:
        kind === "extraordinary_cancellation"
          ? String(form.get("reason") ?? "").trim() || null
          : null,
    }
    const content = JSON.stringify(fields)
    // A response can be lost after commit. Retrying the same form keeps its key;
    // edited declarations receive a new key and never rewrite earlier intent.
    if (!attempt.current || attempt.current.content !== content)
      attempt.current = { key: crypto.randomUUID(), content }
    const declaration = parsePublicContractDeclaration({
      ...fields,
      requestId: attempt.current.key,
    })
    if (!declaration) {
      setError("Bitte prüfe deine Angaben und gib eine gültige E-Mail-Adresse an.")
      return
    }
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/billing/contract-declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(declaration),
      })
      const body = await response.json()
      if (!response.ok || !body.receipt) {
        setError(
          response.status === 429
            ? "Gerade wurden zu viele Erklärungen übermittelt. Bitte versuche es später erneut oder schreibe an info@chaarlie.de."
            : "Der Eingang konnte gerade nicht bestätigt werden. Bitte versuche es mit denselben Angaben erneut oder schreibe an info@chaarlie.de.",
        )
        return
      }
      setReceipt(body.receipt)
    } catch {
      setError(
        "Der Eingang konnte gerade nicht bestätigt werden. Bitte versuche es mit denselben Angaben erneut oder schreibe an info@chaarlie.de.",
      )
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  function saveReceipt() {
    if (!receipt) return
    const url = URL.createObjectURL(
      new Blob([publicDeclarationReceiptText(receipt)], { type: "text/plain;charset=utf-8" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = `chaarlie-erklaerung-${receipt.declarationId}.txt`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf8] text-foreground">
      <header className="border-b border-border/60 bg-white/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.03em] text-[var(--brand-plum-darkest)]"
          >
            Chaarlie
          </Link>
          <nav
            aria-label="Hilfe und Anmeldung"
            className="flex gap-4 text-sm text-muted-foreground"
          >
            <Link href="/kontakt" className="inline-flex min-h-11 items-center">
              Hilfe
            </Link>
            <Link href="/auth" className="inline-flex min-h-11 items-center">
              Anmelden
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[648px] flex-1 px-4 py-9 sm:px-6 sm:py-14">
        <h1
          ref={title}
          tabIndex={receipt ? -1 : undefined}
          className="font-[family-name:var(--font-display)] text-[32px] font-medium leading-tight tracking-[-0.025em] text-[var(--text-heading)] sm:text-[40px]"
        >
          {receipt
            ? withdrawal
              ? "Dein Widerruf ist eingegangen."
              : "Deine Kündigung ist eingegangen."
            : withdrawal
              ? "Vertrag widerrufen"
              : "Vertrag kündigen"}
        </h1>
        {receipt ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {`Wir haben deine Erklärung am ${new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeStyle: "long",
                timeZone: "Europe/Berlin",
              }).format(new Date(receipt.submittedAt))} erhalten.`}
            </p>
            <section
              aria-label="Eingangsbestätigung"
              className="mt-6 space-y-4 break-words rounded-3xl border border-border/70 bg-white p-5 sm:p-7"
            >
              <p className="font-semibold">{receipt.declaration.contract}</p>
              <p className="text-sm leading-relaxed">
                {publicDeclarationStatement(receipt.declaration)}
              </p>
              {receipt.declaration.reason && (
                <p className="text-sm">Kündigungsgrund: {receipt.declaration.reason}</p>
              )}
              <p className="text-sm text-muted-foreground">Name: {receipt.declaration.name}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Die Eingangsbestätigung ist zur Zustellung an {receipt.declaration.email}{" "}
                vorgemerkt.{" "}
                {withdrawal
                  ? "Die Zuordnung und Abwicklung werden geprüft."
                  : "Nach sicherer Zuordnung bestätigen wir dir das Vertragsende."}
              </p>
              <p className="text-xs text-muted-foreground">
                Erklärungsnummer: {receipt.declarationId}
              </p>
              <Button type="button" onClick={saveReceipt}>
                Erklärung speichern
              </Button>
            </section>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {withdrawal
                ? "Hier kannst du deinen Widerruf übermitteln. Eine Anmeldung ist nicht erforderlich."
                : "Du kannst deine Kündigung hier direkt übermitteln. Eine Anmeldung ist nicht erforderlich."}
            </p>
            <form
              onSubmit={submit}
              className="mt-6 rounded-3xl border border-border/70 bg-white p-5 sm:p-7"
              aria-busy={pending}
            >
              <fieldset disabled={pending} className="space-y-5">
                <legend className="sr-only">
                  {withdrawal ? "Angaben zu deinem Widerruf" : "Angaben zu deiner Kündigung"}
                </legend>
                <label className={labelClass}>
                  Name
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={200}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  E-Mail für die Bestätigung
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    className={inputClass}
                  />
                </label>
                <div>
                  <label className={labelClass}>
                    Vertrag
                    <input
                      name="contract"
                      required
                      maxLength={500}
                      aria-describedby="contract-help"
                      className={inputClass}
                    />
                  </label>
                  <p
                    id="contract-help"
                    className="mt-1 text-xs leading-relaxed text-muted-foreground"
                  >
                    Vertragsnummer oder Angaben, mit denen wir deinen Vertrag zuordnen können.
                  </p>
                </div>
                {!withdrawal && (
                  <>
                    <label className={labelClass}>
                      Art der Kündigung
                      <select
                        name="kind"
                        value={kind}
                        onChange={(event) => setKind(event.target.value as PublicDeclarationKind)}
                        className={inputClass}
                      >
                        <option value="ordinary_cancellation">Ordentlich</option>
                        <option value="extraordinary_cancellation">Außerordentlich</option>
                      </select>
                    </label>
                    {kind === "extraordinary_cancellation" && (
                      <label className={labelClass}>
                        Kündigungsgrund (optional)
                        <input name="reason" maxLength={2000} className={inputClass} />
                      </label>
                    )}
                    <label className={labelClass}>
                      Gewünschtes Vertragsende
                      <input
                        name="requestedEnd"
                        defaultValue="Zum nächstmöglichen Zeitpunkt"
                        required
                        maxLength={200}
                        className={inputClass}
                      />
                    </label>
                  </>
                )}
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive"
                  >
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={pending}>
                  {pending
                    ? "Wird übermittelt …"
                    : withdrawal
                      ? "Widerruf bestätigen"
                      : "Jetzt kündigen"}
                </Button>
              </fieldset>
            </form>
          </>
        )}
        <Link
          href="/"
          className="mt-6 flex min-h-11 items-center justify-center text-sm text-primary underline"
        >
          Zur Startseite
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
