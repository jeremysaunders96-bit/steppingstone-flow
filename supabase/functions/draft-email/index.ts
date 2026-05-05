import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_SYSTEM_PROMPT = `You are drafting emails on behalf of William Meadon, founder of Steppingstone. Write exactly as he writes. Short paragraphs. Warm but direct. Never corporate. Never AI-sounding. Sign off simply.`;

// ─────────────────────────────────────────────
// REAL EMAIL TEMPLATES - REPLICATE THESE EXACTLY
// ─────────────────────────────────────────────

const WAYMAP_TEMPLATE = `
You are replicating this exact email, adapted only for the new recipient and any additional context provided.

WILL'S REAL WAYMAP INTRO EMAIL - THIS IS YOUR TEMPLATE:
───────────────────────────────────────────────────────
Subject: Waymap

Thank you, James and very good to be introduced to you, Alex.

My firm, Steppingstone has been appointed to help raise the profile of Waymap, an exciting, young British tech company.

Waymap is the world's most accurate navigation app. Remarkably, it needs neither GPS nor Wi-Fi to work and so is effective indoors, outdoors and deep underground and guides users to within 1 metre of their intended destination. Initially designed for people with visual impairments, such an app (which is free to the user), clearly has mass market appeal (for both sighted and the visually impaired) across the built environment e.g. offices, transport systems, hotels and sporting venues.

This summer, Lord's cricket ground became the first stadium in the world to install it to help all spectators not only find their seat more easily, but also have a better experience finding all the available amenities once at the ground.

I enclose a deck to show the ways in which Waymap might be of help to hotel owners, together with a one pager which includes the charging structure. Should, at any stage, you wish to speak directly to the Waymap management team, including founder Dr Tom Pey, I would be very happy to arrange.

Let me know if you need more, otherwise I look forward to hearing how I can help you further.

With thanks and best wishes, William
───────────────────────────────────────────────────────

HOW TO ADAPT THIS TEMPLATE:

Line 1: Change the introducer name and recipient name to match the new contact. If no introducer, use "Very good to connect with you, [name]." or "As requested, I wanted to introduce you to Waymap."
Para 2: Keep identical - only change if Steppingstone's specific role for this contact differs.
Para 3: Keep the Waymap description IDENTICAL - this is factual and accurate. Do not rewrite it.
Para 4: Change the proof point to match the recipient's world:
  - Hotel / hospitality: use Lord's Cricket Ground as in the template
  - Transport: "Waymap is now live across the whole of Washington DC's entire transport system"
  - Investor: "So impressed were the Google Foundation with the technology that they gave Waymap a $1m grant to change the world for blind people"
  - General: use Lord's Cricket Ground
Para 5: Change "hotel owners" to the relevant sector. Keep the offer to connect with Dr Tom Pey.
Para 6: Keep identical.
Sign-off: "With thanks and best wishes, William" for new contacts. "With best wishes, Will" for warm contacts.

NEVER: Add extra paragraphs. Change the Waymap description. Add bullet points. Make it longer than the template.
`;

const CURATION_TEMPLATE = `
You are replicating this exact email, adapted only for the new recipient and any additional context provided.

WILL'S REAL CURATION INTRO EMAIL - THIS IS YOUR TEMPLATE:
───────────────────────────────────────────────────────
Subject: Introduction to Curation Connect

Dear Nicky,

Looking forward to seeing you for lunch at Colbert on Thursday. The table is booked for 12.45pm.

As promised (or was it threatened?!) ahead of that, I enclose some material on Curation Connect which my firm, Steppingstone is busily introducing to Investment Trust boards. I look forward to hearing what you think.

With best wishes, Will
───────────────────────────────────────────────────────

HOW TO ADAPT THIS TEMPLATE:

This email is SHORT because Will has a warm relationship and a meeting coming up. That is the model.

If there IS a meeting or lunch coming up:
- Line 1: Reference the specific meeting, venue and time as Will does. Keep it this short.
- Line 2: Use the "As promised (or was it threatened?!)" aside if the relationship is warm enough - this is a signature Will move. If the relationship is newer, use "As discussed," or "As promised,"
- Close: "I look forward to hearing what you think." Keep it identical.
- Length: UNDER 80 WORDS. Let the attached material do the work.

If there is NO meeting coming up (cold or warm outreach without a meeting booked):
Use this adapted version:

Dear [Name],

[One warm anchor line - a shared connection, a recent introduction, or a reference to something relevant. E.g. "Thank you for making the time - it was good to speak last week." OR "Very good to be introduced to you via [introducer]."]

I enclose some material on Curation Connect, which my firm, Steppingstone is busily introducing to Investment Trust boards. [One sentence on why it is relevant to them specifically - e.g. "At a time when the whole sector is under pressure from Saba and other activists, I think what Curation have built is directly relevant to what your board is working through."]

I look forward to hearing what you think.

With best wishes, Will

KEY CURATION FACTS TO USE WHERE RELEVANT:
- Connects listed companies to retail investors at scale
- 40 paying corporate clients including Unilever, Balfour Beatty, Fever-Tree and Rathbones
- Investment trust clients: Seraphim Space and Geiger Counter
- Reaches 60,000+ investors per month
- The burning platform: discount problem, Saba pressure, need for new retail shareholders
- Two-month trial available
- Founded by Nirav Feingold

NEVER: Write more than 150 words. Add bullet points. Explain everything in the email - attach the deck instead. Sound like a brochure.
`;

const RICHARD_NOBLE_TEMPLATE = `
You are replicating this exact email, adapted only for the new recipient and any additional context provided.

WILL'S REAL RICHARD NOBLE EMAIL - THIS IS YOUR TEMPLATE:
───────────────────────────────────────────────────────
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
───────────────────────────────────────────────────────

HOW TO ADAPT THIS TEMPLATE:

Line 1: Change based on context:
  - "As requested, I enclose some more information on Richard Noble." - if they asked for it
  - "As promised, I enclose some information on Richard Noble." - if Will mentioned it in conversation
  - "I wanted to share some information on an extraordinary project I am involved with." - cold outreach

Paras 2 and 3: Keep IDENTICAL. These are factual and precise. Do not rewrite or summarise them.

Para 4 (Steppingstone role + qualification): Keep the qualification IDENTICAL: "he can only spare time to speak to those who genuinely want and can afford to help." This is deliberate and important.

Paras 5 and 6 (education + sustainability): Include both if the recipient would connect with them. For a corporate sponsor focused on ESG, lead with sustainability. For someone interested in skills and apprenticeships, lead with education. Both can be shortened to one sentence each if needed.

Close: "So, at this stage, please let me know if you, or others you know, would like to be kept in touch with Thrust WSH's progress over the coming months." Keep this soft close IDENTICAL or very close to it.

Sign-off: "With best wishes, Will"

NEVER: Remove the precise credential (1983-1997). Remove the honest qualification. Add bullet points. Make it shorter than the template unless context demands it.
`;

const STEPPINGSTONE_TEMPLATE = `
You are replicating this exact email, adapted only for the new recipient and any additional context provided.

WILL'S REAL STEPPINGSTONE SERVICES EMAIL - THIS IS YOUR TEMPLATE:
───────────────────────────────────────────────────────
Subject: An introduction to Steppingstone

Dear Clemmie,

As you know, my firm, Steppingstone is a one-stop-shop to help SMEs grow.

How we do this varies from client to client. Some just ask for access to our wide range of fractional professional advisors. Others, like Waymap want help with capital raising. We have even been appointed by world record holder, Richard Noble to help him raise sponsorship money for his next world record attempt: the world water speed record in Scotland in 2027.

Many clients simply pay a small sum to be featured in our now-quarterly newsletter, which reaches 5,000 high-net-worth individuals, CEOs, and entrepreneurs via email and LinkedIn. This is popular because our newsletter has an impressive open rate of over 75% (source: Mailchimp). I would have thought this would be a good value way for Cannizaro to start getting to know us.

Recent newsletters have profiled several quality companies and individuals with whom we have close affiliations, including Sapling Spirits, Sirplus, Wren Press (the King's stationers) and world renowned photographer, David Yarrow.

Without exception, all have found being profiled for £500 a very cost-effective way to reach potential new customers. Some have gone on to have longer-term affiliations and collaborations with us.

Our Easter newsletter is set to go to press in 10 days, with the Peligoni Club being one of the promotions. We still have a couple of other slots available, so if Cannizaro is interested in taking one, we have about a week to agree on a promotional narrative.

Of course, I'd be happy to speak to Michael at his convenience to discuss further how we can help Canizaro grow.

I attach a short explanatory deck.

With much love, Dad xx
───────────────────────────────────────────────────────

HOW TO ADAPT THIS TEMPLATE:

Para 1: Keep IDENTICAL except swap "As you know" for "As you may know" or "I wanted to share a little about" for contacts who do not already know Steppingstone.

Para 2: Keep the three examples IDENTICAL - fractional advisors, Waymap capital raising, Richard Noble. These are Will's best proof points.

Para 3: Keep the newsletter stats IDENTICAL - 5,000 HNWs, 75% open rate. Replace "Cannizaro" with the relevant company name. Replace "I would have thought this would be a good value way for [company] to start getting to know us" - this is a Will phrase, keep it.

Para 4: Keep the named examples IDENTICAL - Sapling Spirits, Sirplus, Wren Press, David Yarrow. Only update if there are newer more relevant profiles to reference.

Para 5: Keep "Without exception" IDENTICAL - this is a Will phrase. Do not change it.

Para 6: Update for the current newsletter slot availability and timing. If no specific slot context is given, replace with: "We have a few slots available in our next edition. If [company] would like to take one, do let me know and we can agree on a promotional narrative."

Para 7: Replace "Michael" with the right name. Replace "Canizaro" with the right company.

Sign-off: Calibrate to relationship:
  - Family: "With much love, Dad xx" as in the template
  - Close friend: "With much love, Will"  
  - Warm professional: "With best wishes, Will"
  - New contact: "With thanks and best wishes, William"

NEVER: Change "Without exception". Change the newsletter stats. Remove the named client examples. Add bullet points.
`;

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

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

function detectTemplate(brief: string, contact?: ContactBrief): string {
  const b = brief.toLowerCase();
  const notes = (contact?.notes ?? "").toLowerCase();
  const segment = (contact?.segment ?? "").toLowerCase();

  if (b.includes("waymap") || notes.includes("waymap")) return "waymap";
  if (b.includes("curation") || b.includes("investment trust") || b.includes("it board") || segment === "curation")
    return "curation";
  if (
    b.includes("richard noble") ||
    b.includes("thrustwsh") ||
    b.includes("water speed") ||
    b.includes("thrust") ||
    b.includes("sponsorship")
  )
    return "richard-noble";
  if (
    b.includes("steppingstone") ||
    b.includes("newsletter") ||
    b.includes("profile") ||
    (b.includes("introduce") && b.includes("business"))
  )
    return "steppingstone";
  if (b.includes("follow up") || b.includes("follow-up") || b.includes("chase") || b.includes("check in"))
    return "follow-up";
  return "general";
}

function getTemplate(templateType: string): string {
  switch (templateType) {
    case "waymap":
      return WAYMAP_TEMPLATE;
    case "curation":
      return CURATION_TEMPLATE;
    case "richard-noble":
      return RICHARD_NOBLE_TEMPLATE;
    case "steppingstone":
      return STEPPINGSTONE_TEMPLATE;
    default:
      return "";
  }
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
  const templateType = detectTemplate(body.brief, body.contact ?? body.contactA);
  const template = getTemplate(templateType);

  if (body.mode === "intro" && body.contactA && body.contactB) {
    // Double opt-in between two contacts
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

    if (template) {
      // Use the specific real email template
      parts.push(
        `Draft an email from Will Meadon to ${c.name}${c.company ? ` at ${c.company}` : ""}.`,
        ``,
        `BRIEF: ${body.brief}`,
        `RELATIONSHIP: ${register}`,
        `SIGN OFF TO USE: ${signOff}`,
        ``,
        `CONTACT NOTES: ${c.notes ?? "no notes on file"}`,
        c.how_we_met ? `HOW THEY MET: ${c.how_we_met}` : "",
        ``,
        `INTERACTION HISTORY:`,
        formatInteractions(c.recent_interactions),
        ``,
        template,
      );
    } else {
      // Follow-up or general email
      const isFollowUp = templateType === "follow-up";
      parts.push(
        `Draft an email from Will Meadon to ${c.name}${c.company ? ` at ${c.company}` : ""}.`,
        ``,
        `BRIEF: ${body.brief}`,
        `RELATIONSHIP: ${register}`,
        ``,
        `CONTACT NOTES: ${c.notes ?? "no notes on file"}`,
        c.how_we_met ? `HOW THEY MET: ${c.how_we_met}` : "",
        ``,
        `INTERACTION HISTORY:`,
        formatInteractions(c.recent_interactions),
        ``,
        isFollowUp
          ? `RULES: This is a follow-up email. Maximum one paragraph. Reference the specific last interaction. One ask only. Under 80 words. Never say "just checking in." Sign off: ${signOff}`
          : `RULES: Open with a warm specific anchor - a named meeting, a shared reference, something real. Never "I hope this finds you well." One paragraph per idea. Specific names and numbers. Soft close. Sign off: ${signOff}`,
      );
    }
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

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────

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

    // Fetch full contact details
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
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
