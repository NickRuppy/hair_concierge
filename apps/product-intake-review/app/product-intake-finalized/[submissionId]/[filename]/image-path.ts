import { resolve, sep } from "node:path"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FILE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,199}\.(?:jpe?g|png|webp)$/i

export function resolveFinalizedImagePath(
  root: string,
  submissionId: string,
  filename: string,
): string | null {
  if (!UUID_PATTERN.test(submissionId) || !FILE_PATTERN.test(filename) || filename.includes("..")) {
    return null
  }

  const resolvedRoot = resolve(root)
  const file = resolve(resolvedRoot, submissionId, filename)
  return file.startsWith(`${resolvedRoot}${sep}`) ? file : null
}
