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
  if (await shouldRenderGatedExample()) return <GatedChatExample />

  return <ChatContainer />
}
