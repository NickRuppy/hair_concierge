import { after, before } from "node:test"

/** Runs this file's tests with ACCOUNT_DELETION_ENABLED=true and restores the previous value. */
export function enableAccountDeletionForTests() {
  let previous: string | undefined
  before(() => {
    previous = process.env.ACCOUNT_DELETION_ENABLED
    process.env.ACCOUNT_DELETION_ENABLED = "true"
  })
  after(() => {
    if (previous === undefined) delete process.env.ACCOUNT_DELETION_ENABLED
    else process.env.ACCOUNT_DELETION_ENABLED = previous
  })
}
