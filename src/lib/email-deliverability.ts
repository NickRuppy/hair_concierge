import { promises as dns } from "node:dns"

import {
  DISPOSABLE_EMAIL_DOMAINS,
  EMAIL_ADDRESS_PATTERN,
  KNOWN_EMAIL_DOMAINS,
  suggestEmailCorrection,
} from "@/lib/email-deliverability-shared"

/**
 * Serverseitige Zustellbarkeitspruefung fuer Lead-E-Mail-Adressen.
 *
 * Hintergrund: Die Bounce-Quote lag bei rund 4,6 Prozent, davon der Grossteil
 * Tippfehler in der Domain (z.B. "gmail.vom", "gmx.den"). Gmail sortiert die
 * Absenderdomain daraufhin in den Spam-Ordner.
 *
 * Bewusst KEIN externer Dienst: Ein MX-Lookup kostet nichts, laeuft in etwa
 * 50 ms und faengt genau die Faelle ab, die in den Bounce-Logs auftauchen.
 */

export type EmailDeliverability =
  | { ok: true; normalized: string }
  | { ok: false; reason: "format" | "no_mx" | "disposable"; suggestion?: string }

/**
 * Prueft, ob die Domain ueberhaupt Mail annehmen kann.
 *
 * Bei DNS-Zeitueberschreitung oder unerwarteten Fehlern wird die Adresse
 * ANGENOMMEN. Ein wackelnder DNS-Resolver darf niemals Leads blockieren,
 * ein Bounce ist billiger als ein verlorener Lead.
 */
export async function checkEmailDeliverability(
  email: string,
  { timeoutMs = 3000 }: { timeoutMs?: number } = {},
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

  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return { ok: false, reason: "disposable" }
  }

  // Bekannte Grossanbieter brauchen keinen Lookup.
  if (KNOWN_EMAIL_DOMAINS.includes(domain)) return { ok: true, normalized }

  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("dns_timeout")), timeoutMs),
      ),
    ])
    if (Array.isArray(records) && records.length > 0) return { ok: true, normalized }
    return {
      ok: false,
      reason: "no_mx",
      suggestion: suggestEmailCorrection(normalized) ?? undefined,
    }
  } catch (caught) {
    const code = (caught as NodeJS.ErrnoException)?.code
    // Domain existiert nachweislich nicht.
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return {
        ok: false,
        reason: "no_mx",
        suggestion: suggestEmailCorrection(normalized) ?? undefined,
      }
    }
    // Timeout oder Resolver-Problem: im Zweifel durchlassen.
    return { ok: true, normalized }
  }
}

export { suggestEmailCorrection }
