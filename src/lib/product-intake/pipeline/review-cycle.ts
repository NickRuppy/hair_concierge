import { AsyncLocalStorage } from "node:async_hooks"

// The worker supplies a lease-fenced reservation operation for each executing job.
// Standalone diagnostic calls have no job and keep their existing timeout behavior.
const modelCycle = new AsyncLocalStorage<() => Promise<number>>()

export function withResearchModelCycle<T>(reserve: () => Promise<number>, run: () => T): T {
  return modelCycle.run(reserve, run)
}

export async function reserveCurrentResearchModelRun(): Promise<number | undefined> {
  return modelCycle.getStore()?.()
}
