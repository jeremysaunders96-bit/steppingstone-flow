import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT =
  "You are drafting an email on behalf of William Meadon, founder of Steppingstone. Will spent 28 years at JP Morgan as a fund manager. He is warm, direct, and senior. His emails are considered and personal - he never sounds corporate or generic. He tailors every email to the individual. He gets to the point with warmth. He signs off simply. He never uses buzzwords, em dashes as punctuation, or AI-sounding phrases. Write as if Will is writing it himself.";

interface InteractionSummary {
  date?: string;
  type?: string;
  summary?: string;
}

interface ContactBrief {
  name: string;
  company?: string | null;
  recent_interactions?: InteractionSummary[];
}

interface RequestBody {
  mode: "single" | "intro";
  brief: string;
  account?: string;
  contact?: ContactBrief;
  contactA?: ContactBrief;
  contactB?: ContactBrief;
}

function formatInteractions(items?: InteractionSummary[]): string {
  if (!items || items.length === 0) return "No prior interactions on record.";
  return items
    .slice(0, 3)
    .map(
      (i) =>
        `- ${i.date ?? "unknown date"} (${i.type ?? "note"}): ${i.summary ?? ""}`,
    )
    .join("\n");
}

function buildUserMessage(body: RequestBody): string {
  if (body.mode === "intro") {
    const a = body.contactA!;
    const b = body.contactB!;
    return [
      `Draft a double-opt-in introduction email introducing ${a.name} at ${a.company ?? "(company unknown)"} to ${b.name} at ${b.company ?? "(company unknown)"}.`,
      `Reason for the introduction: ${body.brief}.`,
      ``,
      `Recent context for ${a.name}:`,
      formatInteractions(a.recent_interactions),
      ``,
      `Recent context for ${b.name}:`,
      formatInteractions(b.recent_interactions),
      ``,
      `The email should be addressed to both parties in Will's standard introduction style - he checks with both before connecting them, explains clearly why he thinks they should meet, and signs off simply.`,
    ].join("\n");
  }

  const c = body.contact!;
  return [
    `Draft an email to ${c.name} at ${c.company ?? "(company unknown)"}.`,
    ``,
    `Context about this contact and our relationship:`,
    formatInteractions(c.recent_interactions),
    ``,
    `The email needs to: ${body.brief}.`,
    ``,
    `Draft from the account: ${body.account ?? "william@steppingstone.co.uk"}.`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as RequestBody;
    if (!body || (body.mode !== "single" && body.mode !== "intro")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'mode'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!body.brief || typeof body.brief !== "string") {
      return new Response(
        JSON.stringify({ error: "Please describe what the email needs to do." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const client = new Anthropic({ apiKey });
    const userMessage = buildUserMessage(body);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const draft = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("draft-email error:", err);
    const message = err instanceof Error ? err.message : "Something went wrong generating the draft.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});