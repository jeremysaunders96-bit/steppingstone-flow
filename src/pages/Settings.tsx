import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import {
  buildConsentUrl,
  isConfigured as isOAuthConfigured,
  KNOWN_ACCOUNTS,
  verifyReturnedState,
} from "@/lib/googleOAuth";
import {
  listConnectedAccounts,
  disconnectAccount,
  type GoogleAccountRow,
} from "@/lib/googleAccounts";
import { fetchFeedbackStats30d, type FeedbackStats30d } from "@/lib/feedbackStats";

export default function Settings() {
  const [accounts, setAccounts] = useState<GoogleAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [stats, setStats] = useState<FeedbackStats30d | null>(null);
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listConnectedAccounts();
      setAccounts(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchFeedbackStats30d().then(setStats).catch(() => { /* silent */ });
  }, [load]);

  // Handle OAuth callback feedback (?google_connected= / ?google_error=).
  useEffect(() => {
    const connected = params.get("google_connected");
    const errorCode = params.get("google_error");
    const state = params.get("state");
    if (!connected && !errorCode) return;

    if (state && !verifyReturnedState(state)) {
      toast({ title: "State mismatch", description: "OAuth response didn't match this browser. Try again.", variant: "destructive" });
    } else if (connected) {
      toast({ title: "Connected", description: connected });
    } else if (errorCode) {
      const detail = params.get("detail");
      toast({
        title: "Couldn't connect",
        description: detail ? `${errorCode}: ${detail}` : errorCode,
        variant: "destructive",
      });
    }
    const next = new URLSearchParams(params);
    next.delete("google_connected");
    next.delete("google_error");
    next.delete("state");
    next.delete("detail");
    setParams(next, { replace: true });
    load();
  }, [params, setParams, load]);

  const connectedByEmail = useMemo(() => {
    const m = new Map<string, GoogleAccountRow>();
    for (const a of accounts) m.set(a.account_email, a);
    return m;
  }, [accounts]);

  const startConnect = (email: string) => {
    if (!isOAuthConfigured()) {
      toast({
        title: "OAuth not configured yet",
        description: "Set VITE_GOOGLE_OAUTH_CLIENT_ID and the Supabase function secrets before connecting.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = buildConsentUrl(email);
  };

  const onDisconnect = async (email: string) => {
    try {
      await disconnectAccount(email);
      toast({ title: "Disconnected", description: email });
      load();
    } catch (e) {
      toast({ title: "Disconnect failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const onImport = async (email: string) => {
    setImporting(email);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-import-contacts", {
        body: { account_email: email },
      });
      if (error) throw error;
      const imported = (data as { imported?: number } | null)?.imported ?? 0;
      toast({ title: "Contacts imported", description: `${imported} added from ${email}.` });
    } catch (e) {
      toast({ title: "Import failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="font-display text-3xl text-teal">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect Will's Google accounts. Gmail drafts, calendar events, and contacts import all run off these.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-teal">Google integrations</h2>

        {!isOAuthConfigured() && (
          <div className="card-soft p-4 border border-amber-300 bg-amber-50 text-amber-900 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong>OAuth not yet configured.</strong> The Google Cloud project needs creating with Will,
                then paste the client ID into <code>VITE_GOOGLE_OAUTH_CLIENT_ID</code> and set the matching
                secrets on the Supabase project. Connect buttons stay disabled until then.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-3">
            {KNOWN_ACCOUNTS.map(({ email, label }) => {
              const row = connectedByEmail.get(email);
              const connected = Boolean(row);
              return (
                <div key={email} className="card-soft p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{email}</span>
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-ink/70">
                        {label}
                      </span>
                    </div>
                    {connected ? (
                      <div className="flex items-center gap-1.5 text-xs text-teal mt-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Connected{row?.updated_at ? ` · refreshed ${new Date(row.updated_at).toLocaleString()}` : ""}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-1">Not connected</div>
                    )}
                  </div>
                  {connected ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={importing === email}
                        onClick={() => onImport(email)}
                      >
                        {importing === email ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4 mr-1" />
                        )}
                        Import contacts
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDisconnect(email)}>
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="bg-teal hover:bg-teal/90 text-white"
                      size="sm"
                      disabled={!isOAuthConfigured()}
                      onClick={() => startConnect(email)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Importing contacts is a one-off action per account. It pulls Will's "Other contacts" (people he's
          emailed but never saved) plus his named contacts, tagged <code>gmail-import</code>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-teal">Drafting feedback</h2>
        <p className="text-xs text-muted-foreground -mt-2">
          Last 30 days. Every Send-to-Drafts or Copy auto-captures a before/after pair, which feeds
          recent dictation drafts. The higher the "sent as written" share, the closer the model is
          to Will's voice.
        </p>
        {stats === null ? (
          <div className="text-sm text-muted-foreground italic">Loading…</div>
        ) : stats.total === 0 ? (
          <div className="card-soft p-4 text-sm text-muted-foreground italic">
            No drafts captured yet. The next time Will hits Send to Drafts or Copy, a row lands here.
          </div>
        ) : (
          <div className="card-soft p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-display text-teal">{stats.sentAsWritten}</div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">Sent as written</div>
              </div>
              <div>
                <div className="text-2xl font-display text-orange">{stats.editedAndSent}</div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">Edited</div>
              </div>
              <div>
                <div className="text-2xl font-display text-muted-foreground">{stats.rejected}</div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">Rejected</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {stats.total} draft{stats.total === 1 ? "" : "s"} captured
              {stats.lastCapturedAt && ` · last: ${new Date(stats.lastCapturedAt).toLocaleString()}`}
              {stats.total > 0 && (
                <> · <strong>{Math.round((stats.sentAsWritten / stats.total) * 100)}%</strong> sent as written</>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
