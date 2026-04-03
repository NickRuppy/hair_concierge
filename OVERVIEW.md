# Hair Concierge (TomBot) — Architecture Overview

## What It Is

A personalized AI hair care recommendation platform built around **Tom Hannemann** (German hair care expert, 1.5M DACH followers). Users take a diagnostic quiz, complete a post-auth onboarding to build a detailed hair profile, then receive expert product recommendations and hair care advice via a conversational AI chat — all in Tom's voice and methodology.

**Target:** German-speaking hair care enthusiasts. All UI text is in German.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (React 19, TypeScript 5, App Router) |
| Database | Supabase PostgreSQL + pgvector |
| Auth | Supabase Auth (OAuth + email) |
| AI/LLM | OpenAI GPT-4 (chat), GPT-4 Vision (photo analysis), text-embedding-3-large (1536-dim embeddings) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | Zustand |
| Analytics | PostHog |
| E2E Tests | Playwright |
| Deployment | Vercel |

---

## System Architecture

```mermaid
graph TB
    subgraph Client["Client · React 19 + Tailwind v4"]
        direction TB
        Quiz["Quiz Flow<br/>(11 steps, pre-auth)"]
        Auth["Auth Page<br/>(OAuth + Email)"]
        Onboarding["Onboarding<br/>(3 steps, post-auth)"]
        Chat["Chat Interface<br/>(SSE streaming)"]
        Profile["User Profile"]
        Admin["Admin Dashboard"]

        subgraph State["State Management"]
            ZustandStore["Zustand<br/>(quiz store)"]
            AuthProvider["AuthProvider<br/>(user + profile)"]
            UseChatHook["useChat hook<br/>(SSE + messages)"]
        end
    end

    subgraph Server["Next.js API Routes"]
        direction TB
        QuizAPI["POST /api/quiz/lead<br/>POST /api/quiz/analyze"]
        AuthAPI["POST /api/auth/callback"]
        ChatAPI["POST /api/chat<br/>(SSE streaming)"]
        ProductsAPI["GET /api/products"]
        ProfileAPI["POST /api/profile"]
        AdminAPI["/api/admin/*<br/>(CRUD endpoints)"]
        Middleware["Middleware<br/>(session refresh,<br/>route protection)"]
    end

    subgraph RAG["RAG Pipeline · src/lib/rag/"]
        direction TB
        Router["Intent Router<br/>(classify user intent)"]
        Retriever["Hybrid Retriever<br/>(dense + lexical + RRF)"]
        ProductMatcher["Product Matcher<br/>(category-specific)"]
        Synthesizer["Synthesizer<br/>(Tom's voice + citations)"]

        Router --> Retriever
        Retriever --> ProductMatcher
        ProductMatcher --> Synthesizer
    end

    subgraph CategoryLogic["Category Engines"]
        Shampoo["Shampoo<br/>(6 buckets)"]
        Conditioner["Conditioner<br/>(weight/repair)"]
        LeaveIn["Leave-In<br/>(need/styling)"]
        Oil["Oil<br/>(subtype/mode)"]
        Mask["Mask<br/>(concentration)"]
    end

    subgraph Supabase["Supabase · Postgres + pgvector"]
        direction TB
        AuthDB["Auth (users, sessions)"]
        ProfilesDB["profiles<br/>hair_profiles"]
        ProductsDB["products +<br/>category spec tables<br/>(shampoo, conditioner,<br/>leave-in, oil, mask)"]
        ContentDB["content_chunks<br/>(book, courses, QA)<br/>+ 1536-dim embeddings"]
        ChatDB["conversations<br/>messages"]
        LeadsDB["leads<br/>(pre-auth quiz data)"]
        RPCFunctions["RPC Functions<br/>(match_content_chunks,<br/>match_*_products,<br/>lexical search)"]
    end

    subgraph External["External Services"]
        OpenAI["OpenAI API<br/>(GPT-4 chat,<br/>GPT-4 Vision,<br/>text-embedding-3-large)"]
        PostHog["PostHog<br/>(analytics)"]
        Vercel["Vercel<br/>(hosting)"]
    end

    Quiz --> QuizAPI
    Auth --> AuthAPI
    Chat --> ChatAPI
    Profile --> ProfileAPI
    Admin --> AdminAPI

    ChatAPI --> Router

    ProductMatcher --> Shampoo
    ProductMatcher --> Conditioner
    ProductMatcher --> LeaveIn
    ProductMatcher --> Oil
    ProductMatcher --> Mask

    QuizAPI --> LeadsDB
    AuthAPI --> AuthDB
    Retriever --> RPCFunctions
    RPCFunctions --> ContentDB
    RPCFunctions --> ProductsDB
    CategoryLogic --> RPCFunctions
    ChatAPI --> ChatDB
    ProfileAPI --> ProfilesDB
    Middleware --> AuthDB

    Router --> OpenAI
    Synthesizer --> OpenAI
    Retriever --> OpenAI
    Client --> PostHog
```

---

## User Journey

```mermaid
flowchart LR
    A["Landing"] --> B["Quiz<br/>(7 hair questions)"]
    B --> C["Results Card<br/>(shareable)"]
    C --> D["Auth<br/>(signup/login)"]
    D --> E["Onboarding<br/>(goals, profile, routine)"]
    E --> F["Chat<br/>(AI consultation)"]
    F --> G["Product Recs<br/>(with citations)"]
```

### Flow Details

1. **Quiz** (pre-auth) — 7-question hair diagnostic covering texture, thickness, cuticle condition, protein-moisture balance, scalp type, chemical treatments, and goals
2. **Lead capture** — name + email stored in `leads` table
3. **Auth** — Supabase OAuth (Google, etc.) + email signup; lead data linked to new user
4. **Onboarding** (post-auth) — additional profile fields: wash frequency, goals, density, mechanical stress
5. **Chat** — streaming SSE responses, RAG-powered, Tom's personality and methodology

---

## RAG Pipeline

The core intelligence of the app. Each user message flows through this pipeline:

```mermaid
flowchart TD
    Msg["User sends message"] --> Vision{"Has image?"}
    Vision -->|Yes| Analyze["GPT-4 Vision<br/>analyze hair photo"]
    Vision -->|No| Intent
    Analyze --> Intent["Intent Router<br/>(classify intent)"]

    Intent --> Load["Load in parallel:<br/>hair_profile + last 10 messages"]
    Load --> Route["Policy Engine<br/>(select content sources)"]

    Route --> Dense["pgvector<br/>semantic search"]
    Route --> Lexical["BM25<br/>full-text search"]
    Dense --> RRF["RRF Fusion<br/>(k=60)"]
    Lexical --> RRF
    RRF --> Rerank["Cross-encoder<br/>reranking"]

    Rerank --> Match["Category-Specific<br/>Product Matching"]
    Match --> Eligibility["Check eligibility<br/>(per category rules)"]
    Eligibility --> Score["Score & rank<br/>(profile-aware)"]

    Score --> Synth["Synthesize Response<br/>(Tom's voice + citations)"]
    Synth --> Stream["Stream via SSE<br/>to client"]
    Stream --> Save["Save to DB"]
```

### Recommendation Engine (Per Category)

Each of the 5 product categories follows a 3-stage pipeline:

1. **Decision Builder** — checks eligibility, infers derived fields from profile (e.g., `scalp_type` → `shampoo_bucket`)
2. **Product Matcher** — hybrid retrieval: pgvector semantic search + trigram lexical search + metadata filtering via Supabase RPC functions
3. **Reranker** — category-specific scoring rules, returns top results with reasons and usage hints

**Categories:** Shampoo (6 buckets), Conditioner (weight/repair levels), Leave-in (need bucket/styling context), Oil (subtype/use mode), Mask (concentration/dosing)

---

## Data Model

```mermaid
erDiagram
    users ||--o| profiles : has
    users ||--o| hair_profiles : has
    users ||--o{ conversations : owns
    conversations ||--o{ messages : contains
    leads ||--o| users : converts_to

    products ||--o| shampoo_specs : has
    products ||--o| conditioner_specs : has
    products ||--o| leave_in_specs : has
    products ||--o| oil_specs : has
    products ||--o| mask_specs : has

    content_chunks }|--|| knowledge_base : "book, courses, QA"

    hair_profiles {
        uuid user_id
        enum hair_texture
        enum thickness
        enum density
        enum scalp_type
        jsonb concerns
        jsonb goals
    }

    products {
        uuid id
        text name
        text category
        vector embedding_1536
        boolean active
    }

    content_chunks {
        uuid id
        text content
        text source_type
        vector embedding_1536
    }

    messages {
        uuid id
        text role
        text content
        jsonb recommendations
    }
```

---

## Key Directories

```
src/
├── app/                    # Next.js App Router
│   ├── api/chat/           # Chat SSE streaming endpoint
│   ├── api/quiz/           # Quiz analysis + lead capture
│   ├── api/admin/          # Admin CRUD endpoints
│   ├── quiz/               # Quiz UI
│   ├── auth/               # Login/signup
│   ├── onboarding/         # Post-auth profile collection
│   ├── chat/               # Chat interface
│   ├── profile/            # User settings
│   ├── admin/              # Admin dashboard
│   └── result/[leadId]/    # Public shareable result card
│
├── components/
│   ├── ui/                 # shadcn/ui primitives (25+ components)
│   ├── quiz/               # Quiz-specific components (13 files)
│   ├── chat/               # Chat components (9 files)
│   ├── onboarding/         # Onboarding steps (4 files)
│   └── admin/              # Admin panel components
│
├── lib/
│   ├── rag/                # RAG pipeline (21 files) — the brain of the app
│   ├── quiz/               # Quiz state, questions, normalization
│   ├── supabase/           # DB clients (browser, server, admin)
│   ├── openai/             # LLM wrappers (chat, embeddings, vision)
│   ├── vocabulary/         # Centralized German labels (single source of truth)
│   ├── validators/         # Zod schemas
│   └── {shampoo,conditioner,leave-in,oil,mask}/  # Category constants
│
├── hooks/                  # useChat, useHairProfile
├── providers/              # AuthProvider, PostHog, Toast
└── middleware.ts           # Route protection + session refresh

supabase/
└── migrations/             # 35+ SQL migrations (schema, RPC functions, RLS)

data/
└── markdown-cleaned/       # RAG knowledge base (book, courses, products, QA)
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Deterministic product matching** (not pure LLM) | Category-specific rules ensure consistent, explainable recommendations |
| **Hybrid retrieval** (vector + lexical + RRF) | Catches both semantic and keyword matches for better recall |
| **Category-specific spec tables** (not generic JSON) | Type-safe, queryable product attributes per category |
| **Pre-auth quiz → post-auth onboarding** | Low-friction entry; captures lead before requiring signup |
| **SSE streaming** (not WebSockets) | Simpler, works with Vercel edge, progressive response display |
| **German-only UI with centralized vocabulary** | Single source of truth in `src/lib/vocabulary/` |
| **Zustand** (not Redux/Context) | Lightweight, minimal boilerplate for quiz + chat state |

---

## Current Status (March 2026)

**Done:** Quiz, auth, chat with streaming + RAG, product recommendations (5 categories), intent router, admin panel, image analysis, mechanical stress onboarding

**In progress:** Onboarding finalization, shareable diagnosis card (Instagram Story format), routine recommendation design spec

**Planned:** Cross-category routine engine, paywall enforcement, Stripe integration, barcode scanner, seasonal refresh notifications
