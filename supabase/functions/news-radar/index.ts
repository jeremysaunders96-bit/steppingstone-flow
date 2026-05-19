// Sector radar: fetches RSS sources, stores new items, batch-scores relevance with Claude.
// Triggered manually from /linkedin via the "Refresh news" button. No cron required for v1.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.65.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCORING_SYSTEM = `You are scoring news items for William Meadon, founder of Steppingstone (UK SME advisory firm). Will's interests in priority order:

1. Investment trust sector commentary — Saba/activist dynamic, the discount problem, retail investor access, FCA regulation, Edinburgh Worldwide and similar situations, AIC commentary. SCORE 8-10 if highly relevant.
2. Active deals he's involved in — Curation Connect, Waymap, ThrustWSH/Richard Noble. SCORE 7-9 if directly mentioned (rare from external news).
3. Network stories — UK SMEs growing, fractional advisory, named board directors he respects. SCORE 5-7.
4. Cultural recommendations he might share — UK exhibitions, plays, restaurants. SCORE 4-6 if interesting.
5. General fund management / financial markets — SCORE 2-4.
6. Everything else — SCORE 0-2.

For each item, output JSON in an array. No markdown, no backticks.`;

interface RssItem {
  title: string;
  url: string;
  snippet: string | null;
  author: string | null;
  published_at: string | null;
}

interface ScoredItem {
  id: string;
  score: number;
  why: string;
  topic: "sector" | "deal" | "network" | "cultural" | "other";
}

function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, {
    signal: controller.signal,
    headers: { "User-Agent": "SteppingstoneRadar/1.0 (+contact@sstone.co.uk)" },
  }).finally(() => clearTimeout(timer));
}

function tryParseDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function stripHtml(s: string | undefined | null): string {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// Hand-rolled RSS/Atom parser. Avoids the npm:fast-xml-parser dependency that
// was failing to start in Supabase's Deno runtime. RSS and Atom feeds have
// strict, predictable structure; regex is brittle in general but fine here.
function unwrapCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function extractTag(block: string, tag: string): string | null {
  // Match <tag ...>content</tag>, case-insensitive, lazy
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return null;
  return unwrapCdata(m[1]).trim();
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // RSS 2.0 <item> blocks
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtml(extractTag(block, "title") ?? "");
    const link = extractTag(block, "link") ?? "";
    if (!title || !link) continue;
    items.push({
      title,
      url: link,
      snippet: stripHtml(extractTag(block, "description") ?? extractTag(block, "content:encoded") ?? "").slice(0, 500),
      author: stripHtml(extractTag(block, "dc:creator") ?? extractTag(block, "author") ?? "") || null,
      published_at: tryParseDate(extractTag(block, "pubDate") ?? extractTag(block, "dc:date")),
    });
  }

  // Atom <entry> blocks
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtml(extractTag(block, "title") ?? "");
    // Atom <link href="..."/> uses an attribute, not inner text. Prefer rel="alternate" or no rel.
    let url = "";
    const linkRe = /<link\b([^>]*)\/?>/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(block)) !== null) {
      const attrs = lm[1];
      const relMatch = attrs.match(/\brel=["']([^"']+)["']/i);
      const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
      if (!hrefMatch) continue;
      const rel = relMatch?.[1];
      if (!rel || rel === "alternate") {
        url = hrefMatch[1];
        break;
      }
      if (!url) url = hrefMatch[1]; // fallback to first link
    }
    if (!title || !url) continue;
    items.push({
      title,
      url,
      snippet: stripHtml(extractTag(block, "summary") ?? extractTag(block, "content") ?? "").slice(0, 500),
      author: stripHtml(extractTag(block, "name") ?? "") || null,
      published_at: tryParseDate(extractTag(block, "published") ?? extractTag(block, "updated")),
    });
  }

  return items;
}

async function scoreBatch(
  client: Anthropic,
  batch: Array<{ id: string; title: string; snippet: string | null }>,
): Promise<ScoredItem[]> {
  const userMessage = `Score these ${batch.length} items. Return ONLY a JSON array, one object per item. Each object: {"id": "<id>", "score": 0-10, "why": "1-2 sentence reason", "topic": "sector"|"deal"|"network"|"cultural"|"other"}.

Items:
${batch.map((it) => `id: ${it.id}\ntitle: ${it.title}\nsnippet: ${it.snippet ?? "(none)"}\n---`).join("\n")}`;

  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: Math.min(8000, batch.length * 200),
    system: SCORING_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  let cleaned = raw;
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const first = cleaned.indexOf("[");
  const last = cleaned.lastIndexOf("]");
  if (first === -1 || last === -1) return [];

  try {
    const parsed = JSON.parse(cleaned.slice(first, last + 1)) as Array<Record<string, unknown>>;
    return parsed
      .filter((r) => typeof r.id === "string")
      .map((r) => ({
        id: r.id as string,
        score: typeof r.score === "number" ? Math.max(0, Math.min(10, Math.round(r.score))) : 0,
        why: typeof r.why === "string" ? r.why : "",
        topic: (["sector", "deal", "network", "cultural", "other"] as const).includes(r.topic as "sector")
          ? (r.topic as ScoredItem["topic"])
          : "other",
      }));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "anthropic_key_missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Read enabled sources.
    const { data: sources, error: srcErr } = await sb
      .from("news_sources")
      .select("id, name, url, kind, weight")
      .eq("enabled", true);
    if (srcErr) throw srcErr;
    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ ok: true, new_items: 0, scored: 0, sources_checked: 0, errors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch + parse each source, collect items.
    const allFetched: Array<RssItem & { source_id: string }> = [];
    const sourceErrors: Array<{ name: string; error: string }> = [];

    await Promise.all(
      sources.map(async (s: { id: string; name: string; url: string }) => {
        try {
          const res = await fetchWithTimeout(s.url, 12000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const xml = await res.text();
          const items = await parseRss(xml);
          for (const it of items) allFetched.push({ ...it, source_id: s.id });
          await sb.from("news_sources").update({ last_fetched_at: new Date().toISOString(), last_error: null }).eq("id", s.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          sourceErrors.push({ name: s.name, error: msg });
          await sb.from("news_sources").update({ last_fetched_at: new Date().toISOString(), last_error: msg }).eq("id", s.id);
        }
      }),
    );

    // 3. Dedupe against existing news_items.url, insert new ones.
    const urls = Array.from(new Set(allFetched.map((x) => x.url)));
    let existingUrls = new Set<string>();
    if (urls.length > 0) {
      // Chunk to avoid query size limits.
      for (let i = 0; i < urls.length; i += 200) {
        const chunk = urls.slice(i, i + 200);
        const { data } = await sb.from("news_items").select("url").in("url", chunk);
        for (const r of (data ?? []) as { url: string }[]) existingUrls.add(r.url);
      }
    }
    const seenInBatch = new Set<string>();
    const toInsert = allFetched.filter((it) => {
      if (existingUrls.has(it.url)) return false;
      if (seenInBatch.has(it.url)) return false;
      seenInBatch.add(it.url);
      return true;
    });

    let insertedRows: Array<{ id: string; title: string; snippet: string | null }> = [];
    if (toInsert.length > 0) {
      try {
        const { data: inserted, error: insErr } = await sb
          .from("news_items")
          .insert(toInsert.map((it) => ({
            source_id: it.source_id,
            url: it.url,
            title: it.title.slice(0, 1000),
            snippet: it.snippet?.slice(0, 2000) ?? null,
            author: it.author?.slice(0, 200) ?? null,
            published_at: it.published_at,
          })))
          .select("id, title, snippet");
        if (insErr) {
          console.error("news_items insert failed:", insErr.message);
          sourceErrors.push({ name: "_insert", error: insErr.message });
        } else {
          insertedRows = (inserted ?? []) as typeof insertedRows;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("news_items insert threw:", msg);
        sourceErrors.push({ name: "_insert", error: msg });
      }
    }

    // 4. Pull all unscored items (newly inserted + any backlog).
    const { data: unscored } = await sb
      .from("news_items")
      .select("id, title, snippet")
      .is("relevance_score", null)
      .order("fetched_at", { ascending: false })
      .limit(60);

    // 5. Batch score in chunks of 20. Wrap each batch in try/catch so a single
    // bad Anthropic call doesn't crash the whole refresh.
    const client = new Anthropic({ apiKey });
    let scoredCount = 0;
    const scoringErrors: Array<{ batch: number; error: string }> = [];
    const all = (unscored ?? []) as Array<{ id: string; title: string; snippet: string | null }>;
    for (let i = 0; i < all.length; i += 20) {
      const batch = all.slice(i, i + 20);
      try {
        const scores = await scoreBatch(client, batch);
        for (const s of scores) {
          const { error: updErr } = await sb
            .from("news_items")
            .update({
              relevance_score: s.score,
              relevance_reasoning: s.why,
              topic_match: s.topic,
            })
            .eq("id", s.id);
          if (!updErr) scoredCount++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`scoreBatch failed at index ${i}:`, msg);
        scoringErrors.push({ batch: i, error: msg });
        // Continue to the next batch rather than crashing the whole function.
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      sources_checked: sources.length,
      new_items: toInsert.length,
      scored: scoredCount,
      errors: sourceErrors,
      scoring_errors: scoringErrors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : "news-radar failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
