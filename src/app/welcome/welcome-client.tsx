"use client"

import { Mail } from "lucide-react"

export function WelcomeClient({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-header text-3xl">Zahlung erfolgreich</h1>
        <p className="text-base text-muted-foreground">
          Wir haben dir einen Login-Link an{" "}
          <span className="font-medium text-foreground">{email}</span> gesendet. Bitte öffne deine
          E-Mails, um fortzufahren.
        </p>
        <p className="text-xs text-muted-foreground">
          Keine E-Mail erhalten? Prüfe deinen Spam-Ordner oder warte 1–2 Minuten.
        </p>
      </div>
    </main>
  )
}
