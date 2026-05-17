import { supabase } from "@/lib/supabase";

export interface GoogleAccountRow {
  account_email: string;
  display_name: string | null;
  scopes: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export async function listConnectedAccounts(): Promise<GoogleAccountRow[]> {
  const { data, error } = await supabase
    .from("user_google_tokens")
    .select("account_email, display_name, scopes, expires_at, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GoogleAccountRow[];
}

export async function disconnectAccount(accountEmail: string): Promise<void> {
  const { error } = await supabase
    .from("user_google_tokens")
    .delete()
    .eq("account_email", accountEmail);
  if (error) throw error;
}
