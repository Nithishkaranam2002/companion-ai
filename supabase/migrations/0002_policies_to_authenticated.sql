-- Scope read policies to the authenticated role and use (select auth.uid()) so the
-- function is evaluated once per query (Supabase RLS performance guidance).
drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations for select
    to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for select
    to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own moods" on public.mood_entries;
create policy "own moods" on public.mood_entries for select
    to authenticated using ((select auth.uid()) = user_id);
