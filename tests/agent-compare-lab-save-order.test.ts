import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("agent compare lab only records saved judgment after the POST succeeds", () => {
  const source = readFileSync("src/components/labs/agent-compare-lab.tsx", "utf8")
  const handlerStart = source.indexOf("function handleSaveJudgment()")
  const handlerEnd = source.indexOf("\n  return (", handlerStart)

  assert.notEqual(handlerStart, -1)
  assert.notEqual(handlerEnd, -1)

  const handler = source.slice(handlerStart, handlerEnd)
  const fetchIndex = handler.indexOf('fetch("/api/labs/agent-compare/judgments"')
  const responseCheckIndex = handler.indexOf("if (!response.ok)", fetchIndex)
  const mutationIndex = handler.indexOf("setHistory(", responseCheckIndex)

  assert.notEqual(fetchIndex, -1)
  assert.notEqual(responseCheckIndex, -1)
  assert.notEqual(mutationIndex, -1)
  assert.equal(handler.slice(0, fetchIndex).includes("setHistory("), false)
  assert.equal(handler.slice(0, fetchIndex).includes('setNote("")'), false)
  assert.equal(handler.slice(0, fetchIndex).includes('setFailureBucket("none")'), false)
  assert.equal(
    handler.slice(0, fetchIndex).includes("setCriticalProductClaimFailure(false)"),
    false,
  )
})
