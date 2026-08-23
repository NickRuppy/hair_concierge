import { writeFileSync } from "node:fs"

/**
 * Regenerates the reviewable PLACEHOLDER Hair Tools illustrations.
 *
 * These are not the approved production art set — see
 * public/images/personal-plan/tools/README.md. Run with `node
 * scripts/generate-tool-placeholder-illustrations.mjs` from the repo root.
 */

const OUT = "public/images/personal-plan/tools"
const STROKE = "#6B50A0"

// Deliberately simple, consistent line art. These are reviewable placeholders,
// NOT the approved production photo/cut-out set.
const SHAPES = {
  hair_dryer: `<path d="M22 46h44l26-14v56L66 74H22a14 14 0 0 1 0-28Z"/><path d="M46 74l-6 26h20l-6-26"/>`,
  hot_air_brush: `<rect x="26" y="20" width="26" height="52" rx="13"/><path d="M39 72v28"/><path d="M26 30h-8M26 44h-8M26 58h-8M52 30h8M52 44h8M52 58h8"/><rect x="30" y="94" width="18" height="14" rx="6"/>`,
  air_multi_styler: `<rect x="44" y="14" width="24" height="46" rx="12"/><path d="M56 60v26"/><rect x="44" y="86" width="24" height="24" rx="10"/><path d="M80 24l14-6M80 40l14 6"/>`,
  flat_iron: `<path d="M32 24h40a10 10 0 0 1 10 10v40H22V34a10 10 0 0 1 10-10Z"/><path d="M22 74h60l8 30H14l8-30Z"/>`,
  curling_iron: `<rect x="46" y="14" width="22" height="54" rx="11"/><path d="M57 68v38"/><path d="M46 26h-14a8 8 0 0 0 0 16h14"/>`,
  curling_wand: `<path d="M62 14l-14 62"/><path d="M70 14a12 12 0 0 0-16 0"/><rect x="38" y="76" width="22" height="32" rx="10"/>`,
  wave_iron: `<path d="M28 40q14-16 28 0t28 0"/><path d="M28 64q14-16 28 0t28 0"/><path d="M40 88h32v20H40z"/>`,
  automatic_curler: `<rect x="34" y="16" width="52" height="40" rx="14"/><path d="M60 56v18"/><rect x="42" y="74" width="36" height="34" rx="12"/><path d="M52 30a10 10 0 0 1 16 0"/>`,
  heated_rollers: `<circle cx="40" cy="42" r="18"/><circle cx="80" cy="42" r="14"/><circle cx="58" cy="82" r="16"/>`,
  heated_brush: `<rect x="34" y="18" width="34" height="44" rx="10"/><path d="M34 28h-10M34 40h-10M34 52h-10M68 28h10M68 40h10M68 52h10"/><path d="M51 62v42"/>`,
  heated_multi_styler: `<rect x="40" y="12" width="30" height="50" rx="14"/><path d="M55 62v20"/><rect x="30" y="82" width="50" height="26" rx="10"/><path d="M84 30h14M84 48h14"/>`,
  heatless_curling_band: `<path d="M24 96c0-40 24-72 48-72"/><circle cx="24" cy="96" r="10"/><circle cx="86" cy="24" r="10"/>`,
  setting_roller: `<rect x="20" y="42" width="80" height="36" rx="18"/><path d="M36 42v36M52 42v36M68 42v36M84 42v36"/>`,
  foam_roller: `<rect x="24" y="40" width="72" height="40" rx="20"/><path d="M44 40v40M76 40v40"/>`,
  flexi_rod: `<path d="M28 96q16-28 0-56"/><path d="M60 96q16-28 0-56"/><path d="M92 96q16-28 0-56"/>`,
  setting_former: `<path d="M30 30h60v18a30 30 0 0 1-60 0Z"/><path d="M60 66v34"/>`,
  wide_tooth_comb: `<rect x="20" y="26" width="80" height="16" rx="6"/><path d="M28 42v44M44 42v44M60 42v44M76 42v44M92 42v44"/>`,
  detangling_brush: `<rect x="30" y="16" width="60" height="52" rx="24"/><path d="M42 30v10M60 26v14M78 30v10M42 52v8M60 50v10M78 52v8"/><path d="M60 68v40"/>`,
  paddle_brush: `<rect x="26" y="14" width="68" height="60" rx="16"/><path d="M42 30v8M60 30v8M78 30v8M42 50v8M60 50v8M78 50v8"/><rect x="50" y="74" width="20" height="34" rx="8"/>`,
  vent_brush: `<rect x="30" y="16" width="60" height="54" rx="14"/><path d="M44 28v30M60 24v34M76 28v30"/><rect x="52" y="70" width="16" height="38" rx="7"/>`,
  round_brush: `<circle cx="50" cy="46" r="26"/><path d="M50 20v-8M76 46h8M50 72v8M24 46h-8M68 28l6-6M68 64l6 6M32 28l-6-6M32 64l-6 6"/><path d="M70 66l24 34"/>`,
  styling_brush: `<path d="M34 18h52v40a26 26 0 0 1-52 0Z"/><path d="M48 30v14M60 28v16M72 30v14"/><path d="M60 84v24"/>`,
  hair_pick: `<rect x="26" y="20" width="68" height="12" rx="5"/><path d="M34 32v40M50 32v46M66 32v46M82 32v40"/><rect x="50" y="86" width="20" height="22" rx="8"/>`,
  sectioning_comb: `<rect x="20" y="30" width="52" height="14" rx="5"/><path d="M26 44v26M38 44v26M50 44v26M62 44v26"/><path d="M72 37h30"/>`,
  soft_hair_tie: `<circle cx="60" cy="60" r="34"/><circle cx="60" cy="60" r="18"/>`,
  scrunchie: `<path d="M26 60q10-18 34-18t34 18-34 18-34-18Z"/><path d="M40 48q6 12 0 24M60 42v36M80 48q-6 12 0 24"/>`,
  claw_clip: `<path d="M28 34h64v28a20 20 0 0 1-20 20H48a20 20 0 0 1-20-20Z"/><path d="M36 34l8-14M84 34l-8-14M48 62h24"/>`,
  sectioning_clip: `<path d="M24 40h72"/><path d="M24 40l14 56M96 40L82 96"/><circle cx="60" cy="40" r="8"/>`,
  root_volume_clip: `<path d="M26 46q34-24 68 0"/><path d="M26 46v34M94 46v34"/><path d="M40 62h40"/>`,
  hair_pin: `<path d="M40 20v70a20 20 0 0 0 40 0V20"/><path d="M56 20v70"/>`,
  headband: `<path d="M20 76a40 40 0 0 1 80 0"/><path d="M20 76v10M100 76v10"/>`,
  scalp_brush: `<path d="M28 40h64v22a32 32 0 0 1-64 0Z"/><path d="M40 84v6M56 90v6M72 84v6M48 88v6M64 88v6"/><rect x="50" y="18" width="20" height="22" rx="8"/>`,
  applicator_bottle: `<path d="M46 34h28v56a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12Z"/><path d="M52 34V20h16v14"/><path d="M60 20l4-12"/>`,
  applicator_comb: `<path d="M44 20h32v40H44z"/><path d="M50 60v34M60 60v34M70 60v34"/><path d="M52 20V8h16v12"/>`,
  water_spray_bottle: `<path d="M42 44h34v54a10 10 0 0 1-10 10H52a10 10 0 0 1-10-10Z"/><path d="M50 44V26h18v18"/><path d="M50 30H32l-6-8"/>`,
  pillowcase: `<rect x="18" y="34" width="84" height="52" rx="14"/><path d="M32 34c14 18 42 18 56 0"/><path d="M18 60h6M96 60h6"/>`,
  bonnet: `<path d="M22 66a38 38 0 0 1 76 0Z"/><rect x="18" y="66" width="84" height="18" rx="9"/><path d="M34 48q26-14 52 0"/>`,
  length_tip_sleeve: `<path d="M46 18h28l-6 76a8 8 0 0 1-16 0Z"/><path d="M44 44h32M46 68h28"/>`,
  soft_night_tie: `<ellipse cx="60" cy="60" rx="36" ry="24"/><ellipse cx="60" cy="60" rx="16" ry="10"/>`,
  microfiber_towel: `<path d="M26 20h68v66a14 14 0 0 1-14 14H40a14 14 0 0 1-14-14Z"/><path d="M26 74h68"/><path d="M40 36h40M40 52h40"/>`,
  smooth_cotton_cloth: `<path d="M32 26h56l12 18-18 8v46H38V52l-18-8Z"/>`,
  drying_wrap: `<path d="M24 76a36 36 0 0 1 72 0Z"/><path d="M96 76l10 26-24-14"/><path d="M40 60q20-14 40 0"/>`,
}

const FAMILY_SHAPES = {
  airflow: SHAPES.hair_dryer,
  heated_styling: SHAPES.flat_iron,
  heatless_styling: SHAPES.setting_roller,
  brushes_combs: SHAPES.detangling_brush,
  securing_sectioning: SHAPES.claw_clip,
  wash_application: SHAPES.scalp_brush,
  night_protection: SHAPES.bonnet,
  drying_textiles: SHAPES.microfiber_towel,
}

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke="${STROKE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" role="presentation"><g>${inner}</g></svg>\n`
}

let count = 0
for (const [name, inner] of Object.entries(SHAPES)) {
  writeFileSync(`${OUT}/${name}.svg`, svg(inner))
  count += 1
}
for (const [family, inner] of Object.entries(FAMILY_SHAPES)) {
  writeFileSync(`${OUT}/family-${family}.svg`, svg(inner))
  count += 1
}
console.log("wrote", count, "placeholder tool illustrations")
