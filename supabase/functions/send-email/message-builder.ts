export type EmailActionType = "signup" | "magiclink" | "recovery" | "email_change"

export type SupabaseAuthUser = {
  id: string
  email?: string
  new_email?: string
}

export type SupabaseEmailData = {
  token?: string
  token_hash?: string
  redirect_to?: string
  email_action_type?: string
  site_url?: string
  token_new?: string
  token_hash_new?: string
  old_email?: string
  old_phone?: string
  provider?: string
  factor_type?: string
}

export type SendEmailHookPayload = {
  user: SupabaseAuthUser
  email_data: SupabaseEmailData
}

export type CustomerIoTransactionalEmail = {
  to: string
  transactional_message_id: string
  identifiers: {
    email: string
  }
  message_data: Record<string, string>
  disable_message_retention: boolean
  send_to_unsubscribed: boolean
}

type BuildOptions = {
  siteUrl: string
}

function authConfirmUrl(
  siteUrl: string,
  tokenHash: string,
  type: "email" | "magiclink" | "recovery" | "email_change",
  params: Record<string, string>,
) {
  const url = new URL("/auth/confirm", siteUrl)
  url.searchParams.set("token_hash", tokenHash)
  url.searchParams.set("type", type)

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }

  return url.toString()
}

function baseMessageData(
  user: SupabaseAuthUser,
  emailData: SupabaseEmailData,
  confirmationUrl: string,
  recipientEmail: string,
  token: string,
  tokenHash: string,
) {
  return {
    user_id: user.id,
    email: recipientEmail,
    new_email: user.new_email ?? "",
    token,
    token_hash: tokenHash,
    token_new: emailData.token_new ?? "",
    token_hash_new: emailData.token_hash_new ?? "",
    redirect_to: emailData.redirect_to ?? "",
    site_url: emailData.site_url ?? "",
    email_action_type: emailData.email_action_type ?? "",
    old_email: emailData.old_email ?? "",
    old_phone: emailData.old_phone ?? "",
    provider: emailData.provider ?? "",
    factor_type: emailData.factor_type ?? "",
    confirmation_url: confirmationUrl,
    action_url: confirmationUrl,
    magic_link_url: confirmationUrl,
    reset_url: confirmationUrl,
  }
}

function customerIoEmail(
  payload: SendEmailHookPayload,
  recipientEmail: string,
  transactionalMessageId: string,
  confirmationUrl: string,
  token: string,
  tokenHash: string,
): CustomerIoTransactionalEmail {
  return {
    to: recipientEmail,
    transactional_message_id: transactionalMessageId,
    identifiers: { email: recipientEmail },
    message_data: baseMessageData(
      payload.user,
      payload.email_data,
      confirmationUrl,
      recipientEmail,
      token,
      tokenHash,
    ),
    disable_message_retention: true,
    send_to_unsubscribed: true,
  }
}

function requireEmail(value: string | undefined, label: string) {
  if (!value) throw new Error(`Missing ${label} email for auth email hook`)
  return value
}

function requireTokenHash(value: string | undefined, label: string) {
  if (!value) throw new Error(`Missing ${label} token hash for auth email hook`)
  return value
}

export function buildCustomerIoEmails(
  payload: SendEmailHookPayload,
  options: BuildOptions,
): CustomerIoTransactionalEmail[] {
  const { user, email_data: emailData } = payload
  const actionType = emailData.email_action_type as EmailActionType | undefined
  const userEmail = requireEmail(user.email, "user")
  const redirectTo = emailData.redirect_to ?? ""

  if (actionType === "signup") {
    const tokenHash = requireTokenHash(emailData.token_hash, "signup")
    const confirmationUrl = authConfirmUrl(options.siteUrl, tokenHash, "email", {
      next: redirectTo,
    })
    return [
      customerIoEmail(
        payload,
        userEmail,
        "email_confirmation",
        confirmationUrl,
        emailData.token ?? "",
        tokenHash,
      ),
    ]
  }

  if (actionType === "magiclink") {
    const tokenHash = requireTokenHash(emailData.token_hash, "magic link")
    const confirmationUrl = authConfirmUrl(options.siteUrl, tokenHash, "magiclink", {
      redirect_to: redirectTo,
    })
    return [
      customerIoEmail(
        payload,
        userEmail,
        "magic_link",
        confirmationUrl,
        emailData.token ?? "",
        tokenHash,
      ),
    ]
  }

  if (actionType === "recovery") {
    const tokenHash = requireTokenHash(emailData.token_hash, "password reset")
    const confirmationUrl = authConfirmUrl(options.siteUrl, tokenHash, "recovery", {
      next: "/auth/update-password",
    })
    return [
      customerIoEmail(
        payload,
        userEmail,
        "password_reset",
        confirmationUrl,
        emailData.token ?? "",
        tokenHash,
      ),
    ]
  }

  if (actionType === "email_change") {
    const emails: CustomerIoTransactionalEmail[] = []

    if (emailData.token && emailData.token_hash_new) {
      const confirmationUrl = authConfirmUrl(
        options.siteUrl,
        emailData.token_hash_new,
        "email_change",
        {
          next: redirectTo,
        },
      )
      emails.push(
        customerIoEmail(
          payload,
          userEmail,
          "email_change_current",
          confirmationUrl,
          emailData.token,
          emailData.token_hash_new,
        ),
      )
    }

    if (user.new_email && emailData.token_new && emailData.token_hash) {
      const confirmationUrl = authConfirmUrl(
        options.siteUrl,
        emailData.token_hash,
        "email_change",
        {
          next: redirectTo,
        },
      )
      emails.push(
        customerIoEmail(
          payload,
          user.new_email,
          "email_change_new",
          confirmationUrl,
          emailData.token_new,
          emailData.token_hash,
        ),
      )
    }

    if (emails.length === 0) {
      throw new Error("Missing email change token data for auth email hook")
    }

    return emails
  }

  throw new Error(`Unsupported auth email action type: ${emailData.email_action_type ?? "unknown"}`)
}
