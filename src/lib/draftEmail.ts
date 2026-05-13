import { supabase } from "@/integrations/supabase/client";
import { supabase as supabaseLegacy, type Contact } from "@/lib/supabase";

export interface InteractionSummary {
  date?: string;
  type?: string;
  summary?: string;
}

export interface ContactBrief {
  name: string;
  company?: string | null;
  id?: string | null;
  notes?: string | null;
  segment?: string | null;
  how_we_met?: string | null;
  status?: string | null;
  recent_interactions?: InteractionSummary[];
}

export async function fetchRecentInteractions(contactId: string): Promise<InteractionSummary[]> {
  const { data, error } = await supabaseLegacy
    .from("interactions")
    .select("date, type, summary")
    .eq("contact_id", contactId)
    .order("date", { ascending: false });
  if (error) {
    console.error("fetchRecentInteractions", error);
    return [];
  }
  return (data ?? []) as InteractionSummary[];
}

export function contactToBrief(contact: Contact, interactions: InteractionSummary[]): ContactBrief {
  return {
    id: contact.id,
    name: contact.full_name,
    company: contact.company,
    notes: contact.notes,
    segment: "segment" in contact ? contact.segment : null,
    how_we_met: contact.how_we_met,
    status: contact.status,
    recent_interactions: interactions,
  };
}

type DraftSinglePayload = {
  mode: "single";
  brief: string;
  account: string;
  contact: ContactBrief;
  templateType?: "stepping-stone" | "curation" | "waymap" | "richard-noble" | "newsletter";
};

type DraftIntroPayload = {
  mode: "intro";
  brief: string;
  contactA: ContactBrief;
  contactB: ContactBrief;
};

type DraftDictationPayload = {
  mode: "dictation";
  brief: string;
  account?: string;
  contact?: ContactBrief | null;
};

export async function generateDraft(
  payload: DraftSinglePayload | DraftIntroPayload | DraftDictationPayload
): Promise<string> {
  let slimBody: Record<string, unknown>;
  if (payload.mode === "single") {
    slimBody = { mode: "single", brief: payload.brief, contact: payload.contact };
    if (payload.templateType) slimBody.templateType = payload.templateType;
  } else if (payload.mode === "intro") {
    slimBody = { mode: "intro", brief: payload.brief, contact: payload.contactA };
  } else {
    slimBody = { mode: "dictation", brief: payload.brief, dictation: payload.brief, contact: payload.contact ?? null };
  }
  const { data, error } = await supabase.functions.invoke("draft-email", {
    body: slimBody,
  });
  if (error) {
    throw new Error(error.message || "Could not generate the draft. Please try again.");
  }
  if (data && typeof (data as { error?: string }).error === "string") {
    throw new Error((data as { error: string }).error);
  }
  return ((data as { draft?: string })?.draft) ?? "";
}

export type DraftOutcome = "sent-as-written" | "edited-and-sent" | "rejected";

export async function saveDraftFeedback(args: {
  contactId?: string | null;
  mode: "single" | "intro";
  outcome: DraftOutcome;
  originalDraft: string;
  finalVersion?: string | null;
  editNotes?: string | null;
  brief?: string | null;
}): Promise<void> {
  const row: Record<string, unknown> = {
    contact_id: args.contactId ?? null,
    mode: args.mode,
    outcome: args.outcome,
    original_draft: args.originalDraft,
    final_version: args.finalVersion ?? args.originalDraft,
    edit_notes: args.editNotes ?? null,
    brief: args.brief ?? null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseLegacy.from("draft_feedback") as any).insert(row);
  if (error) throw error;
}