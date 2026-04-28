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

-- Extra deal fields used by the Deals screen.
-- Run these once if your existing deals table doesn't have them yet:
alter table public.deals add column if not exists deal_type text
  check (deal_type in ('capital-raise','introduction-mandate','advisory','other','one-off-introduction'));
alter table public.deals add column if not exists client_name text;
alter table public.deals add column if not exists start_date date;
alter table public.deals add column if not exists target_close_date date;
alter table public.deals add column if not exists commission_structure text;
alter table public.deals add column if not exists next_action text;
alter table public.deals add column if not exists next_action_date date;
alter table public.deals add column if not exists latest_update text;

-- If you previously added a deal_type CHECK without 'one-off-introduction',
-- run this to widen it:
-- alter table public.deals drop constraint if exists deals_deal_type_check;
-- alter table public.deals add constraint deals_deal_type_check
--   check (deal_type in ('capital-raise','introduction-mandate','advisory','other','one-off-introduction'));

-- View used by the Home "Deal Pulse" and Deals list to show staleness.
create or replace view public.deal_last_activity as
select
  d.id,
  d.name,
  d.stage,
  d.description,
  d.target_amount,
  d.created_at,
  d.deal_type,
  d.client_name,
  d.start_date,
  d.target_close_date,
  d.commission_structure,
  d.next_action,
  d.next_action_date,
  d.latest_update,
  la.last_activity_date,
  case when la.last_activity_date is null then null
       else (current_date - la.last_activity_date)::int
  end as days_since_activity
from public.deals d
left join lateral (
  select max(i.date) as last_activity_date
  from public.deal_contacts dc
  join public.interactions i on i.contact_id = dc.contact_id
  where dc.deal_id = d.id
) la on true;

create table if not exists public.deal_contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  role_in_deal text,
  unique (deal_id, contact_id)
);

-- If you previously created deal_contacts without role_in_deal, run:
-- alter table public.deal_contacts add column if not exists role_in_deal text;

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