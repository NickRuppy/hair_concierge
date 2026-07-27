export const MODAL_LAYER_PRIORITIES = {
  bottomSheet: 50,
  checkoutOverlay: 110,
  dialog: 120,
} as const

export interface ModalLayerHandle {
  id: string
  isTopLayer: () => boolean
  release: () => void
}

interface ModalLayerRegistration {
  root: HTMLElement
  priority?: number
  onTopLayerChange?: (isTopLayer: boolean) => void
}

interface ModalLayer extends Required<ModalLayerRegistration> {
  id: string
  order: number
  lastTopState: boolean
}

interface BodyLockSnapshot {
  scrollX: number
  scrollY: number
  styles: {
    left: string
    overflow: string
    position: string
    right: string
    top: string
    width: string
  }
}

interface AttributeSnapshot {
  ariaHidden: string | null
  inert: string | null
}

let nextLayerId = 1
let nextOrder = 1
let layers: ModalLayer[] = []
let bodyLockSnapshot: BodyLockSnapshot | null = null
let bodyChildrenObserver: MutationObserver | null = null
const attributeSnapshots = new Map<HTMLElement, AttributeSnapshot>()

function getCurrentTopLayer(): ModalLayer | null {
  if (layers.length === 0) return null

  return layers.reduce((top, layer) => {
    if (layer.priority > top.priority) return layer
    if (layer.priority === top.priority && layer.order > top.order) return layer
    return top
  })
}

function snapshotElementAttributes(element: HTMLElement) {
  if (attributeSnapshots.has(element)) return

  attributeSnapshots.set(element, {
    ariaHidden: element.getAttribute("aria-hidden"),
    inert: element.hasAttribute("inert") ? (element.getAttribute("inert") ?? "") : null,
  })
}

function setElementHidden(element: HTMLElement) {
  snapshotElementAttributes(element)
  element.setAttribute("aria-hidden", "true")
  element.setAttribute("inert", "")
  element.inert = true
}

function setElementInteractive(element: HTMLElement) {
  if (!attributeSnapshots.has(element)) return
  element.removeAttribute("aria-hidden")
  element.removeAttribute("inert")
  element.inert = false
}

function restoreElementAttributes(element: HTMLElement) {
  const snapshot = attributeSnapshots.get(element)
  if (!snapshot) return

  if (snapshot.ariaHidden === null) {
    element.removeAttribute("aria-hidden")
  } else {
    element.setAttribute("aria-hidden", snapshot.ariaHidden)
  }

  if (snapshot.inert === null) {
    element.removeAttribute("inert")
    element.inert = false
  } else {
    element.setAttribute("inert", snapshot.inert)
    element.inert = true
  }

  attributeSnapshots.delete(element)
}

function ensureBodyLocked() {
  if (bodyLockSnapshot || typeof window === "undefined" || typeof document === "undefined") {
    return
  }

  const { body } = document
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  bodyLockSnapshot = {
    scrollX,
    scrollY,
    styles: {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
      width: body.style.width,
    },
  }

  body.style.position = "fixed"
  body.style.top = `-${scrollY}px`
  body.style.left = `-${scrollX}px`
  body.style.right = "0"
  body.style.width = "100%"
  body.style.overflow = "hidden"
}

function releaseBodyLock() {
  if (!bodyLockSnapshot || typeof window === "undefined" || typeof document === "undefined") {
    return
  }

  const snapshot = bodyLockSnapshot
  bodyLockSnapshot = null

  document.body.style.position = snapshot.styles.position
  document.body.style.top = snapshot.styles.top
  document.body.style.left = snapshot.styles.left
  document.body.style.right = snapshot.styles.right
  document.body.style.width = snapshot.styles.width
  document.body.style.overflow = snapshot.styles.overflow

  window.scrollTo(snapshot.scrollX, snapshot.scrollY)
}

function ensureBodyChildrenObserved() {
  if (
    bodyChildrenObserver ||
    typeof document === "undefined" ||
    typeof MutationObserver === "undefined"
  ) {
    return
  }

  bodyChildrenObserver = new MutationObserver(() => {
    if (layers.length > 0) reconcileIsolation()
  })
  bodyChildrenObserver.observe(document.body, { childList: true })
}

function releaseBodyChildrenObserver() {
  bodyChildrenObserver?.disconnect()
  bodyChildrenObserver = null
}

function getBodyChildrenToHide(topRoot: HTMLElement): HTMLElement[] {
  if (typeof document === "undefined") return []

  return Array.from(document.body.children).filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement)) return false
    if (child.hasAttribute("data-modal-layer-exempt")) return false
    return child !== topRoot && !child.contains(topRoot)
  })
}

function reconcileTopLayerState() {
  const topLayer = getCurrentTopLayer()

  for (const layer of layers) {
    const isTopLayer = layer === topLayer
    if (layer.lastTopState === isTopLayer) continue
    layer.lastTopState = isTopLayer
    layer.onTopLayerChange(isTopLayer)
  }
}

function reconcileIsolation() {
  if (layers.length === 0) {
    releaseBodyChildrenObserver()
    for (const element of Array.from(attributeSnapshots.keys())) {
      restoreElementAttributes(element)
    }
    releaseBodyLock()
    return
  }

  ensureBodyLocked()
  ensureBodyChildrenObserved()

  const topLayer = getCurrentTopLayer()
  if (!topLayer) return

  const hiddenElements = new Set<HTMLElement>(getBodyChildrenToHide(topLayer.root))
  for (const layer of layers) {
    if (layer !== topLayer) hiddenElements.add(layer.root)
  }

  for (const element of Array.from(attributeSnapshots.keys())) {
    if (!hiddenElements.has(element)) setElementInteractive(element)
  }

  for (const element of hiddenElements) {
    setElementHidden(element)
  }

  setElementInteractive(topLayer.root)
  reconcileTopLayerState()
}

export function registerModalLayer({
  root,
  priority = MODAL_LAYER_PRIORITIES.bottomSheet,
  onTopLayerChange = () => {},
}: ModalLayerRegistration): ModalLayerHandle {
  const layer: ModalLayer = {
    id: `modal-layer-${nextLayerId++}`,
    root,
    priority,
    onTopLayerChange,
    order: nextOrder++,
    lastTopState: false,
  }

  layers.push(layer)
  reconcileIsolation()

  let released = false

  return {
    id: layer.id,
    isTopLayer: () => getCurrentTopLayer()?.id === layer.id,
    release: () => {
      if (released) return
      released = true
      layers = layers.filter((candidate) => candidate !== layer)
      layer.onTopLayerChange(false)
      reconcileIsolation()
    },
  }
}

export function getModalTabbableElements(container: HTMLElement): HTMLElement[] {
  if (typeof window === "undefined") return []

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => {
    const style = window.getComputedStyle(element)
    return (
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !element.closest('[aria-disabled="true"]') &&
      !element.closest("[inert]") &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    )
  })
}

export function focusModalElement(element: HTMLElement | null) {
  if (!element) return

  try {
    element.focus({ preventScroll: true })
  } catch {
    element.focus()
  }
}

export function resetModalLayerManagerForTests() {
  layers = []
  nextLayerId = 1
  nextOrder = 1
  releaseBodyChildrenObserver()
  for (const element of Array.from(attributeSnapshots.keys())) {
    restoreElementAttributes(element)
  }
  releaseBodyLock()
}
