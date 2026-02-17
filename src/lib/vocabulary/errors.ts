/* ── Fixed error strings (auth / validation) ── */

export const ERR_UNAUTHORIZED = "Nicht autorisiert"
export const ERR_FORBIDDEN = "Keine Admin-Berechtigung"
export const ERR_INVALID_DATA = "Ungültige Daten"

/* ── Composable "Fehler beim …" helper ── */

type Verb =
  | "Laden"
  | "Speichern"
  | "Erstellen"
  | "Aktualisieren"
  | "Löschen"
  | "Senden"
  | "Hochladen"
  | "Verarbeitung"
  | "Generieren"

export function fehler(verb: Verb, suffix?: string): string {
  return suffix
    ? `Fehler beim ${verb} ${suffix}`
    : `Fehler beim ${verb}`
}
