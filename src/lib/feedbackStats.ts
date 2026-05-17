import { supabase } from "@/lib/supabase";

export interface FeedbackStats30d {
  total: number;
  sentAsWritten: number;
  editedAndSent: number;
  rejected: number;
  // Most recent capture, for "data is flowing" reassurance.
  lastCapturedAt: string | null;
}

export async function fetchFeedbackStats30d(): Promise<FeedbackStats30d> {
  const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const { data, error } = await supabase
    .from("draft_feedback")
    .select("outcome, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as { outcome: string; created_at: string }[];
  let sentAsWritten = 0;
  let editedAndSent = 0;
  let rejected = 0;
  for (const r of rows) {
    if (r.outcome === "sent-as-written") sentAsWritten++;
    else if (r.outcome === "edited-and-sent") editedAndSent++;
    else if (r.outcome === "rejected") rejected++;
  }
  return {
    total: sentAsWritten + editedAndSent + rejected,
    sentAsWritten,
    editedAndSent,
    rejected,
    lastCapturedAt: rows[0]?.created_at ?? null,
  };
}
