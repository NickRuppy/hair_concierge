import { lstatSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs"
import path from "node:path"

function lstatOrNull(target: string) {
  try {
    return lstatSync(target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

/**
 * Validates each existing component with lstat, including dangling links.
 * Callers must pass the requested path, rather than a realpath-resolved one,
 * because following the link would defeat the output boundary.
 */
export function assertNoSymlinksOnExistingPath(targetPath: string): void {
  const resolved = path.resolve(targetPath)
  const root = path.parse(resolved).root
  let cursor = root
  for (const component of path.relative(root, resolved).split(path.sep)) {
    if (!component) continue
    cursor = path.join(cursor, component)
    const stat = lstatOrNull(cursor)
    if (!stat) continue
    if (stat.isSymbolicLink()) throw new Error(`Refusing output symlink: ${cursor}`)
  }
}

function assertOutputTarget(resolved: string): void {
  if (resolved === path.parse(resolved).root) {
    throw new Error("Output directory cannot be a filesystem root")
  }
  assertNoSymlinksOnExistingPath(resolved)
  const stat = lstatOrNull(resolved)
  if (!stat) return
  if (!stat.isDirectory()) throw new Error(`Output path must be a directory: ${resolved}`)
  if (readdirSync(resolved).length > 0) {
    throw new Error(`Refusing to replace non-empty output directory: ${resolved}`)
  }
}

/**
 * Writes a complete artifact directory beside the requested target, then
 * replaces an allowed new or empty target with one POSIX/macOS rename.
 */
export function publishDirectoryAtomically(output: string, write: (stage: string) => void): void {
  const resolved = path.resolve(output)
  assertOutputTarget(resolved)
  const parent = path.dirname(resolved)
  mkdirSync(parent, { recursive: true })
  // Covers both mkdir races and a target that appeared while staging.
  assertOutputTarget(resolved)
  const stage = mkdtempSync(path.join(parent, `.${path.basename(resolved)}.staging-`))
  try {
    write(stage)
    // Recheck the target and existing ancestors immediately before publication.
    assertOutputTarget(resolved)
    renameSync(stage, resolved)
  } catch (error) {
    rmSync(stage, { recursive: true, force: true })
    throw error
  }
}
