> **Status: BACKLOG** — Product feedback (likes/dislikes) not built. Valuable for personalization when ready.

# Workstream 4: Enhanced Profile Injection

> **Standalone implementation spec.** This file contains everything needed to implement WS4 independently.

## Goal

Dramatically improve personalization by:
1. Tracking product feedback (likes/dislikes) across sessions
2. Extracting preference patterns from conversations
3. Injecting richer profile data into the system prompt
4. Providing explicit product feedback UI in chat

## Background: Current Personalization

### What exists:
- `hair_profiles` table stores: hair_type, hair_texture, concerns, goals, wash_frequency, heat_styling, styling_tools, cuticle_condition, protein_moisture_balance, scalp_type, chemical_treatment
- `conversation_memory` field (max 2000 chars) — extracted by `memory-extractor.ts` after 3+ user messages
- Memory extraction prompt focuses on: product experiences, allergies, health factors, lifestyle, preferences, hair history, ingredient reactions
- Profile is formatted by `formatUserProfile()` in `synthesizer.ts` and injected into system prompt

### What's missing:
- No structured product like/dislike tracking
- No preference pattern extraction ("prefers natural products", "dislikes heavy silicones")
- No explicit feedback UI for product recommendations
- Memory extraction doesn't output structured product sentiment
- No API endpoint for product feedback

## Database Migration

**File:** `supabase/migrations/20260217000002_add_profile_preferences.sql`

```sql
-- Product preference tracking
ALTER TABLE hair_profiles
  ADD COLUMN IF NOT EXISTS liked_products text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS disliked_products text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_feedback jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS preference_summary text;

-- Note: product_feedback stores detailed history:
-- [{ "product_id": "uuid", "product_name": "Name", "sentiment": "positive|negative|neutral",
--    "note": "optional user note", "source": "explicit|implicit", "created_at": "iso8601" }]

-- Verify conversations.memory_extracted_at_count exists
-- (may already exist from initial migration — this is idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'memory_extracted_at_count'
  ) THEN
    ALTER TABLE conversations ADD COLUMN memory_extracted_at_count integer DEFAULT 0;
  END IF;
END $$;

-- Index for feedback queries
CREATE INDEX IF NOT EXISTS idx_hair_profiles_liked ON hair_profiles USING gin (liked_products);
CREATE INDEX IF NOT EXISTS idx_hair_profiles_disliked ON hair_profiles USING gin (disliked_products);
```

## Files to Create

### `src/app/api/feedback/route.ts`

New API endpoint for explicit product feedback:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

const feedbackSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  note: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { product_id, product_name, sentiment, note } = parsed.data;

  // 1. Fetch current profile
  const { data: profile } = await supabaseAdmin
    .from('hair_profiles')
    .select('liked_products, disliked_products, product_feedback')
    .eq('user_id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // 2. Update liked/disliked arrays
  const liked = new Set(profile.liked_products ?? []);
  const disliked = new Set(profile.disliked_products ?? []);

  if (sentiment === 'positive') {
    liked.add(product_name);
    disliked.delete(product_name);
  } else if (sentiment === 'negative') {
    disliked.add(product_name);
    liked.delete(product_name);
  } else {
    liked.delete(product_name);
    disliked.delete(product_name);
  }

  // 3. Append to feedback history
  const feedback = [...(profile.product_feedback as any[] ?? [])];
  feedback.push({
    product_id,
    product_name,
    sentiment,
    note: note ?? null,
    source: 'explicit',
    created_at: new Date().toISOString(),
  });

  // Keep last 50 feedback entries
  const trimmedFeedback = feedback.slice(-50);

  // 4. Update profile
  const { error } = await supabaseAdmin
    .from('hair_profiles')
    .update({
      liked_products: [...liked],
      disliked_products: [...disliked],
      product_feedback: trimmedFeedback,
    })
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  return NextResponse.json({ success: true });
}
```

## Files to Modify

### `src/lib/types.ts`

Update HairProfile interface:

```typescript
interface HairProfile {
  // ... existing fields ...
  liked_products: string[] | null;
  disliked_products: string[] | null;
  product_feedback: Array<{
    product_id: string;
    product_name: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    note: string | null;
    source: 'explicit' | 'implicit';
    created_at: string;
  }> | null;
  preference_summary: string | null;
}
```

### `src/lib/rag/synthesizer.ts`

Update `formatUserProfile()`:

```typescript
function formatUserProfile(profile: HairProfile, consultationMode: boolean): string {
  let text = `## Nutzerprofil\n`;

  // ... existing fields (hair_type, hair_texture, concerns, etc.) ...

  // NEW: Product preferences
  if (profile.liked_products?.length) {
    text += `\n### Gemochte Produkte\n`;
    text += profile.liked_products.join(', ');
    text += '\n(Diese Produkte bevorzugt empfehlen, wenn passend)';
  }

  if (profile.disliked_products?.length) {
    text += `\n### Nicht gemochte Produkte\n`;
    text += profile.disliked_products.join(', ');
    text += '\n(Diese Produkte NICHT empfehlen!)';
  }

  // NEW: Extracted preference patterns
  if (profile.preference_summary) {
    text += `\n### Praeferenzen und Vorlieben\n`;
    text += profile.preference_summary;
  }

  // Existing: conversation memory
  if (profile.conversation_memory) {
    text += `\n### Bekannte Details aus Gespraechen\n`;
    text += profile.conversation_memory;
  }

  // Consultation mode instruction
  if (consultationMode) {
    text += '\n\n**WICHTIG:** Stelle zuerst 2-3 gezielte Rueckfragen, bevor du konkrete Produkte empfiehlst.';
  }

  return text;
}
```

### `src/lib/rag/memory-extractor.ts`

Update `MEMORY_EXTRACTION_PROMPT` to also extract product sentiment and preferences:

```typescript
const MEMORY_EXTRACTION_PROMPT = `Du bist ein Assistent, der aus Gespraechen zwischen einem Nutzer und einem Haarexperten
dauerhafte, persoenliche Fakten extrahiert.

Extrahiere NUR:
1. Produkterfahrungen (positiv/negativ/neutral) — z.B. "Olaplex hat gut funktioniert", "XY Shampoo war zu schwer"
2. Allergien oder Unvertraeglichkeiten
3. Gesundheitliche Faktoren (Medikamente, Hormone, Schilddruese)
4. Lebensstilfaktoren (Sport, Schwimmen, Sauna)
5. Produktvorlieben und -abneigungen — z.B. "mag natuerliche Produkte", "will keine Silikone"
6. Haargeschichte (fruehe Faerbungen, Schaeden)
7. Inhaltsstoffreaktionen

Ignoriere: Smalltalk, Toms Empfehlungen (nur Nutzerfeedback zaehlt), einmalige Fragen

FORMAT:
Gib die Fakten als Stichpunkte zurueck.
Fuer Produkterfahrungen, markiere das Sentiment: [+] positiv, [-] negativ, [~] neutral
Beispiel:
- [+] Olaplex No.3: "Haare fuehlen sich kraeftiger an"
- [-] XY Shampoo: "Zu schwer, beschwert die Haare"
- Praeferenz: Bevorzugt leichte, natuerliche Produkte
- Allergie: Reagiert auf Duftstoffe

Bestehende Erinnerungen (nicht loeschen, nur ergaenzen):
{existingMemory}

Neues Gespraech:
{transcript}`;
```

Add a new function to extract structured product feedback:

```typescript
export async function extractProductFeedback(
  conversationId: string,
  userId: string,
): Promise<void> {
  // ... existing message loading logic ...

  // After extracting memory text, also parse for product sentiment markers
  const sentimentPattern = /\[([+\-~])\]\s*([^:]+):\s*"?([^"]+)"?/g;
  const feedbackEntries: Array<{
    product_name: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    note: string;
  }> = [];

  let match;
  while ((match = sentimentPattern.exec(extractedMemory)) !== null) {
    const [, marker, productName, note] = match;
    feedbackEntries.push({
      product_name: productName.trim(),
      sentiment: marker === '+' ? 'positive' : marker === '-' ? 'negative' : 'neutral',
      note: note.trim(),
    });
  }

  // Update hair_profiles with implicit feedback
  if (feedbackEntries.length > 0) {
    const { data: profile } = await supabaseAdmin
      .from('hair_profiles')
      .select('liked_products, disliked_products, product_feedback')
      .eq('user_id', userId)
      .single();

    if (profile) {
      const liked = new Set(profile.liked_products ?? []);
      const disliked = new Set(profile.disliked_products ?? []);
      const feedback = [...(profile.product_feedback as any[] ?? [])];

      for (const entry of feedbackEntries) {
        if (entry.sentiment === 'positive') liked.add(entry.product_name);
        if (entry.sentiment === 'negative') disliked.add(entry.product_name);

        feedback.push({
          product_name: entry.product_name,
          sentiment: entry.sentiment,
          note: entry.note,
          source: 'implicit',
          created_at: new Date().toISOString(),
        });
      }

      await supabaseAdmin
        .from('hair_profiles')
        .update({
          liked_products: [...liked],
          disliked_products: [...disliked],
          product_feedback: feedback.slice(-50),
        })
        .eq('user_id', userId);
    }
  }
}
```

### `src/lib/rag/pipeline.ts`

Load preference data and pass to scorer:

```typescript
// In runPipeline(), when loading hair profile:
// The profile now includes liked_products, disliked_products, product_feedback, preference_summary
// These are automatically available via the existing profile query

// Pass to scorer (if WS2 is implemented):
// The scorer reads profile.liked_products and profile.disliked_products
```

### `src/components/chat/chat-message.tsx`

Add feedback buttons to product recommendation cards:

```typescript
// In the product recommendation rendering section:
function ProductFeedbackButtons({ product, onFeedback }: {
  product: Product;
  onFeedback: (sentiment: 'positive' | 'negative') => void;
}) {
  return (
    <div className="flex gap-1 mt-1">
      <button
        onClick={() => onFeedback('positive')}
        className="text-xs text-muted-foreground hover:text-green-600"
        title="Gutes Produkt fuer mich"
      >
        <ThumbsUp size={14} />
      </button>
      <button
        onClick={() => onFeedback('negative')}
        className="text-xs text-muted-foreground hover:text-red-600"
        title="Passt nicht fuer mich"
      >
        <ThumbsDown size={14} />
      </button>
    </div>
  );
}

// Wire up the feedback handler:
async function handleProductFeedback(product: Product, sentiment: 'positive' | 'negative') {
  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: product.id,
      product_name: product.name,
      sentiment,
    }),
  });
}
```

## Preference Summary Generation

Add a background job (called after memory extraction) that summarizes feedback patterns:

```typescript
// In memory-extractor.ts, after extracting product feedback:

async function updatePreferenceSummary(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from('hair_profiles')
    .select('product_feedback, preference_summary')
    .eq('user_id', userId)
    .single();

  if (!profile?.product_feedback?.length) return;

  const feedback = profile.product_feedback as any[];
  if (feedback.length < 3) return;  // Need enough data points

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `Analysiere das folgende Produktfeedback eines Nutzers und extrahiere 2-4 Praeferenzmuster.
Formuliere kurze Stichpunkte auf Deutsch.

Feedback:
${feedback.map(f => `${f.sentiment === 'positive' ? '+' : f.sentiment === 'negative' ? '-' : '~'} ${f.product_name}: ${f.note ?? 'kein Kommentar'}`).join('\n')}

Beispiele fuer Praeferenzmuster:
- Bevorzugt leichte, nicht beschwerend Produkte
- Reagiert empfindlich auf starke Duftstoffe
- Mag Naturkosmetik und natuerliche Inhaltsstoffe

Praeferenzmuster:`,
    }],
    max_tokens: 200,
  });

  const summary = response.choices[0]?.message?.content?.trim();
  if (summary) {
    await supabaseAdmin
      .from('hair_profiles')
      .update({ preference_summary: summary })
      .eq('user_id', userId);
  }
}
```

## Verification

### Unit Tests

1. `formatUserProfile()` includes liked products when present
2. `formatUserProfile()` includes disliked products with warning text
3. `formatUserProfile()` includes preference summary when present
4. Feedback API rejects invalid input (missing product_id, invalid sentiment)
5. Feedback API correctly adds to liked set and removes from disliked set when sentiment=positive
6. Memory extraction correctly parses `[+]` and `[-]` sentiment markers

### Integration Tests

1. POST to `/api/feedback` with `{ sentiment: "negative", product_name: "Olaplex No.3" }`
2. Verify `disliked_products` now contains "Olaplex No.3"
3. Send a product recommendation chat message
4. Verify system prompt contains "Nicht gemochte Produkte: Olaplex No.3"
5. Verify Olaplex is ranked lower (if WS2) or excluded (if WS1 has a dislike rule)

### End-to-End

1. Start chat, receive product recommendation with feedback buttons
2. Click thumbs-down on a product
3. In next message, ask for recommendations again
4. Verify the disliked product does not appear

## Dependencies

- **None** — WS4 is fully independent
- WS2 (Scoring) uses `liked_products`/`disliked_products` for ranking when available
- WS1 (Rule Engine) could add a "never recommend disliked products" rule
