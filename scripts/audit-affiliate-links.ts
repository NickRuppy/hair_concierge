import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"

loadEnv({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type Row = {
  id: string
  name: string
  brand: string | null
  category: string | null
  affiliate_link: string | null
  is_active: boolean | null
}

function isUsableUrl(v: string | null): boolean {
  if (!v) return false
  const trimmed = v.trim()
  if (!trimmed) return false
  try {
    const u = new URL(trimmed)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

async function main() {
  let from = 0
  const pageSize = 1000
  const all: Row[] = []
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, category, affiliate_link, is_active")
      .order("category", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Row[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  const byCat = new Map<
    string,
    { total: number; active: number; activeMissing: number; activeWithLink: number }
  >()
  for (const r of all) {
    const cat = r.category ?? "(none)"
    const slot = byCat.get(cat) ?? {
      total: 0,
      active: 0,
      activeMissing: 0,
      activeWithLink: 0,
    }
    slot.total += 1
    if (r.is_active) {
      slot.active += 1
      if (isUsableUrl(r.affiliate_link)) slot.activeWithLink += 1
      else slot.activeMissing += 1
    }
    byCat.set(cat, slot)
  }

  const rows = Array.from(byCat.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  console.log("category | total | active | activeWithLink | activeMissing")
  for (const [cat, s] of rows) {
    console.log(`${cat} | ${s.total} | ${s.active} | ${s.activeWithLink} | ${s.activeMissing}`)
  }

  const sampleMissing = all.filter((r) => r.is_active && !isUsableUrl(r.affiliate_link)).slice(0, 8)
  console.log("\nSample active rows missing a link:")
  for (const r of sampleMissing) {
    console.log(
      `- [${r.category}] ${r.brand ?? "(no brand)"} — ${r.name} (raw=${JSON.stringify(r.affiliate_link)})`,
    )
  }

  const sampleWithLink = all.filter((r) => r.is_active && isUsableUrl(r.affiliate_link))
  console.log("\nAll active rows that already have a link:")
  for (const r of sampleWithLink) {
    console.log(`- [${r.category}] ${r.brand ?? "(no brand)"} — ${r.name} → ${r.affiliate_link}`)
  }

  const hosts = new Map<string, number>()
  for (const r of sampleWithLink) {
    try {
      const h = new URL(r.affiliate_link as string).host
      hosts.set(h, (hosts.get(h) ?? 0) + 1)
    } catch {}
  }
  console.log("\nHost frequency among existing links:")
  for (const [h, c] of Array.from(hosts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${h}: ${c}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
