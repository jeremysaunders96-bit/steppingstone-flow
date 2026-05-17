-- Google OAuth tokens for Gmail + Calendar integration
-- One row per connected Google account. Will has two: william@sstone.co.uk and willmeadon@gmail.com.

create table if not exists public.user_google_tokens (
  id uuid primary key default gen_random_uuid(),
  account_email text not null unique,
  google_user_id text,
  refresh_token text not null,
  access_token text not null,
  expires_at timestamptz not null,
  scopes text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_google_tokens_email_idx on public.user_google_tokens(account_email);

-- contacts: track where a contact came from and when imported
alter table public.contacts add column if not exists source text default 'manual';
alter table public.contacts add column if not exists imported_at timestamptz;

-- Enforce allowed values; nullable so legacy rows aren't forced to a specific source
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_source_check'
  ) then
    alter table public.contacts
      add constraint contacts_source_check
      check (source is null or source in ('manual','gmail-import','curation-list'));
  end if;
end$$;

create index if not exists contacts_source_idx on public.contacts(source);
