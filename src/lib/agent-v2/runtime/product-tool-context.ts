const REFERENTIAL_PRODUCT_FOLLOWUP =
  /\b(?:dann|dazu|daf(?:ue|ü)r|davon|welche(?:s|r)?\s+davon|was\s+passt\s+dazu|passt\s+(?:dann|dazu)|produkt\s+passt|welche(?:s|r)?\s+produkt)\b/i

const DIRECT_NAMED_OBJECT_ASK =
  /\b(?:welche(?:s|r)?|was\s+f(?:ue|ü)r\s+ein(?:e|en)?)\s+(?!davon\b|produkt\b)(?:[\p{L}\p{M}\p{N}-]+)(?:\s+(?!davon\b|w(?:ue|ü)rdest\b|soll(?:te|test)?\b|ist\b|passt\b|nehme(?:n|st)?\b)[\p{L}\p{M}\p{N}-]+){0,3}\s+(?:passt|ist|hilft|eignet|funktioniert)\b/iu

const REFERENTIAL_GROUP_ASK =
  /\bwelche(?:s|r)?\s+(?:von\s+(?:denen|den\s+beiden|diesen|diese[mn]?|ihnen)|der\s+beiden|die\s+beiden|beide|davon)\b/i

const DIRECT_PRODUCT_NEED =
  /\bwelche(?:s|r)?\s+produkt\b.*\b(?:f(?:ue|ü)r|gegen|bei|mit|ohne|als|zu)\b/i

const MAX_RECENT_USER_MESSAGES = 2

type ProductToolContextMessage = {
  role: string
  content: string
}

export function isReferentialProductFollowup(message: string): boolean {
  const latestMessage = message.trim()
  return (
    REFERENTIAL_GROUP_ASK.test(latestMessage) || REFERENTIAL_PRODUCT_FOLLOWUP.test(latestMessage)
  )
}

export function buildAgentV2ProductToolMessage(params: {
  latestMessage: string
  recentMessages: ProductToolContextMessage[]
}): string {
  const latestMessage = params.latestMessage.trim()
  if (latestMessage.length === 0) return params.latestMessage
  if (
    !REFERENTIAL_GROUP_ASK.test(latestMessage) &&
    (DIRECT_NAMED_OBJECT_ASK.test(latestMessage) || DIRECT_PRODUCT_NEED.test(latestMessage))
  ) {
    return params.latestMessage
  }
  if (!isReferentialProductFollowup(latestMessage)) return params.latestMessage

  const recentUserMessages = params.recentMessages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0)
    .slice(-MAX_RECENT_USER_MESSAGES)

  if (recentUserMessages.length === 0) return params.latestMessage

  return [
    "Vorherige Nutzerkontexte:",
    ...recentUserMessages.map((content) => `- ${content}`),
    "Aktuelle Nutzerfrage:",
    latestMessage,
  ].join("\n")
}
