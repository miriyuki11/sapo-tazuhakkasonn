alter table public.user_private_notes enable row level security;

drop policy if exists select_own_notes on public.user_private_notes;
drop policy if exists insert_own_notes on public.user_private_notes;
drop policy if exists update_own_notes on public.user_private_notes;
drop policy if exists delete_own_notes on public.user_private_notes;

create policy select_own_notes
on public.user_private_notes
for select
using (auth.uid() = author_user_id);

create policy insert_own_notes
on public.user_private_notes
for insert
with check (auth.uid() = author_user_id);

create policy update_own_notes
on public.user_private_notes
for update
using (auth.uid() = author_user_id)
with check (auth.uid() = author_user_id);

create policy delete_own_notes
on public.user_private_notes
for delete
using (auth.uid() = author_user_id);