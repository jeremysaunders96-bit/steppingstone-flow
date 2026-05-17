// Drafts LinkedIn posts in Will Meadon's voice. Supports two modes:
//   - "paired": Steppingstone company-page post (150-250 words) + 1-3 sentence personal
//     reshare commentary, drafted together so they reinforce.
//   - "reshare": 1-3 sentence Will-voice commentary to add when resharing a third-party post.
//
// Pulls the LinkedIn bible (system_context.kind='linkedin_voice') as a cached system prompt
// and the last 5 edited drafts of the same type as few-shot examples in the user message.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.65.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_BIBLE = `You are drafting LinkedIn posts on behalf of William Meadon, founder of Steppingstone. Will's audience is senior: investment trust board directors, fund managers, capital markets professionals. Specific over general. Position over both-sides. No em dashes. No "thrilled to share". No hashtags. Return JSON only.`;

interface RequestBody {
  type: "paired" | "reshare";
  topic: "sector" | "deal" | "network" | "cultural" | "other";
  brief: string;
  trigger_source?: string;
  source_url?: string;
  // Optional: hint for how to re-attempt when Will hits Regenerate.
  regenerate_angle_hint?: string;
  debug?: boolean;
}

interface PairedResponse {
  company_body: string;
  personal_commentary: string;
}
interface ReshareResponse {
  commentary: string;
}

function tryParseJson<T>(text: string): T | null {
  if (!text) return null;
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(s.slice(first, last + 1)) as T;
  } catch {
    return null;
  }
}

function topicLabel(t: string): string {
  switch (t) {
    case "sector": return "Investment trust sector commentary";
    case "deal": return "Active deal or partnership";
    case "network": return "Network or introduction story";
    case "cultural": return "Cultural recommendation (Stepping Out style)";
    case "other": return "Other";
    default: return t;
  }
}

interface PairedExample {
  brief: string | null;
  topic: string | null;
  original_company_body: string | null;
  final_company_body: string | null;
  original_personal_commentary: string | null;
  final_personal_commentary: string | null;
}
interface ReshareExample {
  brief: string | null;
  topic: string | null;
  original_reshare_commentary: string | null;
  final_reshare_commentary: string | null;
}

function buildPairedUserMessage(body: RequestBody, examples: PairedExample[]): string {
  const parts: string[] = [
    `Draft a Type 1 paired LinkedIn post for William Meadon / Steppingstone.`,
    ``,
    `TOPIC: ${topicLabel(body.topic)}`,
    body.trigger_source ? `WHAT TRIGGERED THIS: ${body.trigger_source}` : "",
    ``,
    `WILL'S BRIEF (his own words about what he wants to say):`,
    `─────────────────────────────────────────`,
    body.brief,
    `─────────────────────────────────────────`,
    ``,
    `OUTPUT REQUIRED:`,
    `1. company_body: 150-250 words for the Steppingstone company page. Polished, newsletter-adjacent in tone. Hook in the first ~150 chars. Specific names, numbers, positions. Will's voice rules apply (no em dashes, no "thrilled to share", no hashtags, no rhetorical questions at paragraph ends, no sales CTAs).`,
    `2. personal_commentary: 1-3 sentences for Will's reshare to his personal page. Sharper than the company body, more direct. The angle he couldn't say from the company page.`,
    ``,
    `Return ONLY the JSON: {"company_body": "...", "personal_commentary": "..."}`,
  ];

  if (body.regenerate_angle_hint) {
    parts.push("", `REGENERATE - TRY A DIFFERENT ANGLE: ${body.regenerate_angle_hint}`);
  }

  if (examples.length > 0) {
    parts.push("", `RECENT EDITS FROM WILL (study how he reshapes drafts):`, "");
    examples.forEach((ex, i) => {
      parts.push(
        `─── Example ${i + 1} (${ex.topic ?? "n/a"}) ───`,
        `BRIEF: ${ex.brief ?? "(no brief recorded)"}`,
        ``,
        `BEFORE (your draft):`,
        `Company body: ${ex.original_company_body ?? "(none)"}`,
        `Personal commentary: ${ex.original_personal_commentary ?? "(none)"}`,
        ``,
        `AFTER (what Will sent):`,
        `Company body: ${ex.final_company_body ?? "(none)"}`,
        `Personal commentary: ${ex.final_personal_commentary ?? "(none)"}`,
        "",
      );
    });
  }

  return parts.filter(Boolean).join("\n");
}

function buildReshareUserMessage(body: RequestBody, examples: ReshareExample[]): string {
  const parts: string[] = [
    `Draft Type 2 reshare commentary for William Meadon to add when resharing a third-party LinkedIn post.`,
    ``,
    `TOPIC: ${topicLabel(body.topic)}`,
    body.source_url ? `SOURCE POST URL: ${body.source_url}` : "",
    body.trigger_source ? `WHY THIS IS WORTH RESHARING: ${body.trigger_source}` : "",
    ``,
    `WILL'S BRIEF (his angle on the original post):`,
    `─────────────────────────────────────────`,
    body.brief,
    `─────────────────────────────────────────`,
    ``,
    `OUTPUT REQUIRED:`,
    `1-3 sentences. A specific position. NOT "great post" / "important read" / "must read". Earn the reshare. The commentary IS the value. Will's voice rules apply.`,
    ``,
    `Return ONLY the JSON: {"commentary": "..."}`,
  ];

  if (body.regenerate_angle_hint) {
    parts.push("", `REGENERATE - TRY A DIFFERENT ANGLE: ${body.regenerate_angle_hint}`);
  }

  if (examples.length > 0) {
    parts.push("", `RECENT EDITS FROM WILL (study how he reshapes reshare commentary):`, "");
    examples.forEach((ex, i) => {
      parts.push(
        `─── Example ${i + 1} (${ex.topic ?? "n/a"}) ───`,
        `BRIEF: ${ex.brief ?? "(no brief recorded)"}`,
        `BEFORE: ${ex.original_reshare_commentary ?? "(none)"}`,
        `AFTER: ${ex.final_reshare_commentary ?? "(none)"}`,
        "",
      );
    });
  }

  return parts.filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "anthropic_key_missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body.type || !["paired", "reshare"].includes(body.type)) {
      return new Response(JSON.stringify({ error: "type_required", expected: ["paired", "reshare"] }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.brief || !body.brief.trim()) {
      return new Response(JSON.stringify({ error: "brief_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.topic) body.topic = "other";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // System prompt = the LinkedIn bible, cached.
    let bibleText = FALLBACK_BIBLE;
    try {
      const { data: ctxRows } = await sb
        .from("system_context")
        .select("context_text")
        .eq("kind", "linkedin_voice")
        .limit(1);
      if (ctxRows && ctxRows[0]?.context_text) bibleText = ctxRows[0].context_text as string;
    } catch (e) {
      console.warn("linkedin_voice fetch failed", e);
    }

    // Pull last 5 edited drafts of the same type as few-shot examples.
    let pairedExamples: PairedExample[] = [];
    let reshareExamples: ReshareExample[] = [];
    try {
      if (body.type === "paired") {
        const { data } = await sb
          .from("linkedin_draft_feedback")
          .select("brief, topic, original_company_body, final_company_body, original_personal_commentary, final_personal_commentary")
          .eq("type", "paired")
          .eq("outcome", "edited-and-sent")
          .order("created_at", { ascending: false })
          .limit(8);
        pairedExamples = ((data ?? []) as PairedExample[])
          .filter((r) => {
            const c = (r.original_company_body ?? "").trim() !== (r.final_company_body ?? "").trim();
            const p = (r.original_personal_commentary ?? "").trim() !== (r.final_personal_commentary ?? "").trim();
            return c || p;
          })
          .slice(0, 5);
      } else {
        const { data } = await sb
          .from("linkedin_draft_feedback")
          .select("brief, topic, original_reshare_commentary, final_reshare_commentary")
          .eq("type", "reshare")
          .eq("outcome", "edited-and-sent")
          .order("created_at", { ascending: false })
          .limit(8);
        reshareExamples = ((data ?? []) as ReshareExample[])
          .filter((r) => (r.original_reshare_commentary ?? "").trim() !== (r.final_reshare_commentary ?? "").trim())
          .slice(0, 5);
      }
    } catch (e) {
      console.warn("feedback fetch failed", e);
    }

    const userMessage = body.type === "paired"
      ? buildPairedUserMessage(body, pairedExamples)
      : buildReshareUserMessage(body, reshareExamples);

    const client = new Anthropic({ apiKey });
    const completion = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: bibleText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = completion.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    const debugPayload = body.debug
      ? { systemPromptLength: bibleText.length, userPrompt: userMessage, raw }
      : undefined;

    if (body.type === "paired") {
      const parsed = tryParseJson<PairedResponse>(raw);
      if (!parsed || !parsed.company_body || !parsed.personal_commentary) {
        return new Response(JSON.stringify({ error: "malformed_paired", raw, debug: debugPayload }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        type: "paired",
        company_body: parsed.company_body,
        personal_commentary: parsed.personal_commentary,
        debug: debugPayload,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = tryParseJson<ReshareResponse>(raw);
    if (!parsed || !parsed.commentary) {
      return new Response(JSON.stringify({ error: "malformed_reshare", raw, debug: debugPayload }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      type: "reshare",
      commentary: parsed.commentary,
      debug: debugPayload,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not draft LinkedIn post.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
