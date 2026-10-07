type BoundedFifoOptions = {
  label: string
  limit: number
  warn?: (message: string) => void
}
export function createBoundedFifo<T>({ label, limit, warn }: BoundedFifoOptions) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Bounded FIFO limit must be a positive integer")
  }

  let items: T[] = []

  return {
    clear() {
      items = []
    },
    drain() {
      const drained = items
      items = []
      return drained
    },
    push(item: T) {
      if (items.length >= limit) {
        items.shift()
        warn?.(`[analytics] ${label} queue full; dropped oldest item`)
      }
      items.push(item)
    },
    size() {
      return items.length
    },
  }
}
