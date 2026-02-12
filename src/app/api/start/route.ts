import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  // Get today's quote (or random active quote)
  const today = new Date().toISOString().split("T")[0]
  let { data: quote } = await supabase
    .from("daily_quotes")
    .select("*")
    .eq("display_date", today)
    .eq("is_active", true)
    .single()

  if (!quote) {
    // Fallback: random active quote
    const { data: quotes } = await supabase
      .from("daily_quotes")
      .select("*")
      .eq("is_active", true)
      .limit(10)

    if (quotes && quotes.length > 0) {
      quote = quotes[Math.floor(Math.random() * quotes.length)]
    }
  }

  // Get user's hair profile for product matching
  const { data: hairProfile } = await supabase
    .from("hair_profiles")
    .select("hair_type, concerns")
    .eq("user_id", user.id)
    .single()

  // Get recommended products based on user profile
  let productsQuery = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(10)

  if (hairProfile?.hair_type) {
    productsQuery = productsQuery.contains("suitable_hair_types", [
      hairProfile.hair_type,
    ])
  }

  const { data: products } = await productsQuery

  // If not enough matched products, fill with any active products
  let recommendedProducts = products || []
  if (recommendedProducts.length < 4) {
    const { data: fallbackProducts } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(10)
    recommendedProducts = fallbackProducts || []
  }

  // Get published articles
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, slug, excerpt, cover_image_url, category, published_at")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .limit(6)

  return NextResponse.json({
    quote,
    products: recommendedProducts,
    articles: articles || [],
  })
}
