
-- system_context: single-row table with the system prompt
create table if not exists public.system_context (
  id uuid primary key default gen_random_uuid(),
  context_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_context enable row level security;

drop policy if exists "anon all system_context" on public.system_context;
create policy "anon all system_context" on public.system_context for all to anon using (true) with check (true);
drop policy if exists "auth all system_context" on public.system_context;
create policy "auth all system_context" on public.system_context for all to authenticated using (true) with check (true);

-- Seed with the previous hardcoded system prompt if empty
insert into public.system_context (context_text)
select 'You are drafting an email on behalf of William Meadon, founder of Steppingstone. Will spent 28 years at JP Morgan as a fund manager. He is warm, direct, and senior. His emails are considered and personal - he never sounds corporate or generic. He tailors every email to the individual. He gets to the point with warmth. He signs off simply. He never uses buzzwords, em dashes as punctuation, or AI-sounding phrases. Write as if Will is writing it himself.'
where not exists (select 1 from public.system_context);

-- draft_feedback: how each generated draft was used
create table if not exists public.draft_feedback (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid,
  mode text not null default 'single' check (mode in ('single','intro')),
  outcome text not null check (outcome in ('sent-as-written','edited-and-sent','rejected')),
  original_draft text not null,
  final_version text,
  edit_notes text,
  brief text,
  created_at timestamptz not null default now()
);

create index if not exists draft_feedback_contact_idx on public.draft_feedback(contact_id);
create index if not exists draft_feedback_created_idx on public.draft_feedback(created_at desc);

alter table public.draft_feedback enable row level security;

drop policy if exists "anon all draft_feedback" on public.draft_feedback;
create policy "anon all draft_feedback" on public.draft_feedback for all to anon using (true) with check (true);
drop policy if exists "auth all draft_feedback" on public.draft_feedback;
create policy "auth all draft_feedback" on public.draft_feedback for all to authenticated using (true) with check (true);
