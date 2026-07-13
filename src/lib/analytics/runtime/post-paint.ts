export function scheduleAfterFirstPaint(
  callback: () => void,
  requestFrame: typeof requestAnimationFrame = window.requestAnimationFrame.bind(window),
  cancelFrame: typeof cancelAnimationFrame = window.cancelAnimationFrame.bind(window),
) {
  let secondFrame = 0
  const firstFrame = requestFrame(() => {
    secondFrame = requestFrame(callback)
  })

  return () => {
    cancelFrame(firstFrame)
    if (secondFrame) cancelFrame(secondFrame)
  }
}
