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
  mode: "single" | "intro" | "dictation";
  brief: string;
  account?: string;
  templateType?: string;
  contact?: ContactBrief;
  contactA?: ContactBrief;
  contactB?: ContactBrief;
}

interface EmailTemplate {
  id: string;
  label: string;
  subject_template: string;
  body_template: string;
  guidance: string;
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

function buildTemplateUserMessage(body: RequestBody, template: EmailTemplate, fb: FeedbackContext): string {
  const c = body.contact!;
  const register = detectRelationshipRegister(c);
  const signOff = buildSignOff(register);

  const parts: string[] = [
    `Draft an email from Will Meadon to ${c.name}${c.company ? ` at ${c.company}` : ""}.`,
    ``,
    `TEMPLATE TO USE: ${template.label}`,
    ``,
    `THIS IS THE VERBATIM TEMPLATE - DO NOT REWRITE THE NON-BRACKETED CONTENT:`,
    `─────────────────────────────────────────`,
    `Subject: ${template.subject_template}`,
    ``,
    template.body_template,
    `─────────────────────────────────────────`,
    ``,
    `HOW TO PERSONALISE THE BRACKETED SECTIONS:`,
    template.guidance,
    ``,
    `PERSONALISATION FROM WILL: ${body.brief || "(no specific personalisation provided)"}`,
    ``,
    `CONTACT NOTES: ${c.notes ?? "no notes on file"}`,
    c.how_we_met ? `HOW THEY MET: ${c.how_we_met}` : "",
    c.status ? `STATUS: ${c.status}` : "",
    c.segment ? `SEGMENT: ${c.segment}` : "",
    ``,
    `INTERACTION HISTORY:`,
    formatInteractions(c.recent_interactions),
    ``,
    `RELATIONSHIP REGISTER: ${register}`,
    `DEFAULT SIGN OFF: ${signOff}`,
    ``,
    `CRITICAL RULES:`,
    `1. Output the email with the bracketed sections replaced according to the guidance above.`,
    `2. DO NOT alter, rewrite, paraphrase or summarise any non-bracketed content in the template body. It is verbatim Will Meadon writing.`,
    `3. DO NOT add additional paragraphs not in the template.`,
    `4. DO NOT add bullet points unless they are in the template.`,
    `5. DO NOT use phrases banned in the system_context (em dashes, "I hope this finds you well", etc).`,
    `6. Use the personalisation provided by Will to shape the [OPENING ANCHOR] and [PERSONALISED CLOSE] sections.`,
    `7. Output the email ready to send. No preamble, no commentary, just the email body starting with the subject line.`,
  ];

  if (fb.contactSpecific.length > 0) {
    const lines = fb.contactSpecific.map((r) => `- ${r.outcome}${r.edit_notes ? `: ${r.edit_notes}` : ""}`).join("\n");
    parts.push("", `PREVIOUS FEEDBACK FOR THIS CONTACT - APPLY THESE LEARNINGS:`, lines);
  }

  return parts.filter(Boolean).join("\n");
}

function buildDictationUserMessage(body: RequestBody, fb: FeedbackContext): string {
  const c = body.contact!;
  const register = detectRelationshipRegister(c);
  const signOff = buildSignOff(register);

  const parts: string[] = [
    `Will Meadon has dictated the following content for an email to ${c.name}${c.company ? ` at ${c.company}` : ""}.`,
    ``,
    `RAW DICTATION FROM WILL:`,
    `─────────────────────────────────────────`,
    body.brief,
    `─────────────────────────────────────────`,
    ``,
    `YOUR JOB:`,
    `Tidy this dictation into a properly structured, well-written email. Will spoke this aloud, so it may have repetitions, "ums," half-finished sentences, or out-of-order ideas. Your task is to:`,
    ``,
    `1. PRESERVE everything Will said - all the points, all the references, all the warmth`,
    `2. STRUCTURE it as a proper email with appropriate paragraphs (one job per paragraph)`,
    `3. FIX grammar, punctuation, sentence flow`,
    `4. REMOVE filler words ("um", "you know", repetitions) only - never remove content`,
    `5. KEEP Will's voice - warm, direct, specific, never corporate`,
    `6. ADD a proper greeting at the top using "Dear [first name]," or "Hi [first name],"`,
    `7. ADD the appropriate sign-off based on relationship: ${signOff}`,
    ``,
    `NEVER:`,
    `- Add content Will did not say`,
    `- Add proof points, statistics, or company details he didn't mention`,
    `- Use phrases like "I hope this finds you well", "I am writing to", "I wanted to reach out"`,
    `- Use em dashes as punctuation`,
    `- Add bullet points`,
    `- Make it longer than necessary`,
    `- Add a subject line unless Will mentioned one - if needed, generate one that matches what he said`,
    ``,
    `CONTACT NOTES: ${c.notes ?? "no notes on file"}`,
    c.how_we_met ? `HOW THEY MET: ${c.how_we_met}` : "",
    ``,
    `INTERACTION HISTORY (for context only - do not invent references to past meetings unless Will mentioned them):`,
    formatInteractions(c.recent_interactions),
    ``,
    `Output the email ready to send. Start with the subject line if appropriate, then the email body.`,
  ];

  if (fb.contactSpecific.length > 0) {
    const lines = fb.contactSpecific.map((r) => `- ${r.outcome}${r.edit_notes ? `: ${r.edit_notes}` : ""}`).join("\n");
    parts.push("", `PREVIOUS FEEDBACK FOR THIS CONTACT - APPLY THESE LEARNINGS:`, lines);
  }

  return parts.filter(Boolean).join("\n");
}

function buildGeneralUserMessage(body: RequestBody, fb: FeedbackContext): string {
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
      ``,
      `INTERACTION HISTORY:`,
      formatInteractions(c.recent_interactions),
      ``,
      `Use the templates and stock phrases from the system_context. Keep it under 250 words unless a longer template applies.`,
    );
  }

  if (fb.contactSpecific.length > 0) {
    const lines = fb.contactSpecific.map((r) => `- ${r.outcome}${r.edit_notes ? `: ${r.edit_notes}` : ""}`).join("\n");
    parts.push("", `PREVIOUS FEEDBACK FOR THIS CONTACT:`, lines);
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
    if (!body || !["single", "intro", "dictation"].includes(body.mode)) {
      return new Response(JSON.stringify({ error: "Missing or invalid mode." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.brief || typeof body.brief !== "string") {
      return new Response(JSON.stringify({ error: "Please provide a brief or dictation." }), {
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

    if ((body.mode === "single" || body.mode === "dictation") && body.contact?.id) {
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

    let template: EmailTemplate | null = null;
    if (body.templateType && body.mode === "single") {
      try {
        const { data: tplRows } = await sb.from("email_templates").select("*").eq("id", body.templateType).limit(1);
        if (tplRows && tplRows[0]) {
          template = tplRows[0] as EmailTemplate;
        }
      } catch (e) {
        console.warn("template fetch failed", e);
      }
    }

    const contactIds: string[] = [];
    if ((body.mode === "single" || body.mode === "dictation") && body.contact?.id) {
      contactIds.push(body.contact.id);
    }
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

    let userMessage: string;
    if (body.mode === "dictation") {
      userMessage = buildDictationUserMessage(body, { contactSpecific, recentEdited });
    } else if (template) {
      userMessage = buildTemplateUserMessage(body, template, { contactSpecific, recentEdited });
    } else {
      userMessage = buildGeneralUserMessage(body, { contactSpecific, recentEdited });
    }

    const client = new Anthropic({ apiKey });
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
