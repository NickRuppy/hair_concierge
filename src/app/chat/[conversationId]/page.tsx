"use client"

import { ChatContainer } from "@/components/chat/chat-container"
import { Header } from "@/components/layout/header"
import { useParams } from "next/navigation"

export default function ConversationPage() {
  const params = useParams<{ conversationId?: string | string[] }>()
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId

  return (
    <>
      <Header />
      <ChatContainer conversationId={conversationId ?? null} />
    </>
  )
}
