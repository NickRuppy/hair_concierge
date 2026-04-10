#!/usr/bin/env node

import net from "node:net";
import path from "node:path";
import process from "node:process";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });

  if (options.allowFailure) {
    return result;
  }

  if (result.status !== 0) {
    const detail = options.capture
      ? (result.stderr || result.stdout || "").trim()
      : "";
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}${detail ? `\n${detail}` : ""}`
    );
  }

  return result;
}

function git(args, options = {}) {
  return run("git", args, options);
}

function getGitTopLevel() {
  return git(["rev-parse", "--show-toplevel"], { capture: true }).stdout.trim();
}

function getRepoRoot(worktreeRoot) {
  const marker = `${path.sep}.worktrees${path.sep}`;
  const markerIndex = worktreeRoot.indexOf(marker);

  if (markerIndex >= 0) {
    return worktreeRoot.slice(0, markerIndex);
  }

  return worktreeRoot;
}

function getWorktreeName(repoRoot, worktreeRoot) {
  const worktreesDir = path.join(repoRoot, ".worktrees");
  const relativePath = path.relative(worktreesDir, worktreeRoot);

  if (
    relativePath &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  ) {
    return relativePath.split(path.sep)[0];
  }

  return "main";
}

function hashName(value) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function preferredPort(worktreeName) {
  if (worktreeName === "main") {
    return 3000;
  }

  return 3100 + (hashName(worktreeName) % 700);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

async function findOpenPort(startPort) {
  for (let offset = 0; offset < 100; offset += 1) {
    const candidate = startPort + offset;

    if (await isPortFree(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No open port found starting from ${startPort}.`);
}

async function main() {
  const printPortOnly = process.argv.includes("--print-port");
  const worktreeRoot = getGitTopLevel();
  const repoRoot = getRepoRoot(worktreeRoot);
  const worktreeName = getWorktreeName(repoRoot, worktreeRoot);
  const port = await findOpenPort(preferredPort(worktreeName));

  if (printPortOnly) {
    console.log(String(port));
    return;
  }

  console.log(`Starting ${worktreeName} on http://localhost:${port}`);

  const nextBinary = path.join(worktreeRoot, "node_modules", ".bin", "next");

  if (!existsSync(nextBinary)) {
    throw new Error(
      "Missing Next.js binary. Run `npm ci` in this worktree before starting dev."
    );
  }

  const child = spawn(nextBinary, ["dev", "--port", String(port)], {
    cwd: worktreeRoot,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
