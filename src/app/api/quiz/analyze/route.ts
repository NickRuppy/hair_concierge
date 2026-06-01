import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Diese Quiz-Analyse wird nicht mehr unterstuetzt." },
    { status: 410 },
  )
}
