import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const authPageSource = readFileSync(new URL("../src/app/auth/page.tsx", import.meta.url), "utf8")
const authFormSource = readFileSync(
  new URL("../src/components/auth/auth-form.tsx", import.meta.url),
  "utf8",
)

test("/auth passes the email query parameter as the AuthForm defaultEmail", () => {
  assert.match(authPageSource, /defaultEmail=\{searchParams\.get\("email"\) \?\? undefined\}/)
})

test("AuthForm initializes the email field from defaultEmail", () => {
  assert.match(authFormSource, /const \[email, setEmail\] = useState\(defaultEmail \?\? ""\)/)
  assert.match(authFormSource, /value=\{email\}/)
})

test("prefilled auth email remains editable", () => {
  assert.match(authFormSource, /onChange=\{\(e\) => setEmail\(e\.target\.value\)\}/)
  assert.doesNotMatch(authFormSource, /readOnly/)
  assert.doesNotMatch(authFormSource, /aria-readonly/)
})

test("magic link sending still requires the explicit button handler", () => {
  assert.match(authFormSource, /async function handleMagicLink/)
  assert.match(authFormSource, /onClick=\{handleMagicLink\}/)
  assert.doesNotMatch(authPageSource, /signInWithOtp/)
  assert.doesNotMatch(authPageSource, /send-magic-link/)
})
