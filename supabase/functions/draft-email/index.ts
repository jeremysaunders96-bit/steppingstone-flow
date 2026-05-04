import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function detectEmailType(brief: string, contact?: ContactBrief): string {
  const b = brief.toLowerCase();
  if (b.includes("introduc") || b.includes("intro")) return "introduction";
  if (b.includes("follow up") || b.includes("follow-up") || b.includes("check in") || b.includes("chase"))
    return "follow-up";
  if (b.includes("waymap")) return "waymap-outreach";
  if (b.includes("curation") || b.includes("investment trust") || b.includes("it board")) return "curation-outreach";
  if (b.includes("richard noble") || b.includes("thrustwsh") || b.includes("water speed") || b.includes("sponsorship"))
    return "richard-noble-outreach";
  if (b.includes("newsletter") || b.includes("profile") || b.includes("steppingstone")) return "steppingstone-services";
  if (contact?.segment === "curation") return "curation-outreach";
  return "general";
}

function detectRelationshipRegister(contact?: ContactBrief): string {
  if (!contact) return "professional";
  const notes = (contact.notes ?? "").toLowerCase();
  const how = (contact.how_we_met ?? "").toLowerCase();
  const combined = notes + " " + how;

  if (
    combined.includes("family") ||
    combined.includes("daughter") ||
    combined.includes("son") ||
    combined.includes("dad")
  ) {
    return "family";
  }
  if (
    combined.includes("ex jpm") ||
    combined.includes("ex jp morgan") ||
    combined.includes("ex jpmorgan") ||
    combined.includes("ex schroders") ||
    combined.includes("ex flemings") ||
    combined.includes("ex colleague") ||
    combined.includes("old colleague") ||
    combined.includes("old friend") ||
    combined.includes("knows socially")
  ) {
    return "old-colleague";
  }
  if (
    combined.includes("met once") ||
    combined.includes("email outreach") ||
    combined.includes("cold") ||
    combined.includes("introduced via") ||
    combined.includes("intro via")
  ) {
    return "new-contact";
  }
  return "warm-professional";
}

function buildSignOff(register: string, name?: string): string {
  switch (register) {
    case "family":
      return "With much love, Dad xx";
    case "old-colleague":
      return "With best wishes, Will";
    case "new-contact":
      return "With thanks and best wishes, William";
    default:
      return "With best wishes, Will";
  }
}

function buildEmailTypeGuidance(emailType: string): string {
  switch (emailType) {
    case "introduction":
      return `This is a double-opt-in introduction email. Structure:
- Para 1: One warm line acknowledging the relationship or what prompted this
- Para 2: One line establishing Steppingstone's role and the connection
- Para 3: What the company or person IS - lead with the most striking credential or fact
- Para 4: One named proof point (a client, a venue, a specific number)
- Para 5: What is enclosed or offered - practical, no pressure
- Para 6: Soft close - leave the door open, never pressure
Keep to under 200 words. Let any attached deck do the heavy lifting.`;

    case "follow-up":
      return `This is a follow-up email. Rules:
- One paragraph maximum
- Reference the specific last interaction by name and date if known
- State clearly what you are following up on
- One question or one ask only
- Never say "just checking in" - every follow-up has a purpose
- Keep it under 80 words`;

    case "waymap-outreach":
      return `This is a Waymap introduction or outreach email. Structure:
- Para 1: Warm acknowledgement of the relationship or introduction
- Para 2: One line - Steppingstone has been appointed to help raise the profile of Waymap, an exciting young British tech company
- Para 3: What Waymap IS - "the world's most accurate navigation app. Remarkably, it needs neither GPS nor Wi-Fi to work" - accurate to 1 metre, effective indoors outdoors and underground, free to users, mass market appeal
- Para 4: ONE named proof point - Lord's Cricket Ground became the first stadium in the world to install it. Or Washington DC's entire transport system. Pick the most relevant one.
- Para 5: What is enclosed and offer to connect directly with founder Dr Tom Pey
- Para 6: Soft close
The human story: founded by Dr Tom Pey, who lost his sight aged 39. Use this when introducing to someone who would connect with that angle.`;

    case "curation-outreach":
      return `This is a Curation Connect outreach email to an investment trust board contact. Rules:
- Keep it SHORT. IT board directors are busy and senior. Under 150 words in the email body.
- If there is a lunch or meeting booked, let that carry the weight - the email just needs to introduce the idea
- The burning platform: the whole Trust sector is under pressure from Saba and other activists, the discount problem is real
- Curation proof points: 40 paying corporates including Unilever, Balfour Beatty, Fever-Tree. IT clients: Seraphim Space, Geiger Counter.
- Offer the two-month trial as a low-friction entry point
- Let the attached deck do the explaining - Will always attaches material rather than over-explaining in the email`;

    case "richard-noble-outreach":
      return `This is a Richard Noble / ThrustWSH outreach email. Structure:
- Para 1: Warm anchor line
- Para 2: Richard's credential PRECISELY: "Richard is a British entrepreneur who, as pilot, held the world land speed record between 1983 and 1997. He was also the project director of Thrust SSC, the British vehicle which holds the current world land speed record, set at Black Rock Desert, Nevada in 1997."
- Para 3: What he is doing now - testing a high-speed jet hydrofoil to break the world water speed record in Scotland in 2027. Netflix documentary in production.
- Para 4: Steppingstone's role and the ask. Include the honest qualification: "he can only spare time to speak to those who genuinely want and can afford to help"
- Para 5: Additional angle if relevant (education programme / sustainable fuel)
- Para 6: Soft close - offer to keep them in touch rather than demanding a meeting`;

    case "steppingstone-services":
      return `This is a Steppingstone services email. Rules:
- Open with what Steppingstone IS - "a one-stop-shop to help SMEs grow"
- Show range through named examples: Waymap (capital raising), Richard Noble (sponsorship), newsletter profiles (£500, 5,000 HNWs, 75% open rate)
- Name recent newsletter clients: Sapling Spirits, Sirplus, Wren Press (the King's stationers), David Yarrow, Peligoni Club
- Use Will's phrase: "Without exception, all have found being profiled for £500 a very cost-effective way to reach potential new customers"
- Specific numbers throughout: 5,000 people, 75% open rate, £500
- Close with an offer to speak at their convenience`;

    default:
      return `General email rules:
- Open with a warm specific anchor - a named meeting, a shared reference, something real
- One paragraph per idea, never combine two points
- Specific names, dates and numbers throughout - never vague
- Soft close that leaves the door open without pressure`;
  }
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
    const emailType = "introduction";
    const guidance = buildEmailTypeGuidance(emailType);

    parts.push(
      `Draft a double-opt-in introduction email from Will Meadon introducing ${a.name}${a.company ? ` at ${a.company}` : ""} to ${b.name}${b.company ? ` at ${b.company}` : ""}.`,
      ``,
      `Reason for the introduction: ${body.brief}.`,
      ``,
      `EMAIL TYPE GUIDANCE:`,
      guidance,
      ``,
      `Context on ${a.name}:`,
      a.notes ? `Notes: ${a.notes}` : "",
      `Recent interactions:`,
      formatInteractions(a.recent_interactions),
      ``,
      `Context on ${b.name}:`,
      b.notes ? `Notes: ${b.notes}` : "",
      `Recent interactions:`,
      formatInteractions(b.recent_interactions),
      ``,
      `Sign off: With best wishes, Will`,
    );
  } else {
    const c = body.contact!;
    const emailType = detectEmailType(body.brief, c);
    const register = detectRelationshipRegister(c);
    const signOff = buildSignOff(register, c.name);
    const guidance = buildEmailTypeGuidance(emailType);

    parts.push(
      `Draft an email from Will Meadon to ${c.name}${c.company ? ` at ${c.company}` : ""}.`,
      ``,
      `WHAT THE EMAIL NEEDS TO DO: ${body.brief}`,
      ``,
      `EMAIL TYPE: ${emailType}`,
      `RELATIONSHIP REGISTER: ${register}`,
      ``,
      `EMAIL TYPE GUIDANCE:`,
      guidance,
      ``,
      `CONTACT CONTEXT:`,
      c.notes ? `Notes on this contact: ${c.notes}` : "",
      c.how_we_met ? `How they met: ${c.how_we_met}` : "",
      c.status ? `Current status: ${c.status}` : "",
      c.segment ? `Segment: ${c.segment}` : "",
      ``,
      `INTERACTION HISTORY (most recent first):`,
      formatInteractions(c.recent_interactions),
      ``,
      `SIGN OFF TO USE: ${signOff}`,
      `SENDING ACCOUNT: ${body.account ?? "william@steppingstone.co.uk"}`,
    );
  }

  if (fb.contactSpecific.length > 0) {
    const lines = fb.contactSpecific.map((r) => `- ${r.outcome}${r.edit_notes ? `: ${r.edit_notes}` : ""}`).join("\n");
    parts.push("", `PREVIOUS DRAFT FEEDBACK FOR THIS CONTACT:`, lines);
  }

  if (fb.recentEdited.length > 0) {
    const lines = fb.recentEdited
      .filter((r) => r.edit_notes && r.edit_notes.trim().length > 0)
      .map((r) => `- ${r.edit_notes}`)
      .join("\n");
    if (lines) {
      parts.push("", `GENERAL FEEDBACK FROM RECENT DRAFTS WILL HAS EDITED:`, lines);
    }
  }

  return parts.filter((p) => p !== undefined && p !== null).join("\n");
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

    // 2. Fetch full contact details including notes if we have an id
    if (body.mode === "single" && body.contact?.id) {
      try {
        const { data: contactData } = await sb
          .from("contacts")
          .select("notes, how_we_met, status, segment")
          .eq("id", body.contact.id)
          .single();
        if (contactData) {
          body.contact.notes = contactData.notes ?? null;
          body.contact.how_we_met = contactData.how_we_met ?? null;
          body.contact.status = contactData.status ?? null;
          body.contact.segment = contactData.segment ?? null;
        }
      } catch (e) {
        console.warn("contact notes fetch failed", e);
      }
    }

    // 3. Load draft feedback context
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
