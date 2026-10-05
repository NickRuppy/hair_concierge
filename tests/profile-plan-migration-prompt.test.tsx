import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

import * as ownership from "../src/lib/personal-plan/profile-plan-ownership"
import * as access from "../src/components/profile/profile-routine-access"
import { Button } from "../src/components/ui/button"

type MigrationStatus = "ineligible" | "candidate" | "pending_source" | "ready"

function resolve(
  hasPersonalPlan: boolean,
  deps: {
    loadUserId: () => Promise<string | null>
    loadMigrationStatus: (userId: string) => Promise<MigrationStatus>
  },
) {
  assert.equal(
    typeof ownership.resolveProfilePlanMigrationAvailable,
    "function",
    "migration availability resolver exists",
  )
  return ownership.resolveProfilePlanMigrationAvailable(hasPersonalPlan, deps)
}

test("plan owners skip both migration dependencies", async () => {
  const calls: string[] = []
  assert.equal(
    await resolve(true, {
      loadUserId: async () => {
        calls.push("user")
        return "user-1"
      },
      loadMigrationStatus: async () => {
        calls.push("migration")
        return "ready"
      },
    }),
    false,
  )
  assert.deepEqual(calls, [])
})

test("no authenticated user means no migration lookup or prompt", async () => {
  let statusCalls = 0
  assert.equal(
    await resolve(false, {
      loadUserId: async () => null,
      loadMigrationStatus: async () => {
        statusCalls++
        return "ready"
      },
    }),
    false,
  )
  assert.equal(statusCalls, 0)
})

for (const [status, expected] of [
  ["ineligible", false],
  ["candidate", true],
  ["pending_source", true],
  ["ready", true],
] as const) {
  test(`migration admission ${status} makes availability ${expected}`, async () => {
    const userIds: string[] = []
    assert.equal(
      await resolve(false, {
        loadUserId: async () => "user-1",
        loadMigrationStatus: async (userId) => {
          userIds.push(userId)
          return status
        },
      }),
      expected,
    )
    assert.deepEqual(userIds, ["user-1"])
  })
}

for (const dependency of ["user", "migration"] as const) {
  test(`a throwing ${dependency} dependency hides the prompt instead of breaking the layout`, async () => {
    assert.equal(
      await resolve(false, {
        loadUserId: async () => {
          if (dependency === "user") throw new Error("user lookup failed")
          return "user-1"
        },
        loadMigrationStatus: async () => {
          throw new Error("migration lookup failed")
        },
      }),
      false,
    )
  })
}

test("the layout loads migration availability after ownership and passes it to the provider", () => {
  const layout = readFileSync("src/app/profile/layout.tsx", "utf8")
  assert.match(
    layout,
    /const planMigrationAvailable = await loadProfilePlanMigrationAvailable\(hasPersonalPlan\)/,
  )
  assert.ok(
    layout.indexOf("const [hasPersonalPlan]") < layout.indexOf("const planMigrationAvailable"),
  )
  assert.match(
    layout,
    /<ProfileRoutineAccessProvider\s[^>]*planMigrationAvailable=\{planMigrationAvailable\}/,
  )
})

test("migration context defaults to false and carries the optional provider fact", () => {
  assert.equal(
    typeof access.useProfilePlanMigrationAvailable,
    "function",
    "migration context hook exists",
  )
  function Probe() {
    return <span>{String(access.useProfilePlanMigrationAvailable())}</span>
  }
  assert.equal(renderToStaticMarkup(<Probe />), "<span>false</span>")
  for (const value of [undefined, false, true]) {
    assert.equal(
      renderToStaticMarkup(
        <access.ProfileRoutineAccessProvider
          hasRoutineAccess={false}
          planMigrationAvailable={value}
        >
          <Probe />
        </access.ProfileRoutineAccessProvider>,
      ),
      `<span>${String(value ?? false)}</span>`,
    )
  }
})

test("the profile page reads migration availability beside plan ownership", () => {
  const page = readFileSync("src/app/profile/page.tsx", "utf8")
  assert.match(
    page,
    /const hasPersonalPlan = useProfileHasPersonalPlan\(\)\s+const planMigrationAvailable = useProfilePlanMigrationAvailable\(\)/,
  )
})

const pageSource = ts.createSourceFile(
  "src/app/profile/page.tsx",
  readFileSync("src/app/profile/page.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)

function findNode(predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined
  function visit(node: ts.Node) {
    if (predicate(node)) found = node
    else ts.forEachChild(node, visit)
  }
  visit(pageSource)
  assert.ok(found, "expected production migration prompt node")
  return found
}

function hasId(node: ts.Node, id: string): boolean {
  return (
    ts.isJsxElement(node) &&
    node.openingElement.attributes.properties.some(
      (attr) =>
        ts.isJsxAttribute(attr) &&
        attr.name.getText() === "id" &&
        attr.initializer !== undefined &&
        ts.isStringLiteral(attr.initializer) &&
        attr.initializer.text === id,
    )
  )
}

// Render the production JSX and local helper, avoiding the full page's auth/fetch effects
// and router mount requirements, as in profile-plan-owner-surfaces.test.tsx.
function surface(hasPersonalPlan: boolean, planMigrationAvailable: boolean) {
  const wrapper = findNode((node) => hasId(node, "profile-plan-migration-prompt"))
  const products = findNode((node) => hasId(node, "profile-section-products"))
  let expression = wrapper.parent
  while (expression.parent && !ts.isJsxExpression(expression)) expression = expression.parent
  assert.ok(ts.isJsxExpression(expression), "the prompt has a conditional wrapper")
  const parent = expression.parent
  assert.ok(ts.isJsxElement(parent))
  const siblings = parent.children.filter((child) => !ts.isJsxText(child) || child.text.trim())
  assert.equal(
    siblings[siblings.indexOf(expression) + 1],
    products,
    "prompt is directly before products",
  )
  const helper = findNode(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "InlinePromptCard",
  )
  const emitted = ts.transpileModule(`${helper.getText()}\nreturn <>${expression.getText()}</>;`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const navigations: string[] = []
  const root = new Function(
    "React",
    "Button",
    "hasPersonalPlan",
    "planMigrationAvailable",
    "router",
    emitted,
  )(React, Button, hasPersonalPlan, planMigrationAvailable, {
    push: (href: string) => navigations.push(href),
  }) as ReactElement
  return { root, html: renderToStaticMarkup(root), navigations }
}

function buttons(node: ReactNode): Array<ReactElement<React.ComponentProps<typeof Button>>> {
  if (!React.isValidElement(node)) return []
  const element = node as ReactElement<{ children?: ReactNode; action?: ReactNode }>
  return [
    ...(node.type === Button ? [node as ReactElement<React.ComponentProps<typeof Button>>] : []),
    ...React.Children.toArray(element.props.children).flatMap(buttons),
    ...React.Children.toArray(element.props.action).flatMap(buttons),
  ]
}

test("an eligible non-owner sees exactly one migration card and its button opens /plan-bereit", () => {
  const { root, html, navigations } = surface(false, true)
  assert.equal((html.match(/id="profile-plan-migration-prompt"/g) ?? []).length, 1)
  assert.match(html, />Dein persönlicher Plan fehlt noch</)
  assert.match(html, />Mit deinem Plan kannst du Styling, Alltag und Produkte hier anpassen\.</)
  assert.match(html, />Plan erstellen</)
  const actions = buttons(root)
  assert.equal(actions.length, 1)
  assert.equal(actions[0].props.children, "Plan erstellen")
  assert.equal(actions[0].props.type, "button")
  assert.equal(actions[0].props.className, "w-auto")
  assert.ok(actions[0].props.variant === undefined || actions[0].props.variant === "default")
  assert.ok(actions[0].props.onClick)
  actions[0].props.onClick({} as React.MouseEvent<HTMLButtonElement>)
  assert.deepEqual(navigations, ["/plan-bereit"])
})

test("plan owners never see the migration card, even when availability is true", () => {
  for (const available of [false, true]) {
    const { root, html } = surface(true, available)
    assert.equal(html, "")
    assert.equal(buttons(root).length, 0)
  }
})

test("non-owners without migration availability see no migration card", () => {
  const { root, html } = surface(false, false)
  assert.equal(html, "")
  assert.equal(buttons(root).length, 0)
})
