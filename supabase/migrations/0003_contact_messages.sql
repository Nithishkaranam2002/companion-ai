-- Contact form submissions. Written by the API only; no client access.
create table if not exists public.contact_messages (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    email       text not null,
    topic       text not null default 'general',
    message     text not null,
    handled     boolean not null default false,
    created_at  timestamptz not null default now()
);
create index if not exists contact_created_idx on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;
