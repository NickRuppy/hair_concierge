/**
 * Phase 1: Automated Bulk Transcript Cleanup
 *
 * - Strips all inline timestamps ([H:MM:SS], [M:SS], [0:00])
 * - Applies correction dictionary for common transcription errors
 * - Removes very short speaker interjections (< 15 chars of actual text)
 * - Normalizes whitespace (collapse blank lines, trim trailing spaces)
 * - Writes output to data/markdown-cleaned/ (preserves originals)
 *
 * Usage: npx tsx scripts/clean-transcripts.ts [--dry-run] [--stats] [--file <path>] [--only-failed]
 *
 * Options:
 *   --file <path>   Process a single file (relative to data/markdown/)
 *   --only-failed   Re-process only the known-broken files (all live calls + 4 course transcripts)
 */

import fs from "fs"
import path from "path"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const INPUT_BASE = path.join(ROOT, "data", "markdown")
const INPUT_DIRS = [
  path.join(INPUT_BASE, "course-transcripts"),
  path.join(INPUT_BASE, "live-calls"),
]
const OUTPUT_BASE = path.join(ROOT, "data", "markdown-cleaned")

// The 4 course transcripts with known Phase 2 quality issues
const FAILED_COURSE_FILES = [
  "course-transcripts/styling-basics/01-haarstyling-basics.md",
  "course-transcripts/basics-2/03-haarfarben-guide-toenung-direktzieher-permanente-farbe.md",
  "course-transcripts/advanced/02-bond-builder.md",
  "course-transcripts/advanced/01-hair-oiling.md",
]

// ---------------------------------------------------------------------------
// Correction Dictionary
// ---------------------------------------------------------------------------
// Format: [pattern (string or regex), replacement]
// Ordered: longer/more specific patterns first to avoid partial matches

const CORRECTIONS: [string | RegExp, string][] = [
  // === Hair structure & anatomy ===
  // Haar- compound words (use regex for case-insensitive + variants)
  [/\bHarbpflege\b/g, "Haarpflege"],
  [/\bHarbflege\b/g, "Haarpflege"],
  [/\bHarpflege\b/g, "Haarpflege"],
  [/\bhaubpflege\b/gi, "Haarpflege"],
  [/\bHarppflege\b/g, "Haarpflege"],
  [/\bHarbruch\b/g, "Haarbruch"],
  [/\bHarshaft\b/g, "Haarschaft"],
  [/\bHarstruktur\b/g, "Haarstruktur"],
  [/\bHaarschruktur\b/g, "Haarstruktur"],
  [/\bHaarstruktör\b/g, "Haarstruktur"],
  [/\bHarstil\b/g, "Haarstil"],
  [/\bHarewaschen\b/g, "Haarewaschen"],
  [/\bHaarewaschen\b/g, "Haarewaschen"],
  [/\bHarotine\b/g, "Haarroutine"],
  [/\bHarroutine\b/g, "Haarroutine"],
  [/\bHarmenge\b/g, "Haarmenge"],
  [/\bHarmpakken\b/g, "Haar packe"],
  [/\bHarmen\b/g, "Haaren"],
  [/\bHaarfolikl\b/g, "Haarfollikel"],
  [/\bKopfholt\b/g, "Kopfhaut"],
  [/\bKoffer hat\b/g, "Kopfhaut"],
  // NOTE: "Koffer" alone and "Kupfer" removed - too many false positives (suitcase, copper hair color)
  // NOTE: "Harm" alone removed - too many false positives; AI Phase 2 handles context-dependent corrections

  // === Chemical terms ===
  [/\bDiesel-Feedbrücken\b/g, "Disulfidbrücken"],
  [/\bDieselfiedbrücken\b/g, "Disulfidbrücken"],
  [/\bDiesel Feedbrücken\b/g, "Disulfidbrücken"],
  [/\bHörleronsäucher\b/g, "Hyaluronsäure"],
  [/\bHyaloronsäure\b/g, "Hyaluronsäure"],
  [/\bGlitzerin\b/g, "Glycerin"],
  [/\bGlutzerin\b/g, "Glycerin"],
  [/\bWeglitzerin\b/g, "Glycerin"],
  // NOTE: "Glitter" removed - actual word (not always a Glycerin misspelling)
  [/\bKaratien\b/g, "Keratin"],
  [/\bKaratienstränge\b/g, "Keratinstränge"],
  [/\bKaratienmenge\b/g, "Keratinmenge"],
  [/\bKartsinn\b/g, "Keratin"],
  [/\bKaratinens\b/g, "Keratin ins"],
  [/\bKeratinens\b/g, "Keratin ins"],
  [/\bDimetikon\b/g, "Dimethicon"],
  [/\bDimithikon\b/g, "Dimethicon"],
  [/\bAmmodymethikon\b/gi, "Amodimethicon"],
  [/\bAmodimethikon\b/gi, "Amodimethicon"],
  [/\bZinamid\b/g, "Niacinamid"],
  [/\bHefepils\b/g, "Hefepilz"],
  [/\bHilfepillz\b/g, "Hefepilz"],
  [/\bHilfepilz\b/g, "Hefepilz"],
  [/\bMalasetia\b/g, "Malassezia"],
  [/\bMalasitia\b/g, "Malassezia"],
  [/\bMalasitia Globosa\b/g, "Malassezia Globosa"],
  [/\bPirokton-Ulamin\b/g, "Piroctonolamin"],
  [/\bPyrocton oder Lamin\b/g, "Piroctonolamin"],
  [/\bPyroctonolamin\b/g, "Piroctonolamin"],
  [/\bPyrocton oder Amin\b/g, "Piroctonolamin"],
  [/\bSeleniumsulfit\b/g, "Seleniumsulfid"],
  [/\bSeleniumsulfid\b/g, "Seleniumsulfid"],
  [/\bKetokocanol\b/g, "Ketoconazol"],
  [/\bKetozolin\b/g, "Ketoconazol"],
  [/\bKitokocanol\b/g, "Ketoconazol"],
  [/\bDastallizösäure\b/g, "Salicylsäure"],
  [/\bVikulsäure\b/g, "Glykolsäure"],
  [/\bTensit\b/g, "Tensid"],
  [/\bAntensiden\b/g, "Tensiden"],
  [/\bKopolimäre\b/g, "Copolymere"],
  [/\bCopolimäre\b/g, "Copolymere"],
  [/\bPeptiz-Kettens\b/g, "Peptidketten"],
  [/\bPeptidketten\b/g, "Peptidketten"],
  [/\bAuerstoff\b/g, "Sauerstoff"],
  [/\bZitronensäure\b/g, "Zitronensäure"], // correct - anchor

  // === Skin barrier ===
  [/\bHautbayere\b/g, "Hautbarriere"],
  [/\bHautbayerin\b/g, "Hautbarriere"],
  [/\bHautbayern\b/g, "Hautbarriere"],
  [/\bHaut Bayerin\b/g, "Hautbarriere"],
  [/\bHaut bei jahre\b/g, "Hautbarriere"],
  [/\bHaut Bayere\b/g, "Hautbarriere"],
  [/\bKopfhautbarriere\b/g, "Kopfhautbarriere"],

  // === Product names ===
  [/\bSchampo\b/g, "Shampoo"],
  [/\bSchampu\b/g, "Shampoo"],
  [/\bSchampf\b/g, "Shampoo"],
  [/\bSchampfer\b/g, "Shampoo"],
  [/\bSchampo's\b/g, "Shampoos"],
  [/\bSchampfowaschen\b/g, "Shampoowaschen"],
  [/\bSchampos\b/g, "Shampoos"],
  [/\bSchampus\b/g, "Shampoos"],
  [/\bSchampoo\b/g, "Shampoo"],
  [/\bTherapieschampo\b/g, "Therapie-Shampoo"],
  [/\bTherapie-Shampus\b/g, "Therapie-Shampoos"],
  [/\bTherapie Eigenschaft\b/g, "Therapie-Eigenschaft"],
  [/\bPflegeschampus\b/g, "Pflegeshampoos"],
  [/\bSchuppenschampo\b/g, "Schuppenshampoo"],
  [/\bSchuppenshampoo\b/g, "Schuppenshampoo"],
  [/\bSchuppenschampe\b/g, "Schuppenshampoos"],
  [/\bSensitivschampo\b/g, "Sensitiv-Shampoo"],
  [/\bTiefenreinigungs-Shampoo\b/g, "Tiefenreinigungsshampoo"],
  [/\bTiefenreinigungsschampo\b/g, "Tiefenreinigungsshampoo"],
  [/\bTiefenreinigungs-Schampo\b/g, "Tiefenreinigungsshampoo"],
  [/\bSchampo alleine\b/g, "Shampoo alleine"],
  [/\bT-Baume Öl\b/g, "Teebaumöl"],
  [/\bT-Barmöl\b/g, "Teebaumöl"],
  [/\bThebaum Öl\b/g, "Teebaumöl"],
  [/\bT-Baum Öl\b/g, "Teebaumöl"],
  [/\bTeebaumoel\b/g, "Teebaumöl"],
  [/\bRiziosöl\b/g, "Rizinusöl"],
  [/\bJuliobauöl\b/g, "Jojobaöl"],
  [/\bJojo Bar\b/g, "Jojobaöl"],
  [/\bJojobar\b/g, "Jojobaöl"],
  [/\bAganöl\b/g, "Arganöl"],
  [/\bArgan Oil\b/g, "Arganöl"],
  [/\bOklaplex\b/g, "Olaplex"],
  [/\bUllaplex\b/g, "Olaplex"],
  [/\bHolerplex\b/g, "Olaplex"],
  [/\bOlaflex\b/g, "Olaplex"],
  [/\bOlaplexnutzung\b/g, "Olaplex-Nutzung"],
  [/\bK8C\b/g, "K18"],
  [/\bK-18\b/g, "K18"],
  [/\bE-Press\b/g, "Epres"],
  [/\bHeld Holders\b/g, "Head & Shoulders"],
  [/\bHelden Show\b/g, "Head & Shoulders"],
  [/\bHeiden Scholas\b/g, "Head & Shoulders"],
  [/\bHead-In-Schotos\b/g, "Head & Shoulders"],
  [/\bhead and Show\b/g, "Head & Shoulders"],
  [/\bHead in Show\b/g, "Head & Shoulders"],
  [/\bHeld and Show\b/g, "Head & Shoulders"],
  [/\bHeiden Show\b/g, "Head & Shoulders"],
  [/\bHead-in-Shoulders\b/g, "Head & Shoulders"],
  [/\bden Schotos\b/g, "Head & Shoulders"],
  [/\bElvitall\b/g, "Elvital"],
  [/\bPanthein\b/g, "Pantene"],
  [/\bPanthen\b/g, "Pantene"],
  [/\bPantheon\b/g, "Pantene"],
  [/\bBuchlemen\b/g, "Bouclème"],
  [/\bOgx\b/g, "OGX"],
  [/\bIsana\b/g, "Isana"],
  [/\bCanto\b/g, "Cantu"],
  [/\bSharebutter\b/g, "Sheabutter"],
  [/\bBallajage\b/g, "Balayage"],
  [/\bBalajage\b/g, "Balayage"],
  [/\bTrimet Ikone\b/g, "Trimethicon"],

  // === Leave-in variants ===
  [/\bLieven\b/g, "Leave-in"],
  [/\bLievin\b/g, "Leave-in"],
  [/\bLiefin\b/g, "Leave-in"],
  [/\bLieflen\b/g, "Leave-in"],
  [/\bLiefins\b/g, "Leave-ins"],
  [/\bLiefinliste\b/g, "Leave-in-Liste"],
  [/\bLievens\b/g, "Leave-ins"],
  [/\bLieblins\b/g, "Leave-ins"],
  [/\bLief in\b/g, "Leave-in"],
  [/\bLove in\b/gi, "Leave-in"],
  [/\bLive-in\b/g, "Leave-in"],
  [/\bLive in\b/g, "Leave-in"],
  [/\bLiven\b/g, "Leave-in"],
  [/\bLivens\b/g, "Leave-ins"],

  // === Technique/method terms ===
  [/\bBond-Bilding\b/g, "Bond-Building"],
  [/\bBond-Bilder\b/g, "Bond-Builder"],
  [/\bBond Bilder\b/g, "Bond-Builder"],
  [/\bBont\b/g, "Bond"],
  [/\bBond-Building-Perserie\b/g, "Bond-Building per se"],
  [/\bBond-Building-Technologien\b/g, "Bond-Building-Technologien"],
  [/\bRestruktureung\b/g, "Restrukturierung"],
  [/\bGlockentraining\b/g, "Lockentraining"],
  [/\bLockenRefresh\b/g, "Locken-Refresh"],
  [/\bHandtuchung\b/g, "Handtuch trockenen"],
  [/\bHandtuchtocken\b/g, "handtuchtrocken"],
  [/\bHandtuch trocken\b/g, "handtuchtrocken"],
  [/\bTiefenreiningungsserum\b/g, "Tiefenreinigungsserum"],
  [/\bTiefenreinigungsserum\b/g, "Tiefenreinigungsserum"],
  [/\bTiefengereinigt\b/g, "tiefengereinigt"],
  [/\bTiefen gereinigt\b/g, "tiefengereinigt"],
  [/\bPerformenseitige\b/g, "performanceseitige"],
  [/\bDarreichungsformen\b/g, "Darreichungsformen"],
  [/\bKondition und\b/g, "Conditioner und"],
  [/\bKonditioner\b/g, "Conditioner"],
  [/\bKonditionen\b/g, "Conditioner"],
  [/\bKündisch\b/g, "Conditioner"],
  [/\bKondition\b/g, "Conditioner"],
  [/\bKondition drauf\b/g, "Conditioner drauf"],
  [/\bKondition drüber\b/g, "Conditioner drüber"],
  [/\bKonditionen ersetzen\b/g, "Conditioner ersetzen"],
  [/\bAusspülkonditioner\b/g, "Ausspül-Conditioner"],

  // === Common spoken-text transcription errors ===
  [/\brotieren\b/g, "Routinen"],
  [/\brotinen\b/g, "Routinen"],
  [/\bRutine\b/g, "Routine"],
  [/\bPflegeothin\b/g, "Pflegeroutine"],
  [/\bTextvor\b/g, "Textur"],
  [/\bTextoterhare\b/g, "Textur der Haare"],
  [/\bAntifrisifekt\b/g, "Anti-Frizz-Effekt"],
  [/\bPlazeroeffekt\b/g, "Placeboeffekt"],
  [/\bMikrobium\b/g, "Mikrobiom"],
  [/\bSären\b/g, "Seren"],
  [/\bSärepeeling\b/g, "Säurepeeling"],
  [/\bScrups\b/g, "Scrubs"],
  [/\bPeelingserien\b/g, "Peelingseren"],
  [/\bPeelingserum\b/g, "Peelingserum"],
  [/\bNautogorie\b/g, "Naturkosmetik"],
  [/\bHavax-Tum\b/g, "Haarwachstum"],
  [/\bSensitive-Koffer\b/g, "sensitive Kopfhaut"],
  [/\bDrosmarin\b/g, "Rosmarin"],
  [/\bKoffe ihn\b/g, "Koffein"],
]

// ---------------------------------------------------------------------------
// Timestamp stripping
// ---------------------------------------------------------------------------

/**
 * Remove all inline timestamps like [0:00], [1:32], [00:00], [1:02:33]
 */
function stripTimestamps(text: string): string {
  // Replace timestamps, preserving newlines before them but consuming horizontal whitespace
  // First pass: handle timestamps at the start of a line (after newline)
  let result = text.replace(/\n[ \t]*\[\d{1,2}:\d{2}(?::\d{2})?\][ \t]*/g, "\n")
  // Second pass: handle timestamps inline (mid-line)
  result = result.replace(/[ \t]*\[\d{1,2}:\d{2}(?::\d{2})?\][ \t]*/g, " ")
  return result
}

// ---------------------------------------------------------------------------
// Short interjection removal
// ---------------------------------------------------------------------------

/**
 * Remove very short speaker interjections in live calls.
 * Lines like: **Silvia:** Ich.  or  **Julia Pursche:** Die ein.
 * These are < 15 chars of actual spoken content.
 */
function removeShortInterjections(text: string): string {
  // Match speaker-labeled lines where the spoken part is very short
  return text.replace(
    /\*\*[^*]+:\*\*\s*.{1,12}[.!?]?\s*(?=\n|\*\*|$)/g,
    (match) => {
      // Only remove if the spoken content (after **Name:**) is truly trivial
      const spoken = match.replace(/\*\*[^*]+:\*\*\s*/, "").trim()
      if (spoken.length <= 15) return ""
      return match
    }
  )
}

// ---------------------------------------------------------------------------
// Apply correction dictionary
// ---------------------------------------------------------------------------

function applyCorrections(text: string): { text: string; corrections: Map<string, number> } {
  const corrections = new Map<string, number>()

  for (const [pattern, replacement] of CORRECTIONS) {
    if (typeof pattern === "string") {
      // Simple string replace
      const count = text.split(pattern).length - 1
      if (count > 0) {
        corrections.set(`${pattern} → ${replacement}`, count)
        text = text.replaceAll(pattern, replacement)
      }
    } else {
      // Regex replace
      const matches = text.match(pattern)
      if (matches && matches.length > 0) {
        // Only count if the match is different from replacement (skip anchors)
        const firstMatch = matches[0]
        if (firstMatch !== replacement) {
          corrections.set(`${firstMatch} → ${replacement}`, matches.length)
        }
        text = text.replace(pattern, replacement)
      }
    }
  }

  return { text, corrections }
}

// ---------------------------------------------------------------------------
// Whitespace normalization
// ---------------------------------------------------------------------------

function normalizeWhitespace(text: string): string {
  return (
    text
      // Collapse multiple spaces into one (but not newlines)
      .replace(/[^\S\n]+/g, " ")
      // Collapse 3+ newlines into 2
      .replace(/\n{3,}/g, "\n\n")
      // Trim trailing spaces on each line
      .replace(/ +$/gm, "")
      // Trim leading/trailing whitespace
      .trim()
  )
}

// ---------------------------------------------------------------------------
// Front matter handling
// ---------------------------------------------------------------------------

function splitFrontMatter(raw: string): { frontMatter: string; body: string } {
  if (!raw.startsWith("---")) {
    return { frontMatter: "", body: raw }
  }
  const endIdx = raw.indexOf("\n---", 3)
  if (endIdx === -1) {
    return { frontMatter: "", body: raw }
  }
  return {
    frontMatter: raw.slice(0, endIdx + 4),
    body: raw.slice(endIdx + 4),
  }
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function discoverMarkdownFiles(dirs: string[]): string[] {
  const files: string[] = []

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith(".md")) {
        files.push(full)
      }
    }
  }

  for (const dir of dirs) {
    if (fs.existsSync(dir)) walk(dir)
  }
  return files.sort()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const showStats = args.includes("--stats") || dryRun
  const onlyFailed = args.includes("--only-failed")
  const fileIdx = args.indexOf("--file")
  const singleFile = fileIdx !== -1 ? args[fileIdx + 1] : null

  console.log("=".repeat(60))
  console.log("Phase 1: Automated Transcript Cleanup")
  console.log(dryRun ? "(DRY RUN - no files written)" : `Output: ${OUTPUT_BASE}`)
  if (onlyFailed) console.log("MODE: --only-failed (all live calls + 4 course files)")
  if (singleFile) console.log(`MODE: --file ${singleFile}`)
  console.log("=".repeat(60))

  let files: string[]

  if (singleFile) {
    const full = path.join(INPUT_BASE, singleFile)
    if (!fs.existsSync(full)) {
      console.error(`Error: File not found: ${full}`)
      process.exit(1)
    }
    files = [full]
  } else if (onlyFailed) {
    // Collect the 17 known-broken files: all live calls + 4 specific course transcripts
    const liveCallDir = path.join(INPUT_BASE, "live-calls")
    const liveCallFiles = fs.existsSync(liveCallDir)
      ? fs.readdirSync(liveCallDir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => path.join(liveCallDir, f))
          .sort()
      : []

    const courseFiles = FAILED_COURSE_FILES.map((f) => path.join(INPUT_BASE, f)).filter((f) => {
      if (!fs.existsSync(f)) {
        console.warn(`Warning: Failed course file not found: ${f}`)
        return false
      }
      return true
    })

    files = [...courseFiles, ...liveCallFiles]
    console.log(`\nFound ${courseFiles.length} failed course files + ${liveCallFiles.length} live calls = ${files.length} total`)
  } else {
    files = discoverMarkdownFiles(INPUT_DIRS)
  }

  console.log(`\nProcessing ${files.length} transcript files\n`)

  let totalCorrections = 0
  let totalTimestamps = 0
  let totalInterjections = 0
  const allCorrections = new Map<string, number>()

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf-8")
    const { frontMatter, body } = splitFrontMatter(raw)
    const relPath = path.relative(INPUT_BASE, filePath)

    // 1. Count timestamps before removal
    const timestampMatches = body.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g)
    const timestampCount = timestampMatches?.length ?? 0
    totalTimestamps += timestampCount

    // 2. Strip timestamps
    let cleaned = stripTimestamps(body)

    // 3. Remove short interjections
    const beforeInterjections = cleaned
    cleaned = removeShortInterjections(cleaned)
    const interjectionCount =
      (beforeInterjections.match(/\*\*[^*]+:\*\*/g)?.length ?? 0) -
      (cleaned.match(/\*\*[^*]+:\*\*/g)?.length ?? 0)
    totalInterjections += Math.max(0, interjectionCount)

    // 4. Apply correction dictionary
    const { text: corrected, corrections } = applyCorrections(cleaned)
    cleaned = corrected
    for (const [key, count] of corrections) {
      allCorrections.set(key, (allCorrections.get(key) ?? 0) + count)
    }
    totalCorrections += corrections.size

    // 5. Normalize whitespace
    cleaned = normalizeWhitespace(cleaned)

    // Reconstruct file
    const output = frontMatter ? `${frontMatter}\n${cleaned}\n` : `${cleaned}\n`

    // Write output
    if (!dryRun) {
      const outPath = path.join(OUTPUT_BASE, relPath)
      const outDir = path.dirname(outPath)
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(outPath, output, "utf-8")
    }

    // Report
    const correctionCount = [...corrections.values()].reduce((a, b) => a + b, 0)
    if (showStats && (timestampCount > 0 || correctionCount > 0 || interjectionCount > 0)) {
      console.log(
        `  ${relPath}: ${timestampCount} timestamps, ${correctionCount} corrections, ${interjectionCount} interjections removed`
      )
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`)
  console.log("SUMMARY")
  console.log("=".repeat(60))
  console.log(`Files processed:        ${files.length}`)
  console.log(`Timestamps removed:     ${totalTimestamps}`)
  console.log(`Dictionary corrections: ${totalCorrections} unique patterns applied`)
  console.log(`Interjections removed:  ${totalInterjections}`)

  if (showStats && allCorrections.size > 0) {
    console.log(`\nTop corrections:`)
    const sorted = [...allCorrections.entries()].sort((a, b) => b[1] - a[1])
    for (const [correction, count] of sorted.slice(0, 30)) {
      console.log(`  ${count}x  ${correction}`)
    }
    if (sorted.length > 30) {
      console.log(`  ... and ${sorted.length - 30} more`)
    }
  }

  if (dryRun) {
    console.log("\n(Dry run - no files written)")
  } else {
    console.log(`\nCleaned files written to: ${OUTPUT_BASE}`)
  }
  console.log("=".repeat(60))
}

main()
