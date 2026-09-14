// Shared pure helpers and vocabulary tables used by both fixture builders:
//   - build-lab-fixture.mjs (the gold-set / calibration-packet lane)
//   - build-unseen-products.mjs (the unseen-test lane, batch "unseen-test")
//
// Kept side-effect-free (no top-level file reads, no process.argv) so either
// builder — or a future third one — can import it without triggering the
// other's CLI contract.

import { createHash } from "node:crypto"

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function stableStringify(value) {
  if (value === null) return "null"
  if (typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`
}

export function fingerprint(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex")
}

export function displayValue(value) {
  if (value === null || value === undefined) return "nicht abgeleitet"
  if (Array.isArray(value)) return value.length ? value.join(" · ") : "[]"
  if (typeof value === "boolean") return value ? "true" : "false"
  return String(value)
}

// The seven §7 dimensions that survive the v0.4 trim, in review order. See
// build-lab-fixture.mjs's header comment (T1-T17) for the full derivation of
// this trim — both lanes review the same seven dimensions, since the
// unseen-test lane was run against the same frozen v0.4 standard.
export const DIMENSION_ABBREVIATIONS = {
  conditioning_potential: "COND",
  weight_residue_potential: "WT",
  persistence_removal_class: "PERS",
  hold_route_state: "HOLD",
  heat_protection_evidence_state: "HEAT",
  repair_surface_film: "R2",
  fragrance_scalp_exposure: "EXPO",
}

export const DIMENSION_LABELS = {
  conditioning_potential: "Pflegepotenzial (inkl. Slip-Beobachtung)",
  weight_residue_potential: "Gewicht / Rückstand (inkl. Architektur-Leseweise, §3.1.2)",
  persistence_removal_class: "Persistenz / Auswaschbarkeit",
  hold_route_state: "Halt-Route",
  heat_protection_evidence_state: "Hitzeschutz-Evidenz",
  repair_surface_film: "Repair-Oberflächenfilm",
  fragrance_scalp_exposure: "Duft- / Kopfhaut-Exposition",
}

// Dimension fields whose profile counterpart is a deterministic echo (T8),
// annotated on the dimension row itself rather than listed as its own row.
export const ECHO_OF_DIMENSION = {
  conditioning_potential: "conditioning_level",
  weight_residue_potential: "weight_potential",
  persistence_removal_class: "persistence",
  hold_route_state: "hold_support",
}

// The lean-profile fields that stay separately reviewable (T8; `product_form`
// added T10 — it is an independent identity read, not a dimension echo).
export const PROFILE_LABELS = {
  product_form: "Produktform (Präsentationsform)",
  repair_support_level: "Repair-Unterstützung",
  "focus.primary": "Primärer Fokus",
  "focus.secondary": "Sekundäre Schwerpunkte",
  "specialist_functions.provides_heat_protection": "Hitzeschutz (Binärwert)",
  "hair_thickness_fit.fine": "Haardicke · fein",
  "hair_thickness_fit.medium": "Haardicke · normal",
  "hair_thickness_fit.coarse": "Haardicke · dick",
  "damage_fit.healthy": "Schädigung · gesund",
  "damage_fit.moderately_damaged": "Schädigung · mäßig geschädigt",
  "damage_fit.highly_damaged": "Schädigung · stark geschädigt",
  "texture_fit.straight": "Textur · glatt",
  "texture_fit.wavy": "Textur · wellig",
  "texture_fit.curly": "Textur · lockig",
  "texture_fit.coily": "Textur · stark lockig",
}
