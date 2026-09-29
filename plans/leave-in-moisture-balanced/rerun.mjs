// Rerun of care_direction (v1.0 §9 vs. candidate v1.1 overlay) across the frozen corpus.
// Research artifact only: reads the frozen packets, verifies every hand-classified species
// against its frozen INCI rank, and applies both rules mechanically. No writes anywhere.
//
// Run: node plans/leave-in-moisture-balanced/rerun.mjs   (from the worktree root)
import { readFileSync } from "node:fs"

const corpus = "data/research/leave-in-inci/v1.0/corpus"
const gold = JSON.parse(readFileSync(`${corpus}/gold-set/calibration-packet.json`, "utf8")).entries
const unseen = JSON.parse(readFileSync(`${corpus}/unseen-test/unseen-packet.json`, "utf8")).entries
const inciOf = (slot) => {
  const e = [...gold, ...unseen].find((x) => String(x.slot) === String(slot))
  return e.normalized_ingredients.map((i) => (typeof i === "string" ? i : i.name ?? i.inci))
}

// Species classes (only species ABOVE the tail marker are listed; below-marker species are subordinate).
//   F  persistent film (L2 persistent silicone, silicone quat, Polysilicone-29)
//   V  volatile carrier (L2 volatile / volatile hydrocarbon / propellant) - M6, contributes nothing
//   C  L1 cationic (quat, cationic polymer)          FA  fatty alcohol (LGN partner)
//   DH settled humectant (water-binding function settled by the INCI name)
//   G  multifunctional glycol (solvent / preservative booster / film plasticiser / humectant)
//   DL non-volatile medium- or rich-band lipid (SR D.1)
//   DE dry-feel spreading ester (SR D.1 dry-feel band)
//   X  other: extract, plain hydrolysate, vitamin, emulsifier, thickener, pH, fragrance, alcohol, L5/L7
// marker: rank of the §3.1.1 tail marker; status per reference-key-v4 / unseen records.
// r2: R2 (repair_surface_film) value on the frozen record.
const records = [
  { slot: 1, name: "alverde Leave-In Sprühkur Express 7in1", live: "moisture", marker: 9, status: "plausible", r2: "none_visible",
    above: { 2: "DL", 3: "X", 4: "DH", 5: "DE", 6: "G", 7: "X", 8: "DE" } },
  { slot: 2, name: "ISANA Leave-In Hyaluron & Panthenol", live: "moisture", marker: 9, status: "plausible", r2: "none_visible",
    above: { 2: "FA", 3: "DH", 4: "DE", 5: "C", 6: "DH", 7: "C", 8: "C" } },
  { slot: 3, name: "Cantu Leave-In Repair Creme", live: "moisture", marker: 28, status: "plausible", r2: "none_visible",
    above: { 2: "DL", 3: "FA", 4: "DH", 5: "C", 6: "DL", 7: "DL", 16: "DH", 24: "DH" } },
  { slot: 4, name: "alverde Nutri-Care 2-Phasen-Sprühkur", live: null, marker: null, status: "none_visible", r2: "none_visible",
    above: { 2: "DL", 3: "X", 4: "DH", 5: "DH", 6: "DH", 7: "DL" } },
  { slot: 5, name: "EVO Head Mistress Cuticle Sealer", live: "balanced", marker: 6, status: "plausible", r2: "none_visible",
    above: { 2: "F", 3: "V", 4: "X", 5: "F" } },
  { slot: 6, name: "Curlsmith Hydrate & Plump", live: "moisture", marker: 36, status: "vacuous", r2: "none_visible",
    above: { 2: "DE", 3: "FA", 4: "DE", 5: "DL", 6: "C", 7: "DH", 8: "DH", 9: "DL", 10: "DL", 11: "C", 12: "C" } },
  { slot: 8, name: "Gliss Express-Repair Sprüh-Conditioner", live: "moisture", marker: 14, status: "plausible", r2: "none_visible",
    above: { 2: "V", 3: "F", 4: "DL", 5: "F", 6: "X", 7: "X", 8: "F", 9: "C", 10: "X", 11: "C" } },
  { slot: 9, name: "Redken Extreme Anti-Snap", live: "protein", marker: 3, status: "implausible", r2: "candidate",
    above: { 2: "X", 4: "F", 8: "DE" } },
  { slot: 10, name: "Olaplex No.6 Bond Smoother", live: "moisture", marker: 14, status: "plausible", r2: "none_visible",
    above: { 2: "FA", 3: "F", 4: "V", 5: "DE", 6: "DE", 7: "C", 8: "V", 9: "F", 10: "G", 11: "X", 13: "C" } },
  { slot: 11, name: "Balea Leichtkämmspray", live: null, marker: 7, status: "vacuous", r2: "none_visible",
    above: { 2: "DH", 3: "G", 4: "C", 5: "X", 6: "DH" } },
  { slot: 13, name: "Neqi Diamond Glass Styling Spray", live: "moisture", marker: 9, status: "plausible", r2: "none_visible",
    above: { 2: "G", 3: "X", 4: "X", 5: "X", 6: "G", 7: "F", 8: "X" } },
  { slot: "u1", name: "Elvital Dream Length No Spliss Milk", live: null, marker: 13, status: "plausible", r2: "none_visible",
    above: { 2: "DE", 3: "F", 4: "F", 5: "X", 6: "X", 7: "DL", 8: "X", 10: "X", 11: "X", 12: "X" } },
  { slot: "u4", name: "Briogeo Avocado + Kiwi Leave-In", live: null, marker: 31, status: "vacuous", r2: "none_visible",
    above: { 2: "X", 3: "FA", 4: "DH", 5: "C", 6: "X", 7: "DE", 8: "DL", 12: "DH", 13: "DH", 18: "DL" } },
  { slot: "u5", name: "ISANA Argan Leave-in Conditioner", live: null, marker: 11, status: "vacuous", r2: "none_visible",
    above: { 2: "DH", 3: "DL", 4: "DH", 5: "X", 6: "DL", 7: "FA", 9: "C" } },
  { slot: "u6", name: "amika The Shield", live: null, marker: 16, status: "plausible", r2: "none_visible",
    above: { 1: "V", 2: "V", 4: "V", 5: "DL", 6: "FA", 7: "X", 8: "X", 9: "C", 10: "C", 11: "X", 12: "F", 13: "C", 14: "X", 15: "DH" } },
]

// Expected INCI at each classified rank (guards against transcription error).
const expect = {
  1: { 2: "HELIANTHUS ANNUUS HYBRID OIL", 4: "GLYCERIN", 6: "PENTYLENE GLYCOL" },
  2: { 3: "GLYCERIN", 6: "BETAINE" },
  3: { 2: "CANOLA OIL", 4: "GLYCERIN" },
  4: { 2: "GLYCINE SOJA OIL", 4: "GLYCERIN", 5: "SODIUM LACTATE", 6: "BETAINE" },
  5: { 2: "DIMETHICONE", 5: "DIMETHICONOL" },
  6: { 5: "RICINUS COMMUNIS (CASTOR) SEED OIL", 7: "GLYCERIN" },
  8: { 2: "TRISILOXANE", 3: "DIMETHICONE", 4: "PRUNUS ARMENIACA KERNEL OIL", 5: "PHENYL TRIMETHICONE" },
  10: { 3: "DIMETHICONE", 5: "COCO-CAPRYLATE", 6: "NEOPENTYL GLYCOL DIHEPTANOATE", 10: "PROPANEDIOL" },
  11: { 2: "BETAINE", 6: "PANTHENOL" },
  13: { 2: "DIPROPYLENE GLYCOL", 6: "PENTYLENE GLYCOL", 7: "POLYSILICONE-29" },
  u1: { 2: "ISOPROPYL MYRISTATE", 3: "DIMETHICONE", 7: "RICINUS COMMUNIS SEED OIL / CASTOR SEED OIL" },
  u4: { 4: "GLYCERIN", 8: "PERSEA GRATISSIMA (AVOCADO) OIL" },
  u5: { 2: "GLYCERIN", 3: "RICINUS COMMUNIS SEED OIL" },
  u6: { 5: "HIPPOPHAE RHAMNOIDES (SEA BUCKTHORN/ARGOUSIER) FRUIT/SEED OIL", 12: "PHENYL TRIMETHICONE", 15: "GLYCERIN" },
}
for (const [slot, ranks] of Object.entries(expect)) {
  const inci = inciOf(slot)
  for (const [rank, name] of Object.entries(ranks)) {
    if (inci[rank - 1] !== name) throw new Error(`slot ${slot} r${rank}: expected ${name}, packet has ${inci[rank - 1]}`)
  }
}

const ranksOf = (rec, classes) =>
  Object.entries(rec.above).filter(([, c]) => classes.includes(c)).map(([r]) => Number(r)).sort((a, b) => a - b)

// v1.0 §9 as frozen: R2 -> protein; any L1/L3/L4 above tail -> moisture; film-led (T19) -> balanced.
// L3 in v1.0 includes the dry-feel band and volatile hydrocarbons; L4 includes glycols.
function currentRule(rec) {
  if (rec.r2 === "candidate" || rec.r2 === "tested") return "protein"
  const legs = ranksOf(rec, ["C", "DH", "G", "DL", "DE"])
  if (legs.length) return "moisture"
  if (ranksOf(rec, ["F"]).length) return "balanced"
  return "unknown"
}

// Candidate v1.1 overlay (Option A): only DH and DL species are directional; a film that leads
// every directional species makes the moisture leg subordinate.
function proposedRule(rec) {
  if (rec.r2 === "candidate" || rec.r2 === "tested") return { value: "protein", row: "protein_anchor" }
  const d = ranksOf(rec, ["DH", "DL"])
  const f = ranksOf(rec, ["F"])
  const readable = d.length || f.length || ranksOf(rec, ["C", "FA"]).length
  if (!readable) return { value: "unknown", row: "evidence_failure" }
  if (!d.length)
    return { value: "balanced", row: f.length ? "film_led_neutral" : "conditioning_only_neutral", margin: null }
  if (f.length && f[0] < d[0]) return { value: "balanced", row: "film_leads_moisture_leg", margin: d[0] - f[0] }
  return { value: "moisture", row: "moisture_led", margin: f.length ? f[0] - d[0] : null }
}

// Option A-narrow: species demotion only, no film-lead test.
function narrowRule(rec) {
  if (rec.r2 === "candidate" || rec.r2 === "tested") return "protein"
  if (ranksOf(rec, ["DH", "DL"]).length) return "moisture"
  return "balanced"
}

console.log("slot | product | live | v1.0 | A-narrow | A (recommended) | row | first film | first DH/DL | margin")
for (const rec of records) {
  const p = proposedRule(rec)
  const f = ranksOf(rec, ["F"])[0] ?? "-"
  const d = ranksOf(rec, ["DH", "DL"])[0] ?? "-"
  const flag = currentRule(rec) !== p.value ? "  <-- FLIP" : ""
  console.log(`${rec.slot} | ${rec.name} | ${rec.live ?? "-"} | ${currentRule(rec)} | ${narrowRule(rec)} | ${p.value} | ${p.row} | ${f} | ${d} | ${p.margin ?? "-"}${flag}`)
}
