import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const profilePagePath = new URL("../src/app/profile/page.tsx", import.meta.url)

async function readAccountCard() {
  const source = await readFile(profilePagePath, "utf8")
  const start = source.indexOf('<Card className="mt-4 border-border/60 bg-card/60">')
  const end = source.indexOf("          </Card>", start)

  assert.notEqual(start, -1, "Profile must retain the Account card")
  assert.notEqual(end, -1, "Profile Account card must be complete")

  return { source, accountCard: source.slice(start, end) }
}

test("Profile Account card offers native server-action logout without explanatory copy", async () => {
  const { source, accountCard } = await readAccountCard()

  assert.match(source, /import\s+\{\s*signOutAction\s*\}\s+from\s+["']@\/app\/auth\/actions["']/)
  assert.match(accountCard, /<h2[^>]*>\s*Account\s*<\/h2>/)
  assert.match(
    accountCard,
    /<AvatarImage src=\{profile\?\.avatar_url \?\? undefined\} alt="Avatar" \/>/,
  )
  assert.match(accountCard, /\{profile\?\.full_name \|\| "—"\}/)
  assert.match(accountCard, /\{profile\?\.email\}/)
  assert.match(accountCard, /<form\b[^>]*\baction=\{signOutAction\}[^>]*>/)
  assert.match(
    accountCard,
    /<Button\s+type="submit"\s+variant="outline"\s+className="[^"]*border-border[^"]*text-foreground[^"]*hover:bg-muted[^"]*"[\s\S]*?>\s*Abmelden\s*<\/Button>/,
  )
  assert.doesNotMatch(accountCard, /Dein Zugang bleibt bewusst sekundär/)
  assert.doesNotMatch(accountCard, /<CardDescription/)
  assert.doesNotMatch(accountCard, /AlertDialog|Dialog|onClick=\{[^}]*signOut/)
})
