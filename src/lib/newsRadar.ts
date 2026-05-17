import { supabase } from "@/lib/supabase";

export type NewsTopic = "sector" | "deal" | "network" | "cultural" | "other";
export type NewsStatus = "new" | "drafted" | "dismissed" | "saved";

export interface NewsItem {
  id: string;
  source_id: string | null;
  url: string;
  title: string;
  snippet: string | null;
  author: string | null;
  published_at: string | null;
  fetched_at: string;
  relevance_score: number | null;
  relevance_reasoning: string | null;
  topic_match: NewsTopic | null;
  status: NewsStatus;
  source_name: string | null;
}

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
}

export interface RefreshResult {
  ok: boolean;
  sources_checked: number;
  new_items: number;
  scored: number;
  errors: Array<{ name: string; error: string }>;
}

export async function refreshNews(): Promise<RefreshResult> {
  const { data, error } = await supabase.functions.invoke("news-radar", { body: {} });
  if (error) throw error;
  const result = data as RefreshResult & { error?: string };
  if (result.error) throw new Error(result.error);
  return result;
}

// Items worth Will's attention: scored >= 7, not yet acted on, newest first.
// Score gates the list but date drives the order — Will wants to see the most
// recent things first within the relevance bar.
export async function fetchTopItems(limit = 4): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from("news_items")
    .select("*, source:news_sources(name)")
    .eq("status", "new")
    .gte("relevance_score", 7)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("fetched_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<NewsItem & { source: { name: string | null } | null }>)
    .map((r) => ({ ...r, source_name: r.source?.name ?? null }));
}

export async function fetchSavedItems(limit = 10): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from("news_items")
    .select("*, source:news_sources(name)")
    .eq("status", "saved")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("fetched_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<NewsItem & { source: { name: string | null } | null }>)
    .map((r) => ({ ...r, source_name: r.source?.name ?? null }));
}

export async function setItemStatus(id: string, status: NewsStatus): Promise<void> {
  const { error } = await supabase
    .from("news_items")
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function lastRefreshTime(): Promise<string | null> {
  const { data, error } = await supabase
    .from("news_sources")
    .select("last_fetched_at")
    .not("last_fetched_at", "is", null)
    .order("last_fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as { last_fetched_at: string | null } | null)?.last_fetched_at ?? null;
}
