-- Sector radar: pull sector news from RSS sources, score relevance with Claude,
-- surface high-signal items on /linkedin for Will to react to.

create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  url text not null,
  kind text not null default 'rss' check (kind in ('rss','google-news-rss')),
  enabled boolean not null default true,
  weight integer not null default 1,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.news_sources(id) on delete cascade,
  url text not null unique,
  title text not null,
  snippet text,
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  relevance_score integer,                              -- 0-10, null until scored
  relevance_reasoning text,                              -- 1-2 sentences from Claude
  topic_match text check (topic_match is null or topic_match in ('sector','deal','network','cultural','other')),
  status text not null default 'new' check (status in ('new','drafted','dismissed','saved')),
  status_changed_at timestamptz
);

create index if not exists news_items_status_score_idx on public.news_items(status, relevance_score desc);
create index if not exists news_items_fetched_at_idx on public.news_items(fetched_at desc);
create index if not exists news_items_published_at_idx on public.news_items(published_at desc);

alter table public.news_sources enable row level security;
alter table public.news_items enable row level security;

drop policy if exists "anon all news_sources" on public.news_sources;
create policy "anon all news_sources" on public.news_sources for all to anon using (true) with check (true);
drop policy if exists "auth all news_sources" on public.news_sources;
create policy "auth all news_sources" on public.news_sources for all to authenticated using (true) with check (true);

drop policy if exists "anon all news_items" on public.news_items;
create policy "anon all news_items" on public.news_items for all to anon using (true) with check (true);
drop policy if exists "auth all news_items" on public.news_items;
create policy "auth all news_items" on public.news_items for all to authenticated using (true) with check (true);

-- Starter sources. Some URLs are best guesses for the named publications. If a feed returns
-- HTML or fails, news_sources.last_error captures it and the URL can be updated via SQL.
-- The Google News RSS row is the safety net: it reliably returns results for the query and
-- aggregates across publications.
insert into public.news_sources (name, url, kind, weight) values
  ('AIC News',                       'https://www.theaic.co.uk/aic/news/feed',                                                  'rss',              3),
  ('Investment Week',                'https://www.investmentweek.co.uk/feed',                                                   'rss',              2),
  ('Citywire Investment Trusts',     'https://citywire.com/funds-insider/news/investment-trusts/rss',                           'rss',              2),
  ('Trustnet News',                  'https://www.trustnet.com/News/rss.aspx',                                                  'rss',              2),
  ('FT Adviser Investments',         'https://www.ftadviser.com/rss/investments/',                                              'rss',              1),
  ('Google News: investment trust',  'https://news.google.com/rss/search?q=%22investment+trust%22+UK&hl=en-GB&gl=GB&ceid=GB:en','google-news-rss',  1)
on conflict (name) do nothing;
