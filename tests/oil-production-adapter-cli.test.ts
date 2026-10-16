import assert from "node:assert/strict"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

import {
  exitCodeForOilProjection,
  parseOilProductionAdapterCliArgs,
  runOilProductionAdapterCli,
} from "../scripts/research/oil-inci/production-adapter"
import { OilResearchInputSchema } from "../src/lib/oil-research/contracts"
import {
  makeOilEnvelope,
  makeOilExclusion,
  preserveFixtureProfile,
} from "./fixtures/oil-research/fixture"

const script = path.resolve("scripts/research/oil-inci/production-adapter.ts")

function temporaryRoot(prefix: string): string {
  // The CLI correctly rejects output symlinks. Canonicalize macOS's standard
  // temporary alias before constructing an output path for this test.
  return mkdtempSync(path.join(realpathSync(os.tmpdir()), prefix))
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

test("oil local replay accepts exactly --input and --output", () => {
  assert.deepEqual(parseOilProductionAdapterCliArgs(["--input", "oil.json", "--output", "out"]), {
    input: "oil.json",
    output: "out",
  })
  assert.throws(
    () => parseOilProductionAdapterCliArgs(["--input", "oil.json"]),
    /--output is required/,
  )
  assert.throws(() => parseOilProductionAdapterCliArgs(["--overwrite"]), /Unknown argument/)
})

test("oil CLI writes a complete immutable ready artifact through its child-process boundary", () => {
  const root = temporaryRoot("oil-adapter-cli-ready-")
  const inputPath = path.join(root, "input.json")
  const outputPath = path.join(root, "output")
  const submitted = `${JSON.stringify(makeOilEnvelope(), null, 2)}\n`
  writeFileSync(inputPath, submitted)

  const child = runCli(["--input", inputPath, "--output", outputPath])
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /property_projection_ready/)
  for (const name of [
    "original-input.json",
    "research-envelope.json",
    "production-projection.json",
    "projection-summary.md",
  ]) {
    assert.equal(existsSync(path.join(outputPath, name)), true, name)
  }
  assert.equal(readFileSync(path.join(outputPath, "original-input.json"), "utf8"), submitted)
  const emittedEnvelope = JSON.parse(
    readFileSync(path.join(outputPath, "research-envelope.json"), "utf8"),
  )
  assert.equal(OilResearchInputSchema.safeParse(emittedEnvelope).success, true)
  const replayOutput = path.join(root, "replayed")
  const replay = runCli([
    "--input",
    path.join(outputPath, "research-envelope.json"),
    "--output",
    replayOutput,
  ])
  assert.equal(replay.status, 0, replay.stderr)
  const projection = JSON.parse(
    readFileSync(path.join(outputPath, "production-projection.json"), "utf8"),
  )
  assert.equal(projection.status, "property_projection_ready")
  assert.match(readFileSync(path.join(outputPath, "projection-summary.md"), "utf8"), /manual/i)
})

test("semantic refusals have literal child exit codes and never emit an admitted envelope", () => {
  const root = temporaryRoot("oil-adapter-cli-refusal-")
  const unknownWeight = makeOilEnvelope()
  unknownWeight.profile.weight.value = "unknown"
  preserveFixtureProfile(unknownWeight)
  const needsInput = path.join(root, "needs.json")
  const needsOutput = path.join(root, "needs-output")
  writeFileSync(needsInput, JSON.stringify(unknownWeight))
  const needs = runCli(["--input", needsInput, "--output", needsOutput])
  assert.equal(needs.status, 1, needs.stderr)
  assert.equal(existsSync(path.join(needsOutput, "original-input.json")), true)
  assert.equal(existsSync(path.join(needsOutput, "production-projection.json")), true)
  assert.equal(existsSync(path.join(needsOutput, "research-envelope.json")), false)

  const exclusionInput = path.join(root, "excluded.json")
  const exclusionOutput = path.join(root, "excluded-output")
  writeFileSync(exclusionInput, JSON.stringify(makeOilExclusion()))
  const excluded = runCli(["--input", exclusionInput, "--output", exclusionOutput])
  assert.equal(excluded.status, 3, excluded.stderr)
  assert.equal(existsSync(path.join(exclusionOutput, "research-envelope.json")), false)
  assert.equal(
    JSON.parse(readFileSync(path.join(exclusionOutput, "production-projection.json"), "utf8"))
      .status,
    "not_applicable",
  )
})

test("invalid JSON and unsafe output paths are invocation failures, not research refusals", () => {
  const root = temporaryRoot("oil-adapter-cli-invalid-")
  const malformed = path.join(root, "malformed.json")
  writeFileSync(malformed, "{ invalid")
  const broken = runCli(["--input", malformed, "--output", path.join(root, "broken-output")])
  assert.equal(broken.status, 2, broken.stderr)

  const inputPath = path.join(root, "valid.json")
  writeFileSync(inputPath, JSON.stringify(makeOilEnvelope()))
  const target = path.join(root, "target")
  const symlink = path.join(root, "link")
  writeFileSync(target, "not a directory")
  symlinkSync(target, symlink)
  const unsafe = runCli(["--input", inputPath, "--output", path.join(symlink, "child")])
  assert.equal(unsafe.status, 2, unsafe.stderr)
  assert.match(unsafe.stderr, /symlink/i)

  const dangling = path.join(root, "dangling")
  symlinkSync(path.join(root, "not-created"), dangling)
  const danglingResult = runCli(["--input", inputPath, "--output", dangling])
  assert.equal(danglingResult.status, 2, danglingResult.stderr)
  assert.match(danglingResult.stderr, /symlink/i)

  const oversized = path.join(root, "oversized.json")
  writeFileSync(oversized, Buffer.alloc(1024 * 1024 + 1, " "))
  const oversizedResult = runCli(["--input", oversized, "--output", path.join(root, "too-large")])
  assert.equal(oversizedResult.status, 2, oversizedResult.stderr)
  assert.match(oversizedResult.stderr, /1 MiB/)
})

test("direct API accepts an empty target, rejects a non-empty target and maps outcomes", () => {
  const root = temporaryRoot("oil-adapter-cli-output-")
  const inputPath = path.join(root, "input.json")
  const outputPath = path.join(root, "output")
  writeFileSync(inputPath, JSON.stringify(makeOilEnvelope()))
  mkdirSync(outputPath)
  assert.equal(
    runOilProductionAdapterCli({ input: inputPath, output: outputPath }).status,
    "property_projection_ready",
  )
  assert.throws(
    () => runOilProductionAdapterCli({ input: inputPath, output: outputPath }),
    /non-empty output directory/,
  )
  assert.equal(exitCodeForOilProjection("property_projection_ready"), 0)
  assert.equal(exitCodeForOilProjection("needs_research"), 1)
  assert.equal(exitCodeForOilProjection("not_applicable"), 3)
})
