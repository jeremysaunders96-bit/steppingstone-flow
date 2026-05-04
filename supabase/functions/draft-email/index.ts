import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_SYSTEM_PROMPT = `You are drafting emails on behalf of William Meadon, founder of Steppingstone. Will spent 28 years at JPMorgan, Flemings and Schroders. He is warm, direct and senior. His emails are short, structured and personal. He never sounds corporate. He signs off simply. He never uses buzzwords or AI-sounding phrases.`;

const INTRO_EMAIL_GUIDANCE = `
INTRODUCTION EMAIL - STUDY THESE REAL EXAMPLES THEN FOLLOW THE STRUCTURE EXACTLY.

--- REAL EXAMPLE A: WAYMAP INTRO (new contact via mutual introducer) ---

Subject: Waymap

Thank you, James and very good to be introduced to you, Alex.

My firm, Steppingstone has been appointed to help raise the profile of Waymap, an exciting, young British tech company.

Waymap is the world's most accurate navigation app. Remarkably, it needs neither GPS nor Wi-Fi to work and so is effective indoors, outdoors and deep underground and guides users to within 1 metre of their intended destination. Initially designed for people with visual impairments, such an app (which is free to the user), clearly has mass market appeal (for both sighted and the visually impaired) across the built environment e.g. offices, transport systems, hotels and sporting venues.

This summer, Lord's cricket ground became the first stadium in the world to install it to help all spectators not only find their seat more easily, but also have a better experience finding all the available amenities once at the ground.

I enclose a deck to show the ways in which Waymap might be of help to hotel owners, together with a one pager which includes the charging structure. Should, at any stage, you wish to speak directly to the Waymap management team, including founder Dr Tom Pey, I would be very happy to arrange.

Let me know if you need more, otherwise I look forward to hearing how I can help you further.

With thanks and best wishes, William

--- REAL EXAMPLE B: CURATION INTRO (warm relationship, lunch coming up) ---

Subject: Introduction to Curation Connect

Dear Nicky,

Looking forward to seeing you for lunch at Colbert on Thursday. The table is booked for 12.45pm.

As promised (or was it threatened?!) ahead of that, I enclose some material on Curation Connect which my firm, Steppingstone is busily introducing to Investment Trust boards. I look forward to hearing what you think.

With best wishes, Will

--- REAL EXAMPLE C: RICHARD NOBLE (following up on a request) ---

Subject: Richard Noble OBE

Dear Ollie,

As requested, I enclose some more information on Richard Noble.

Richard is a British entrepreneur who, as pilot, held the world land speed record between 1983 and 1997. He was also the project director of Thrust SSC, the British vehicle which holds the current world land speed record, set at Black Rock Desert, Nevada in 1997.

Now, with his highly-skilled team of British engineers at Thrust WSH (WSH = Water Speed Hydrofoil), Richard has designed and is currently testing a high-speed jet hydrofoil that will attempt to break the world water speed record in Scotland in 2027. His efforts are already attracting global attention, with Netflix currently making a high-profile documentary on this remarkable project.

Richard has asked my firm, Steppingstone to help him in a number of areas, including raising sponsorship for this unique attempt. So, if you know anyone who might be keen to be involved, I am sure Richard would be happy to meet them. He is a remarkable man, but as I'm sure you understand, he can only spare time to speak to those who genuinely want and can afford to help.

Not only does Richard want to break the world record but, through his Thrust education programme, he also wants to inspire the next generation of engineers by funding University STEM courses and apprenticeships in the UK.

Sustainability is also a consideration for Richard, as the jet engine runs on a British, sustainable fossil-free jet fuel, which has taken 25 years to develop.

So, at this stage, please let me know if you, or others you know, would like to be kept in touch with Thrust WSH's progress over the coming months.

I look forward to staying in touch. With best wishes, Will

---

STRUCTURE TO FOLLOW - in this exact order:

LINE 1 - The human anchor. Choose based on context:
- New contact via introduction: "Thank you, [introducer] and very good to be introduced to you, [recipient]."
- Warm contact with meeting coming up: "Looking forward to seeing you for [lunch/coffee] at [venue] on [day]. The table is booked for [time]."
- Following up on a request: "As requested, I enclose some more information on [subject]."
NEVER: "I hope this finds you well" / "I am writing to" / "I wanted to reach out"

LINE 2 - Steppingstone's role. One line only.
- "My firm, Steppingstone has been appointed to help raise the profile of [company]."
- For Curation: "my firm, Steppingstone is busily introducing to Investment Trust boards."
Always name Steppingstone before the subject.

PARA 3 - What the subject IS. The single most remarkable fact first.
- Waymap: "Waymap is the world's most accurate navigation app. Remarkably, it needs neither GPS nor Wi-Fi to work..."
- Richard Noble: "Richard is a British entrepreneur who, as pilot, held the world land speed record between 1983 and 1997..."
- Specific. Precise dates. Named achievements. One paragraph, one job.

PARA 4 - One proof point only. The single best one for this recipient.
- Waymap hotel contact: Lord's Cricket Ground
- Waymap transport contact: Washington DC Metro
- Waymap investor: £2m raise, Ed Parsons (ex Google Maps) as board adviser
- Richard Noble: Netflix documentary in production

PARA 5 - What is enclosed and the practical offer.
- "I enclose a deck..." or "I attach a short note..."
- "Should you wish to speak directly to [founder], I would be very happy to arrange."

PARA 6 - Soft close. No pressure. No questions.
- "Let me know if you need more, otherwise I look forward to hearing how I can help you further."
- "I look forward to hearing what you think."
- "So, at this stage, please let me know if you, or others you know, would like to be kept in touch."

SIGN-OFF:
- New contact: "With thanks and best wishes, William"
- Warm contact: "With best wishes, Will"
- Old colleague: "With best wishes, Will"

LENGTH:
- Warm contact with meeting coming up: SHORT like Example B. Under 80 words.
- New contact via introduction: MEDIUM like Example A. 150-200 words.
- Detailed information follow-up: FULL like Example C.

NEVER IN AN INTRO EMAIL:
- Bullet points
- Multiple proof points stacked together
- Company history or background paragraphs
- "Excited / thrilled / delighted to share / innovative / passionate"
- Em dashes as punctuation
- Questions at the end of paragraphs
- More than 250 words (unless it is a full Richard Noble or Waymap information email)
- Anything that sounds like a brochure
`;

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
  if (b.includes("waymap")) return "waymap-intro";
  if (b.includes("curation") || b.includes("investment trust") || b.includes("it board")) return "curation-intro";
  if (b.includes("richard noble") || b.includes("thrustwsh") || b.includes("water speed") || b.includes("sponsorship"))
    return "richard-noble-intro";
  if (b.includes("follow up") || b.includes("follow-up") || b.includes("chase") || b.includes("check in"))
    return "follow-up";
  if (b.includes("newsletter") || b.includes("profile") || b.includes("steppingstone")) return "steppingstone-services";
  if (contact?.segment === "curation") return "curation-intro";
  return "general";
}

function isIntroType(emailType: string): boolean {
  return ["introduction", "waymap-intro", "curation-intro", "richard-noble-intro"].includes(emailType);
}

function detectRelationshipRegister(contact?: ContactBrief): string {
  if (!contact) return "professional";
  const combined = ((contact.notes ?? "") + " " + (contact.how_we_met ?? "")).toLowerCase();
  if (combined.includes("family") || combined.includes("daughter") || combined.includes("son")) return "family";
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
    combined.includes("new contact")
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

function buildNonIntroGuidance(emailType: string): string {
  switch (emailType) {
    case "follow-up":
      return `FOLLOW-UP EMAIL RULES:
- Maximum one paragraph
- Reference the specific last interaction by name and date if known
- State clearly what you are following up on
- One question or one ask only
- Never say "just checking in" - every follow-up has a purpose
- Under 80 words`;

    case "steppingstone-services":
      return `STEPPINGSTONE SERVICES EMAIL:
- Open: "As you know, my firm, Steppingstone is a one-stop-shop to help SMEs grow."
- Show range through named examples: Waymap (capital raising), Richard Noble (sponsorship), newsletter profiles
- Newsletter: £500 per slot, 5,000 HNWs and CEOs, 75%+ open rate (Mailchimp verified)
- Named recent profiles: Sapling Spirits, Sirplus, Wren Press (the King's stationers), David Yarrow, Peligoni Club
- Use: "Without exception, all have found being profiled for £500 a very cost-effective way to reach potential new customers"
- Close with offer to speak at their convenience`;

    default:
      return `GENERAL EMAIL RULES:
- Open with a warm specific anchor - a named meeting, a shared reference, something real. Never "I hope this finds you well."
- One paragraph per idea
- Specific names, dates and numbers - never vague
- Soft close that leaves the door open without pressure
- Sign off simply`;
  }
}

interface FeedbackContext {
  contactSpecific: Array<{ outcome: string; edit_notes: string | null }>;
  recentEdited: Array<{ edit_notes: string | null }>;
}

function buildUserMessage(body: RequestBody, fb: FeedbackContext): string {
  const parts: string[] = [];
  const emailType = detectEmailType(body.brief, body.contact ?? body.contactA);

  if (body.mode === "intro" || isIntroType(emailType)) {
    // Double opt-in introduction between two contacts
    if (body.mode === "intro" && body.contactA && body.contactB) {
      const a = body.contactA;
      const b = body.contactB;
      parts.push(
        `Draft a double opt-in introduction email from Will Meadon introducing ${a.name}${a.company ? ` at ${a.company}` : ""} to ${b.name}${b.company ? ` at ${b.company}` : ""}.`,
        `Reason: ${body.brief}`,
        ``,
        `Context on ${a.name}:`,
        a.notes ? `Notes: ${a.notes}` : "",
        formatInteractions(a.recent_interactions),
        ``,
        `Context on ${b.name}:`,
        b.notes ? `Notes: ${b.notes}` : "",
        formatInteractions(b.recent_interactions),
      );
    } else {
      // Single contact intro email
      const c = body.contact!;
      const register = detectRelationshipRegister(c);
      const signOff = buildSignOff(register);
      parts.push(
        `Draft an introduction email from Will Meadon to ${c.name}${c.company ? ` at ${c.company}` : ""}.`,
        ``,
        `WHAT THE EMAIL NEEDS TO DO: ${body.brief}`,
        `EMAIL TYPE: ${emailType}`,
        `RELATIONSHIP: ${register}`,
        ``,
        `CONTACT CONTEXT:`,
        c.notes ? `Notes: ${c.notes}` : "No notes on file.",
        c.how_we_met ? `How they met: ${c.how_we_met}` : "",
        c.status ? `Status: ${c.status}` : "",
        ``,
        `INTERACTION HISTORY:`,
        formatInteractions(c.recent_interactions),
        ``,
        `SIGN OFF TO USE: ${signOff}`,
      );
    }

    parts.push(``, `FOLLOW THIS STRUCTURE AND THESE EXAMPLES EXACTLY:`, INTRO_EMAIL_GUIDANCE);
  } else {
    // Non-intro email
    const c = body.contact!;
    const register = detectRelationshipRegister(c);
    const signOff = buildSignOff(register);
    const guidance = buildNonIntroGuidance(emailType);

    parts.push(
      `Draft an email from Will Meadon to ${c.name}${c.company ? ` at ${c.company}` : ""}.`,
      ``,
      `WHAT THE EMAIL NEEDS TO DO: ${body.brief}`,
      `EMAIL TYPE: ${emailType}`,
      `RELATIONSHIP: ${register}`,
      ``,
      `GUIDANCE:`,
      guidance,
      ``,
      `CONTACT CONTEXT:`,
      c.notes ? `Notes: ${c.notes}` : "No notes on file.",
      c.how_we_met ? `How they met: ${c.how_we_met}` : "",
      c.status ? `Status: ${c.status}` : "",
      ``,
      `INTERACTION HISTORY:`,
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
    if (lines) parts.push("", `GENERAL FEEDBACK FROM RECENT DRAFTS WILL HAS EDITED:`, lines);
  }

  return parts.filter((p) => p !== undefined && p !== null && p !== "undefined").join("\n");
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

    // Load system context
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

    // Fetch full contact details including notes
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

    // Load draft feedback
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
