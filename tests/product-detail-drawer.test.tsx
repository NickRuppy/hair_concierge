import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import {
  ProductRoutineActionButton,
  type ProductDetailRoutineAction,
} from "@/components/chat/product-detail-drawer"

type ClientStateHarness = {
  render: () => ReactElement | null
}

type ReactDispatcherInternals = {
  H: unknown
}

type ButtonElementProps = {
  children?: ReactNode
  disabled?: boolean
  onClick?: () => Promise<void> | void
}

type ButtonElement = ReactElement<ButtonElementProps>

function createClientStateHarness(renderComponent: () => ReactElement | null): ClientStateHarness {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const stateValues: unknown[] = []
  let cursor = 0

  const dispatcher = {
    useState<T>(initialState: T | (() => T)): [T, (nextState: T | ((previous: T) => T)) => void] {
      const stateIndex = cursor
      cursor += 1

      if (stateValues.length <= stateIndex) {
        stateValues[stateIndex] =
          typeof initialState === "function" ? (initialState as () => T)() : initialState
      }

      return [
        stateValues[stateIndex] as T,
        (nextState) => {
          stateValues[stateIndex] =
            typeof nextState === "function"
              ? (nextState as (previous: T) => T)(stateValues[stateIndex] as T)
              : nextState
        },
      ]
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const stateIndex = cursor
      cursor += 1
      const previousDeps = stateValues[stateIndex] as unknown[] | undefined
      const changed =
        !deps ||
        !previousDeps ||
        deps.length !== previousDeps.length ||
        deps.some((dep, index) => dep !== previousDeps[index])

      stateValues[stateIndex] = deps
      if (changed) effect()
    },
  }

  return {
    render() {
      cursor = 0
      reactInternals.H = dispatcher
      try {
        return renderComponent()
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
  }
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (!React.isValidElement(node)) return ""

  const element = node as ReactElement<{ children?: ReactNode }>

  return React.Children.toArray(element.props.children)
    .map((child) => textContent(child))
    .join("")
}

function findButtons(node: ReactNode): ButtonElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as ReactElement<{ children?: ReactNode } & Partial<ButtonElementProps>>

  return [
    element.type === "button" ? (element as ButtonElement) : null,
    ...React.Children.toArray(element.props.children).flatMap((child) => findButtons(child)),
  ].filter((button): button is ButtonElement => Boolean(button))
}

function createRoutineAction(
  overrides: Partial<ProductDetailRoutineAction> = {},
): ProductDetailRoutineAction {
  return {
    category: "leave_in",
    productId: "product-1",
    ...overrides,
  }
}

test("product routine action posts an add payload for an empty category", async () => {
  const requests: Array<{ url: string; body: unknown }> = []
  const previousFetch = globalThis.fetch
  let changed = false

  globalThis.fetch = (async (url, init) => {
    requests.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    })

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }) as typeof fetch

  try {
    const harness = createClientStateHarness(
      () =>
        ProductRoutineActionButton({
          routineAction: createRoutineAction({
            onChanged: () => {
              changed = true
            },
          }),
        }) as ReactElement,
    )

    const addButton = findButtons(harness.render()).find((button) => textContent(button) === "+")
    assert.ok(addButton)
    assert.equal(addButton.props.disabled, false)
    assert.ok(addButton.props.onClick)

    await addButton.props.onClick()

    assert.deepEqual(requests, [
      {
        url: "/api/routine/products",
        body: {
          category: "leave_in",
          productId: "product-1",
        },
      },
    ])
    assert.equal(changed, true)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test("product routine action asks before replacing an occupied category", async () => {
  const requests: Array<{ url: string; body: unknown }> = []
  const previousFetch = globalThis.fetch

  globalThis.fetch = (async (url, init) => {
    requests.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    })

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }) as typeof fetch

  try {
    const harness = createClientStateHarness(
      () =>
        ProductRoutineActionButton({
          routineAction: createRoutineAction({ existingUsageId: "usage-1" }),
        }) as ReactElement,
    )

    const firstButton = findButtons(harness.render()).find((button) => textContent(button) === "+")
    assert.ok(firstButton)
    assert.ok(firstButton.props.onClick)

    await firstButton.props.onClick()
    assert.deepEqual(requests, [])

    const confirmButton = findButtons(harness.render()).find((button) =>
      textContent(button).includes("Ersetzen"),
    )
    assert.ok(confirmButton)
    assert.ok(confirmButton.props.onClick)

    await confirmButton.props.onClick()

    assert.deepEqual(requests, [
      {
        url: "/api/routine/products",
        body: {
          category: "leave_in",
          productId: "product-1",
          replaceUsageId: "usage-1",
          confirmReplace: true,
        },
      },
    ])
  } finally {
    globalThis.fetch = previousFetch
  }
})

test("product routine action turns an occupied-category response into replace confirmation", async () => {
  const requests: Array<{ url: string; body: unknown }> = []
  const previousFetch = globalThis.fetch

  globalThis.fetch = (async (url, init) => {
    requests.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    })

    if (requests.length === 1) {
      return new Response(JSON.stringify({ existingUsageId: "usage-from-api" }), { status: 409 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }) as typeof fetch

  try {
    const harness = createClientStateHarness(
      () =>
        ProductRoutineActionButton({
          routineAction: createRoutineAction(),
        }) as ReactElement,
    )

    const firstButton = findButtons(harness.render()).find((button) => textContent(button) === "+")
    assert.ok(firstButton)
    assert.ok(firstButton.props.onClick)

    await firstButton.props.onClick()

    const confirmButton = findButtons(harness.render()).find((button) =>
      textContent(button).includes("Ersetzen"),
    )
    assert.ok(confirmButton)
    assert.ok(confirmButton.props.onClick)

    await confirmButton.props.onClick()

    assert.deepEqual(requests, [
      {
        url: "/api/routine/products",
        body: {
          category: "leave_in",
          productId: "product-1",
        },
      },
      {
        url: "/api/routine/products",
        body: {
          category: "leave_in",
          productId: "product-1",
          replaceUsageId: "usage-from-api",
          confirmReplace: true,
        },
      },
    ])
  } finally {
    globalThis.fetch = previousFetch
  }
})

test("product routine action renders owned state when product is already in routine", () => {
  const harness = createClientStateHarness(
    () =>
      ProductRoutineActionButton({
        routineAction: createRoutineAction({ alreadyInRoutine: true }),
      }) as ReactElement,
  )

  const button = findButtons(harness.render()).find((candidate) =>
    textContent(candidate).includes("Drin"),
  )
  assert.ok(button)
  assert.equal(button.props.disabled, true)
})
