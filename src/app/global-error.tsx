"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111",
          color: "#e5e5e5",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "1rem",
              lineHeight: 1,
            }}
          >
            ⚠
          </div>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              margin: "0 0 0.5rem",
            }}
          >
            Etwas ist schiefgelaufen
          </h2>
          <p
            style={{
              fontSize: "0.95rem",
              color: "#999",
              margin: "0 0 2rem",
            }}
          >
            Ein unerwarteter Fehler ist aufgetreten.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.75rem 2rem",
              fontSize: "0.95rem",
              fontWeight: 500,
              color: "#111",
              backgroundColor: "#e5e5e5",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseOver={(e) =>
              ((e.target as HTMLButtonElement).style.backgroundColor = "#fff")
            }
            onMouseOut={(e) =>
              ((e.target as HTMLButtonElement).style.backgroundColor = "#e5e5e5")
            }
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  )
}
