> **Status: PARTIAL** — Post-validation gap remains (hallucination detection). Structured outputs part is optional.

# Workstream 3: Structured Outputs + Post-Validation

> **Standalone implementation spec.** This file contains everything needed to implement WS3 independently.

## Goal

1. For **product recommendation intents** (`product_recommendation`, `routine_help`): Use OpenAI Structured Outputs (`strict: true`) to guarantee schema-valid responses. SSE progress events maintain responsive UX.
2. For **all other intents**: Keep current SSE streaming + add post-validation to catch hallucinated products.
3. Log all validation issues for monitoring.

## Background: Current Synthesis Flow

In `src/lib/rag/synthesizer.ts`:
- `synthesizeResponse()` returns a `ReadableStream<Uint8Array>` for SSE streaming
- Uses `streamChatCompletion()` from `src/lib/openai/chat.ts`
- No structured output — free-form GPT-4o response
- No validation of mentioned products against eligible set

In `src/app/api/chat/route.ts`:
- Wraps pipeline stream in SSE format
- Emits: `conversation_id`, `content_delta`, `product_recommendations`, `sources`, `done`
- Product suppression: if response has `questionCount < 2`, sends products

In `src/hooks/use-chat.ts`:
- Parses SSE events: `conversation_id`, `content_delta`, `product_recommendations`, `sources`, `done`

In `src/lib/types.ts`:
- `ChatSSEEvent` discriminated union type for SSE events

## Database Migration

**File:** `supabase/migrations/20260217000001_create_audit_log.sql`

```sql
CREATE TABLE recommendation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  user_id uuid REFERENCES profiles(id),
  intent_type text,
  synthesis_path text CHECK (synthesis_path IN ('structured', 'streaming')),
  issues jsonb DEFAULT '[]',
  eligible_product_ids text[],
  mentioned_product_names text[],
  response_valid boolean,
  latency_ms integer,
  created_at timestamptz DEFAULT now()
);

-- RLS: admin read-only, service role writes
ALTER TABLE recommendation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_select"
  ON recommendation_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Index for monitoring queries
CREATE INDEX idx_audit_log_valid ON recommendation_audit_log (response_valid, created_at);
CREATE INDEX idx_audit_log_intent ON recommendation_audit_log (intent_type, created_at);
```

## Files to Create

### `src/lib/rag/response-schema.ts`

```typescript
import { z } from 'zod';

// Schema for structured product recommendation responses
// Used with OpenAI Structured Outputs (strict: true)
export const RecommendationResponseSchema = z.object({
  message: z.string().describe(
    "Tom's full natural-language response in German. Include [N] citation markers. " +
    "Write in Tom's voice: direct, warm, knowledgeable."
  ),
  recommended_products: z.array(z.object({
    product_id: z.string().describe("UUID of the product from the provided list"),
    product_name: z.string().describe("Exact product name as provided"),
    reasoning: z.string().describe("Why this product suits this user, in German"),
  })).describe("Products recommended, in the pre-ranked order provided"),
  routine_steps: z.array(z.object({
    order: z.number().describe("Step number, starting from 1"),
    step_name: z.string().describe("Name of the routine step in German"),
    instructions: z.string().describe("How to perform this step, in German"),
    product_id: z.string().optional().describe("Product UUID if a specific product is suggested for this step"),
  })).optional().describe("Routine steps if the user asked for a routine"),
  followup_questions: z.array(
    z.string()
  ).optional().describe("Follow-up questions to ask the user, in German"),
});

export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

// Schema for consultation mode (asking questions before recommending)
export const ConsultationResponseSchema = z.object({
  message: z.string().describe(
    "Tom's response asking clarifying questions. In German, Tom's voice."
  ),
  followup_questions: z.array(
    z.string()
  ).describe("2-3 targeted clarifying questions in German"),
});

export type ConsultationResponse = z.infer<typeof ConsultationResponseSchema>;
```

### `src/lib/rag/post-validator.ts`

```typescript
import type { Product, HairProfile } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validates an LLM response against the eligible product set.
 * Used for both structured and streaming paths.
 */
export function validateResponse(
  fullContent: string,
  eligibleProducts: Product[],
  userProfile: HairProfile,
): ValidationResult {
  const issues: string[] = [];

  // 1. Extract product name mentions from response text
  const mentionedNames = extractProductMentions(fullContent, eligibleProducts);

  // 2. Check each mention exists in eligible set
  const eligibleNameSet = new Set(
    eligibleProducts.map(p => p.name.toLowerCase().trim())
  );

  for (const name of mentionedNames) {
    if (!eligibleNameSet.has(name.toLowerCase().trim())) {
      issues.push(`Hallucinated product: "${name}"`);
    }
  }

  // 3. Check for hair texture contradictions
  if (userProfile.hair_texture) {
    const textureMap: Record<string, string[]> = {
      fein: ['feinem haar', 'feine haare', 'duennes haar'],
      mittel: ['normalem haar', 'mittlerer dicke', 'normales haar'],
      dick: ['dickem haar', 'dicke haare', 'kraeftiges haar'],
    };

    // Check if response mentions wrong texture advice
    const contentLower = fullContent.toLowerCase();
    for (const [texture, phrases] of Object.entries(textureMap)) {
      if (texture !== userProfile.hair_texture) {
        for (const phrase of phrases) {
          if (contentLower.includes(`fuer ${phrase}`) || contentLower.includes(`bei ${phrase}`)) {
            issues.push(`Possible texture mismatch: mentions "${phrase}" but user has ${userProfile.hair_texture}`);
          }
        }
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validates structured output product_ids against eligible set
 */
export function validateStructuredProducts(
  recommendedProductIds: string[],
  eligibleProductIds: string[],
): ValidationResult {
  const issues: string[] = [];
  const eligibleSet = new Set(eligibleProductIds);

  for (const id of recommendedProductIds) {
    if (!eligibleSet.has(id)) {
      issues.push(`Product ID "${id}" not in eligible set`);
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Log validation results to audit table
 */
export async function logAuditEntry(entry: {
  conversationId: string;
  userId: string;
  intentType: string;
  synthesisPath: 'structured' | 'streaming';
  issues: string[];
  eligibleProductIds: string[];
  mentionedProductNames: string[];
  responseValid: boolean;
  latencyMs: number;
}): Promise<void> {
  try {
    await supabaseAdmin.from('recommendation_audit_log').insert({
      conversation_id: entry.conversationId,
      user_id: entry.userId,
      intent_type: entry.intentType,
      synthesis_path: entry.synthesisPath,
      issues: entry.issues,
      eligible_product_ids: entry.eligibleProductIds,
      mentioned_product_names: entry.mentionedProductNames,
      response_valid: entry.responseValid,
      latency_ms: entry.latencyMs,
    });
  } catch (err) {
    console.error('[audit] Failed to log audit entry:', err);
  }
}

// ── Helpers ────────────────────────────────────────────

function extractProductMentions(
  content: string,
  knownProducts: Product[],
): string[] {
  // Match product names from the known catalog
  // Sort by name length descending (longest first) to avoid partial matches
  const sortedNames = knownProducts
    .map(p => p.name)
    .sort((a, b) => b.length - a.length);

  const found: string[] = [];
  const contentLower = content.toLowerCase();

  for (const name of sortedNames) {
    if (contentLower.includes(name.toLowerCase())) {
      found.push(name);
    }
  }

  // Also detect bold product mentions: **Product Name**
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let match;
  while ((match = boldPattern.exec(content)) !== null) {
    const boldText = match[1];
    // Check if this bold text looks like a product name (not in known catalog)
    if (!sortedNames.some(n => n.toLowerCase() === boldText.toLowerCase()) &&
        !found.some(f => f.toLowerCase() === boldText.toLowerCase())) {
      // Potential hallucinated product mentioned in bold
      if (boldText.length > 3 && !['Tom', 'Tipp', 'Hinweis', 'Wichtig'].includes(boldText)) {
        found.push(boldText);
      }
    }
  }

  return [...new Set(found)];
}
```

## Files to Modify

### `src/lib/rag/synthesizer.ts`

Add a new function alongside existing `synthesizeResponse()`:

```typescript
import { zodResponseFormat } from 'openai/helpers/zod';
import { RecommendationResponseSchema, ConsultationResponseSchema } from './response-schema';

// Existing function — kept for streaming intents
export async function synthesizeResponse(params: SynthesizeParams): Promise<ReadableStream<Uint8Array>> {
  // ... existing streaming implementation unchanged ...
}

// NEW: Structured output for product recommendation intents
export async function synthesizeStructuredResponse(
  params: SynthesizeParams
): Promise<RecommendationResponse> {
  const systemPrompt = buildSystemPrompt(params);
  const messages = buildMessageArray(systemPrompt, params);

  // Determine schema based on consultation mode
  const schema = params.consultationMode
    ? zodResponseFormat(ConsultationResponseSchema, 'consultation')
    : zodResponseFormat(RecommendationResponseSchema, 'recommendation');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    response_format: schema,
    temperature: 0,  // Maximize consistency for product recs
  });

  return response.choices[0].message.parsed;
}
```

### `src/lib/rag/pipeline.ts`

Add intent-based routing to choose synthesis path:

```typescript
const STRUCTURED_INTENTS: IntentType[] = ['product_recommendation', 'routine_help'];

// In runPipeline():
if (STRUCTURED_INTENTS.includes(intent)) {
  // Structured path — non-streaming, schema-guaranteed
  const structuredResponse = await synthesizeStructuredResponse({
    /* ... params ... */
  });

  // Return as a synthetic stream that emits the response at once
  return {
    type: 'structured' as const,
    response: structuredResponse,
    // ... other pipeline outputs
  };
} else {
  // Streaming path — existing behavior
  const stream = await synthesizeResponse({
    /* ... params ... */
  });

  return {
    type: 'streaming' as const,
    stream,
    // ... other pipeline outputs
  };
}
```

### `src/app/api/chat/route.ts`

Handle both synthesis paths with progress events:

```typescript
// For structured path:
if (pipelineResult.type === 'structured') {
  // Emit progress events
  const progressSteps = [
    { step: 'understanding_request', delay: 0 },
    { step: 'scoring_catalog', delay: 800 },
    { step: 'finalizing_recommendations', delay: 1600 },
  ];

  for (const { step, delay } of progressSteps) {
    await new Promise(r => setTimeout(r, delay));
    writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'status',
      data: { step },
    })}\n\n`));
  }

  // Emit full content at once
  writer.write(encoder.encode(`data: ${JSON.stringify({
    type: 'content_delta',
    data: pipelineResult.response.message,
  })}\n\n`));

  // Emit products
  if (pipelineResult.response.recommended_products?.length) {
    writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'product_recommendations',
      data: pipelineResult.response.recommended_products,
    })}\n\n`));
  }

  // Done
  writer.write(encoder.encode(`data: ${JSON.stringify({
    type: 'done',
    data: { intent },
  })}\n\n`));
}
```

### `src/hooks/use-chat.ts`

Handle new `status` event type:

```typescript
// In SSE event parser:
case 'status':
  // Update loading state with current step
  updateAssistantMessage(lastMessageId, {
    status: parsed.data.step,  // 'understanding_request' | 'scoring_catalog' | 'finalizing_recommendations'
  });
  break;
```

### `src/components/chat/chat-message.tsx`

Render progress indicators during structured generation:

```typescript
// If message has status but no content yet, show progress indicator
if (message.status && !message.content) {
  const statusLabels: Record<string, string> = {
    understanding_request: 'Analysiere deine Anfrage...',
    scoring_catalog: 'Durchsuche Produktkatalog...',
    finalizing_recommendations: 'Stelle Empfehlungen zusammen...',
  };

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <LoadingSpinner />
      <span>{statusLabels[message.status] ?? 'Einen Moment...'}</span>
    </div>
  );
}
```

### `src/lib/types.ts`

Add new SSE event type:

```typescript
// Add to ChatSSEEvent union:
| { type: 'status'; data: { step: string } }
```

Add status field to Message type (client-side only, not persisted):

```typescript
// In Message or a separate client-side type:
status?: string;  // Transient progress indicator
```

## Verification

### Unit Tests

1. `validateResponse()` catches a hallucinated product name not in eligible set
2. `validateResponse()` passes when all mentioned products are in eligible set
3. `validateStructuredProducts()` catches a product_id not in eligible set
4. `extractProductMentions()` finds products mentioned in bold `**...**` and plain text
5. Structured response schema parses a valid JSON response correctly
6. Schema rejects a response missing required fields

### Integration Tests

1. Send a `product_recommendation` query -> verify response is structured, parses with Zod
2. Send a `general_chat` query -> verify response streams as before
3. Verify SSE stream includes `status` events for product recommendation intents
4. Verify `status` events do NOT appear for non-product intents
5. Verify audit log entry is created after each recommendation

### Client Tests

1. Verify `use-chat.ts` updates message status on `status` events
2. Verify progress indicators render and then disappear when content arrives
3. Verify existing streaming UX is unchanged for advice/chat intents

## Dependencies

- **None** — WS3 can be implemented independently
- Works better with WS1 (smaller eligible set = fewer validation issues) and WS2 (pre-ranked products)
- WS5 (Caching) will cache structured responses for consistency
