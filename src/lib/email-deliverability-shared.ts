/**
 * Reine E-Mail-Heuristiken ohne Node-Abhaengigkeiten.
 *
 * Liegt bewusst getrennt von `email-deliverability.ts`, weil dort `node:dns`
 * importiert wird und die Quiz-Komponente eine Client-Komponente ist.
 * Beide Seiten nutzen dieselben Listen, damit Vorschlag im Formular und
 * Pruefung auf dem Server nicht auseinanderlaufen.
 */

export const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Belegte Tippfehler auf echte Anbieterdomains.
 *
 * Bewusst eine explizite Liste statt einer Aehnlichkeitsheuristik. Eine
 * Levenshtein-Distanz ueber alle bekannten Domains erzeugt Fehlvorschlaege
 * bei real existierenden Domains: `mail.com` liegt eine Einfuegung von
 * `gmail.com` entfernt, `example.co` eine von `example.com`. Beide sind
 * gueltig, ein Korrekturvorschlag waere dort schlicht falsch.
 *
 * Diese Liste enthaelt nur Domains, die selbst kein Mail annehmen und
 * eindeutig einem Anbieter zuzuordnen sind. Erweiterungen bitte anhand
 * echter Bounce-Logs, nicht anhand von Vermutungen.
 */
const DOMAIN_TYPOS: Record<string, string> = {
  // gmail.com
  "gmail.vom": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cim": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  // gmx.de
  "gmx.den": "gmx.de",
  "gmx.dee": "gmx.de",
  "gmx.d": "gmx.de",
  "gmx.ed": "gmx.de",
  // web.de
  "web.d": "web.de",
  "web.dee": "web.de",
  "web.ed": "web.de",
  "wen.de": "web.de",
  // hotmail
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.vom": "hotmail.com",
  // outlook
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.vom": "outlook.com",
  // icloud
  "iclould.com": "icloud.com",
  "iclod.com": "icloud.com",
  "icloud.con": "icloud.com",
  "icloud.vom": "icloud.com",
  // yahoo
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.vom": "yahoo.com",
  // t-online
  "t-online.d": "t-online.de",
  "t-online.den": "t-online.de",
  "tonline.de": "t-online.de",
  // sonstige
  "freenet.d": "freenet.de",
  "aol.con": "aol.com",
  "aol.vom": "aol.com",
}

/**
 * Grossanbieter, die nachweislich Mail annehmen. Fuer diese Domains wird der
 * MX-Lookup uebersprungen, das spart einen DNS-Roundtrip pro Lead.
 *
 * Enthaelt bewusst auch `mail.com`, `gmx.com` und `live.com`: real
 * existierende Domains, die einer Aehnlichkeitsheuristik zum Opfer fielen.
 */
export const KNOWN_GOOD_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "gmx.ch",
  "gmx.com",
  "web.de",
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "hotmail.de",
  "live.com",
  "live.de",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "yahoo.de",
  "ymail.com",
  "t-online.de",
  "freenet.de",
  "aol.com",
  "aol.de",
  "mail.com",
  "mail.de",
  "posteo.de",
  "posteo.net",
  "mailbox.org",
  "protonmail.com",
  "proton.me",
  "arcor.de",
]

/**
 * Schlaegt eine Korrektur vor, wenn die Domain ein belegter Tippfehler ist.
 *
 * Anders als eine Autovervollstaendigung per `startsWith` greift das auch
 * dann, wenn die Adresse bereits vollstaendig getippt ist. Genau diese Faelle
 * (z. B. `gmail.vom`) sind in den Bounce-Logs aufgetaucht.
 *
 * Gibt `null` zurueck, wenn die Domain nicht eindeutig als Tippfehler belegt
 * ist. Lieber kein Vorschlag als ein falscher.
 */
export function suggestEmailCorrection(email: string): string | null {
  const value = email.trim().toLowerCase()
  const at = value.lastIndexOf("@")
  if (at < 1) return null
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (!local || !domain) return null

  const corrected = DOMAIN_TYPOS[domain]
  if (!corrected || corrected === domain) return null
  return `${local}@${corrected}`
}
