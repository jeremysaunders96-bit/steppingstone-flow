import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_SYSTEM_PROMPT = `You are drafting emails on behalf of William Meadon, founder of Steppingstone. Steppingstone is a one-stop-shop of fractional consultants and advisors helping UK SMEs grow, and runs a bi-monthly newsletter reaching 5,000 HNWIs. It is NOT a wealth management firm, family office, or mentoring service. Will spent 28 years at JPMorgan. Write exactly as he writes. Short paragraphs. Warm but direct. Never corporate. Never AI-sounding. Sign off simply.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const serviceKey = (() => {
      const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (legacy) return legacy;
      const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
      if (secretKeys) {
        try {
          const parsed = JSON.parse(secretKeys);
          return parsed.service_role ?? parsed.serviceRole ?? String(Object.values(parsed)[0]);
        } catch { /* ignore */ }
      }
      return Deno.env.get("SUPABASE_ANON_KEY")!;
    })();

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set");

    const body = await req.json();
    const { brief, contact, mode, templateType, dictation } = body;

    if (!brief && !dictation) {
      return new Response(JSON.stringify({ error: "brief or dictation is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);
    let systemPrompt = FALLBACK_SYSTEM_PROMPT;
    try {
      const { data: ctxRows, error: ctxError } = await sb
        .from("system_context")
        .select("context_text")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!ctxError && ctxRows && ctxRows[0]?.context_text) {
        systemPrompt = ctxRows[0].context_text as string;
        console.log("Loaded system_context, length:", systemPrompt.length);
      } else {
        console.log("Using fallback. DB error:", ctxError);
      }
    } catch (e) {
      console.warn("system_context fetch failed:", e);
    }

    const contactName = contact?.name ?? "the contact";
    const contactCompany = contact?.company ? ` at ${contact.company}` : "";

    const TEMPLATE_LABELS: Record<string, string> = {
      "stepping-stone": "Stepping Stone Introduction",
      "curation": "Curation Connect Introduction",
      "waymap": "Waymap Introduction",
      "richard-noble": "Richard Noble (ThrustWSH) Introduction",
      "newsletter": "Newsletter Pitch",
    };

    let userMessage: string;
    if (mode === "dictation") {
      userMessage = `Will dictated the following raw transcript for an email${contact ? ` to ${contactName}${contactCompany}` : ""}. Tidy it into a structured email in Will's voice. Preserve every piece of content and meaning. Fix grammar, structure and flow. Do not invent new facts. Short paragraphs. Sign off as Will.\n\nTranscript:\n"""\n${dictation}\n"""`;
    } else if (templateType && TEMPLATE_LABELS[templateType]) {
      const label = TEMPLATE_LABELS[templateType];
      userMessage = `Draft a "${label}" email from Will to ${contactName}${contactCompany}. Use the canonical ${label} template defined in the system context above as the base. Personalise it using the notes below; if no personalisation is given, send the standard version.\n\nPersonalisation notes: ${brief || "(none)"}\n\nKeep Will's voice. Short paragraphs. Sign off as Will. Template type: ${templateType}.`;
    } else {
      userMessage = `Write a short, personal email from Will to ${contactName}${contactCompany}.\n\nBrief: ${brief}\n\nKeep it to 3-4 short paragraphs. Warm but not gushing. No bullet points. Sign off as Will.`;
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const draft = (response.content[0] as { type: string; text: string }).text;

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("draft-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
