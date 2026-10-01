import assert from "node:assert/strict"
import test from "node:test"

import * as profileRoute from "../src/app/api/profile/route"
import * as answersRoute from "../src/app/api/profile/answers/route"
import { authenticatedProfileUser } from "../src/lib/hair-profile/edit-route"

const userId = "11111111-1111-4111-8111-111111111111"

// Clean-switch fix round 1, item A: `PUT /api/profile` (the last direct column writer, no caller)
// is gone; the web editors save through `POST /api/profile/answers` (profile-answers-route.test.ts).
test("profile route modules expose only supported HTTP handlers", () => {
  assert.deepEqual(Object.keys(profileRoute).sort(), ["GET"])
  assert.deepEqual(Object.keys(answersRoute), ["POST"])
})

test("the route auth seam rejects a missing server-session owner", async () => {
  assert.equal(
    await authenticatedProfileUser({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    null,
  )
  assert.equal(
    await authenticatedProfileUser({
      auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    }),
    userId,
  )
})
