#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const BRANCH_PREFIX = "codex/";

function printUsage() {
  console.log(`Usage: npm run worktree:new -- <name> [--base <ref>] [--no-install]

Creates a repo-local worktree in .worktrees/<name>, copies ignored local files
listed in .worktreeinclude, and installs dependencies by default.
`);
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

  // Repo-local worktrees live under <repo>/.worktrees/<slug>.
  if (markerIndex >= 0) {
    return worktreeRoot.slice(0, markerIndex);
  }

  return worktreeRoot;
}

function detectBaseRef(repoRoot) {
  const remoteHead = git(
    ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"],
    { cwd: repoRoot, capture: true, allowFailure: true }
  );

  if (remoteHead.status === 0) {
    return remoteHead.stdout.trim().replace(/^refs\/remotes\//, "");
  }

  const originMain = git(
    ["show-ref", "--verify", "--quiet", "refs/remotes/origin/main"],
    { cwd: repoRoot, allowFailure: true }
  );

  if (originMain.status === 0) {
    return "origin/main";
  }

  const main = git(["show-ref", "--verify", "--quiet", "refs/heads/main"], {
    cwd: repoRoot,
    allowFailure: true,
  });

  if (main.status === 0) {
    return "main";
  }

  return "HEAD";
}

function ensureBranchAvailable(repoRoot, branchName) {
  const refsToCheck = [
    `refs/heads/${branchName}`,
    `refs/remotes/origin/${branchName}`,
  ];

  for (const ref of refsToCheck) {
    const result = git(["show-ref", "--verify", "--quiet", ref], {
      cwd: repoRoot,
      allowFailure: true,
    });

    if (result.status === 0) {
      throw new Error(`Branch already exists: ${branchName}`);
    }
  }
}

function loadIncludePaths(configRoot) {
  const includeFile = path.join(configRoot, ".worktreeinclude");

  if (!existsSync(includeFile)) {
    return [];
  }

  return readFileSync(includeFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function isIgnored(repoRoot, relativePath) {
  const result = git(["check-ignore", "-q", "--", relativePath], {
    cwd: repoRoot,
    allowFailure: true,
  });

  return result.status === 0;
}

function copyIncludedFiles(configRoot, sourceRoots, worktreePath) {
  const copied = [];

  for (const relativePath of loadIncludePaths(configRoot)) {
    const sourceRoot = sourceRoots.find((root) => {
      const candidatePath = path.join(root, relativePath);
      return existsSync(candidatePath) && isIgnored(root, relativePath);
    });

    if (!sourceRoot) {
      continue;
    }

    const sourcePath = path.join(sourceRoot, relativePath);
    const destinationPath = path.join(worktreePath, relativePath);
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    cpSync(sourcePath, destinationPath, { recursive: true });
    copied.push(relativePath);
  }

  return copied;
}

function detectInstallCommand(repoRoot) {
  if (existsSync(path.join(repoRoot, "package-lock.json"))) {
    return { command: "npm", args: ["ci"], label: "npm ci" };
  }

  if (existsSync(path.join(repoRoot, "pnpm-lock.yaml"))) {
    return {
      command: "pnpm",
      args: ["install", "--frozen-lockfile"],
      label: "pnpm install --frozen-lockfile",
    };
  }

  if (existsSync(path.join(repoRoot, "yarn.lock"))) {
    return {
      command: "yarn",
      args: ["install", "--frozen-lockfile"],
      label: "yarn install --frozen-lockfile",
    };
  }

  return null;
}

function parseArgs(argv) {
  let name = "";
  let baseRef = "";
  let installDeps = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--base") {
      baseRef = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--no-install") {
      installDeps = false;
      continue;
    }

    if (!name) {
      name = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!name) {
    printUsage();
    process.exit(1);
  }

  return {
    slug: slugify(name),
    baseRef,
    installDeps,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.slug) {
    throw new Error("Worktree name must contain at least one letter or number.");
  }

  const worktreeRoot = getGitTopLevel();
  const repoRoot = getRepoRoot(worktreeRoot);
  const baseRef = options.baseRef || detectBaseRef(repoRoot);
  const branchName = `${BRANCH_PREFIX}${options.slug}`;
  const worktreePath = path.join(repoRoot, ".worktrees", options.slug);
  const configRoot = existsSync(path.join(worktreeRoot, ".worktreeinclude"))
    ? worktreeRoot
    : repoRoot;
  const sourceRoots = Array.from(new Set([worktreeRoot, repoRoot]));

  if (existsSync(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  ensureBranchAvailable(repoRoot, branchName);
  mkdirSync(path.join(repoRoot, ".worktrees"), { recursive: true });

  git(["worktree", "add", worktreePath, "-b", branchName, baseRef], {
    cwd: repoRoot,
  });

  const copiedFiles = copyIncludedFiles(configRoot, sourceRoots, worktreePath);
  let installSummary = "skipped";

  if (options.installDeps) {
    const installCommand = detectInstallCommand(repoRoot);

    if (installCommand) {
      run(installCommand.command, installCommand.args, { cwd: worktreePath });
      installSummary = installCommand.label;
    } else {
      installSummary = "no supported lockfile found";
    }
  }

  console.log("");
  console.log(`Created worktree: ${worktreePath}`);
  console.log(`Branch: ${branchName}`);
  console.log(`Base ref: ${baseRef}`);
  console.log(
    copiedFiles.length > 0
      ? `Copied local files: ${copiedFiles.join(", ")}`
      : "Copied local files: none"
  );
  console.log(`Dependencies: ${installSummary}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${worktreePath}`);
  console.log("  npm run dev:worktree");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
