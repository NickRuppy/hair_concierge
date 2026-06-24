import { execFileSync } from "node:child_process"

function readGitValue(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

export function collectLocalGitInfo(): {
  git_sha: string | null
  git_branch: string | null
  git_dirty: boolean | null
} {
  const status = readGitValue(["status", "--porcelain"])
  return {
    git_sha: readGitValue(["rev-parse", "HEAD"]),
    git_branch: readGitValue(["branch", "--show-current"]),
    git_dirty: status === null ? null : status.length > 0,
  }
}
