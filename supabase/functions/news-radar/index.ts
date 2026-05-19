// Sector radar: fetches RSS sources, stores new items, batch-scores relevance with Claude.
// Triggered manually from /linkedin via the "Refresh news" button. No cron required for v1.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.65.0";
import { XMLParser } from "npm:fast-xml-parser@4.3.6";

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

async function parseRss(xml: string): Promise<RssItem[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: true,
  });
  const doc = parser.parse(xml);

  // RSS 2.0: rss.channel.item[]
  const rssItems = doc?.rss?.channel?.item;
  if (rssItems) {
    const list = Array.isArray(rssItems) ? rssItems : [rssItems];
    return list.map((it: Record<string, unknown>) => ({
      title: stripHtml(it.title as string),
      url: typeof it.link === "string" ? it.link : (it.link as { "#text"?: string })?.["#text"] ?? "",
      snippet: stripHtml((it.description ?? it["content:encoded"]) as string).slice(0, 500),
      author: stripHtml((it["dc:creator"] ?? it.author) as string) || null,
      published_at: tryParseDate((it.pubDate ?? it["dc:date"]) as string),
    })).filter((x: RssItem) => x.title && x.url);
  }

  // Atom: feed.entry[]
  const atomEntries = doc?.feed?.entry;
  if (atomEntries) {
    const list = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
    return list.map((it: Record<string, unknown>) => {
      // Atom <link> can be href attribute or a string.
      let url = "";
      const link = it.link;
      if (Array.isArray(link)) {
        const html = link.find((l: Record<string, unknown>) => l?.["@_rel"] !== "self");
        url = (html as { "@_href"?: string })?.["@_href"] ?? "";
      } else if (link && typeof link === "object") {
        url = (link as { "@_href"?: string })["@_href"] ?? "";
      } else if (typeof link === "string") {
        url = link;
      }
      return {
        title: stripHtml(it.title as string),
        url,
        snippet: stripHtml((it.summary ?? it.content) as string).slice(0, 500),
        author: stripHtml(((it.author as { name?: string })?.name) ?? "") || null,
        published_at: tryParseDate((it.published ?? it.updated) as string),
      };
    }).filter((x: RssItem) => x.title && x.url);
  }

  return [];
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
      const { data: inserted, error: insErr } = await sb
        .from("news_items")
        .insert(toInsert.map((it) => ({
          source_id: it.source_id,
          url: it.url,
          title: it.title,
          snippet: it.snippet,
          author: it.author,
          published_at: it.published_at,
        })))
        .select("id, title, snippet");
      if (insErr) throw insErr;
      insertedRows = (inserted ?? []) as typeof insertedRows;
    }

    // 4. Pull all unscored items (newly inserted + any backlog).
    const { data: unscored } = await sb
      .from("news_items")
      .select("id, title, snippet")
      .is("relevance_score", null)
      .order("fetched_at", { ascending: false })
      .limit(60);

    // 5. Batch score in chunks of 20.
    const client = new Anthropic({ apiKey });
    let scoredCount = 0;
    const all = (unscored ?? []) as Array<{ id: string; title: string; snippet: string | null }>;
    for (let i = 0; i < all.length; i += 20) {
      const batch = all.slice(i, i + 20);
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
    }

    return new Response(JSON.stringify({
      ok: true,
      sources_checked: sources.length,
      new_items: toInsert.length,
      scored: scoredCount,
      errors: sourceErrors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : "news-radar failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
