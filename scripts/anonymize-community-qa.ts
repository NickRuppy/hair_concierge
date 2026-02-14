/**
 * Anonymize Community Q&A Output Files
 *
 * Strips personal member names from existing community-qa markdown files:
 * 1. Removes `member_name` line from frontmatter
 * 2. Replaces `# Community Q&A: {name}` → `# Community Q&A: Chat {NN}`
 * 3. Replaces all remaining full-name occurrences with "Das Mitglied"
 * 4. Replaces first-name-only occurrences (4+ chars) with "Das Mitglied"
 *
 * Usage: npx tsx scripts/anonymize-community-qa.ts [--dry-run]
 */

import fs from "fs"
import path from "path"

const OUTPUT_DIR = path.join(process.cwd(), "data", "markdown-cleaned", "community-qa")

function anonymizeFile(filePath: string, dryRun: boolean): { name: string; replacements: number } {
  let content = fs.readFileSync(filePath, "utf-8")
  let replacements = 0

  // Extract member_name from frontmatter
  const nameMatch = content.match(/^member_name:\s*"(.+)"$/m)
  if (!nameMatch) {
    return { name: "(none)", replacements: 0 }
  }

  const fullName = nameMatch[1]
  const firstName = fullName.split(/\s+/)[0]

  // Extract chat number from filename (chat-01.md → 01)
  const chatNum = path.basename(filePath, ".md").replace("chat-", "")

  // 1. Remove member_name line from frontmatter
  const before1 = content
  content = content.replace(/^member_name:\s*".+"\n/m, "")
  if (content !== before1) replacements++

  // 2. Replace H1 heading
  const before2 = content
  content = content.replace(
    `# Community Q&A: ${fullName}`,
    `# Community Q&A: Chat ${chatNum}`
  )
  if (content !== before2) replacements++

  // 3. Replace all remaining full-name occurrences in body
  if (content.includes(fullName)) {
    const count = (content.match(new RegExp(escapeRegex(fullName), "g")) || []).length
    content = content.replaceAll(fullName, "Das Mitglied")
    replacements += count
  }

  // 4. Replace first-name-only occurrences (only if 4+ chars to avoid false positives)
  if (firstName.length >= 4 && content.includes(firstName)) {
    const count = (content.match(new RegExp(escapeRegex(firstName), "g")) || []).length
    content = content.replaceAll(firstName, "Das Mitglied")
    replacements += count
  }

  if (!dryRun) {
    fs.writeFileSync(filePath, content, "utf-8")
  }

  return { name: fullName, replacements }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function main() {
  const dryRun = process.argv.includes("--dry-run")

  console.log("=" .repeat(60))
  console.log("Anonymize Community Q&A Files")
  if (dryRun) console.log("(DRY RUN - no files will be modified)")
  console.log("=".repeat(60))

  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error(`Error: ${OUTPUT_DIR} not found.`)
    process.exit(1)
  }

  const files = fs.readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith("chat-") && f.endsWith(".md"))
    .sort()

  console.log(`\nFound ${files.length} chat files\n`)

  let totalReplacements = 0

  for (const file of files) {
    const filePath = path.join(OUTPUT_DIR, file)
    const { name, replacements } = anonymizeFile(filePath, dryRun)
    totalReplacements += replacements
    const status = replacements > 0 ? `${replacements} replacements` : "no changes"
    console.log(`  ${file}: ${name} → ${status}`)
  }

  console.log(`\n${"=".repeat(60)}`)
  console.log(`Total: ${totalReplacements} replacements across ${files.length} files`)
  if (dryRun) console.log("(Dry run - no files were modified)")
  console.log("=".repeat(60))
}

main()
