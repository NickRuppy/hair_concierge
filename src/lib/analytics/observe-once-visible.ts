type ObserverConstructor = new (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
) => Pick<IntersectionObserver, "disconnect" | "observe">

export function observeOnceVisible(
  element: Element,
  onVisible: () => void,
  Observer: ObserverConstructor | undefined = globalThis.IntersectionObserver,
): () => void {
  let tracked = false
  const track = () => {
    if (tracked) return
    tracked = true
    onVisible()
  }

  if (!Observer) {
    track()
    return () => undefined
  }

  const observer = new Observer(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      track()
      observer.disconnect()
    },
    { threshold: 0.2 },
  )
  observer.observe(element)
  return () => observer.disconnect()
}
