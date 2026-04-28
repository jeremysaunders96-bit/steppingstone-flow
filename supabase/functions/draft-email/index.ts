import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_SYSTEM_PROMPT =
  "You are drafting an email on behalf of William Meadon, founder of Steppingstone. Will spent 28 years at JP Morgan as a fund manager. He is warm, direct, and senior. His emails are considered and personal - he never sounds corporate or generic. He tailors every email to the individual. He gets to the point with warmth. He signs off simply. He never uses buzzwords, em dashes as punctuation, or AI-sounding phrases. Write as if Will is writing it himself.";

interface InteractionSummary {
  date?: string;
  type?: string;
  summary?: string;
}

interface ContactBrief {
  name: string;
  company?: string | null;
  id?: string | null;
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
    .map(
      (i) =>
        `- ${i.date ?? "unknown date"} (${i.type ?? "note"}): ${i.summary ?? ""}`,
    )
    .join("\n");
}

interface FeedbackContext {
  contactSpecific: Array<{ outcome: string; edit_notes: string | null }>;
  recentEdited: Array<{ edit_notes: string | null }>;
}

function buildUserMessage(body: RequestBody, fb: FeedbackContext): string {
  const parts: string[] = [];
  if (body.mode === "intro") {
    const a = body.contactA!;
    const b = body.contactB!;
    parts.push(
      `Draft a double-opt-in introduction email introducing ${a.name} at ${a.company ?? "(company unknown)"} to ${b.name} at ${b.company ?? "(company unknown)"}.`,
      `Reason for the introduction: ${body.brief}.`,
      ``,
      `Interaction history for ${a.name} (most recent first):`,
      formatInteractions(a.recent_interactions),
      ``,
      `Interaction history for ${b.name} (most recent first):`,
      formatInteractions(b.recent_interactions),
      ``,
      `The email should be addressed to both parties in Will's standard introduction style - he checks with both before connecting them, explains clearly why he thinks they should meet, and signs off simply.`,
    );
  } else {
    const c = body.contact!;
    parts.push(
      `Draft an email to ${c.name} at ${c.company ?? "(company unknown)"}.`,
      ``,
      `Full interaction history with this contact (most recent first):`,
      formatInteractions(c.recent_interactions),
      ``,
      `The email needs to: ${body.brief}.`,
      ``,
      `Draft from the account: ${body.account ?? "william@steppingstone.co.uk"}.`,
    );
  }

  if (fb.contactSpecific.length > 0) {
    const lines = fb.contactSpecific
      .map((r) => `- ${r.outcome}${r.edit_notes ? `: ${r.edit_notes}` : ""}`)
      .join("\n");
    parts.push("", `Previous draft feedback for this contact:`, lines);
  }
  if (fb.recentEdited.length > 0) {
    const lines = fb.recentEdited
      .filter((r) => r.edit_notes && r.edit_notes.trim().length > 0)
      .map((r) => `- ${r.edit_notes}`)
      .join("\n");
    if (lines) {
      parts.push("", `General feedback on recent drafts Will has edited:`, lines);
    }
  }

  return parts.join("\n");
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Load system prompt from system_context
    let systemPrompt = FALLBACK_SYSTEM_PROMPT;
    try {
      const { data: ctxRows } = await sb
        .from("system_context")
        .select("context_text")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (ctxRows && ctxRows[0]?.context_text) {
        systemPrompt = ctxRows[0].context_text as string;
      }
    } catch (e) {
      console.warn("system_context fetch failed", e);
    }

    // 2. Load draft feedback context
    const contactIds: string[] = [];
    if (body.mode === "single" && body.contact?.id) contactIds.push(body.contact.id);
    if (body.mode === "intro") {
      if (body.contactA?.id) contactIds.push(body.contactA.id);
      if (body.contactB?.id) contactIds.push(body.contactB.id);
    }

    let contactSpecific: Array<{ outcome: string; edit_notes: string | null }> = [];
    if (contactIds.length > 0) {
      const { data } = await sb
        .from("draft_feedback")
        .select("outcome, edit_notes")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false })
        .limit(20);
      contactSpecific = (data ?? []) as typeof contactSpecific;
    }

    const { data: recentEditedData } = await sb
      .from("draft_feedback")
      .select("edit_notes, contact_id")
      .eq("outcome", "edited-and-sent")
      .order("created_at", { ascending: false })
      .limit(5);
    const recentEdited = ((recentEditedData ?? []) as Array<{ edit_notes: string | null; contact_id: string | null }>)
      .filter((r) => !contactIds.includes(r.contact_id ?? ""))
      .map((r) => ({ edit_notes: r.edit_notes }));

    const client = new Anthropic({ apiKey });
    const userMessage = buildUserMessage(body, { contactSpecific, recentEdited });

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
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