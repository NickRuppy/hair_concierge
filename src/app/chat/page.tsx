import { ChatContainer } from "@/components/chat/chat-container"
import { GatedChatExample } from "@/components/gated-preview/gated-chat-example"
import { shouldRenderGatedExample } from "@/lib/gated-preview/gate"

export const dynamic = "force-dynamic"

export default async function ChatPage() {
  // T12 (freemium-scanner-first PR3): the free tier gets the framed „Beispiel" chat — a
  // scripted, capability-true transcript — instead of a live `useChat` session it is not
  // entitled to. Premium and flag-off render exactly today's page: the same
  // `<ChatContainer />`, now handed down from a server component so the tier can be
  // derived server-side (`shouldRenderGatedExample` fails closed to premium).
  //
  // Pre-boundary fix wave (F2): unlike `/routine` and `/anwendung`, this page has no
  // server-side data load of its own to run the tier check alongside — `ChatContainer` is
  // a client component that fetches its conversation list itself, client-side, so there is
  // nothing here to `Promise.all` the tier check against. The tier check's cost
  // (`auth.getUser()` + the paid-access composite) is therefore the page's entire added
  // server-side latency; `ChatLayout` (`src/app/chat/layout.tsx`) already awaits its own
  // navigation-access read before rendering `{children}`, so this is additive to a
  // pre-existing sequential cost rather than a new one this task introduced. No
  // restructuring closes this one — noted as a deliberate, unavoidable tradeoff of gating
  // server-side at all.
  //
  // Pre-boundary fix wave (F3): the suspected bundle bloat did NOT reproduce. Verified with
  // two full production builds plus a live browser network capture on this exact route: a
  // static import (this one) and both a plain `await import()` and a `next/dynamic()`
  // wrapper inside the guard all shipped the byte-identical 30 chunks (~682 KB) for a
  // premium `/chat` load. The client-reference manifest explains why — `GatedPreview`'s
  // (and therefore `PremiumSheet`'s) chunk set is IDENTICAL to `ChatContainer`'s own, i.e.
  // that code already ships on this route via a chunk shared for unrelated reasons, so
  // gating the import moves nothing. Kept static rather than adding an import boundary
  // (and its small SSR/loading-state risk) for a saving that does not exist.
  if (await shouldRenderGatedExample()) return <GatedChatExample />

  return <ChatContainer />
}
