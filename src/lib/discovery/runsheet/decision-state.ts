/**
 * One status per step entry (cockpit call-ready A1, Nick's ruling 2026-10-09), derived in ONE
 * place so the step card, „Für den Plan festgehalten" and the week view can never tell the
 * consultant different stories:
 *
 *  - `entschieden` — the call clicked keep, swap or drop for this entry;
 *  - `bewusst_ohne` — an empty step deliberately left without a product (keep / drop of the
 *    empty entry): decided, and never to be read as „offen";
 *  - `vorschlag` — an empty step whose Idealplan pick nobody confirmed yet;
 *  - `offen` — her own product (or an empty step without any pick) still undecided.
 *
 * Pure. It reads only what every surface already holds — the entry's item, its decision (the
 * server's or the cockpit's optimistic one) and whether a proposal exists — and touches no
 * hashed field (`outcome` stays as it is).
 */

export type RunsheetDecisionState = "entschieden" | "vorschlag" | "offen" | "bewusst_ohne"

export const RUNSHEET_DECISION_STATE_LABELS: Record<RunsheetDecisionState, string> = {
  entschieden: "Entschieden",
  vorschlag: "Vorschlag",
  offen: "Offen",
  bewusst_ohne: "Bewusst ohne Produkt",
}

export function runsheetDecisionState(input: {
  intakeItemId: string | null
  decision: "keep" | "swap" | "drop" | null
  hasProposal: boolean
}): RunsheetDecisionState {
  const empty = input.intakeItemId === null
  if (input.decision) {
    return empty && input.decision !== "swap" ? "bewusst_ohne" : "entschieden"
  }
  return empty && input.hasProposal ? "vorschlag" : "offen"
}
