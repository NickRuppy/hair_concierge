import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  type AsciiGermanOrthographyMatch,
  findAsciiGermanOrthography,
} from "../src/lib/german-orthography/ascii-transliterations"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function collectGuidanceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(ROOT, relativeDir)
  const files: string[] = []

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectGuidanceFiles(relativePath))
      continue
    }

    if (entry.isFile() && /\.(?:json|md)$/.test(entry.name)) {
      files.push(relativePath)
    }
  }

  return files.sort()
}

const MODEL_FACING_SOURCE_FILES = [
  // Current production AgentV2/CareBalance prompt, context, projection, recommendation, routine,
  // and tiny visible auth UI surfaces. Legacy tool-loop/classic, labs, and admin paths are
  // intentionally excluded by the implementation plan.
  "src/lib/agent-v2/runtime/prompt.ts",
  "src/lib/agent-v2/runtime/product-tool-context.ts",
  "src/lib/agent-v2/runtime/responses-agent.ts",
  "src/lib/agent-v2/tools/routine-projection.ts",
  "src/lib/agent-v2/tools/select-products-projection.ts",
  "src/lib/agent-v2/tools/tool-definitions.ts",
  "src/lib/agent/tools/build-or-fix-routine.ts",
  "src/lib/agent/tools/care-balance-context.ts",
  "src/lib/agent/tools/get-user-context.ts",
  "src/lib/agent/tools/select-products.ts",
  "src/lib/bondbuilder/usage-protocols.ts",
  "src/lib/leave-in/constants.ts",
  "src/lib/oil/constants.ts",
  "src/lib/product-specs/constants.ts",
  "src/lib/chat-runtime/prompts.ts",
  "src/lib/recommendation-engine/chat.ts",
  "src/lib/recommendation-engine/selection.ts",
  "src/lib/routines/brush-tools.ts",
  "src/lib/routines/planner.ts",
  "src/app/auth/page.tsx",
  "src/components/auth/auth-form.tsx",
  ...collectGuidanceFiles("data/agent-v2/guidance"),
]

interface AllowlistEntry {
  file: string
  id: string
  match: RegExp
  pattern: RegExp
  reason: string
}

const ALLOWLIST: AllowlistEntry[] = [
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "erklaeren",
    match: /^erklaer/i,
    pattern: /\\b\(\?:verstehen\|wissen\|erklaer\|erklär\|einordnen\)\\w\*\\b/,
    reason: "routine non-mutation detector intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "aendern",
    match: /^aender/i,
    pattern: /\\b\(\?:aendern\|ändern\|umstellen\|umbauen\|anpassen\)\\w\*\\b/,
    reason: "routine non-mutation detector intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "ueber",
    match: /^ueberblick$/i,
    pattern: /\\b\(zusammenfass\\w\*\|zusammenfassung\|recap\|rekap\|ueberblick\|überblick\)\\b/,
    reason: "routine summary follow-up detector intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "oel",
    match: /^oel$/i,
    pattern: /\(\?:haar\)\?\(\?:oel\|oil\|öl\)/,
    reason: "mask/oil detector intentionally accepts user-transliterated oil terms",
  },
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "weiss",
    match: /^weiss(?:t)?$/i,
    pattern: /kennst\|weisst\|weiss\|siehst/,
    reason:
      "current-routine identity detector intentionally accepts normalized user-transliterated input",
  },
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "haeufig",
    match: /^haeufig$/i,
    pattern: /wie oft\|haeufig\|haufig\|anwenden/,
    reason:
      "current-routine identity detector intentionally accepts normalized user-transliterated input",
  },
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "hinzufuegen",
    match: /^hinzufuegen$/i,
    pattern: /einbauen\|hinzufuegen\|hinzufügen/,
    reason:
      "current-routine identity detector intentionally accepts normalized user-transliterated input",
  },
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "spuelung",
    match: /^spuelung$/i,
    pattern: /conditioner.*spuelung|spuelung.*maske|\["conditioner", "spulung", "spuelung"\]/,
    reason:
      "current-routine identity detector intentionally accepts normalized user-transliterated category input",
  },
  {
    file: "src/lib/agent-v2/runtime/responses-agent.ts",
    id: "oel",
    match: /^(?:oel|haaroel)$/i,
    pattern: /oel\|ol|oil: \["ol", "oel", "haarol", "haaroel", "oil"\]/,
    reason:
      "current-routine identity detector intentionally accepts normalized user-transliterated oil input",
  },
  {
    file: "src/lib/agent/tools/select-products.ts",
    id: "oel",
    match: /^oel$/i,
    pattern: /\\bkokos\(\?:frei\|oel\|ol\|nuss\)\?\\b/,
    reason: "ingredient preference detector intentionally accepts coconut-oil transliteration",
  },
  {
    file: "src/lib/agent/tools/select-products.ts",
    id: "oel",
    match: /^oel(?:frei|e)?$/i,
    pattern: /\\boel\(\?:frei\|e\)\?\\b/,
    reason: "ingredient preference detector intentionally accepts oil-free transliteration",
  },
  {
    file: "src/lib/agent/tools/select-products.ts",
    id: "oel",
    match: /^oelfrei$/i,
    pattern: /add\("oil_free", "oelfrei"\)/,
    reason: "normalized internal ingredient evidence token remains ASCII-compatible",
  },
  {
    file: "src/lib/oil/constants.ts",
    id: "oel",
    match: /^(?:oel|natuerliches-oel|styling-oel|trocken-oel)$/i,
    pattern: /"natuerliches-oel"|"styling-oel"|"trocken-oel"/,
    reason: "oil subtype slugs are stable internal keys while labels use standard German",
  },
  {
    file: "src/lib/oil/constants.ts",
    id: "natuerlich",
    match: /^natuerliches(?:-oel)?$/i,
    pattern: /"natuerliches-oel"/,
    reason: "oil subtype slug is a stable internal key while its label uses standard German",
  },
  {
    file: "src/lib/oil/constants.ts",
    id: "oel",
    match: /^(?:natuerliches-oel|styling-oel|trocken-oel)$/i,
    pattern: /case "natuerliches-oel":|case "styling-oel":|case "trocken-oel":/,
    reason: "oil subtype slugs are stable internal keys while labels use standard German",
  },
  {
    file: "src/lib/oil/constants.ts",
    id: "oel",
    match: /^oele$/i,
    pattern: /normalized === "öle" \|\| normalized === "oele"/,
    reason: "oil category compatibility accepts legacy/user-transliterated category input",
  },
  {
    file: "src/lib/recommendation-engine/selection.ts",
    id: "oel",
    match: /^trocken-oel$/i,
    pattern:
      /selectedPurpose !== "trocken-oel"|candidate\.subtype === "trocken-oel"|oil_subtype === "trocken-oel"/,
    reason: "oil subtype slug is a stable internal key while display labels use standard German",
  },
  {
    file: "src/lib/recommendation-engine/selection.ts",
    id: "oel",
    match: /^(?:natuerliches-oel|styling-oel|trocken-oel)$/i,
    pattern: /case "natuerliches-oel":|case "styling-oel":|case "trocken-oel":/,
    reason: "oil subtype slug is a stable internal key while display labels use standard German",
  },
  {
    file: "src/lib/recommendation-engine/chat.ts",
    id: "oel",
    match: /^(?:natuerliches-oel|styling-oel|trocken-oel)$/i,
    pattern: /"natuerliches-oel"|"styling-oel"|"trocken-oel"/,
    reason:
      "oil subtype slugs are stable internal keys while user-facing labels use standard German",
  },
  {
    file: "src/lib/routines/planner.ts",
    id: "rueck",
    match: /^rueckstand$/i,
    pattern: /"rueckstand"/,
    reason: "normalized routine trigger term intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/routines/planner.ts",
    id: "ueber",
    match: /^ueber(?:pflegt|lagert)$/i,
    pattern: /"ueberpflegt"|"ueberlagert"/,
    reason: "normalized routine trigger term intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/routines/planner.ts",
    id: "oel",
    match: /^oel$/i,
    pattern: /"oel vor dem waschen"|OWC_TERMS = \[.*"oel waschen conditioner"/,
    reason: "normalized routine trigger term intentionally accepts user-transliterated oil input",
  },
  {
    file: "src/lib/routines/planner.ts",
    id: "naechst",
    match: /^naechster$/i,
    pattern: /"naechster tag"/,
    reason: "normalized routine trigger term intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/routines/planner.ts",
    id: "ansaetze",
    match: /^ansaetze$/i,
    pattern: /"ansaetze"/,
    reason: "normalized routine trigger term intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/routines/planner.ts",
    id: "spuelung",
    match: /^spuelung$/i,
    pattern: /"nur spuelung"/,
    reason: "normalized routine trigger term intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/routines/brush-tools.ts",
    id: "buersten",
    match: /^(?:buerste|kopfhautbuerste|rundburste|foehnburste)$/i,
    pattern: /"buerste"|"kopfhautbuerste"|"rundburste"|"foehnburste"/,
    reason: "normalized brush/tool trigger term intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/routines/brush-tools.ts",
    id: "foehnen",
    match: /^foehnburste$/i,
    pattern: /"foehnburste"/,
    reason: "normalized brush/tool trigger term intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/routines/brush-tools.ts",
    id: "oel",
    match: /^(?:haaroel|kopfhautoel)$/i,
    pattern: /"haaroel"|"kopfhautoel"/,
    reason:
      "normalized scalp-tool trigger term intentionally accepts user-transliterated oil input",
  },
  {
    file: "src/lib/agent/tools/build-or-fix-routine.ts",
    id: "naechst",
    match: /^naechst/i,
    pattern:
      /\\b\(\?:erste\[rsn\]\?\|ersten\|naechste\[rsn\]\?\|naechsten\|erster\|naechster\)\\s\+/,
    reason: "normalized routine follow-up detector intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/agent/tools/build-or-fix-routine.ts",
    id: "ergaenzen",
    match: /^ergaenz/i,
    pattern:
      /\\b\(\?:erste\[rsn\]\?\|ersten\|naechste\[rsn\]\?\|naechsten\|erster\|naechster\)\\s\+\(\?:zusatz\|extra\|hebel\|produkt\|ergaenzung\)\\b/,
    reason: "normalized routine follow-up detector intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/agent/tools/build-or-fix-routine.ts",
    id: "ergaenzen",
    match: /^ergaenz/i,
    pattern:
      /\\bwelches\\s\+produkt\\b\.\{0,80\}\\b\(\?:als\\s\+erstes\|zuerst\|ergaenzen\|hinzufuegen\)\\b/,
    reason: "normalized routine follow-up detector intentionally accepts user-transliterated input",
  },
  {
    file: "src/lib/agent/tools/build-or-fix-routine.ts",
    id: "hinzufuegen",
    match: /^hinzufueg/i,
    pattern:
      /\\bwelches\\s\+produkt\\b\.\{0,80\}\\b\(\?:als\\s\+erstes\|zuerst\|ergaenzen\|hinzufuegen\)\\b/,
    reason: "normalized routine follow-up detector intentionally accepts user-transliterated input",
  },
]

function patternCoversMatch(
  pattern: RegExp,
  line: string,
  match: AsciiGermanOrthographyMatch,
): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
  const globalPattern = new RegExp(pattern.source, flags)
  const matchStart = match.index
  const matchEnd = match.index + match.match.length

  let allowed: RegExpExecArray | null
  while ((allowed = globalPattern.exec(line)) !== null) {
    const allowedStart = allowed.index
    const allowedEnd = allowed.index + allowed[0].length
    if (allowedStart <= matchStart && allowedEnd >= matchEnd) return true
  }

  return false
}

function isAllowed(file: string, match: AsciiGermanOrthographyMatch, line: string): boolean {
  return ALLOWLIST.some(
    (entry) =>
      entry.file === file &&
      entry.id === match.id &&
      entry.match.test(match.match) &&
      patternCoversMatch(entry.pattern, line, match),
  )
}

test("AgentV2 production model-facing sources use standard German orthography", () => {
  const failures: string[] = []

  for (const file of MODEL_FACING_SOURCE_FILES) {
    const absolutePath = path.join(ROOT, file)
    const lines = readFileSync(absolutePath, "utf8").split("\n")

    lines.forEach((line, index) => {
      for (const match of findAsciiGermanOrthography(line)) {
        if (isAllowed(file, match, line)) continue

        failures.push(`${file}:${index + 1} matches '${match.id}' (${match.match}): ${line.trim()}`)
      }
    })
  }

  assert.deepEqual(failures, [])
})

test("ASCII German orthography detector catches curated domain compounds", () => {
  assert.deepEqual(
    findAsciiGermanOrthography(
      "Pflegeintensitaet, Reinigungsintensitaet und Kopfhautsensitivitaet.",
    ).map((match) => [match.id, match.match]),
    [
      ["intensitaet", "Pflegeintensitaet"],
      ["intensitaet", "Reinigungsintensitaet"],
      ["sensitivitaet", "Kopfhautsensitivitaet"],
    ],
  )
})

test("ASCII German orthography detector ignores ordinary ue letter pairs", () => {
  assert.deepEqual(findAsciiGermanOrthography("Heute ist eine neue, teure Pflege nicht nötig."), [])
})
