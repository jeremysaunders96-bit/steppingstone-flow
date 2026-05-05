import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_SYSTEM_PROMPT = `You are drafting emails on behalf of William Meadon, founder of Steppingstone. Steppingstone is a one-stop-shop of fractional consultants and advisors helping UK SMEs grow, and runs a bi-monthly newsletter reaching 5,000 HNWIs. It is NOT a wealth management firm, family office, or mentoring service. Will spent 28 years at JPMorgan. Write exactly as he writes. Short paragraphs. Warm but direct. Never corporate. Never AI-sounding. Sign off simply.`;

interface InteractionSummary {
  date?: string;
  type?: string;
  summary?: string;
}

interface ContactBrief {
  name: string;
  company?: string | null;
  id?: string | null;
  notes?: string | null;
  segment?: string | null;
  how_we_met?: string | null;
  status?: string | null;
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
  return items.map((i) => `- ${i.date ?? "unknown date"} (${i.type ?? "note"}): ${i.summary ?? ""}`).join("\n");
}

function detectRelationshipRegister(contact?: ContactBrief): string {
  if (!contact) return "professional";
  const combined = ((contact.notes ?? "") + " " + (contact.how_we_met ?? "")).toLowerCase();
  if (
    combined.includes("family") ||
    combined.includes("daughter") ||
    combined.includes("son") ||
    combined.includes("dad")
  )
    return "family";
  if (
    combined.includes("ex jpm") ||
    combined.includes("ex jp morgan") ||
    combined.includes("ex jpmorgan") ||
    combined.includes("ex schroders") ||
    combined.includes("ex flemings") ||
    combined.includes("old colleague") ||
    combined.includes("old friend") ||
    combined.includes("knows socially")
  )
    return "old-colleague";
  if (
    combined.includes("met once") ||
    combined.includes("email outreach") ||
    combined.includes("introduced via") ||
    combined.includes("intro via") ||
    combined.includes("new contact") ||
    combined.includes("first email")
  )
    return "new-contact";
  return "warm-professional";
}

function buildSignOff(register: string): string {
  switch (register) {
    case "family":
      return "With much love, Dad xx";
    case "new-contact":
      return "With thanks and best wishes, William";
    default:
      return "With best wishes, Will";
  }
}

interface FeedbackContext {
  contactSpecific: Array<{ outcome: string; edit_notes: string | null }>;
  recentEdited: Array<{ edit_notes: string | null }>;
}

function buildUserMessage(body: RequestBody, fb: FeedbackContext): string {
  const parts: string[] = [];

  if (body.mode === "intro" && body.contactA && body.contactB) {
    const a = body.contactA;
    const b = body.contactB;
    parts.push(
      `Draft a double opt-in introduction email from Will Meadon introducing ${a.name}${a.company ? ` at ${a.company}` : ""} to ${b.name}${b.company ? ` at ${b.company}` : ""}.`,
      `Reason: ${body.brief}`,
      ``,
      `Context on ${a.name}: ${a.notes ?? "no notes"}`,
      `Context on ${b.name}: ${b.notes ?? "no notes"}`,
      ``,
      `Follow Will's standard intro email structure: warm anchor line naming both people, one line on why he is connecting them, what each person does in one sentence each, why he thinks they should meet, soft close. Under 150 words. Sign off: With best wishes, Will`,
    );
  } else {
    const c = body.contact!;
    const register = detectRelationshipRegister(c);
    const signOff = buildSignOff(register);

    parts.push(
      `Draft an email from Will Meadon to ${c.name}${c.company ? ` at ${c.company}` : ""}.`,
      ``,
      `BRIEF FROM WILL: ${body.brief}`,
      ``,
      `RELATIONSHIP: ${register}`,
      `SIGN OFF TO USE: ${signOff}`,
      ``,
      `CONTACT NOTES: ${c.notes ?? "no notes on file"}`,
      c.how_we_met ? `HOW THEY MET: ${c.how_we_met}` : "",
      c.status ? `STATUS: ${c.status}` : "",
      c.segment ? `SEGMENT: ${c.segment}` : "",
      ``,
      `INTERACTION HISTORY:`,
      formatInteractions(c.recent_interactions),
      ``,
      `INSTRUCTIONS:`,
      `1. Identify which template from the system_context most closely matches this situation`,
      `2. Follow that template's structure, length, and rhythm precisely`,
      `3. Use Will's stock phrases verbatim where they fit`,
      `4. Adapt only the specific names, dates, and recipient-specific framing`,
      `5. Never invent business activities or services not described in the system_context`,
      `6. Keep it short and warm - default to under 250 words unless replicating a long template`,
    );
  }

  if (fb.contactSpecific.length > 0) {
    const lines = fb.contactSpecific.map((r) => `- ${r.outcome}${r.edit_notes ? `: ${r.edit_notes}` : ""}`).join("\n");
    parts.push("", `PREVIOUS FEEDBACK FOR THIS CONTACT - APPLY THESE LEARNINGS:`, lines);
  }

  if (fb.recentEdited.length > 0) {
    const lines = fb.recentEdited
      .filter((r) => r.edit_notes && r.edit_notes.trim().length > 0)
      .map((r) => `- ${r.edit_notes}`)
      .join("\n");
    if (lines) parts.push("", `GENERAL FEEDBACK FROM RECENT DRAFTS:`, lines);
  }

  return parts.filter(Boolean).join("\n");
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
    if (!body || (body.mode !== "single" && body.mode !== "intro")) {
      return new Response(JSON.stringify({ error: "Missing or invalid mode." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.brief || typeof body.brief !== "string") {
      return new Response(JSON.stringify({ error: "Please describe what the email needs to do." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

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

    if (body.mode === "single" && body.contact?.id) {
      try {
        const { data: cd } = await sb
          .from("contacts")
          .select("notes, how_we_met, status, segment")
          .eq("id", body.contact.id)
          .single();
        if (cd) {
          body.contact.notes = cd.notes ?? null;
          body.contact.how_we_met = cd.how_we_met ?? null;
          body.contact.status = cd.status ?? null;
          body.contact.segment = cd.segment ?? null;
        }
      } catch (e) {
        console.warn("contact fetch failed", e);
      }
    }

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
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
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
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
