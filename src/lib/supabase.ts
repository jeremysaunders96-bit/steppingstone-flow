import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://depwgcghnvixbtifxtrz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlcHdnY2dobnZpeGJ0aWZ4dHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODEyMTEsImV4cCI6MjA5Mjk1NzIxMX0.pzpzlXNyuXrDz1N_n9GrT3do9RqIXp5T9FKDmEXkymE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type ContactStatus =
  | "contacted"
  | "replied"
  | "meeting booked"
  | "intro made"
  | "deal done"
  | "gone cold";

export interface Contact {
  id: string;
  full_name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  how_we_met: string | null;
  status: ContactStatus | null;
  linkedin_url: string | null;
  notes: string | null;
  last_contact_date: string | null;
  created_at: string;
}

export type InteractionType =
  | "meeting"
  | "call"
  | "email"
  | "voice note"
  | "introduction made"
  | "note";

export interface Interaction {
  id: string;
  contact_id: string;
  date: string;
  type: InteractionType;
  summary: string;
  full_note: string | null;
  action_items: { text: string; done: boolean }[] | null;
  needs_followup: boolean;
  followup_by: string | null;
  created_at: string;
}

export type DealStage =
  | "active" | "progressing" | "stalled" | "done"
  | "introduced" | "led-somewhere" | "gone-cold";
export type DealType =
  | "capital-raise"
  | "introduction-mandate"
  | "advisory"
  | "other"
  | "one-off-introduction";

export interface Deal {
  id: string;
  name: string;
  stage: DealStage;
  description: string | null;
  target_amount: number | null;
  created_at: string;
  deal_type: DealType | null;
  client_name: string | null;
  start_date: string | null;
  target_close_date: string | null;
  commission_structure: string | null;
  next_action: string | null;
  next_action_date: string | null;
  latest_update: string | null;
}

export interface DealContact {
  id: string;
  deal_id: string;
  contact_id: string;
  role_in_deal: string | null;
}

export type IntroductionStatus = "made" | "progressing" | "led-somewhere" | "gone-cold";

export interface Introduction {
  id: string;
  first_contact_id: string;
  second_contact_id: string;
  reason: string | null;
  status: IntroductionStatus;
  created_at: string;
}

export interface IntroductionWithOther extends Introduction {
  other: Contact | null;
}

export type LinkedInStatus = "draft" | "approved" | "ignored" | "posted";
export type LinkedInType = "Original" | "Reshare" | "Cultural";
export type LinkedInPage = "Company page" | "Personal page";

export interface LinkedInPost {
  id: string;
  post_type: LinkedInType;
  page: LinkedInPage;
  body: string;
  personal_commentary: string | null;
  status: LinkedInStatus;
  posted_at: string | null;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  created_at: string;
}

export type UnmatchedMemoStatus = "unmatched" | "assigned" | "dismissed";

export interface UnmatchedMemo {
  id: string;
  extracted_contact_name: string | null;
  extracted_company: string | null;
  extracted_summary: string | null;
  extracted_full_note: string | null;
  extracted_action_items: { text: string; done: boolean }[] | null;
  extracted_date: string | null;
  extracted_type: string | null;
  status: UnmatchedMemoStatus;
  assigned_contact_id: string | null;
  assigned_interaction_id: string | null;
  created_at: string;
}