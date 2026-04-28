-- Run this once in your Supabase SQL editor to set up the Steppingstone schema.

create extension if not exists "pgcrypto";

-- CONTACTS ---------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  role text,
  email text,
  phone text,
  how_we_met text,
  status text check (status in ('contacted','replied','meeting booked','intro made','deal done','gone cold')),
  linkedin_url text,
  notes text,
  last_contact_date date,
  created_at timestamptz not null default now()
);

-- INTERACTIONS -----------------------------------------------------------
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('meeting','call','email','voice note','introduction made','note')),
  summary text not null,
  full_note text,
  action_items jsonb default '[]'::jsonb,
  needs_followup boolean not null default false,
  followup_by date,
  created_at timestamptz not null default now()
);
create index if not exists interactions_contact_idx on public.interactions(contact_id);
create index if not exists interactions_followup_idx on public.interactions(needs_followup, followup_by);

-- DEALS ------------------------------------------------------------------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage text not null default 'exploring',
  description text,
  target_amount bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  unique (deal_id, contact_id)
);

-- INTRODUCTIONS ----------------------------------------------------------
create table if not exists public.introductions (
  id uuid primary key default gen_random_uuid(),
  first_contact_id uuid not null references public.contacts(id) on delete cascade,
  second_contact_id uuid not null references public.contacts(id) on delete cascade,
  reason text,
  status text not null default 'made' check (status in ('made','progressing','led-somewhere','gone-cold')),
  created_at timestamptz not null default now()
);

-- LINKEDIN ---------------------------------------------------------------
create table if not exists public.linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  post_type text not null check (post_type in ('Original','Reshare','Cultural')),
  page text not null check (page in ('Company page','Personal page')),
  body text not null,
  personal_commentary text,
  status text not null default 'draft' check (status in ('draft','approved','ignored','posted')),
  posted_at timestamptz,
  impressions int,
  reactions int,
  comments int,
  created_at timestamptz not null default now()
);

-- RLS: single-user private link. Open read+write to anon.
alter table public.contacts enable row level security;
alter table public.interactions enable row level security;
alter table public.deals enable row level security;
alter table public.deal_contacts enable row level security;
alter table public.introductions enable row level security;
alter table public.linkedin_posts enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['contacts','interactions','deals','deal_contacts','introductions','linkedin_posts']) loop
    execute format('drop policy if exists "anon all" on public.%I', t);
    execute format('create policy "anon all" on public.%I for all to anon using (true) with check (true)', t);
  end loop;
end $$;