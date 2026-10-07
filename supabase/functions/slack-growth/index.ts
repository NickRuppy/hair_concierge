import { createSlackGrowthHandler } from "./handler.ts"

Deno.serve(
  createSlackGrowthHandler({
    env: {
      SLACK_GROWTH_WEBHOOK_URL: Deno.env.get("SLACK_GROWTH_WEBHOOK_URL"),
      SLACK_GROWTH_DISPATCH_TOKEN: Deno.env.get("SLACK_GROWTH_DISPATCH_TOKEN"),
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    },
  }),
)
