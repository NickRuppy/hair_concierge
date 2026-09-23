import assert from "node:assert/strict"
import test from "node:test"

import {
  canApplyDiscoveryWrite,
  deriveDiscoveryEnrollmentStatus,
  parseDiscoveryCommand,
  projectDiscoveryInvitation,
  runDiscoveryCommand,
  type DiscoveryEnrollmentGateway,
  type DiscoveryEnrollmentRow,
} from "../scripts/discovery"

const SECRET = "discovery-enrollment-secret-with-enough-length"
const SITE_URL = "https://chaarlie.de"
const enrollmentId = "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e"

const applyArgs = [
  "revoke",
  `--enrollment=${enrollmentId}`,
  "--apply",
  "--confirm-project=pqdkhefxsxkyeqelqegq",
]
const applyEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
  ALLOW_DISCOVERY_PRODUCTION_WRITE: "1",
}

const row: DiscoveryEnrollmentRow = {
  id: enrollmentId,
  display_name: "Lea Sommer",
  normalized_email: "lea@example.test",
  token_version: 2,
  claimed_at: null,
  revoked_at: null,
  created_at: "2026-09-22T10:00:00.000Z",
}

/** Every method fails the test: the gate must refuse before the database. */
function forbiddenGateway(): DiscoveryEnrollmentGateway {
  const refuse = (name: string) => () => {
    throw new Error(`gateway.${name} must not run before the production gate passes`)
  }
  return {
    list: refuse("list"),
    create: refuse("create"),
    revoke: refuse("revoke"),
    rotate: refuse("rotate"),
  }
}

function recordingGateway(calls: string[]): DiscoveryEnrollmentGateway {
  const record = (name: string) => async () => {
    calls.push(name)
    return row
  }
  return {
    list: async () => {
      calls.push("list")
      return [row]
    },
    create: record("create"),
    revoke: record("revoke"),
    rotate: record("rotate"),
  }
}

async function run(args: readonly string[], environment: Record<string, string | undefined>) {
  const calls: string[] = []
  const logged: unknown[] = []
  await runDiscoveryCommand({
    args,
    environment,
    gateway: recordingGateway(calls),
    secret: SECRET,
    siteUrl: SITE_URL,
    log: (value) => logged.push(value),
  })
  return { calls, logged }
}

async function refuses(args: readonly string[], environment: Record<string, string | undefined>) {
  await assert.rejects(
    runDiscoveryCommand({
      args,
      environment,
      gateway: forbiddenGateway(),
      secret: SECRET,
      siteUrl: SITE_URL,
      log: () => {},
    }),
    /Writes require ALLOW_DISCOVERY_PRODUCTION_WRITE=1/,
  )
}

test("the discovery CLI parses its four subcommands and normalizes identity", () => {
  assert.deepEqual(parseDiscoveryCommand(["list"]), { action: "list" })
  assert.deepEqual(
    parseDiscoveryCommand(["create", "--name= Lea Sommer ", "--email= LEA@Example.Test "]),
    { action: "create", apply: false, name: "Lea Sommer", email: "lea@example.test" },
  )
  assert.deepEqual(parseDiscoveryCommand(["rotate", `--enrollment=${enrollmentId}`, "--apply"]), {
    action: "rotate",
    apply: true,
    enrollmentId,
  })
  // The e-mail is optional; the participant types it on the invite page.
  assert.deepEqual(parseDiscoveryCommand(["create", "--name=Lea"]), {
    action: "create",
    apply: false,
    name: "Lea",
    email: null,
  })
  assert.deepEqual(parseDiscoveryCommand(["create", "--name=Lea", "--email= "]), {
    action: "create",
    apply: false,
    name: "Lea",
    email: null,
  })
  assert.throws(
    () => parseDiscoveryCommand(["create", "--name=Lea", "--email=lea@"]),
    /valid --email/,
  )
  assert.throws(() => parseDiscoveryCommand(["create", "--email=lea@example.test"]), /--name/)
  assert.throws(() => parseDiscoveryCommand(["revoke"]), /requires --enrollment/)
  assert.throws(() => parseDiscoveryCommand(["nope"]), /Usage: list \| create/)
})

test("the production gate needs --apply, the env gate, the project confirmation and a matching URL", () => {
  assert.equal(canApplyDiscoveryWrite(applyArgs, applyEnvironment), true)
  assert.equal(
    canApplyDiscoveryWrite(
      applyArgs.filter((argument) => argument !== "--apply"),
      applyEnvironment,
    ),
    false,
  )
  assert.equal(
    canApplyDiscoveryWrite(
      applyArgs.filter((argument) => !argument.startsWith("--confirm-project")),
      applyEnvironment,
    ),
    false,
  )
  assert.equal(
    canApplyDiscoveryWrite(applyArgs, {
      ...applyEnvironment,
      ALLOW_DISCOVERY_PRODUCTION_WRITE: undefined,
    }),
    false,
  )
  assert.equal(
    canApplyDiscoveryWrite(applyArgs, {
      ...applyEnvironment,
      ALLOW_DISCOVERY_PRODUCTION_WRITE: "0",
    }),
    false,
  )
  assert.equal(
    canApplyDiscoveryWrite(applyArgs, {
      ...applyEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "https://wrong-project.supabase.co",
    }),
    false,
  )
  assert.equal(
    canApplyDiscoveryWrite(applyArgs, {
      ...applyEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
    }),
    false,
  )
  assert.equal(
    canApplyDiscoveryWrite(
      ["revoke", `--enrollment=${enrollmentId}`, "--apply", "--confirm-project=other"],
      applyEnvironment,
    ),
    false,
  )
})

test("a half-gated mutation reaches no write path at all", async () => {
  await refuses(applyArgs, { ...applyEnvironment, ALLOW_DISCOVERY_PRODUCTION_WRITE: undefined })
  await refuses(applyArgs, { ...applyEnvironment, ALLOW_DISCOVERY_PRODUCTION_WRITE: "0" })
  await refuses(
    applyArgs.filter((argument) => !argument.startsWith("--confirm-project")),
    applyEnvironment,
  )
  await refuses(applyArgs, {
    ...applyEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: "https://wrong-project.supabase.co",
  })
  await refuses(
    [
      "create",
      "--name=Lea",
      "--email=lea@example.test",
      "--apply",
      "--confirm-project=pqdkhefxsxkyeqelqegq",
    ],
    { ...applyEnvironment, ALLOW_DISCOVERY_PRODUCTION_WRITE: undefined },
  )
})

test("without --apply the CLI is a dry run that touches nothing", async () => {
  const { calls, logged } = await run(
    ["create", "--name=Lea", "--email=lea@example.test"],
    applyEnvironment,
  )
  assert.deepEqual(calls, [])
  assert.deepEqual(logged, [
    {
      mode: "dry-run",
      writes: false,
      action: "create",
      apply: false,
      name: "Lea",
      email: "lea@example.test",
    },
  ])
})

test("an unusable signing secret neither breaks a dry run nor masks the gate refusal", async () => {
  const logged: unknown[] = []
  await runDiscoveryCommand({
    args: ["create", "--name=Lea", "--email=lea@example.test"],
    environment: applyEnvironment,
    gateway: forbiddenGateway(),
    secret: "too-short",
    log: (value) => logged.push(value),
  })
  assert.equal((logged[0] as { mode: string }).mode, "dry-run")

  await assert.rejects(
    runDiscoveryCommand({
      args: applyArgs,
      environment: { ...applyEnvironment, ALLOW_DISCOVERY_PRODUCTION_WRITE: undefined },
      gateway: forbiddenGateway(),
      secret: "too-short",
      log: () => {},
    }),
    /Writes require ALLOW_DISCOVERY_PRODUCTION_WRITE=1/,
  )
})

test("a fully gated mutation runs, and list stays a read", async () => {
  assert.deepEqual((await run(applyArgs, applyEnvironment)).calls, ["revoke"])
  assert.deepEqual(
    (
      await run(
        [
          "rotate",
          `--enrollment=${enrollmentId}`,
          "--apply",
          "--confirm-project=pqdkhefxsxkyeqelqegq",
        ],
        applyEnvironment,
      )
    ).calls,
    ["rotate"],
  )
  assert.deepEqual((await run(["list"], {})).calls, ["list"])
})

test("create prints a WhatsApp-ready German invite with the token in the fragment", async () => {
  const { logged } = await run(
    [
      "create",
      "--name=Lea Sommer",
      "--email=lea@example.test",
      "--apply",
      "--confirm-project=pqdkhefxsxkyeqelqegq",
    ],
    applyEnvironment,
  )
  const receipt = logged[0] as { url: string; message: string; status: string; name: string }

  assert.equal(receipt.status, "invited")
  assert.match(receipt.url, /^https:\/\/chaarlie\.de\/beratung\/einladung#code=v1\./)
  assert.doesNotMatch(receipt.url, /\?/)
  assert.equal(
    receipt.message,
    `Hi Lea, hier ist dein persönlicher Link für unser Gespräch:\n${receipt.url}\n` +
      "Konto anlegen, Fragebogen ausfüllen, Produkte eintragen – dauert etwa 10 Minuten.",
  )
})

test("invite links are reproducible per token version and statuses read off the row", () => {
  const first = projectDiscoveryInvitation({
    enrollmentId,
    name: "Lea Sommer",
    tokenVersion: 1,
    secret: SECRET,
    siteUrl: "https://chaarlie.de/",
  })
  assert.match(first.url, /^https:\/\/chaarlie\.de\/beratung\/einladung#code=/)
  assert.notEqual(
    first.url,
    projectDiscoveryInvitation({
      enrollmentId,
      name: "Lea Sommer",
      tokenVersion: 2,
      secret: SECRET,
      siteUrl: SITE_URL,
    }).url,
  )

  assert.equal(deriveDiscoveryEnrollmentStatus({ claimed_at: null, revoked_at: null }), "invited")
  assert.equal(
    deriveDiscoveryEnrollmentStatus({ claimed_at: "2026-09-22T10:00:00Z", revoked_at: null }),
    "claimed",
  )
  assert.equal(
    deriveDiscoveryEnrollmentStatus({
      claimed_at: "2026-09-22T10:00:00Z",
      revoked_at: "2026-09-22T11:00:00Z",
    }),
    "revoked",
  )
})

test("create without --email makes a name-only invite whose receipt says so", async () => {
  const created: unknown[] = []
  const logged: unknown[] = []
  await runDiscoveryCommand({
    args: ["create", "--name=Lea Sommer", "--apply", "--confirm-project=pqdkhefxsxkyeqelqegq"],
    environment: applyEnvironment,
    gateway: {
      ...forbiddenGateway(),
      create: async (input) => {
        created.push(input)
        return { ...row, normalized_email: null }
      },
    },
    secret: SECRET,
    siteUrl: SITE_URL,
    log: (value) => logged.push(value),
  })
  assert.deepEqual(created, [{ name: "Lea Sommer", email: null }])
  const receipt = logged[0] as { email: string | null; url: string; status: string }
  assert.equal(receipt.email, null)
  assert.equal(receipt.status, "invited")
  assert.match(receipt.url, /^https:\/\/chaarlie\.de\/beratung\/einladung#code=v1\./)
})
