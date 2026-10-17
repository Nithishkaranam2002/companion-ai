-- CompanionAI schema. All user content stored here is already PII-redacted by the API.
-- The API connects as the postgres role (bypasses RLS); RLS protects direct client access.

create extension if not exists pgcrypto;

create table if not exists public.conversations (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    title       text not null default 'New conversation',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists conversations_user_idx on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
    id               uuid primary key default gen_random_uuid(),
    conversation_id  uuid not null references public.conversations (id) on delete cascade,
    user_id          uuid not null references auth.users (id) on delete cascade,
    role             text not null check (role in ('user', 'assistant')),
    content          text not null,
    route            text,
    label            text,
    sources          jsonb not null default '[]'::jsonb,
    created_at       timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

create table if not exists public.mood_entries (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    score       int not null check (score between 1 and 10),
    note        text not null default '',
    created_at  timestamptz not null default now()
);
create index if not exists mood_user_idx on public.mood_entries (user_id, created_at desc);

create table if not exists public.escalations (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid references auth.users (id) on delete set null,
    conversation_id  uuid references public.conversations (id) on delete set null,
    reason           text not null,
    summary          text not null,
    urgent           boolean not null default false,
    status           text not null default 'open' check (status in ('open', 'resolved')),
    resolved_by      text,
    resolved_at      timestamptz,
    created_at       timestamptz not null default now()
);
create index if not exists escalations_status_idx on public.escalations (status, urgent desc, created_at desc);

create table if not exists public.usage_events (
    id          bigint generated always as identity primary key,
    user_id     uuid not null,
    is_demo     boolean not null default false,
    created_at  timestamptz not null default now()
);
create index if not exists usage_user_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_demo_idx on public.usage_events (created_at) where is_demo;

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.mood_entries  enable row level security;
alter table public.escalations   enable row level security;
alter table public.usage_events  enable row level security;

-- Users may read their own rows. Writes go through the API only.
drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations for select using (auth.uid() = user_id);
drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for select using (auth.uid() = user_id);
drop policy if exists "own moods" on public.mood_entries;
create policy "own moods" on public.mood_entries for select using (auth.uid() = user_id);
-- escalations and usage_events: no policies => no client access at all.
