-- Already applied to the theabcs Supabase project. Kept here for reference.
create table public.questions (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

-- The Worker uses the publishable key, so it acts as the anon role.
-- It may add and read questions. Deleting needs the secret key.
grant select, insert on public.questions to anon;

create policy "Anyone can read questions"
  on public.questions for select to anon using (true);

create policy "Anyone can submit a question"
  on public.questions for insert to anon
  with check (char_length(text) between 1 and 300);
