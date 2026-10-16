import assert from "node:assert/strict"
import { mock } from "node:test"
import { mockCandidateTransport } from "./raw-candidate-transport"

// Isolated CLI process: mock only DNS/TLS, retaining real decode and Storage HTTP.
assert.ok(process.env.SHAMPOO_FAKE_RAW_IMAGE)
mockCandidateTransport(
  {
    mock,
    after: (cleanup) => {
      process.once("exit", cleanup)
    },
  },
  {
    lookup: async (hostname) => {
      assert.equal(hostname, "xylozent.invalid")
      return [{ address: "93.184.216.34", family: 4 }]
    },
    responses: [{ chunks: [Buffer.from(process.env.SHAMPOO_FAKE_RAW_IMAGE, "base64")] }],
  },
)
