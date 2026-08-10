// Creates (or confirms) a test user via Supabase admin API.
import { createClient } from "@supabase/supabase-js"
import fs from "fs"

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .filter(Boolean)
    .filter((l) => !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1)]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.UX_AUDIT_TEST_PASSWORD

if (!url || !serviceKey || !password) {
  console.error("missing local Supabase env or UX_AUDIT_TEST_PASSWORD")
  process.exit(1)
}
const hostname = new URL(url).hostname
if (hostname !== "127.0.0.1" && hostname !== "localhost") {
  throw new Error("ux-audit test-user helper is local-Supabase-only")
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const email = "ux-audit-test@hairconscierge.test"

// See if the user already exists by listing.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
if (listErr) {
  console.error("listUsers failed:", listErr.message)
  process.exit(1)
}
const existing = list.users.find((u) => u.email === email)

if (existing) {
  // Reset password to known value in case it drifted.
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  })
  if (error) throw error
  console.log("REUSED_USER_ID=" + existing.id)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  console.log("CREATED_USER_ID=" + data.user.id)
}

console.log("EMAIL=" + email)
console.log("PASSWORD_SOURCE=UX_AUDIT_TEST_PASSWORD")
