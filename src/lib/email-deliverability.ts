import { promises as dns } from "node:dns"

import {
  EMAIL_ADDRESS_PATTERN,
  KNOWN_GOOD_EMAIL_DOMAINS,
  suggestEmailCorrection,
} from "@/lib/email-deliverability-shared"

/**
 * Serverseitige Zustellbarkeitspruefung fuer Lead-E-Mail-Adressen.
 *
 * Hintergrund: Die Bounce-Quote lag bei rund 4,6 Prozent, der Grossteil davon
 * Tippfehler in der Domain (z. B. `gmail.vom`). Gmail sortiert die
 * Absenderdomain daraufhin in den Spam-Ordner.
 *
 * Bewusst KEIN externer Dienst: Ein MX-Lookup kostet nichts und faengt genau
 * die Faelle ab, die in den Bounce-Logs auftauchen.
 */

export type EmailDeliverabilityFailure = "format" | "no_mx" | "null_mx"

export type EmailDeliverability =
  | { ok: true; normalized: string }
  | { ok: false; reason: EmailDeliverabilityFailure; suggestion?: string }

/** Erlaubt das Einschleusen eines Resolvers im Test. */
export interface EmailDnsResolver {
  resolveMx: (domain: string) => Promise<{ exchange: string; priority: number }[]>
  resolve4: (domain: string) => Promise<string[]>
  resolve6: (domain: string) => Promise<string[]>
}

const defaultResolver: EmailDnsResolver = {
  resolveMx: (domain) => dns.resolveMx(domain),
  resolve4: (domain) => dns.resolve4(domain),
  resolve6: (domain) => dns.resolve6(domain),
}

/**
 * Ein "Null MX" nach RFC 7505 (`MX 0 .`) sagt ausdruecklich: Diese Domain
 * nimmt keine Mail an. Der Austauschname ist dann leer oder ein einzelner
 * Punkt. Ein solcher Datensatz ist eine Ablehnung, kein gueltiges Ziel.
 */
function isNullMx(records: { exchange: string }[]): boolean {
  if (records.length !== 1) return false
  const exchange = (records[0]?.exchange ?? "").trim()
  return exchange === "" || exchange === "."
}

/** Fehler, die belegen, dass es die Domain nicht gibt. */
function isDefinitiveDnsFailure(caught: unknown): boolean {
  const code = (caught as NodeJS.ErrnoException)?.code
  return code === "ENOTFOUND" || code === "ENODATA"
}

/**
 * Laesst ein Versprechen nach `timeoutMs` scheitern und raeumt den Timer in
 * jedem Fall wieder ab, damit kein offener Handle das Event-Loop haelt.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("dns_timeout")), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Prueft, ob die Domain Mail annehmen kann.
 *
 * Reihenfolge nach RFC 5321 Abschnitt 5.1:
 *   1. MX vorhanden und kein Null MX  -> annehmen
 *   2. Null MX (RFC 7505)             -> ablehnen, Domain lehnt Mail explizit ab
 *   3. kein MX, aber A/AAAA vorhanden -> annehmen (impliziter MX)
 *   4. weder MX noch A/AAAA           -> ablehnen
 *
 * Bei Zeitueberschreitung oder unerwarteten Resolver-Fehlern wird die Adresse
 * ANGENOMMEN. Ein wackelnder DNS-Resolver darf niemals Leads blockieren, ein
 * Bounce ist billiger als ein verlorener Lead.
 */
export async function checkEmailDeliverability(
  email: string,
  {
    timeoutMs = 3000,
    resolver = defaultResolver,
  }: { timeoutMs?: number; resolver?: EmailDnsResolver } = {},
): Promise<EmailDeliverability> {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_ADDRESS_PATTERN.test(normalized)) {
    return {
      ok: false,
      reason: "format",
      suggestion: suggestEmailCorrection(normalized) ?? undefined,
    }
  }

  const domain = normalized.slice(normalized.lastIndexOf("@") + 1)

  // Grossanbieter brauchen keinen Lookup.
  if (KNOWN_GOOD_EMAIL_DOMAINS.includes(domain)) return { ok: true, normalized }

  const suggestion = suggestEmailCorrection(normalized) ?? undefined

  let mxRecords: { exchange: string; priority: number }[] | null = null
  try {
    mxRecords = await withTimeout(resolver.resolveMx(domain), timeoutMs)
  } catch (caught) {
    if (!isDefinitiveDnsFailure(caught)) {
      // Timeout oder Resolver-Problem: im Zweifel durchlassen.
      return { ok: true, normalized }
    }
    // ENOTFOUND/ENODATA auf MX heisst nur: kein MX-Eintrag. Ob die Domain
    // existiert, entscheidet der A/AAAA-Fallback unten.
    mxRecords = []
  }

  if (mxRecords.length > 0) {
    if (isNullMx(mxRecords)) return { ok: false, reason: "null_mx", suggestion }
    return { ok: true, normalized }
  }

  // Kein MX: nach RFC 5321 faellt die Zustellung auf A/AAAA zurueck.
  try {
    const [a, aaaa] = await Promise.all([
      withTimeout(resolver.resolve4(domain), timeoutMs).catch((caught) => {
        if (isDefinitiveDnsFailure(caught)) return [] as string[]
        throw caught
      }),
      withTimeout(resolver.resolve6(domain), timeoutMs).catch((caught) => {
        if (isDefinitiveDnsFailure(caught)) return [] as string[]
        throw caught
      }),
    ])
    if (a.length > 0 || aaaa.length > 0) return { ok: true, normalized }
    return { ok: false, reason: "no_mx", suggestion }
  } catch {
    // Timeout oder Resolver-Problem beim Fallback: durchlassen.
    return { ok: true, normalized }
  }
}

export { suggestEmailCorrection }
