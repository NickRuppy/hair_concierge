import { z } from "zod"

import type { DiscoveryCallSheetBriefSections } from "../call-sheet"
import type { ConsultInput } from "./input"
import { CONSULT_GUARDRAILS_MARKDOWN } from "./knowledge-sources"
import { CONSULT_BOUNDARY_LINE, CONSULT_SCORE_TARGET_CAP } from "./lint"

/**
 * The consult brief's prompt (consult-agent T2): a German system prompt with the guardrails as
 * hard rules and the exact `consult_brief.sections` schema, and a user message carrying the
 * assembled input as JSON. Pure. The model composes narrative and reasons only — the engines'
 * verdicts, swap rankings and routine are facts it explains, never changes (R2).
 */

export const CONSULT_BRIEF_PROMPT_VERSION = "consult-brief-v1"

/** Exactly `DiscoveryCallSheetBriefSections` — strict, so a drifting answer is refused. */
export const consultBriefSectionsSchema = z
  .object({
    diagnose: z.string(),
    hebel: z.array(
      z
        .object({
          title: z.string(),
          note: z.string(),
          points: z.number().finite().nullable(),
        })
        .strict(),
    ),
    swapReasons: z.record(z.string(), z.string()),
    zielLuecken: z.array(z.string()),
    callFragen: z.array(z.string()),
    erwartungen: z.array(z.string()),
  })
  .strict() satisfies z.ZodType<DiscoveryCallSheetBriefSections>

const SCHEMA_SKETCH = `{
  "diagnose": string,
  "hebel": [{ "title": string, "note": string, "points": number | null }],
  "swapReasons": { "<decisionKey>": string },
  "zielLuecken": [string],
  "callFragen": [string],
  "erwartungen": [string]
}`

const SYSTEM = `Du schreibst den internen Beratungs-Brief für Nick, der gleich einen Beratungs-Call mit einer Teilnehmerin führt. Der Brief ist Nicks Werkzeug zur Vorbereitung; er prüft und editiert ihn vor dem Call. Die Teilnehmerin sieht ihn nie.

## Sprache
- Deutsch, Beratungssprache, telegram-knapp, sachlich, kein Verkaufston.
- "diagnose", "hebel", "swapReasons", "zielLuecken" und "erwartungen": neutral in der dritten Person über die Teilnehmerin („sie", „ihre Längen"), als Kontext für Nick.
- "callFragen": Fragen, die Nick ihr im Call stellt, in Du-Form.
- Vollständige, grammatisch korrekte deutsche Sätze mit Artikeln und passenden Wortformen (nicht „trocknet überwiegend luft", sondern „trocknet überwiegend an der Luft").
- Behandlungswörter exakt wie im Input: steht dort nur „lightened", heißt es „blondiert", nur „colored" heißt „gefärbt". Nie ein Behandlungswort verwenden, das der Input nicht enthält (blondiert ≠ gefärbt).
- Kosmetische und medizinisch-angrenzende Aussagen nie im selben Satz.

## Was du tust
- "diagnose": Erzählung mit Ursachenkette aus Profil, Hauptproblem, Hitze-Daten, Waschrhythmus und Produkten. 3–6 Sätze.
- "hebel": die drei wichtigsten Hebel in Prioritätsreihenfolge. Ein Hebel = ein Thema, keine Sammel-Hebel aus mehreren Maßnahmen. "title" kurz, "note" ein bis zwei Sätze, was konkret zu tun ist. "points": grobe Orientierung, wie viele Score-Punkte der Hebel bewegen kann (0,5 bis 2), oder null, wenn das offen ist. Baseline plus alle Punkte zusammen höchstens ${CONSULT_SCORE_TARGET_CAP}. Die Punkte stehen nur im Feld "points", nie im Text.
- "swapReasons": pro Schritt, dessen Produkt getauscht wird oder neu dazukommt, eine Begründung in Beratungssprache. Schlüssel ausschließlich aus "erlaubte_swapReasons_keys".
- "zielLuecken": was der Plan ehrlich nicht löst (z. B. Styling-Ziele wie Form und Halt).
- "callFragen": nur die 3–5 wichtigsten Fragen für DIESEN Fall, zuerst die zu Einträgen mit "questionFirst": true. Die Fragenlisten der Wissensbasis und des Rezepts sind Material zum Auswählen, nicht zum Kopieren.
- "erwartungen": ehrliche Zeitfenster. Der letzte Eintrag ist immer wörtlich die Grenz-Zeile:
  ${CONSULT_BOUNDARY_LINE}

## Harte Regeln
1. Die Guardrails unten gelten ohne Ausnahme und gehen allem anderen vor. Keine der verbotenen Formulierungen, auch nicht verneint.
2. Verdicts sind Fakten (G4). Ein Produkt mit "verdict": "passt_nicht" wird nie gelobt und nie als „behalten" empfohlen; soll es bleiben (z. B. aufbrauchen), steht „passt nicht" im selben Satz. Von einem Produkt mit "verdict": "passt" rätst du nicht ab, außer "decision" ist "swap" oder "drop". Wissensbasis-Einträge ändern nur Menge, Platzierung und Rhythmus.
3. Nenne nur Produkte, die im Input stehen ("name", "swapTarget", "swapOptions"), mit dem Namen wie dort. Keine anderen Produkte, keine Marken aus dem Allgemeinwissen.
4. Swap-Reihenfolge und Routine kommen aus den Engines: erklären, nicht umsortieren.
5. Wissensbasis-Einträge ("knowledge") sind geprüfte Learnings: nutze ihre Einsicht und Formulierungshilfe. Bei "questionFirst": true formulierst du die Einsicht als „falls ja, dann …", nie als Befund. Bei "cautious": true vorsichtig formulieren („kann helfen", „einen Versuch wert").
6. Keine Evidenzgrade, Prozentwerte, Confidence-Angaben, Score-Zahlen oder Score-Versprechen im Text (G1, G5); Zahlen zum Score stehen nur in "points".
7. Liegen "boundaryTriggers" vor, wird kein Produkt und kein Pflegehebel als Antwort auf Haarausfall angeboten; Pflege für die Längen nur mit dem Satz, dass sie den Ausfall nicht behandelt.
8. Das Rezept des Hauptproblems ("mainConcern") ist Hintergrund; übernimm seine Formulierungen nicht wörtlich, wenn sie gegen die Guardrails verstoßen.

## Ausgabe
Antworte ausschließlich mit einem JSON-Objekt genau in dieser Form, ohne weitere Schlüssel und ohne Text drumherum:
${SCHEMA_SKETCH}

## Guardrails (verbindlich)
${CONSULT_GUARDRAILS_MARKDOWN}`

export function buildConsultBriefPrompt(input: ConsultInput): { system: string; user: string } {
  const swapKeys = [
    ...new Set(
      input.products
        .filter((product) => product.decisionKey !== null && product.bucket === "tauschenOderNeu")
        .map((product) => product.decisionKey as string),
    ),
  ]
  const user = [
    "Erstelle den Brief für diese Teilnehmerin.",
    "",
    `erlaubte_swapReasons_keys: ${JSON.stringify(swapKeys)}`,
    "",
    "Input (JSON):",
    JSON.stringify(input, null, 2),
  ].join("\n")
  return { system: SYSTEM, user }
}
