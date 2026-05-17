import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  transcript: string;
  mode?: "extract" | "punctuate";
}

interface SuggestedEvent {
  summary: string;
  description: string | null;
  location: string | null;
  suggested_start: string;  // local ISO datetime (no offset) or YYYY-MM-DD
  suggested_end: string;    // same form
  all_day: boolean;
  confidence: "high" | "medium" | "low";
}

interface MeetingExtraction {
  contact_name: string | null;
  company: string | null;
  key_points: string[];
  action_items: string[];
  additional_notes: string | null;
  calendar_events: SuggestedEvent[];
}

function tryParseJson(text: string): MeetingExtraction | null {
  if (!text) return null;
  let s = text.trim();
  // strip code fences if present
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  // find first { ... last }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  const slice = s.slice(first, last + 1);
  try {
    const obj = JSON.parse(slice);
    const events: SuggestedEvent[] = Array.isArray(obj.calendar_events)
      ? obj.calendar_events
          .filter((e: unknown) => e && typeof e === "object")
          .map((e: Record<string, unknown>) => ({
            summary: String(e.summary ?? ""),
            description: typeof e.description === "string" ? e.description : null,
            location: typeof e.location === "string" ? e.location : null,
            suggested_start: String(e.suggested_start ?? ""),
            suggested_end: String(e.suggested_end ?? ""),
            all_day: Boolean(e.all_day),
            confidence: (["high", "medium", "low"] as const).includes(e.confidence as "high" | "medium" | "low")
              ? (e.confidence as "high" | "medium" | "low")
              : "low",
          }))
          .filter((e: SuggestedEvent) => e.summary && e.suggested_start && e.suggested_end)
      : [];
    return {
      contact_name: obj.contact_name ?? null,
      company: obj.company ?? null,
      key_points: Array.isArray(obj.key_points) ? obj.key_points.filter((x: unknown) => typeof x === "string") : [],
      action_items: Array.isArray(obj.action_items) ? obj.action_items.filter((x: unknown) => typeof x === "string") : [],
      additional_notes: obj.additional_notes ?? null,
      calendar_events: events,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Anthropic API key is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const transcript = (body?.transcript || "").trim();
    const mode = body?.mode === "punctuate" ? "punctuate" : "extract";
    if (!transcript) {
      return new Response(JSON.stringify({ error: "Transcript is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({ apiKey });

    if (mode === "punctuate") {
      const punctSystem =
        "Add correct punctuation, capitalisation and paragraph breaks to this transcript. Do not change, add or remove any words - only add punctuation and formatting. Return only the cleaned transcript with no other text.";
      const punctResp = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: punctSystem,
        messages: [{ role: "user", content: transcript }],
      });
      const cleaned = punctResp.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();
      return new Response(JSON.stringify({ cleaned: cleaned || transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const todayLabel = today.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const systemPrompt = `You are processing a meeting transcript for William Meadon, founder of Steppingstone. Today is ${todayLabel} (${todayIso}). Return ONLY a JSON object with no other text, no markdown, no backticks.

The JSON object must contain:
- contact_name (string or null)
- company (string or null)
- key_points (array of 3-5 strings, each a concise summary of a key discussion point)
- action_items (array of strings, each a specific follow-up or next step)
- additional_notes (string or null - anything else worth remembering)
- calendar_events (array, possibly empty)

For calendar_events: include only FUTURE appointments Will mentions arranging (lunch, call, meeting, drinks, etc.). Skip past events and skip vague intentions ("we should meet sometime"). Each event has:
  - summary: short title, e.g. "Lunch with John Smith"
  - description: optional context, e.g. "Discuss Curation introduction"
  - location: optional, e.g. "The Wolseley"
  - suggested_start: local datetime "YYYY-MM-DDTHH:MM:SS" (no timezone offset) or "YYYY-MM-DD" for all-day
  - suggested_end: same form; default duration 1 hour for lunch/dinner, 30 min for call
  - all_day: true if no specific time given
  - confidence: "high" if specific time and date given; "medium" if day mentioned but time inferred; "low" if vague

Day inference rules anchored on today (${todayIso}): "Thursday" means the next Thursday. "Next week" means Monday of next week unless a day is given. Default times: breakfast 08:00, coffee 10:00, lunch 12:30, drinks 18:00, dinner 19:30, meeting 09:00.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: `Here is the transcript:\n\n${transcript}` }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    const parsed = tryParseJson(raw);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "malformed", raw }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ extraction: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not process transcript.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});