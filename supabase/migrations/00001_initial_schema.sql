-- =============================================================================
-- Hair Concierge - Initial Schema Migration
-- German-language hair care concierge application
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- subscription_tiers (created first because profiles references it)
CREATE TABLE subscription_tiers (
    id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          text        NOT NULL,
    slug          text        UNIQUE NOT NULL,
    monthly_message_limit integer DEFAULT 50,
    can_upload_photos     boolean DEFAULT true,
    can_access_history    boolean DEFAULT true,
    max_conversations     integer DEFAULT 20,
    price_eur_monthly     numeric(10, 2),
    price_eur_yearly      numeric(10, 2),
    is_active             boolean DEFAULT true,
    features              jsonb   DEFAULT '{}',
    created_at            timestamptz DEFAULT now()
);

-- profiles (extends auth.users, auto-created via trigger)
CREATE TABLE profiles (
    id                      uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email                   text,
    full_name               text,
    avatar_url              text,
    is_admin                boolean     DEFAULT false,
    onboarding_completed    boolean     DEFAULT false,
    onboarding_step         integer     DEFAULT 1,
    locale                  text        DEFAULT 'de',
    subscription_tier_id    uuid        REFERENCES subscription_tiers (id) ON DELETE SET NULL,
    message_count_this_month integer    DEFAULT 0,
    message_count_reset_at  timestamptz,
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

-- hair_profiles (1:1 with profiles)
CREATE TABLE hair_profiles (
    id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          uuid        UNIQUE NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    hair_type        text        CHECK (hair_type IN ('glatt', 'wellig', 'lockig', 'kraus')),
    hair_texture     text        CHECK (hair_texture IN ('fein', 'mittel', 'dick')),
    concerns         text[]      DEFAULT '{}',
    products_used    text,
    wash_frequency   text,
    heat_styling     text,
    styling_tools    text[]      DEFAULT '{}',
    goals            text[]      DEFAULT '{}',
    additional_notes text,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

-- products (product catalog)
CREATE TABLE products (
    id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                 text        NOT NULL,
    brand                text,
    description          text,
    category             text,
    affiliate_link       text,
    image_url            text,
    price_eur            numeric(10, 2),
    currency             text        DEFAULT 'EUR',
    tags                 text[]      DEFAULT '{}',
    suitable_hair_types  text[]      DEFAULT '{}',
    suitable_concerns    text[]      DEFAULT '{}',
    is_active            boolean     DEFAULT true,
    sort_order           integer     DEFAULT 0,
    embedding            vector(1536),
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);

-- content_chunks (RAG knowledge base)
CREATE TABLE content_chunks (
    id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type   text        NOT NULL CHECK (source_type IN ('book', 'transcript')),
    source_name   text,
    chunk_index   integer,
    content       text        NOT NULL,
    token_count   integer,
    metadata      jsonb       DEFAULT '{}',
    embedding     vector(1536),
    created_at    timestamptz DEFAULT now()
);

-- conversations
CREATE TABLE conversations (
    id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    title         text,
    is_active     boolean     DEFAULT true,
    message_count integer     DEFAULT 0,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

-- messages
CREATE TABLE messages (
    id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id         uuid        NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    role                    text        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content                 text,
    image_url               text,
    image_analysis          text,
    product_recommendations jsonb,
    rag_context             jsonb,
    token_usage             jsonb,
    created_at              timestamptz DEFAULT now()
);

-- daily_quotes (CMS)
CREATE TABLE daily_quotes (
    id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_text   text        NOT NULL,
    author       text,
    display_date date        UNIQUE,
    is_active    boolean     DEFAULT true,
    created_at   timestamptz DEFAULT now()
);

-- articles (CMS)
CREATE TABLE articles (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           text        NOT NULL,
    slug            text        UNIQUE NOT NULL,
    excerpt         text,
    body            text,
    cover_image_url text,
    category        text,
    tags            text[]      DEFAULT '{}',
    is_published    boolean     DEFAULT false,
    published_at    timestamptz,
    author_name     text,
    sort_order      integer     DEFAULT 0,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- products indexes
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_tags ON products USING GIN (tags);
CREATE INDEX idx_products_suitable_hair_types ON products USING GIN (suitable_hair_types);
CREATE INDEX idx_products_suitable_concerns ON products USING GIN (suitable_concerns);
CREATE INDEX idx_products_embedding ON products USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

-- content_chunks indexes
CREATE INDEX idx_content_chunks_embedding ON content_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_content_chunks_source_type ON content_chunks (source_type);
CREATE INDEX idx_content_chunks_metadata ON content_chunks USING GIN (metadata);

-- conversations indexes
CREATE INDEX idx_conversations_user_id ON conversations (user_id);

-- messages indexes
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_created_at ON messages (created_at);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security (RLS)
-- ---------------------------------------------------------------------------

-- Enable RLS on ALL tables
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hair_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles          ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----

CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
    ON profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ---- hair_profiles ----

CREATE POLICY "hair_profiles_select_own"
    ON hair_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "hair_profiles_select_admin"
    ON hair_profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "hair_profiles_insert_own"
    ON hair_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "hair_profiles_update_own"
    ON hair_profiles FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---- conversations ----

CREATE POLICY "conversations_select_own"
    ON conversations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "conversations_insert_own"
    ON conversations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_update_own"
    ON conversations FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_delete_own"
    ON conversations FOR DELETE
    USING (user_id = auth.uid());

-- ---- messages ----

CREATE POLICY "messages_select_own"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
              AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "messages_insert_own"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
              AND conversations.user_id = auth.uid()
        )
    );

-- ---- products ----

CREATE POLICY "products_select_active"
    ON products FOR SELECT
    USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "products_admin_select"
    ON products FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "products_admin_insert"
    ON products FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "products_admin_update"
    ON products FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "products_admin_delete"
    ON products FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ---- daily_quotes ----

CREATE POLICY "daily_quotes_select_active"
    ON daily_quotes FOR SELECT
    USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "daily_quotes_admin_select"
    ON daily_quotes FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "daily_quotes_admin_insert"
    ON daily_quotes FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "daily_quotes_admin_update"
    ON daily_quotes FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "daily_quotes_admin_delete"
    ON daily_quotes FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ---- articles ----

CREATE POLICY "articles_select_published"
    ON articles FOR SELECT
    USING (is_published = true AND auth.role() = 'authenticated');

CREATE POLICY "articles_admin_select"
    ON articles FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "articles_admin_insert"
    ON articles FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "articles_admin_update"
    ON articles FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "articles_admin_delete"
    ON articles FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ---- content_chunks ----

CREATE POLICY "content_chunks_select_authenticated"
    ON content_chunks FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "content_chunks_admin_insert"
    ON content_chunks FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "content_chunks_admin_update"
    ON content_chunks FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "content_chunks_admin_delete"
    ON content_chunks FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ---- subscription_tiers ----

CREATE POLICY "subscription_tiers_select_active"
    ON subscription_tiers FOR SELECT
    USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "subscription_tiers_admin_select"
    ON subscription_tiers FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "subscription_tiers_admin_insert"
    ON subscription_tiers FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "subscription_tiers_admin_update"
    ON subscription_tiers FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "subscription_tiers_admin_delete"
    ON subscription_tiers FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ---------------------------------------------------------------------------
-- 5. Triggers - handle_new_user
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6. Triggers - updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_hair_profiles
    BEFORE UPDATE ON hair_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_products
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_articles
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_conversations
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7. RPC Functions
-- ---------------------------------------------------------------------------

-- match_content_chunks: semantic search over the RAG knowledge base
CREATE OR REPLACE FUNCTION public.match_content_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    source_filter text DEFAULT NULL
)
RETURNS TABLE (
    id            uuid,
    source_type   text,
    source_name   text,
    chunk_index   int,
    content       text,
    metadata      jsonb,
    similarity    float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cc.id,
        cc.source_type,
        cc.source_name,
        cc.chunk_index,
        cc.content,
        cc.metadata,
        (1 - (cc.embedding <=> query_embedding))::float AS similarity
    FROM content_chunks cc
    WHERE
        cc.embedding IS NOT NULL
        AND (1 - (cc.embedding <=> query_embedding)) >= match_threshold
        AND (source_filter IS NULL OR cc.source_type = source_filter)
    ORDER BY cc.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

-- match_products: semantic + profile-aware product search
CREATE OR REPLACE FUNCTION public.match_products(
    query_embedding vector(1536),
    user_hair_type text DEFAULT NULL,
    user_concerns text[] DEFAULT '{}',
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id              uuid,
    name            text,
    brand           text,
    description     text,
    category        text,
    affiliate_link  text,
    image_url       text,
    price_eur       numeric,
    tags            text[],
    similarity      float,
    profile_score   float,
    combined_score  float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.brand,
        p.description,
        p.category,
        p.affiliate_link,
        p.image_url,
        p.price_eur,
        p.tags,
        (1 - (p.embedding <=> query_embedding))::float AS similarity,
        (
            -- profile_score: hair type overlap (0.5 weight) + concerns overlap (0.5 weight)
            COALESCE(
                CASE
                    WHEN user_hair_type IS NOT NULL
                         AND array_length(p.suitable_hair_types, 1) > 0
                         AND user_hair_type = ANY(p.suitable_hair_types)
                    THEN 0.5
                    ELSE 0.0
                END
                +
                CASE
                    WHEN array_length(user_concerns, 1) > 0
                         AND array_length(p.suitable_concerns, 1) > 0
                    THEN 0.5 * (
                        -- fraction of user concerns matched by this product
                        (SELECT count(*)::float
                         FROM unnest(user_concerns) uc
                         WHERE uc = ANY(p.suitable_concerns)
                        ) / greatest(array_length(user_concerns, 1)::float, 1.0)
                    )
                    ELSE 0.0
                END,
                0.0
            )
        )::float AS profile_score,
        (
            0.6 * (1 - (p.embedding <=> query_embedding))::float
            +
            0.4 * COALESCE(
                CASE
                    WHEN user_hair_type IS NOT NULL
                         AND array_length(p.suitable_hair_types, 1) > 0
                         AND user_hair_type = ANY(p.suitable_hair_types)
                    THEN 0.5
                    ELSE 0.0
                END
                +
                CASE
                    WHEN array_length(user_concerns, 1) > 0
                         AND array_length(p.suitable_concerns, 1) > 0
                    THEN 0.5 * (
                        (SELECT count(*)::float
                         FROM unnest(user_concerns) uc
                         WHERE uc = ANY(p.suitable_concerns)
                        ) / greatest(array_length(user_concerns, 1)::float, 1.0)
                    )
                    ELSE 0.0
                END,
                0.0
            )
        )::float AS combined_score
    FROM products p
    WHERE
        p.is_active = true
        AND p.embedding IS NOT NULL
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Seed Data
-- ---------------------------------------------------------------------------

-- Subscription tiers
INSERT INTO subscription_tiers (name, slug, monthly_message_limit, can_upload_photos, can_access_history, max_conversations, price_eur_monthly, price_eur_yearly, is_active, features)
VALUES
    (
        'Free',
        'free',
        50,
        true,
        true,
        5,
        0.00,
        0.00,
        true,
        '{"chat": true, "photo_upload": true, "history": true}'::jsonb
    ),
    (
        'Premium',
        'premium',
        99999,
        true,
        true,
        20,
        9.99,
        99.99,
        true,
        '{"chat": true, "photo_upload": true, "history": true, "priority_support": true, "exclusive_content": true}'::jsonb
    );

-- Sample daily quotes (German, about hair care)
INSERT INTO daily_quotes (quote_text, author, display_date, is_active)
VALUES
    (
        'Dein Haar ist die Krone, die du niemals abnimmst -- pflege sie mit Liebe.',
        'Unbekannt',
        CURRENT_DATE,
        true
    ),
    (
        'Gesundes Haar beginnt mit gesunden Gewohnheiten. Jeder kleine Schritt zaehlt.',
        'Unbekannt',
        CURRENT_DATE + INTERVAL '1 day',
        true
    ),
    (
        'Schoenheit kommt von innen -- und zeigt sich in jedem einzelnen Haar.',
        'Unbekannt',
        CURRENT_DATE + INTERVAL '2 days',
        true
    );
