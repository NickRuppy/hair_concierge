export async function GET() {
  return new Response("Dieses geteilte Ergebnis wird nicht mehr unterstuetzt.", {
    status: 410,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
