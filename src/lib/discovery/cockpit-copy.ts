import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { scanReasonsLabel } from "@/lib/scan/result-presentation"
import {
  SCAN_NOT_NEEDED_REASON_COPY,
  SCAN_SUBTITLE_WITHOUT_TARGETS,
  SCAN_VERDICT_COPY,
  scanDeferredSubtitle,
  scanNotNeededHeadline,
  scanNotNeededSubtitle,
} from "@/lib/scan/verdict-labels"

/**
 * The cockpit's neutral voice for SHARED verdict copy (verdict-layer T4, O4 closure).
 *
 * The cockpit is Nick's screen and speaks pronoun-free — labels and notices, no „du", no
 * „sie"/„ihr" about the participant (Nick's ruling 2026-09-29, replacing the earlier third
 * person). The verdict texts it borrows from the participant surfaces (scan verdict,
 * Idealplan step sentences, role purposes) are second person there and must stay so — this
 * module never changes them. It maps a KNOWN shared string to its neutral cockpit variant at
 * render time; every other string passes through unchanged.
 *
 * Deliberately an explicit map, not a pronoun regex: each variant is rewritten
 * neutral-factual („Die Kopfhaut ist eher trocken.", „Passt nicht zum Haarprofil") instead of
 * swapped word for word. The only computed entries are the scan's per-category templates,
 * generated from the scan's own functions so their keys can never drift from what the scan
 * renders.
 */

/** Scan verdict copy (`src/lib/scan/verdict-labels.ts`), keyed by the scan's own values. */
const SCAN_VERDICT_TITLES: Array<[string, string]> = [
  [SCAN_VERDICT_COPY.ideal.title, "Passt zum Haarprofil"],
  [SCAN_VERDICT_COPY.supportive.title, "Passt mit Einschränkung zum Haarprofil"],
  [SCAN_VERDICT_COPY.mismatch.title, "Passt nicht zum Haarprofil"],
  [SCAN_SUBTITLE_WITHOUT_TARGETS, "Basierend auf dem Haarprofil"],
  [scanReasonsLabel({ kind: "in_catalog", verdict: "ideal" }), "Warum das passt"],
]

/** `SCAN_NOT_NEEDED_REASON_COPY`, by reason id — total over the scan's ids (tested). */
export const COCKPIT_NOT_NEEDED_REASONS: Record<keyof typeof SCAN_NOT_NEEDED_REASON_COPY, string> =
  {
    "conditioner.inclusion.very_short_not_needed":
      "Bei dieser Haarlänge braucht es nach der Wäsche keine zusätzliche Längenpflege.",
    "leave_in.inclusion.no_job": "Aktuell keine Aufgabe, die ein Leave-in übernehmen müsste.",
    "mask.inclusion.no_job": "Die Längen zeigen aktuell keinen erhöhten Pflegebedarf.",
    "bondbuilder.inclusion.no_job":
      "Aktuell keine Belastung, die eine gezielte Strukturpflege nötig macht.",
    "deep_cleansing.inclusion.none":
      "Die aktuelle Produktnutzung hinterlässt keine Rückstände, für die eine Tiefenreinigung nötig wäre.",
    "deep_cleansing.inclusion.deferred_load":
      "Die aktuelle Produktnutzung ist noch nicht erfasst — im Call klären.",
    "dry_shampoo.inclusion.none":
      "Der Ansatz fettet nicht so schnell nach, dass eine Überbrückung nötig wäre.",
    "dry_shampoo.inclusion.declined_bridge": "Trockenshampoo zur Überbrückung nicht gewünscht.",
    "heat_protectant.inclusion.ordinary_airflow":
      "Die Hitze-Anwendungen machen keinen eigenen Hitzeschutz nötig.",
    "heat_protectant.inclusion.no_heat_event": "Aktuell Styling ohne Hitze.",
    "oil.pre_wash_fibre_treatment.no_job": "Vor der Haarwäsche aktuell keine Ölpflege nötig.",
    "oil.leave_on_fibre_conditioning.no_job":
      "Im feuchten Haar aktuell keine zusätzliche Ölpflege nötig.",
    "oil.dry_finish.no_job": "Für ein Finish im trockenen Haar aktuell kein Anlass.",
    "scalp_care.inclusion.none":
      "Die Kopfhaut zeigt aktuell nichts, was eine eigene Pflege nötig macht.",
    "scalp_care.inclusion.buildup_deferred":
      "Die Kopfhaut-Angaben sind noch nicht vollständig — im Call klären.",
  }

/**
 * Literal shared strings without an exported source value. Each key is checked verbatim
 * against its source file (`tests/discovery-cockpit-copy.test.ts`), so a copy edit there
 * fails the test instead of silently falling back to the second person.
 */
const LITERAL_ENTRIES: Array<[string, string]> = [
  // Idealplan step sentences — `src/lib/personal-plan/decision-presentation.ts`
  // (cockpit: „Schritt im Idealplan" depth and the verdict's „Warum"-block).
  [
    "Deine Haaranalyse zeigt einen möglichen Bedarf, aber auch einen Grund für Vorsicht.",
    "Die Haaranalyse zeigt einen möglichen Bedarf, aber auch einen Grund für Vorsicht.",
  ],
  [
    "Entfernt Talg und Rückstände, ohne deine empfindliche Kopfhaut unnötig zu reizen.",
    "Entfernt Talg und Rückstände, ohne die empfindliche Kopfhaut unnötig zu reizen.",
  ],
  [
    "Deine Kopfhaut reagiert empfindlich. Deshalb eine sanfte Reinigung, die auf unnötige Reizstoffe verzichtet.",
    "Die Kopfhaut reagiert empfindlich. Deshalb eine sanfte Reinigung, die auf unnötige Reizstoffe verzichtet.",
  ],
  [
    "Deine Kopfhaut fettet schneller nach. Deshalb eine ausgleichende Reinigung, die Talg zuverlässig mitnimmt, ohne die Kopfhaut zu reizen.",
    "Die Kopfhaut fettet schneller nach. Deshalb eine ausgleichende Reinigung, die Talg zuverlässig mitnimmt, ohne die Kopfhaut zu reizen.",
  ],
  [
    "Deine Kopfhaut ist eher trocken. Deshalb eine milde Reinigung, die ihr nicht zusätzlich Fett entzieht.",
    "Die Kopfhaut ist eher trocken. Deshalb eine milde Reinigung ohne zusätzlichen Fettentzug.",
  ],
  [
    "Deine Kopfhaut ist im Gleichgewicht. Deshalb eine Reinigung, die genau das erhält – nicht zu mild, nicht zu stark.",
    "Die Kopfhaut ist im Gleichgewicht. Deshalb eine Reinigung, die genau das erhält – nicht zu mild, nicht zu stark.",
  ],
  [
    "Reinigt passend zu deiner Kopfhaut und deiner Haaranalyse.",
    "Reinigt passend zu Kopfhaut und Haaranalyse.",
  ],
  [
    "Glättet deine Längen nach der Wäsche, ohne unnötig zu beschweren.",
    "Glättet die Längen nach der Wäsche, ohne unnötig zu beschweren.",
  ],
  [
    "Pflege, Glättung und Kämmbarkeit passend zum Gewicht deines Haars.",
    "Pflege, Glättung und Kämmbarkeit passend zum Haargewicht.",
  ],
  [
    "Deine Längen brauchen nach der Wäsche eine verlässliche Basispflege.",
    "Die Längen brauchen nach der Wäsche eine verlässliche Basispflege.",
  ],
  [
    "Gibt deinen Längen zusätzlichen Schutz vor Trockenheit und Reibung.",
    "Gibt den Längen zusätzlichen Schutz vor Trockenheit und Reibung.",
  ],
  [
    "Deine Längen brauchen mehr als nur ausspülbare Pflege.",
    "Die Längen brauchen mehr als nur ausspülbare Pflege.",
  ],
  [
    "Ergänzt deine normale Pflege, wenn die Längen mehr Unterstützung brauchen.",
    "Ergänzt die normale Pflege, wenn die Längen mehr Unterstützung brauchen.",
  ],
  [
    "Deine Haaranalyse zeigt einen erhöhten Pflegebedarf in den Längen.",
    "Die Haaranalyse zeigt einen erhöhten Pflegebedarf in den Längen.",
  ],
  [
    "Deine raueren Spitzen und dein Frizz profitieren von einem gezielten Finish.",
    "Die raueren Spitzen und der Frizz profitieren von einem gezielten Finish.",
  ],
  [
    "Überbrückt einen fettigeren Ansatz, wenn du keinen zusätzlichen Waschtag möchtest.",
    "Überbrückt einen fettigeren Ansatz ohne zusätzlichen Waschtag.",
  ],
  [
    "Dein Ansatz kann vor dem nächsten geplanten Waschtag nachfetten.",
    "Der Ansatz kann vor dem nächsten geplanten Waschtag nachfetten.",
  ],
  [
    "Deine chemische Behandlung macht gezielte Strukturpflege sinnvoll.",
    "Die chemische Behandlung macht gezielte Strukturpflege sinnvoll.",
  ],
  [
    "Deine beobachteten Haarsignale machen gezielte Strukturpflege sinnvoll.",
    "Die beobachteten Haarsignale machen gezielte Strukturpflege sinnvoll.",
  ],
  [
    "Der Reset ergänzt deine normale Haarwäsche nur bei Bedarf.",
    "Der Reset ergänzt die normale Haarwäsche nur bei Bedarf.",
  ],
  [
    "Schützt dein Haar vor passenden Hitze-Ereignissen.",
    "Schützt das Haar vor passenden Hitze-Ereignissen.",
  ],
  [
    "Deine Styling-Angaben bestimmen, wann dieser Schutz relevant wird.",
    "Die Styling-Angaben bestimmen, wann dieser Schutz relevant wird.",
  ],
  [
    "Kann deine Kopfhaut zusätzlich unterstützen, ohne Shampoo zu ersetzen.",
    "Kann die Kopfhaut zusätzlich unterstützen, ohne Shampoo zu ersetzen.",
  ],
  [
    "Deine Kopfhaut-Angaben machen eine zusätzliche Unterstützung sinnvoll.",
    "Die Kopfhaut-Angaben machen eine zusätzliche Unterstützung sinnvoll.",
  ],
  // Role purposes — `src/lib/personal-plan/routine/labels.ts` (depth „Warum dieser Schritt",
  // Phase-4 week lines).
  ["Regelmäßige Reinigung für deine Kopfhaut.", "Regelmäßige Reinigung für die Kopfhaut."],
  [
    "Hilft, deine Kopfhautpflege gezielter einzuplanen.",
    "Hilft, die Kopfhautpflege gezielter einzuplanen.",
  ],
  [
    "Schützt dein Haar vor passender Hitze-Anwendung.",
    "Schützt das Haar vor passender Hitze-Anwendung.",
  ],
  // Criterion explanation — `src/lib/personal-plan/products/authority/categories/conditioner.ts`
  // (verdict criterion rows when no comparison table is available).
  [
    "Keine Produktvariante deckt deine Haardicke und Pflegerichtung gemeinsam ab.",
    "Keine Produktvariante deckt Haardicke und Pflegerichtung gemeinsam ab.",
  ],
  // Verdict-section chrome — `src/components/scan/scan-verdict-sections.tsx`.
  [
    "Ändert sich dein Haar oder deine Routine, prüfen wir das für dich neu.",
    "Ändern sich Haar oder Routine, prüfen wir das neu.",
  ],
  ["Das übernimmt bei dir:", "Das übernimmt bereits:"],
]

/** The scan's per-category `not_needed` templates, generated from the scan's functions. */
function notNeededEntries(): Array<[string, string]> {
  const nominative: Record<string, string> = { kein: "kein", keinen: "kein", keine: "keine" }
  const entries: Array<[string, string]> = []
  for (const category of Object.keys(CATEGORY_COPY) as PersonalPlanCategory[]) {
    const label = CATEGORY_COPY[category].label
    // „Du brauchst aktuell keinen Conditioner" → „Aktuell kein Conditioner nötig"
    const headline = scanNotNeededHeadline(category)
    const article = headline.match(/^Du brauchst aktuell (kein|keinen|keine) /)?.[1]
    if (article) entries.push([headline, `Aktuell ${nominative[article]} ${label} nötig`])
    // „Kein Conditioner in deinem Bedarf" → „Kein Conditioner im Bedarf"
    const subtitle = scanNotNeededSubtitle(category)
    if (subtitle.endsWith(" in deinem Bedarf")) {
      entries.push([subtitle, subtitle.replace(/ in deinem Bedarf$/, " im Bedarf")])
    }
    // „Für Conditioner steht deine Einschätzung noch aus" → „… steht die Einschätzung noch aus"
    const deferred = scanDeferredSubtitle(category)
    if (deferred.includes(" steht deine Einschätzung ")) {
      entries.push([
        deferred,
        deferred.replace(" steht deine Einschätzung ", " steht die Einschätzung "),
      ])
    }
    // „Warum du keinen Conditioner brauchst" → „Warum kein Conditioner nötig ist"
    const reasons = scanReasonsLabel({ kind: "not_needed", mode: "not_needed", category })
    const reasonsArticle = reasons.match(/^Warum du (kein|keinen|keine) /)?.[1]
    if (reasonsArticle && reasons.endsWith(" brauchst")) {
      entries.push([reasons, `Warum ${nominative[reasonsArticle]} ${label} nötig ist`])
    }
  }
  return entries
}

export const COCKPIT_VOICE_MAP: ReadonlyMap<string, string> = new Map([
  ...SCAN_VERDICT_TITLES,
  ...(
    Object.keys(COCKPIT_NOT_NEEDED_REASONS) as Array<keyof typeof COCKPIT_NOT_NEEDED_REASONS>
  ).map((id): [string, string] => [
    SCAN_NOT_NEEDED_REASON_COPY[id],
    COCKPIT_NOT_NEEDED_REASONS[id],
  ]),
  ...LITERAL_ENTRIES,
  ...notNeededEntries(),
])

/**
 * The shampoo sentence's optional tail (`decision-presentation.ts`): „…${dandruffSentence}".
 * It carries no second person, so the one pattern rule is: map the head, keep the tail.
 */
export const COCKPIT_DANDRUFF_SUFFIX = " Außerdem soll das Shampoo gezielt gegen Schuppen arbeiten."

/**
 * The cockpit variant of a shared string: the neutral one where the map knows it, the string
 * itself otherwise — unknown text (brand names, LLM brief lines, cockpit-own copy) passes
 * through untouched. Exact match on purpose: a string that differs even in case is not the
 * shared string the map was written for.
 */
export function cockpitVoice(text: string): string {
  const exact = COCKPIT_VOICE_MAP.get(text)
  if (exact !== undefined) return exact
  if (text.endsWith(COCKPIT_DANDRUFF_SUFFIX)) {
    const head = COCKPIT_VOICE_MAP.get(text.slice(0, -COCKPIT_DANDRUFF_SUFFIX.length))
    if (head !== undefined) return `${head}${COCKPIT_DANDRUFF_SUFFIX}`
  }
  return text
}
