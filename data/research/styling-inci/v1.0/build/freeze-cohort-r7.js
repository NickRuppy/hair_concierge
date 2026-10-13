#!/usr/bin/env node
// Targeted R6 owner-ruling re-check. Historical builders run with memory-only writes.
// Only r7/ is written; r6 evidence is retained except id/version and F/U grading masks.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const V1 = path.resolve(__dirname, '..');
const ROOT = path.resolve(V1, '../../../..');
const OUT = path.join(V1, 'r7');
const R6_OUT = path.join(V1, 'r6');
const R6_SCRIPT = path.join(__dirname, 'freeze-cohort-r6.js');
const STAMP = 'styling-inci-v0.5-r6amend';
const VERSION = 'styling-inci-v1.0-cohort-7';
const SALT = 'styling-inci-v1.0-cohort-7/r6-owner-amendment/opaque-id/';
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const ser = o => JSON.stringify(o, null, 2) + '\n';
const clone = o => JSON.parse(JSON.stringify(o));
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Reuse r6's actual construction and leak rules without writing r1-r6. Verify all
// 432 regenerated r6 artifacts against frozen disk bytes before selecting records.
const mem = new Map();
const sandboxFs = Object.assign({}, fs, {
  readFileSync(p, enc) {
    const k = path.resolve(String(p));
    return mem.has(k) ? (enc ? mem.get(k).toString(enc) : mem.get(k)) : fs.readFileSync(p, enc);
  },
  writeFileSync: (p, d) => void mem.set(path.resolve(String(p)), Buffer.from(d)),
  mkdirSync: () => {}, rmSync: () => {},
});
const ctx = vm.createContext({ require: m => m === 'fs' ? sandboxFs : require(m),
  __dirname: path.dirname(R6_SCRIPT), __filename: R6_SCRIPT, Buffer, console: { log: () => {} } });
vm.runInContext(fs.readFileSync(R6_SCRIPT, 'utf8'), ctx, { filename: R6_SCRIPT });
const R6 = expression => vm.runInContext(expression, ctx);
let rebuildFiles = 0;
for (const [p, b] of mem) if (p.startsWith(R6_OUT + path.sep)) {
  if (!fs.readFileSync(p).equals(b)) throw new Error('r6 rebuild changed frozen bytes: ' + p);
  rebuildFiles++;
}
if (rebuildFiles !== 432) throw new Error('incomplete r6 rebuild: ' + rebuildFiles);
const source = JSON.parse(fs.readFileSync(path.join(R6_OUT, 'cohort.json'), 'utf8'));
const all = source.records.slice().sort((a, b) => cmp(a.source_slug, b.source_slug));
const bySlug = Object.fromEntries(all.map(r => [r.source_slug, r]));
const isC12 = R6('isC12');
// Standard §10.2 / R2-Q3: apply the same S0 grading lists to inherited F/U
// directions, including compound hold strengths, while retaining job nouns.
const maskGrades = R6('maskS0');
// Existing identity/look masks are opaque: they do not prove that an adjacent
// adjective grades hold (e.g. inherited „intensiv [CLAIM] Ergebnis”). Shield them
// from S0's adjacent-grade cleanup, then restore their bytes unchanged.
const INHERITED_MASK = '\uE000';
const maskFuGrades = text => {
  if (text.includes(INHERITED_MASK)) throw new Error('F/U mask sentinel collision');
  const masked = maskGrades(text.replace(/\[CLAIM\]/g, INHERITED_MASK), false);
  return { text: masked.text.replaceAll(INHERITED_MASK, '[CLAIM]'), count: masked.count };
};

// Manual directions reading over all 143 records; evidence is stored verbatim in
// scope-audit.json. Broad screening includes dose/repeat ambiguities and optional
// other-product add-ons, even if the amended target_zone will remain unchanged.
const DIRECTION_REASONS = {
  'alverde-locken-refresh-spray': 'optional extra moisture: repeat on dry hair',
  'balea-haarpuder-volumen-pomegranate': 'conditional extra volume: direct root application after general hair application',
  'balea-men-styling-powder': 'conditional extra volume: direct root application after general hair application',
  'balea-locken-crunchgel': 'optional next-day refresh: reapply a small amount to dampened hair',
  'balea-pure-styling-volumenpuder-spray': 'OWNER T1: required roots; optional lengths for texture/grip',
  'balea-sea-salt-texture-spray': 'optional extra dry-hair application for curl-tool finish',
  'balea-styling-spray-ultra-volumen': 'required roots then lengths; optional interim dry-hair reuse',
  'bali-curls-volumizing-curl-spray-refreshing': 'required tips-to-roots sequence; optional extra Curl Defining Gel',
  'bumble-and-bumble-brilliantine': 'conservative dose/repeat screen: use little and build if needed',
  'cantu-lockencreme-kokos': 'optional dry-hair moisture use after damp main use; oil after-treatment',
  'cantu-lockenspray-comeback-curl-next-day': 'optional extra moisture: repeat on dry hair',
  'feschi-smooth-and-shine-anti-frizz-spray-glanzspray': 'conditional extra damp pre-styling application for coarse/thick hair',
  'gard-haarspray-extrastark-pumpspray': 'conditional extra-effect applications: roots for volume; individual strands for styling',
  'got2b-anti-frizz-lotion-schmusekatze': 'conservative optional-use screen: extra heat-protection use in HACK',
  'got2b-gotgloss-glanz-spray': 'optional repeat finish application; optional Primer combination routine',
  'got2b-spruehkleber-freeze-haarlack': 'optional targeted application to individual strands after whole-hair instruction',
  'john-frieda-frizz-ease-traumlocken-lockencreme': 'optional day-2 application to particularly unruly curls',
  'john-frieda-frizz-ease-zauberformel-seiden-finish-creme': 'optional anytime reapplication as needed',
  'langhaarmaedchen-lockenspray-halt-sprungkraft': 'optional extra post-styling application for hold',
  'langhaarmaedchen-lockenspray-natur-lockenwunder': 'optional dry-hair fresh-kick between main wet-hair uses',
  'living-proof-full-dry-volume-texture-spray': 'repeat as needed; final-style application; optional lengths application in Tips',
  'moroccanoil-glaettende-creme-smoothing-lotion': 'optional extra-effect combination: treatment and mousse with lotion',
  'moroccanoil-root-boost': 'optional extra-effect combination: Volumenschaum before blow-drying',
  'moroccanoil-textur-und-volumenpuder': 'conditional additional pump applications to increase volume',
  'nivea-men-styling-cream-active-craft-stylers': 'optional re-styling with an additional dab',
  'osis-flatliner': 'conservative optional extra-effect use: can also serve as fixing spray before blow-drying for more volume',
  'osis-dust-it': 'conservative required multi-site screen: whole dry hair, then named roots and lengths for extra volume/updo hold',
  'syoss-glaze-topcoat': 'conservative extra-effect application screen: before hot tools, then post-styling Glaze reinforcement',
  'syoss-haarspray-max-hold': 'conservative extra-effect applications: whole-hair finish and individual strands from roots for shaping',
  'redken-one-united-all-in-one-multi-benefit-treatment': 'conservative combination screen: conditioner/leave-in/styling application variants',
  'redken-powder-grip-03': 'extra application for mattifying/structuring finish',
  'redken-refreshing-curl-mist': 'conservative optional other-product application screen: recommended care/styling series',
  'redken-root-tease': 'OWNER T2: required roots, then whole-hair application',
  'redken-styling-beach-spray': 'optional dry-hair re-spray during the day (captured paraphrase, never promoted to verbatim)',
  'schwarzkopf-professional-osis-curl-retouch': 'optional extra dry-hair refresh after damp main use',
  'schwarzkopf-taft-gel-wax-glanz-halt-2': 'optional extra other-product finish: TAFT Glanz Haarspray',
  'schwarzkopf-taft-haarpuder-volumen': 'optional extra volume tip: direct dry-hair powder application',
  'schwarzkopf-taft-matt-wax-halt-5': 'optional extra other-product finish: TAFT Haarspray',
  'schwarzkopf-taft-power-haargel-halt-5': 'optional extra other-product finish: TAFT Haarspray',
  'schwarzkopf-taft-styling-balm-locken-halt-3': 'optional extra other-product finish: TAFT Haarspray',
  'schwarzkopf-taft-x-gliss-silky-shine-shine-coat': 'optional extra other-product finish: holding me strongly Haarspray',
  'syoss-curl-cream-gel-3in1': 'optional extra application of Curl Schaumfestiger for definition',
  'syoss-glaze-glanz-und-schutz-primer': 'optional extra-effect combination with Glaze Haarspray',
  'syoss-hitzeschutzspray-keratin-heat': 'conservative optional other-product screen: Keratin Haarspray supplement',
  'syoss-professional-performance-max-hold-power-wax': 'conservative dose/repeat screen: take more Wax if needed',
  'taft-styling-paste-forming-halt-5plus': 'optional extra other-product finish: TAFT Haarspray',
  'taft-x-gliss-hitzeschutzspray-lovely-long': 'optional additional dry-hair use after damp main use',
  'wella-eimi-nutricurls-fresh-up': 'optional reapplication throughout the day to reactivate curls',
};
const OWNERS = ['john-frieda-frizz-ease-unendlich-smooth-blow-out-spray',
  'neqi-diamond-glass-ultimate-styling-spray', 'neqi-diamond-glass-styling-spray-all'];
// All five aqueous smoothing-film candidates in r6. This is reach screening,
// never a classification. P29 itself is excluded from the *care* limb here.
const FILM_SCREEN = {
  'color-wow-dream-coat-supernatural-spray': { reachable: true, evidence: 'aqueous pump spray; first non-solvent film Polysilicone-29 r3; DMDM Hydantoin r4; Silicone Quaternium-18 r7; no FX-1..4; directions require blow-drying under tension; C3-only promise remains an evidence gate' },
  'john-frieda-frizz-ease-unendlich-smooth-blow-out-spray': { reachable: true, evidence: 'aqueous pump spray; Polysilicone-29 r3; Sodium Benzoate r7; oils r13/r14 and conditioning quats r18/r21/r22 after it; no FX; owner named' },
  'neqi-diamond-glass-styling-spray-all': { reachable: true, evidence: 'aqueous pump spray; Polysilicone-29 r7; T_LI Ethylhexylglycerin r8; Silicone Quaternium-18 r10; no FX; heat-activation C2 lines; owner named' },
  'neqi-diamond-glass-ultimate-styling-spray': { reachable: true, evidence: 'OWNER inclusion: Polysilicone-29 r7; T_LI Ethylhexylglycerin r9; Silicone Quaternium-18 r11; frozen FX-1 VP/Methacrylamide/Vinyl Imidazole Copolymer r8 remains; explicit owner outcome overrides the generic no-FX predicate, not its ingredient membership' },
  'garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray': { reachable: false, evidence: 'not film-led trace care: argan oil r6, amidoamine r7, ester r9 before Polysilicone-29 r15 and Phenoxyethanol r17' },
  'moroccanoil-anti-frizz-schild-spray': { reachable: false, evidence: 'Polysilicone-29 r3 but Silicone Quaternium-18 r4 and argan oil r5 precede first preservative Phenoxyethanol r39; fails trace-care limb' },
  'john-frieda-frizz-ease-3-tage-glatt-styling-spray': { reachable: false, evidence: 'Polysilicone-9 r3 is SI-4/FX-U hair-fixing, not a settled SI-1 smoothing coat; no formula-readable heat-activated smoothing-film finding; still included for brand-line screening' },
  'kms-thermashape-2-in-1-spray': { reachable: false, evidence: 'non-aqueous propellant-led aerosol; corroborated Acrylates Copolymer FX-2 r3 leads before Polysilicone-9 r8; fails aqueous/no-FX limbs' },
};
for (const slug of [...Object.keys(DIRECTION_REASONS), ...OWNERS, ...Object.keys(FILM_SCREEN)])
  if (!bySlug[slug]) throw new Error('scope table names a missing r6 record: ' + slug);
const audit = all.map(r => {
  const reasons = [];
  if (OWNERS.includes(r.source_slug)) reasons.push({ class: 'Q1-owner', evidence: FILM_SCREEN[r.source_slug].evidence });
  else if (FILM_SCREEN[r.source_slug]?.reachable) reasons.push({ class: 'Q1-film', evidence: FILM_SCREEN[r.source_slug].evidence });
  const name = r.identity.product_name;
  if (/frizz\s*ease|glow\s*(?:&|und)\s*shine|nutricurls/i.test(name))
    reasons.push({ class: 'Q1-brand-line', evidence: 'confirmed name contains barred brand-line words: ' + name });
  if (DIRECTION_REASONS[r.source_slug]) reasons.push({ class: r.source_slug === 'redken-root-tease' || r.source_slug === 'bali-curls-volumizing-curl-spray-refreshing' || r.source_slug === 'balea-styling-spray-ultra-volumen' ? 'T1-T2-directions' : 'T1-directions', evidence: DIRECTION_REASONS[r.source_slug] });
  const definitionLines = r.claims.filter(c => isC12(c.tier) && /definiert/i.test(c.raw || ''));
  if (definitionLines.length) reasons.push({ class: 'T3-result-phrase', evidence: definitionLines.map(c => c.tier + ' ' + c.type + ': ' + c.raw).join(' / ') });
  return { source_slug: r.source_slug, name: r.identity.brand + ' ' + name, included: reasons.length > 0, reasons,
    formula_screen: FILM_SCREEN[r.source_slug] || null,
    directions_status: r.directions.directions_status, directions: r.directions.text,
    definition_lines_c1_c2: definitionLines.map(c => ({ tier: c.tier, type: c.type, text: c.raw })),
    excluded_reason: reasons.length ? null : 'No owner/film/brand-line reach, no C1/C2 definiert stem, and no optional extra application or required sequential multi-site in manual directions reading. Equipment-only tips, nozzle cleaning, single-use alternatives and required same-site repeats do not qualify.' };
});
const selected = audit.filter(x => x.included);
const priorIds = new Set();
const priorInputs = [];
for (let n = 1; n <= 6; n++) {
  const rel = 'data/research/styling-inci/v1.0/' + (n === 1 ? '' : 'r' + n + '/') + 'cohort.json';
  const old = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  for (const r of old.records) priorIds.add(r.sample_id);
  priorInputs.push(rel);
}
const ids = new Set();
const records = selected.map(a => {
  const r = clone(bySlug[a.source_slug]);
  const oldId = r.sample_id;
  r.sample_id = 'sty-' + sha256(Buffer.from(SALT + r.source_slug)).slice(0, 10);
  if (priorIds.has(r.sample_id) || ids.has(r.sample_id)) throw new Error('id collision: ' + r.sample_id);
  ids.add(r.sample_id);
  r.standard_version = STAMP;
  r.lexicon_version = 'styling-lexicon-v0.5-r6amend';
  r.history.round7 = { round6_sample_id: oldId, reason_classes: a.reasons.map(x => x.class) };
  return r;
}).sort((a, b) => cmp(a.sample_id, b.sample_id));
const packets = { s0: [], fu: [], claims: [] };
let preservedPackets = 0;
const fuGradeMasks = [];
for (const r of records) for (const kind of Object.keys(packets)) {
  const oldId = r.history.round7.round6_sample_id;
  const rel = path.join(R6_OUT, 'packets', kind, oldId + '.json');
  const frozen = JSON.parse(fs.readFileSync(rel, 'utf8'));
  const rebuilt = R6('packets.' + kind).find(p => p.id === oldId).body;
  if (JSON.stringify(frozen) !== JSON.stringify(rebuilt)) throw new Error('packet rebuild mismatch');
  const body = clone(rebuilt);
  body.sample_id = r.sample_id;
  body.packet_version = STAMP;
  if (kind === 'fu' && typeof body.directions?.text === 'string') {
    const before = body.directions.text;
    const masked = maskFuGrades(before);
    body.directions.text = masked.text;
    if (masked.text !== before) fuGradeMasks.push({
      source_slug: r.source_slug, round6_sample_id: oldId, sample_id: r.sample_id,
      field: '.directions.text', replacements: masked.count, before, after: masked.text,
    });
  }
  const restore = clone(body); restore.sample_id = oldId; restore.packet_version = frozen.packet_version;
  const identical = JSON.stringify(restore) === JSON.stringify(frozen);
  if (kind === 'fu' && restore.directions) restore.directions.text = frozen.directions.text;
  if (JSON.stringify(restore) !== JSON.stringify(frozen)) throw new Error('packet evidence changed');
  if (identical) preservedPackets++;
  packets[kind].push({ id: r.sample_id, rec: r, body });
}
if (fuGradeMasks.length !== 3 || fuGradeMasks.reduce((n, m) => n + m.replacements, 0) !== 3)
  throw new Error('expected exactly three inherited F/U grading masks: ' + JSON.stringify(fuGradeMasks));

// Scan ALL string fields. Grades are sealed in S0/FU, while raw claims deliberately
// carry those grades (R2-Q3); claims are still scanned for annotations/slugs/labels.
const patterns = R6('Object.assign({}, S0_LEAK, S0_LEAK_R6)');
const editorial = R6('EDITORIAL_RE');
const anyLabel = R6('ANY_LEAK_RE');
const claimsAnnotation = R6('CLAIMS_LEAK_RE');
const forbiddenKeys = R6('FORBIDDEN_KEYS');
const nameStrengthLeft = R6('nameStrengthLeft');
const postNounStrength = R6('postNounStrength');
const leakCheck = R6('leakCheck');
const genericNames = R6('R4_GENERIC_NAME_HITS');
const stringsScanned = { s0: 0, fu: 0, claims: 0 };
const hits = [];
const rawClaimGrades = [];
const walk = (o, fn, at = '', key = '') => {
  if (Array.isArray(o)) o.forEach((x, i) => walk(x, fn, at + '[' + i + ']', key));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
    if (forbiddenKeys.includes(k)) hits.push({ check: 'forbidden_key', at: at + '.' + k });
    walk(v, fn, at + '.' + k, k);
  } else if (typeof o === 'string') fn(o, at, key);
};
for (const kind of Object.keys(packets)) for (const p of packets[kind]) {
  const tag = kind + '/' + p.id;
  if (kind === 'fu') for (const hit of leakCheck(p.body.directions?.text, p.rec).filter(h => !genericNames.includes(h))) hits.push({ check: 'fu_brand_name', tag, hit });
  walk(p.body, (v, at, key) => {
    stringsScanned[kind]++;
    for (const r of all) if (v.toLowerCase().includes(r.source_slug)) hits.push({ check: 'slug', tag, at });
    for (const id of priorIds) if (v.includes(id)) hits.push({ check: 'prior_id', tag, at });
    if (/https?:\/\/|www\./i.test(v)) hits.push({ check: 'url', tag, at });
    if (anyLabel.test(v)) hits.push({ check: 'round_filter_label', tag, at, v });
    const structural = ['sample_id', 'packet_version', 'packet'].includes(key);
    const freezeWord = kind === 'claims' && ['text', 'words'].includes(key) && /^Freeze$/i.test(v.trim());
    if (!structural && editorial.test(v) && !freezeWord) hits.push({ check: 'editorial_label', tag, at, v });
    if (/\b(?:leave_in|heat_protectant|dry_shampoo|provisional_boundary|salt_spray|texture_spray|shine_finish|smoothing_styler|curl_cream|negative_control)\b/i.test(v)) hits.push({ check: 'route_subtype', tag, at });
    if (kind === 'claims') {
      if (/^\.claims\[/.test(at) && claimsAnnotation.test(v)) hits.push({ check: 'claims_annotation', tag, at, v });
      if (Object.values(patterns).some(re => re.test(v)) && !structural) rawClaimGrades.push({ tag, at });
      return;
    }
    if (structural) return;
    const bare = v.replace(/\[CLAIM\]/g, ' ');
    for (const [check, re] of Object.entries(patterns)) {
      if (check === 'label') continue; // already checked on every field, including metadata
      if (check === 'flexibility_word' && at === '.product.brand' && v.toLowerCase() === 'wellaflex') continue;
      if (re.test(bare)) hits.push({ check: kind + '_' + check, tag, at, v });
    }
    if (at === '.product.confirmed_name' && (nameStrengthLeft(bare) || postNounStrength(bare).hits.length)) hits.push({ check: 's0_name_strength', tag, at, v });
  });
}
// Failed leak checks still write reviewable artifacts, then exit nonzero.
// Never present a failed freeze as ready for blind-lane use.
const classes = {};
for (const a of selected) for (const r of a.reasons) classes[r.class] = (classes[r.class] || 0) + 1;
const docFiles = ['styling-classification-standard.md', '01_property-set-v0.md', '00_category_charter.md', '02_evidence_lexicon.v0.5.md'].map(f => 'docs/research/styling-inci/v1.0/' + f);
const inputPaths = [...priorInputs, 'data/research/styling-inci/v1.0/build/freeze-cohort-r6.js', 'data/research/styling-inci/v1.0/r6/artifact-manifest.json', 'plans/styling-concept/02-rulings.md', ...docFiles];
for (const r of records) for (const kind of Object.keys(packets)) inputPaths.push('data/research/styling-inci/v1.0/r6/packets/' + kind + '/' + r.history.round7.round6_sample_id + '.json');
const inputs = [...new Set(inputPaths)].sort(cmp).map(rel => ({ path: rel, sha256: sha256(fs.readFileSync(path.join(ROOT, rel))) }));
const verification = { r6_rebuild_byte_identical_files: rebuildFiles, packet_evidence_identical_except_id_version: preservedPackets,
  fu_grading_masks: fuGradeMasks,
  prior_id_overlap: 0, string_fields_scanned: stringsScanned, leak_hits: hits.length, leak_findings: hits,
  ready_for_blind_lanes: hits.length === 0,
  grade_check_policy: 'Every S0/FU string tested for hold numbers, contextual strength, compound strength stems, flexibility and finish grades. Claims raw grades are authorized evidence under R2-Q3 and must remain unchanged; every claims string still tested for forbidden annotations, round/filter/editorial labels, slugs, old ids and route labels.',
  authorized_claim_grade_fields: rawClaimGrades.length };
const cohort = { cohort_version: VERSION, frozen_on: '2026-10-13', standard_version: STAMP,
  lexicon_version: 'styling-lexicon-v0.5-r6amend', purpose: 'REFERENCE ONLY. Targeted R6-Q1/R6-T re-check, not a full round. Never supply cohort/id_map/scope-audit/FREEZE-NOTES to blind lanes.',
  counts: { total: records.length, screened: all.length, by_reason_class: classes }, verification, inputs,
  id_map: records.map(r => ({ ...source.id_map.find(x => x.source_slug === r.source_slug), sample_id: r.sample_id, round6_sample_id: r.history.round7.round6_sample_id })), records };
fs.mkdirSync(OUT, { recursive: true });
const writes = [];
const write = (rel, bytes) => { fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true }); fs.writeFileSync(path.join(OUT, rel), bytes); writes.push(rel); };
// Clean only generated packet JSON from this cohort, leaving unrelated r7 artifacts intact.
for (const kind of Object.keys(packets)) {
  const d = path.join(OUT, 'packets', kind); fs.mkdirSync(d, { recursive: true });
  for (const f of fs.readdirSync(d)) if (/^sty-[0-9a-f]{10}\.json$/.test(f)) fs.unlinkSync(path.join(d, f));
}
write('cohort.json', ser(cohort));
write('scope-audit.json', ser({ screened_records: all.length, selected_records: records.length, records: audit }));
for (const kind of Object.keys(packets)) for (const p of packets[kind]) write('packets/' + kind + '/' + p.id + '.json', ser(p.body));
const esc = s => String(s).replace(/\|/g, '/').replace(/\n/g, ' ');
const notes = `# FREEZE-NOTES — targeted Styling r7 re-check\n\nFrozen 2026-10-13. Standard/packet stamp: \`${STAMP}\`; lexicon amendment: \`styling-lexicon-v0.5-r6amend\`. Not classified, not locked. Owner authority: \`plans/styling-concept/02-rulings.md\`, final r6 rulings R6-Q1/R6-T. Both blind lanes must still independently agree on every user-facing field here before R3-L/R4-L lock readiness.\n\n## Scope tests\n\nAll **${all.length}** r6 cohort records and their packets were inspected; **${records.length}** selected. \`scope-audit.json\` records the inclusion/exclusion and captured directions for every record. Reason classes overlap.\n\n- **Q1-owner:** always include the three explicit owner products. NEQI Ultimate remains FX-1 at r8 in the frozen formula: its owner route supersedes D3/R2-Q4, not its F evidence or ingredient class.\n- **Q1-film:** aqueous (water above T_S, not propellant-led) spray/lotion; first non-solvent film former is a heat-activated smoothing coat (SI-1 Polysilicone-29/Silicone Quaternium-18 or comparable, supported by captured smoothing/heat-use evidence); no FX-1…FX-4 fixative; other care ingredients only at/after the first preservative/concentration-capped LI marker, not the perfume cutoff T_S. The leading smoothing film itself is not counted as disqualifying care. No public heat_activated value is assigned by this screen. Color Wow is included despite its C3-only promise: the evidence gate is preserved.\n- **Q1-brand-line:** independently include all names containing Frizz Ease, Glow & Shine or Nutricurls, because R6-Q1 bars brand-line words as jobs, even where other product-type words keep the output unchanged.\n- **T1/T2-directions:** main required application versus optional/conditional extra application, or required sequential multi-site use. Named Balea Volumenpuder/Redken Root Tease always included. Conservative screening also retains ambiguous repeat/dose cases and optional other-product combinations; these are reach probes, not assertions that a target zone changes. Equipment-only tips, nozzle cleaning, unconnected single-use alternatives and required same-site repeats alone do not qualify.\n- **T3-result-phrase:** case-insensitive \`definiert\` stem in **any** C1/C2 captured claim line, including C2_house_brand and typed finish/flexibility/duration/other lines. A plain result phrase needs explicit curls/waves defining/shaping support; lanes decide this, not the builder. All **${classes['T3-result-phrase']}** matches are included, not only alverde Beach Waves.\n\n## Smoothing-film candidates and exclusions\n\n| Product / source slug | Selected for film rule? | Evidence |\n|---|---|---|\n${Object.entries(FILM_SCREEN).sort(([a], [b]) => cmp(a, b)).map(([s, x]) => '| ' + esc(bySlug[s].identity.brand + ' ' + bySlug[s].identity.product_name) + ' / `' + s + '` | ' + (x.reachable ? 'yes' : 'no') + ' | ' + esc(x.evidence) + ' |').join('\n')}\n\nOther sprays/lotions have no settled heat-activated smoothing coat as their first non-solvent film former; ordinary conditioning silicones, rheology polymers, FX/FX-U hair-fixing films, salts and powders are not promoted to this new route. The all-record audit retains their exclusion evidence and directions.\n\n## Affected set (${records.length})\n\n| Product | Reason class(es) | Reason / evidence |\n|---|---|---|\n${selected.map(a => '| ' + esc(a.name) + ' | ' + a.reasons.map(r => r.class).join(', ') + ' | ' + a.reasons.map(r => esc(r.evidence)).join('; ') + ' |').join('\n')}\n\n## Freeze and verification\n\nThe unmodified \`build/freeze-cohort-r6.js\` ran in a memory-write sandbox (and reused its r1…r5 construction); **${rebuildFiles}** r6 artifacts matched frozen bytes. Only selected packets are emitted to r7: **${records.length} S0 + ${records.length} F/U + ${records.length} claims**. After restoring sample_id/packet_version, **${preservedPackets}** packets are semantically identical to r6; the other **${fuGradeMasks.length}** differ only by F/U direction grading masks. No source capture, S0 packet, directions tier or claims text changed. A general F/U directions pass reuses the S0 masking function and grading-word lists (standard §10.2 / R2-Q3): hold strengths including compound stems, flexibility words and finish grades become \`[CLAIM]\`; job nouns remain (e.g. „leichten Halt” ⇒ „[CLAIM] Halt”).\n\n### Inherited r6 F/U grading leaks — scoring-reader notice\n\nThese three phrases were already present in the frozen r6 F/U packets. Historical r6 files remain unchanged; r6 scoring readers must account for their exposure. The following r7 correction receipt is generated from the general masking pass, never hand-edited packets:\n\n| Product | r6 F/U packet id | r7 F/U packet id | Before | After |\n|---|---|---|---|---|\n${fuGradeMasks.map(m => '| ' + esc(bySlug[m.source_slug].identity.brand + ' ' + bySlug[m.source_slug].identity.product_name) + ' | `' + m.round6_sample_id + '` | `' + m.sample_id + '` | ' + esc(m.before) + ' | ' + esc(m.after) + ' |').join('\n')}\n\nNew opaque-id salt: \`${SALT}\`; SHA-256 prefix ids have **0 overlap with r1…r6**, and no internal collision. Identity mapping and selection reasons stay outside packets.\n\nAll string fields scanned: S0 **${stringsScanned.s0}**, F/U **${stringsScanned.fu}**, claims **${stringsScanned.claims}**; **${hits.length} unauthorized leak hits**. ${hits.length ? "**NOT READY FOR BLIND LANES:** F/U grading pass still leaves unauthorized leaks. Findings: " + hits.map(h => h.tag + " " + h.check + " " + h.at + ": " + h.v).join("; ") : "Zero unauthorized leaks; ready for independent blind-lane re-check."} Hold numbers/grades (including compound strength stems), flexibility and finish grades are tested in every S0/FU string. Raw claims grades are intended evidence under R2-Q3 (**${rawClaimGrades.length}** authorized grade-bearing fields), and cannot be removed while preserving r6 claims; every claims string is checked for annotations, round/filter/editorial labels, slugs, prior ids and route labels. Structural packet/id/version metadata is allowed; the captured claims word Freeze is allowed; registered brand wellaflex is identity rather than a flexibility claim. Any unauthorized leak makes the build exit nonzero after writing the reviewable artifacts; ready_for_blind_lanes is true only at zero hits.\n\nReproduce with \`node data/research/styling-inci/v1.0/build/freeze-cohort-r7.js\`. No clock/randomness; sorted ids and paths. \`artifact-manifest.json\` hashes the builder, amended docs/rulings, frozen selected input packets and every output except the manifest itself. Run twice and compare the SHA-256 of that manifest to verify determinism. Historical r1…r6 files are never written.\n`;
write('FREEZE-NOTES.md', notes);
const manifest = { manifest_version: VERSION, frozen_on: '2026-10-13', algorithm: 'sha256',
  script: { path: 'data/research/styling-inci/v1.0/build/freeze-cohort-r7.js', sha256: sha256(fs.readFileSync(__filename)) },
  inputs, counts: { cohort_records: records.length, packets_s0: records.length, packets_fu: records.length, packets_claims: records.length }, verification,
  artifacts: writes.sort(cmp).map(rel => ({ path: 'r7/' + rel, sha256: sha256(fs.readFileSync(path.join(OUT, rel))) })) };
fs.writeFileSync(path.join(OUT, 'artifact-manifest.json'), ser(manifest));
console.log(JSON.stringify({ selected: records.length, by_reason_class: classes, verification, manifest_sha256: sha256(fs.readFileSync(path.join(OUT, 'artifact-manifest.json'))) }, null, 2));

if (hits.length) throw new Error('NOT READY: packet leak hits: ' + JSON.stringify(hits, null, 2));
