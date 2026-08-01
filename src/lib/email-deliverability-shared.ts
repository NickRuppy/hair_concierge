/**
 * Reine E-Mail-Heuristiken ohne Node-Abhaengigkeiten.
 *
 * Liegt bewusst getrennt von `email-deliverability.ts`, weil dort `node:dns`
 * importiert wird und die Quiz-Komponente eine Client-Komponente ist.
 * Beide Seiten nutzen dieselbe Domainliste, damit Vorschlag im Formular und
 * Pruefung auf dem Server nicht auseinanderlaufen.
 */

/** Bekannte Domains, gegen die auf Tippfehler geprueft wird. */
export const KNOWN_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "gmx.ch",
  "web.de",
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "hotmail.de",
  "live.de",
  "icloud.com",
  "me.com",
  "yahoo.com",
  "yahoo.de",
  "t-online.de",
  "freenet.de",
  "aol.com",
  "posteo.de",
  "mailbox.org",
  "protonmail.com",
  "proton.me",
]

/** Top-Level-Domains, die haeufig vertippt werden. */
const KNOWN_TLDS = ["com", "de", "net", "org", "at", "ch", "eu", "io", "me"]

/** Wegwerf-Adressen: nehmen wir an, senden aber nichts hin. */
export const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "trashmail.com",
  "yopmail.com",
  "sharklasers.com",
]

export const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

/**
 * Schlaegt eine Korrektur vor, wenn die Domain einer bekannten sehr aehnlich
 * ist. Faengt "gmail.vom", "gmx.den", "gmial.com", "web.d".
 *
 * Anders als eine Autovervollstaendigung per startsWith greift das auch dann,
 * wenn die Adresse bereits vollstaendig getippt ist.
 */
export function suggestEmailCorrection(email: string): string | null {
  const value = email.trim().toLowerCase()
  const at = value.lastIndexOf("@")
  if (at < 1) return null
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (!domain || KNOWN_EMAIL_DOMAINS.includes(domain)) return null

  let best: { domain: string; distance: number } | null = null
  for (const candidate of KNOWN_EMAIL_DOMAINS) {
    const distance = levenshtein(domain, candidate)
    // Bei kurzen Domains nur Distanz 1 zulassen, sonst zu viele Fehltreffer.
    const limit = candidate.length <= 8 ? 1 : 2
    if (distance <= limit && (!best || distance < best.distance)) {
      best = { domain: candidate, distance }
    }
  }
  if (best) return `${local}@${best.domain}`

  // Zweiter Versuch: nur die TLD ist vertippt (z.B. "meinefirma.dee").
  const lastDot = domain.lastIndexOf(".")
  if (lastDot > 0) {
    const base = domain.slice(0, lastDot)
    const tld = domain.slice(lastDot + 1)
    if (!KNOWN_TLDS.includes(tld)) {
      for (const candidate of KNOWN_TLDS) {
        if (levenshtein(tld, candidate) === 1) return `${local}@${base}.${candidate}`
      }
    }
  }
  return null
}
