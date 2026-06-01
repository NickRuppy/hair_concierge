import type { ProductBondUsageProtocol } from "@/lib/product-specs/constants"

export const BONDBUILDER_CLEAN_BASE_GUIDANCE =
  "Bondbuilder funktionieren am besten ohne starke Rückstände. Wenn viel Styling, Öl, Silikon, Maske oder Leave-in im Haar liegt, vorher sanft reinigen oder gelegentlich tiefenreinigen."

const BONDBUILDER_USAGE_HINTS = {
  olaplex_3plus:
    "Wenn viel Styling, Öl, Silikon oder Maskenfilm im Haar ist, vorher sanft shampoonieren oder gelegentlich tiefenreinigen. Danach No.3PLUS ins nasse Haar geben, 3 Minuten einwirken lassen, ausspülen und anschließend shampoonieren und Conditioner verwenden. Bei Bedarf etwa alle 1-3 Haarwäschen.",
  olaplex_0_booster:
    "Bei sehr starker Schädigung kann No.0 als Booster vor No.3PLUS dazukommen. Es ist kein eigenständiger Standard-Schritt, sondern bereitet die OLAPLEX-Behandlung vor.",
  olaplex_3_legacy:
    "Das ist die ältere OLAPLEX-Vorwaschbehandlung. Wenn du sie bereits hast, kannst du sie für die OLAPLEX-Crosslink-Seite nutzen; No.3PLUS ist der aktuelle Nachfolger.",
  k18_leave_in:
    "K18 nach dem Shampoo ohne vorherigen Conditioner ins handtuchtrockene Haar geben, 4 Minuten warten und nicht ausspülen. Für eine Aufbauphase mehrere Wäschen nacheinander verwenden, danach nur noch nach Bedarf.",
  epres_spray:
    "Epres ist die unkompliziertere Spray-Variante: auf trockenes, ungewaschenes Haar sprühen, mindestens 10 Minuten einwirken lassen und danach normal reinigen und pflegen. In der Aufbauphase 1-2x pro Woche, später eher wöchentlich zur Erhaltung.",
} as const satisfies Record<ProductBondUsageProtocol, string>

export function getBondbuilderUsageHint(
  usageProtocol: ProductBondUsageProtocol | null | undefined,
): string {
  if (usageProtocol) return BONDBUILDER_USAGE_HINTS[usageProtocol]
  return BONDBUILDER_CLEAN_BASE_GUIDANCE
}
