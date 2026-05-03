import type { ProductBondUsageProtocol } from "@/lib/product-specs/constants"

export const BONDBUILDER_CLEAN_BASE_GUIDANCE =
  "Bondbuilder funktionieren am besten ohne starke Rueckstaende. Wenn viel Styling, Oel, Silikon, Maske oder Leave-in im Haar liegt, vorher sanft reinigen oder gelegentlich tiefenreinigen."

const BONDBUILDER_USAGE_HINTS = {
  olaplex_3plus:
    "Wenn viel Styling, Oel, Silikon oder Maskenfilm im Haar ist, vorher sanft shampoonieren oder gelegentlich tiefenreinigen. Danach No.3PLUS ins nasse Haar geben, 3 Minuten einwirken lassen, ausspuelen und anschliessend shampoonieren und Conditioner verwenden. Bei Bedarf etwa alle 1-3 Haarwaeschen.",
  olaplex_0_booster:
    "Bei sehr starker Schaedigung kann No.0 als Booster vor No.3PLUS dazukommen. Es ist kein eigenstaendiger Standard-Schritt, sondern bereitet die OLAPLEX-Behandlung vor.",
  olaplex_3_legacy:
    "Das ist die aeltere OLAPLEX-Vorwaschbehandlung. Wenn du sie bereits hast, kannst du sie fuer die OLAPLEX-Crosslink-Seite nutzen; No.3PLUS ist der aktuelle Nachfolger.",
  k18_leave_in:
    "K18 nach dem Shampoo ohne vorherigen Conditioner ins handtuchtrockene Haar geben, 4 Minuten warten und nicht ausspuelen. Fuer eine Aufbauphase mehrere Waeschen nacheinander verwenden, danach nur noch nach Bedarf.",
  epres_spray:
    "Epres ist die unkompliziertere Spray-Variante: auf trockenes, ungewaschenes Haar spruehen, mindestens 10 Minuten einwirken lassen und danach normal reinigen und pflegen. In der Aufbauphase 1-2x pro Woche, spaeter eher woechentlich zur Erhaltung.",
} as const satisfies Record<ProductBondUsageProtocol, string>

export function getBondbuilderUsageHint(
  usageProtocol: ProductBondUsageProtocol | null | undefined,
): string {
  if (usageProtocol) return BONDBUILDER_USAGE_HINTS[usageProtocol]
  return BONDBUILDER_CLEAN_BASE_GUIDANCE
}
