import { supabase } from "@/lib/supabase";
import type { Contact } from "@/lib/supabase";

const CLOUD_URL = import.meta.env.VITE_SUPABASE_URL as string;
const CLOUD_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface InteractionSummary {
  date?: string;
  type?: string;
  summary?: string;
}

export interface ContactBrief {
  name: string;
  company?: string | null;
  recent_interactions?: InteractionSummary[];
}

export async function fetchRecentInteractions(contactId: string): Promise<InteractionSummary[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select("date, type, summary")
    .eq("contact_id", contactId)
    .order("date", { ascending: false })
    .limit(3);
  if (error) {
    console.error("fetchRecentInteractions", error);
    return [];
  }
  return (data ?? []) as InteractionSummary[];
}

export function contactToBrief(contact: Contact, interactions: InteractionSummary[]): ContactBrief {
  return {
    name: contact.full_name,
    company: contact.company,
    recent_interactions: interactions,
  };
}

type DraftSinglePayload = {
  mode: "single";
  brief: string;
  account: string;
  contact: ContactBrief;
};

type DraftIntroPayload = {
  mode: "intro";
  brief: string;
  contactA: ContactBrief;
  contactB: ContactBrief;
};

export async function generateDraft(payload: DraftSinglePayload | DraftIntroPayload): Promise<string> {
  const url = `${CLOUD_URL}/functions/v1/draft-email`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CLOUD_KEY}`,
      apikey: CLOUD_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || "Could not generate the draft. Please try again.");
  }
  return (data.draft as string) ?? "";
}