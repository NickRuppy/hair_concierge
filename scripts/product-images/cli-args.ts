/**
 * Minimal, dependency-free CLI flag parsing shared by the batch product-image
 * scripts. Deliberately not reusing scripts/product-intake/cli.ts — that
 * module pulls in Supabase + Sentry setup this pipeline doesn't need.
 */

export type CliFlags = Map<string, string>

export function parseArgs(argv: string[] = process.argv.slice(2)): CliFlags {
  const flags = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const next = argv[index + 1]
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(key, next)
      index += 1
    } else {
      flags.set(key, "true")
    }
  }
  return flags
}

export function requireFlag(flags: CliFlags, name: string, usage: string): string {
  const value = flags.get(name)
  if (!value) {
    console.error(`Missing required --${name}\n\n${usage}`)
    process.exit(1)
  }
  return value
}
