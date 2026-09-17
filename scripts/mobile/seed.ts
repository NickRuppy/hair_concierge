import { createClient } from "@supabase/supabase-js"
import { loadLocalEnvironment } from "./local-stack.mjs"
import { seedMobileCatalogFixture } from "./catalog-fixture"
import { seedMobileProfileFixtures } from "./profile-fixture"
import { executeLocalSQL } from "./local-postgres.mjs"

async function main() {
  const environment = loadLocalEnvironment()
  const client = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const identities = {
    free: "scanner-free@example.test",
    detailed: "scanner-detailed@example.test",
    incomplete: "scanner-incomplete@example.test",
  }
  const userIds = {} as Record<keyof typeof identities, string>
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error("Local auth read failed")
  for (const [kind, email] of Object.entries(identities)) {
    let id = data.users.find((user) => user.email === email)?.id
    if (!id) {
      const created = await client.auth.admin.createUser({ email, email_confirm: true })
      if (created.error || !created.data.user)
        throw new Error("Local synthetic auth creation failed")
      id = created.data.user.id
    }
    userIds[kind as keyof typeof identities] = id
  }
  await seedMobileCatalogFixture({
    databaseUrl: "postgresql://127.0.0.1:55322/postgres",
    executeTransaction: async (sql) => {
      executeLocalSQL(sql)
    },
  })
  await seedMobileProfileFixtures(client, userIds)
  console.log(
    "Seeded three synthetic local identities and catalog fixtures. No password or session tokens emitted.",
  )
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local fixture failed")
  process.exitCode = 1
})
