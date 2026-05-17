import { supabase, type LinkedInPost } from "@/lib/supabase";

export type LinkedInTopic = "sector" | "deal" | "network" | "cultural" | "other";
export type LinkedInDraftType = "paired" | "reshare" | "personal_standalone";

export const TOPIC_LABELS: Record<LinkedInTopic, string> = {
  sector: "Investment trust sector",
  deal: "Active deal / partnership",
  network: "Network / introduction",
  cultural: "Cultural recommendation",
  other: "Other",
};

export interface LinkedInPostRow extends LinkedInPost {
  topic: LinkedInTopic | null;
  trigger_source: string | null;
  source_url: string | null;
}

export interface GenerateInput {
  type: LinkedInDraftType;
  topic: LinkedInTopic;
  brief: string;
  trigger_source?: string;
  source_url?: string;
  regenerate_angle_hint?: string;
}

export interface PairedResult {
  type: "paired";
  company_body: string;
  personal_commentary: string;
}
export interface ReshareResult {
  type: "reshare";
  commentary: string;
}
export interface StandaloneResult {
  type: "personal_standalone";
  body: string;
}
export type GenerateResult = PairedResult | ReshareResult | StandaloneResult;

export async function generateLinkedInDraft(input: GenerateInput): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke("linkedin-draft", { body: input });
  if (error) throw error;
  const result = data as Partial<GenerateResult> & { error?: string; raw?: string };
  if (!result || (result as { error?: string }).error) {
    throw new Error((result as { error?: string }).error || "Draft failed");
  }
  if (input.type === "paired") {
    const r = result as PairedResult;
    if (!r.company_body || !r.personal_commentary) throw new Error("Malformed paired response");
    return r;
  }
  if (input.type === "reshare") {
    const r = result as ReshareResult;
    if (!r.commentary) throw new Error("Malformed reshare response");
    return r;
  }
  const r = result as StandaloneResult;
  if (!r.body) throw new Error("Malformed standalone response");
  return r;
}

// Persists a generated draft as a linkedin_posts row with status='draft'.
export async function saveDraftRow(args: {
  type: LinkedInDraftType;
  topic: LinkedInTopic;
  trigger_source?: string;
  source_url?: string;
  brief: string;
  body: string;                       // company_body (paired) / commentary (reshare) / post body (standalone)
  personal_commentary?: string;       // only set for paired
}): Promise<LinkedInPostRow> {
  const post_type = args.type === "reshare" ? "reshare" : "original";
  const page = args.type === "paired" ? "company" : "personal";
  const row = {
    post_type,
    page,
    body_text: args.body,
    personal_commentary: args.personal_commentary ?? null,
    status: "draft",
    topic: args.topic,
    trigger_source: args.trigger_source ?? args.brief.slice(0, 200),
    source_url: args.source_url ?? null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("linkedin_posts") as any).insert(row).select().single();
  if (error) throw error;
  return data as LinkedInPostRow;
}

export async function listDrafts(): Promise<LinkedInPostRow[]> {
  const { data, error } = await supabase
    .from("linkedin_posts")
    .select("*")
    .eq("status", "draft")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LinkedInPostRow[];
}

export async function listPostedRecent(days = 30): Promise<LinkedInPostRow[]> {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const { data, error } = await supabase
    .from("linkedin_posts")
    .select("*")
    .eq("status", "posted")
    .gte("posted_at", since)
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LinkedInPostRow[];
}

export async function approveDraft(args: {
  postId: string;
  originalBody: string;
  originalPersonalCommentary: string | null;
  finalBody: string;
  finalPersonalCommentary: string | null;
  type: LinkedInDraftType;
  topic: LinkedInTopic | null;
  trigger_source: string | null;
  brief: string | null;
}): Promise<void> {
  // Implicit feedback: edited-and-sent if the textarea content differs, sent-as-written if it matches.
  const bodyChanged = args.originalBody.trim() !== args.finalBody.trim();
  const commentaryChanged =
    (args.originalPersonalCommentary ?? "").trim() !== (args.finalPersonalCommentary ?? "").trim();
  const outcome = (bodyChanged || commentaryChanged) ? "edited-and-sent" : "sent-as-written";

  // Update the post with the edited content + mark approved.
  const { error: updateErr } = await supabase
    .from("linkedin_posts")
    .update({ status: "approved", body_text: args.finalBody, personal_commentary: args.finalPersonalCommentary })
    .eq("id", args.postId);
  if (updateErr) throw updateErr;

  // Record feedback row. personal_standalone re-uses the company_body columns for the
  // post text — simpler than adding a third pair of columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: fbErr } = await (supabase.from("linkedin_draft_feedback") as any).insert(
    args.type === "paired"
      ? {
          post_id: args.postId,
          type: "paired",
          outcome,
          original_company_body: args.originalBody,
          final_company_body: args.finalBody,
          original_personal_commentary: args.originalPersonalCommentary,
          final_personal_commentary: args.finalPersonalCommentary,
          topic: args.topic,
          trigger_source: args.trigger_source,
          brief: args.brief,
        }
      : args.type === "reshare"
        ? {
            post_id: args.postId,
            type: "reshare",
            outcome,
            original_reshare_commentary: args.originalBody,
            final_reshare_commentary: args.finalBody,
            topic: args.topic,
            trigger_source: args.trigger_source,
            brief: args.brief,
          }
        : {
            post_id: args.postId,
            type: "personal_standalone",
            outcome,
            original_company_body: args.originalBody,
            final_company_body: args.finalBody,
            topic: args.topic,
            trigger_source: args.trigger_source,
            brief: args.brief,
          },
  );
  if (fbErr) throw fbErr;
}

export async function rejectDraft(args: {
  postId: string;
  type: LinkedInDraftType;
  topic: LinkedInTopic | null;
  trigger_source: string | null;
  brief: string | null;
  body: string;
  personal_commentary: string | null;
  edit_notes: string | null;
}): Promise<void> {
  // Mark as ignored.
  const { error: updateErr } = await supabase
    .from("linkedin_posts")
    .update({ status: "ignored" })
    .eq("id", args.postId);
  if (updateErr) throw updateErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: fbErr } = await (supabase.from("linkedin_draft_feedback") as any).insert(
    args.type === "paired"
      ? {
          post_id: args.postId,
          type: "paired",
          outcome: "rejected",
          original_company_body: args.body,
          original_personal_commentary: args.personal_commentary,
          edit_notes: args.edit_notes,
          topic: args.topic,
          trigger_source: args.trigger_source,
          brief: args.brief,
        }
      : args.type === "reshare"
        ? {
            post_id: args.postId,
            type: "reshare",
            outcome: "rejected",
            original_reshare_commentary: args.body,
            edit_notes: args.edit_notes,
            topic: args.topic,
            trigger_source: args.trigger_source,
            brief: args.brief,
          }
        : {
            post_id: args.postId,
            type: "personal_standalone",
            outcome: "rejected",
            original_company_body: args.body,
            edit_notes: args.edit_notes,
            topic: args.topic,
            trigger_source: args.trigger_source,
            brief: args.brief,
          },
  );
  if (fbErr) throw fbErr;
}

export async function markPosted(args: {
  postId: string;
  postedAt?: string;
  impressions?: number | null;
  reactions?: number | null;
  comments?: number | null;
}): Promise<void> {
  const { error } = await supabase
    .from("linkedin_posts")
    .update({
      status: "posted",
      posted_at: args.postedAt ?? new Date().toISOString(),
      impressions: args.impressions ?? null,
      reactions: args.reactions ?? null,
      comments: args.comments ?? null,
    })
    .eq("id", args.postId);
  if (error) throw error;
}

export async function updateEngagement(args: {
  postId: string;
  impressions?: number | null;
  reactions?: number | null;
  comments?: number | null;
}): Promise<void> {
  const patch: Record<string, number | null> = {};
  if (args.impressions !== undefined) patch.impressions = args.impressions;
  if (args.reactions !== undefined) patch.reactions = args.reactions;
  if (args.comments !== undefined) patch.comments = args.comments;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("linkedin_posts").update(patch).eq("id", args.postId);
  if (error) throw error;
}
