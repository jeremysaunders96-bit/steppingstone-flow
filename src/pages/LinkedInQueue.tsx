import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bookmark, Check, Copy, ExternalLink, Loader2, Newspaper, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  TOPIC_LABELS,
  type LinkedInTopic,
  type LinkedInDraftType,
  type LinkedInPostRow,
  approveDraft,
  generateLinkedInDraft,
  listDrafts,
  listPostedRecent,
  markPosted,
  rejectDraft,
  saveDraftRow,
} from "@/lib/linkedin";
import {
  type NewsItem,
  fetchTopItems,
  fetchSavedItems,
  lastRefreshTime,
  refreshNews,
  setItemStatus,
} from "@/lib/newsRadar";

function topicBadge(topic: LinkedInTopic | null) {
  if (!topic) return null;
  return (
    <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-light text-teal">
      {TOPIC_LABELS[topic]}
    </span>
  );
}

function typeBadge(type: LinkedInDraftType) {
  const label = type === "paired" ? "Paired" : type === "reshare" ? "Reshare" : "Personal";
  return (
    <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-ink/70">
      {label}
    </span>
  );
}

// Recovers the draft type from the stored row.
// - Reshare post_type → reshare
// - Original on Company page → paired
// - Original on Personal page (no commentary) → personal_standalone
function postType(p: LinkedInPostRow): LinkedInDraftType {
  if (p.post_type === "Reshare") return "reshare";
  if (p.page === "Personal page" && !p.personal_commentary) return "personal_standalone";
  return "paired";
}

interface GenerateInitialValues {
  type?: LinkedInDraftType;
  topic?: LinkedInTopic;
  trigger?: string;
  sourceUrl?: string;
  brief?: string;
}
interface GenerateOpener {
  values: GenerateInitialValues;
  fromNewsItemId?: string;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export default function LinkedInQueue() {
  const [drafts, setDrafts] = useState<LinkedInPostRow[]>([]);
  const [approvedPending, setApprovedPending] = useState<LinkedInPostRow[]>([]);
  const [posted, setPosted] = useState<LinkedInPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateOpener, setGenerateOpener] = useState<GenerateOpener | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([listDrafts(), listPostedRecent(30)]);
      const allDraftsAndApproved = d;
      setDrafts(allDraftsAndApproved.filter((r) => r.status === "draft"));
      // listDrafts only returns status='draft'; pull approved separately.
      const { data: appr } = await fetchApproved();
      setApprovedPending(appr);
      setPosted(p);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-12 max-w-4xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-teal">LinkedIn</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drafts you've asked the system to write. Approve, edit, regenerate, or reject. Nothing posts without you.
          </p>
        </div>
        <Button
          className="bg-teal hover:bg-teal/90 text-white"
          onClick={() => { setGenerateOpener(null); setGenerateOpen(true); }}
        >
          <Sparkles className="h-4 w-4 mr-2" /> Generate new post
        </Button>
      </header>

      <NewsRadarSection
        onDraftFromItem={(item) => {
          const isReshare = (item.url || "").includes("linkedin.com");
          setGenerateOpener({
            values: {
              type: isReshare ? "reshare" : "paired",
              topic: item.topic_match ?? "sector",
              trigger: item.source_name
                ? `${item.source_name}: ${item.title}`.slice(0, 200)
                : item.title.slice(0, 200),
              sourceUrl: isReshare ? item.url : undefined,
              brief: [
                item.title,
                item.snippet ?? "",
                item.relevance_reasoning ? `\nWhy this matters: ${item.relevance_reasoning}` : "",
              ].filter(Boolean).join("\n\n"),
            },
            fromNewsItemId: item.id,
          });
          setGenerateOpen(true);
        }}
      />

      <DraftsSection drafts={drafts} loading={loading} onChange={load} />
      <ApprovedSection rows={approvedPending} onChange={load} />
      <PostedSection rows={posted} />

      <GenerateModal
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        initialValues={generateOpener?.values}
        onCreated={async () => {
          if (generateOpener?.fromNewsItemId) {
            try { await setItemStatus(generateOpener.fromNewsItemId, "drafted"); } catch { /* ignore */ }
          }
          setGenerateOpener(null);
          setGenerateOpen(false);
          load();
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// News radar — sector RSS sources scored by Claude. Sits at the top of /linkedin.
// -----------------------------------------------------------------------------
function NewsRadarSection({ onDraftFromItem }: { onDraftFromItem: (item: NewsItem) => void }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [saved, setSaved] = useState<NewsItem[]>([]);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [top, sv, when] = await Promise.all([fetchTopItems(4), fetchSavedItems(10), lastRefreshTime()]);
      setItems(top);
      setSaved(sv);
      setLastFetched(when);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshNews();
      const newCount = result.new_items ?? 0;
      const errorCount = result.errors?.length ?? 0;
      toast.success(
        `${newCount} new item${newCount === 1 ? "" : "s"} pulled`
          + (errorCount > 0 ? ` (${errorCount} source${errorCount === 1 ? "" : "s"} errored)` : ""),
      );
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const onDismiss = async (id: string) => {
    try {
      await setItemStatus(id, "dismissed");
      setItems((arr) => arr.filter((x) => x.id !== id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onSave = async (id: string) => {
    try {
      await setItemStatus(id, "saved");
      setItems((arr) => arr.filter((x) => x.id !== id));
      const next = await fetchSavedItems(10);
      setSaved(next);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-teal" />
          <h2 className="font-display text-2xl text-teal">News radar</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last refresh: {formatRelative(lastFetched)}
          </span>
          <Button size="sm" variant="outline" disabled={refreshing} onClick={onRefresh}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="card-soft p-6 text-center text-muted-foreground italic text-sm">
          No high-relevance items right now. Hit Refresh to pull the latest from sources.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} onDraft={() => onDraftFromItem(item)} onDismiss={() => onDismiss(item.id)} onSave={() => onSave(item.id)} />
          ))}
        </div>
      )}

      {saved.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowSaved((v) => !v)}
            className="text-xs text-teal hover:underline"
          >
            {showSaved ? "Hide" : "Show"} {saved.length} saved item{saved.length === 1 ? "" : "s"}
          </button>
          {showSaved && (
            <div className="space-y-3 mt-3">
              {saved.map((item) => (
                <NewsCard key={item.id} item={item} onDraft={() => onDraftFromItem(item)} onDismiss={() => onDismiss(item.id)} onSave={() => {/* already saved */}} subtle />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function NewsCard({
  item,
  onDraft,
  onDismiss,
  onSave,
  subtle = false,
}: {
  item: NewsItem;
  onDraft: () => void;
  onDismiss: () => void;
  onSave: () => void;
  subtle?: boolean;
}) {
  return (
    <article className={`card-soft p-4 space-y-2 ${subtle ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.source_name && (
          <span className="px-2 py-0.5 rounded-full bg-muted text-ink/70">{item.source_name}</span>
        )}
        {item.topic_match && topicBadge(item.topic_match)}
        {item.relevance_score != null && (
          <span className="px-2 py-0.5 rounded-full bg-teal-light text-teal font-medium">
            Score {item.relevance_score}
          </span>
        )}
        {item.published_at && (
          <span>{new Date(item.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        )}
      </div>
      <a href={item.url} target="_blank" rel="noreferrer" className="block text-sm font-medium text-ink hover:text-teal">
        {item.title} <ExternalLink className="inline h-3 w-3 align-baseline" />
      </a>
      {item.snippet && (
        <p className="text-xs text-muted-foreground line-clamp-3">{item.snippet}</p>
      )}
      {item.relevance_reasoning && (
        <p className="text-xs italic text-teal/80">{item.relevance_reasoning}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" className="bg-teal hover:bg-teal/90 text-white" onClick={onDraft}>
          <Sparkles className="h-3.5 w-3.5 mr-1" /> Draft a post about this
        </Button>
        {!subtle && (
          <Button size="sm" variant="outline" onClick={onSave}>
            <Bookmark className="h-3.5 w-3.5 mr-1" /> Save for later
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          <X className="h-3.5 w-3.5 mr-1" /> Dismiss
        </Button>
      </div>
    </article>
  );
}

// -----------------------------------------------------------------------------
// Drafts (status='draft') — Will reviews here.
// -----------------------------------------------------------------------------
function DraftsSection({
  drafts,
  loading,
  onChange,
}: {
  drafts: LinkedInPostRow[];
  loading: boolean;
  onChange: () => void;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl text-teal mb-4">Awaiting your review</h2>
      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : drafts.length === 0 ? (
        <div className="card-soft p-8 text-center text-muted-foreground italic">
          No drafts yet. Click "Generate new post" to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((d) => (
            <DraftCard key={d.id} row={d} onChange={onChange} />
          ))}
        </div>
      )}
    </section>
  );
}

function DraftCard({ row, onChange }: { row: LinkedInPostRow; onChange: () => void }) {
  const type = postType(row);
  const [body, setBody] = useState(row.body);
  const [personal, setPersonal] = useState(row.personal_commentary ?? "");
  const [busy, setBusy] = useState<"approve" | "reject" | "regenerate" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenHint, setRegenHint] = useState("");

  const onApprove = async () => {
    setBusy("approve");
    try {
      await approveDraft({
        postId: row.id,
        originalBody: row.body,
        originalPersonalCommentary: row.personal_commentary ?? null,
        finalBody: body,
        finalPersonalCommentary: type === "paired" ? personal : null,
        type,
        topic: row.topic,
        trigger_source: row.trigger_source,
        brief: row.trigger_source,
      });
      toast.success("Approved");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onReject = async () => {
    setBusy("reject");
    try {
      await rejectDraft({
        postId: row.id,
        type,
        topic: row.topic,
        trigger_source: row.trigger_source,
        brief: row.trigger_source,
        body: row.body,
        personal_commentary: row.personal_commentary ?? null,
        edit_notes: rejectNote.trim() || null,
      });
      toast.success("Rejected — the model will see this");
      setRejectOpen(false);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onRegenerate = async () => {
    if (!row.trigger_source) {
      toast.error("Can't regenerate — original brief not stored");
      return;
    }
    setBusy("regenerate");
    try {
      const result = await generateLinkedInDraft({
        type,
        topic: row.topic ?? "other",
        brief: row.trigger_source,
        trigger_source: row.trigger_source,
        source_url: row.source_url ?? undefined,
        regenerate_angle_hint: regenHint.trim() || undefined,
      });
      // Replace the body/commentary in the row, save back.
      if (result.type === "paired") {
        setBody(result.company_body);
        setPersonal(result.personal_commentary);
        await fetchSupabaseUpdate(row.id, {
          body: result.company_body,
          personal_commentary: result.personal_commentary,
        });
      } else if (result.type === "reshare") {
        setBody(result.commentary);
        await fetchSupabaseUpdate(row.id, { body: result.commentary });
      } else {
        setBody(result.body);
        await fetchSupabaseUpdate(row.id, { body: result.body });
      }
      toast.success("Regenerated");
      setRegenOpen(false);
      setRegenHint("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <article className="card-soft p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {topicBadge(row.topic)}
        {typeBadge(type)}
        {row.trigger_source && (
          <span className="text-xs text-muted-foreground italic truncate">
            Trigger: {row.trigger_source}
          </span>
        )}
      </div>

      {type === "paired" ? (
        <>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Steppingstone company page post (150-250 words)
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="mt-1 font-sans text-sm"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Your personal reshare commentary (sits above the reshare on your page)
            </Label>
            <Textarea
              value={personal}
              onChange={(e) => setPersonal(e.target.value)}
              rows={3}
              className="mt-1 font-sans text-sm"
            />
          </div>
        </>
      ) : type === "reshare" ? (
        <>
          {row.source_url && (
            <a
              href={row.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs text-teal hover:underline"
            >
              <ExternalLink className="h-3 w-3 mr-1" /> Source post
            </a>
          )}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Your commentary (to add when resharing)
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1 font-sans text-sm"
            />
          </div>
        </>
      ) : (
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Personal-page post (just you, no Steppingstone version)
          </Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="mt-1 font-sans text-sm"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          className="bg-teal hover:bg-teal/90 text-white"
          disabled={busy !== null}
          onClick={onApprove}
        >
          {busy === "approve" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Approve
        </Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => setRegenOpen(true)}>
          <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
        </Button>
        <Button variant="ghost" disabled={busy !== null} onClick={() => setRejectOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" /> Reject
        </Button>
      </div>

      {regenOpen && (
        <div className="rounded-md border p-3 space-y-2 bg-muted/30">
          <Label className="text-xs">Optional: hint a different angle (e.g. "sharper take on Saba", "lead with Richard's story")</Label>
          <div className="flex gap-2">
            <Input value={regenHint} onChange={(e) => setRegenHint(e.target.value)} className="text-sm h-8" />
            <Button size="sm" disabled={busy !== null} onClick={onRegenerate}>
              {busy === "regenerate" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { setRegenOpen(false); setRegenHint(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div className="rounded-md border p-3 space-y-2 bg-muted/30">
          <Label className="text-xs">Optional: why? (e.g. "too PR", "wrong angle on the Saba dynamic")</Label>
          <div className="flex gap-2">
            <Input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className="text-sm h-8" />
            <Button size="sm" variant="destructive" disabled={busy !== null} onClick={onReject}>
              {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { setRejectOpen(false); setRejectNote(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// Approved, not yet posted — Will copies to LinkedIn from here and marks posted.
// -----------------------------------------------------------------------------
function ApprovedSection({ rows, onChange }: { rows: LinkedInPostRow[]; onChange: () => void }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-2xl text-teal mb-4">Approved, ready to post</h2>
      <div className="space-y-4">
        {rows.map((r) => (
          <ApprovedCard key={r.id} row={r} onChange={onChange} />
        ))}
      </div>
    </section>
  );
}

function ApprovedCard({ row, onChange }: { row: LinkedInPostRow; onChange: () => void }) {
  const type = postType(row);
  const [busy, setBusy] = useState(false);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied — paste into LinkedIn`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const onMarkPosted = async () => {
    setBusy(true);
    try {
      await markPosted({ postId: row.id });
      toast.success("Marked posted");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card-soft p-5 space-y-3 border-l-4 border-teal">
      <div className="flex flex-wrap items-center gap-2">
        {topicBadge(row.topic)}
        {typeBadge(type)}
        {row.trigger_source && (
          <span className="text-xs text-muted-foreground italic truncate">
            Trigger: {row.trigger_source}
          </span>
        )}
      </div>

      {type === "paired" ? (
        <>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Company post</div>
            <p className="text-sm whitespace-pre-wrap">{row.body}</p>
          </div>
          {row.personal_commentary && (
            <div className="pl-4 border-l-2 border-orange">
              <div className="text-xs uppercase tracking-wide text-orange mb-1">Personal reshare commentary</div>
              <p className="text-sm whitespace-pre-wrap italic">{row.personal_commentary}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => copy(row.body, "Company post")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy company post
            </Button>
            {row.personal_commentary && (
              <Button size="sm" variant="outline" onClick={() => copy(row.personal_commentary!, "Personal reshare")}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy personal reshare
              </Button>
            )}
            <Button size="sm" className="bg-teal text-white hover:bg-teal/90" disabled={busy} onClick={onMarkPosted}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Mark posted
            </Button>
          </div>
        </>
      ) : type === "reshare" ? (
        <>
          {row.source_url && (
            <a href={row.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-teal hover:underline">
              <ExternalLink className="h-3 w-3 mr-1" /> Source post
            </a>
          )}
          <p className="text-sm whitespace-pre-wrap">{row.body}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => copy(row.body, "Commentary")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy commentary
            </Button>
            <Button size="sm" className="bg-teal text-white hover:bg-teal/90" disabled={busy} onClick={onMarkPosted}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Mark posted
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm whitespace-pre-wrap">{row.body}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => copy(row.body, "Post")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy post
            </Button>
            <Button size="sm" className="bg-teal text-white hover:bg-teal/90" disabled={busy} onClick={onMarkPosted}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Mark posted
            </Button>
          </div>
        </>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// Posted (last 30 days)
// -----------------------------------------------------------------------------
function PostedSection({ rows }: { rows: LinkedInPostRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-2xl text-teal mb-4">Posted (last 30 days)</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="card-soft p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {topicBadge(r.topic)}
              {typeBadge(postType(r))}
              {r.posted_at && (
                <span className="text-xs text-muted-foreground">
                  {new Date(r.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
            <p className="text-sm text-ink/85 line-clamp-3 whitespace-pre-wrap">{r.body}</p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              {r.reactions != null && <Stat label="Reactions" value={r.reactions} />}
              {r.comments != null && <Stat label="Comments" value={r.comments} />}
              {r.impressions != null && <Stat label="Impressions" value={r.impressions} />}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-muted text-ink/80">
      <strong className="text-ink">{value.toLocaleString()}</strong> {label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Generate modal
// -----------------------------------------------------------------------------
function GenerateModal({
  open,
  onOpenChange,
  onCreated,
  initialValues,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  initialValues?: GenerateInitialValues;
}) {
  const [type, setType] = useState<LinkedInDraftType>("paired");
  const [topic, setTopic] = useState<LinkedInTopic>("sector");
  const [trigger, setTrigger] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);

  // Apply pre-populated values whenever the modal opens with an initial set
  // (e.g. when the user hit "Draft a post about this" on a news item).
  useEffect(() => {
    if (!open || !initialValues) return;
    if (initialValues.type) setType(initialValues.type);
    if (initialValues.topic) setTopic(initialValues.topic);
    if (initialValues.trigger !== undefined) setTrigger(initialValues.trigger);
    if (initialValues.sourceUrl !== undefined) setSourceUrl(initialValues.sourceUrl);
    if (initialValues.brief !== undefined) setBrief(initialValues.brief);
  }, [open, initialValues]);

  const reset = () => {
    setType("paired");
    setTopic("sector");
    setTrigger("");
    setSourceUrl("");
    setBrief("");
  };

  const onGenerate = async () => {
    if (!brief.trim()) {
      toast.error("Add a brief first — what do you want to say?");
      return;
    }
    setBusy(true);
    try {
      const result = await generateLinkedInDraft({
        type,
        topic,
        brief: brief.trim(),
        trigger_source: trigger.trim() || undefined,
        source_url: type === "reshare" ? (sourceUrl.trim() || undefined) : undefined,
      });
      if (result.type === "paired") {
        await saveDraftRow({
          type: "paired",
          topic,
          trigger_source: trigger.trim() || undefined,
          brief: brief.trim(),
          body: result.company_body,
          personal_commentary: result.personal_commentary,
        });
      } else if (result.type === "reshare") {
        await saveDraftRow({
          type: "reshare",
          topic,
          trigger_source: trigger.trim() || undefined,
          source_url: sourceUrl.trim() || undefined,
          brief: brief.trim(),
          body: result.commentary,
        });
      } else {
        await saveDraftRow({
          type: "personal_standalone",
          topic,
          trigger_source: trigger.trim() || undefined,
          brief: brief.trim(),
          body: result.body,
        });
      }
      toast.success("Draft saved to the queue");
      reset();
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-teal">Generate new LinkedIn post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Type</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setType("paired")}
                className={`text-left rounded-md border-2 p-3 transition-colors ${
                  type === "paired" ? "border-teal bg-teal/5" : "border-transparent bg-muted/50"
                }`}
              >
                <div className="text-sm font-medium">Paired</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Steppingstone company post + your personal reshare commentary
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType("reshare")}
                className={`text-left rounded-md border-2 p-3 transition-colors ${
                  type === "reshare" ? "border-teal bg-teal/5" : "border-transparent bg-muted/50"
                }`}
              >
                <div className="text-sm font-medium">Reshare</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Commentary to add when resharing someone else's post
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType("personal_standalone")}
                className={`text-left rounded-md border-2 p-3 transition-colors ${
                  type === "personal_standalone" ? "border-teal bg-teal/5" : "border-transparent bg-muted/50"
                }`}
              >
                <div className="text-sm font-medium">Personal-only</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Single post on your personal page (cultural recs, personal commentary)
                </div>
              </button>
            </div>
          </div>

          <div>
            <Label>Topic</Label>
            <Select value={topic} onValueChange={(v) => setTopic(v as LinkedInTopic)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TOPIC_LABELS) as LinkedInTopic[]).map((k) => (
                  <SelectItem key={k} value={k}>{TOPIC_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "reshare" && (
            <div>
              <Label>Source post URL (optional)</Label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.linkedin.com/..."
                className="mt-1"
              />
            </div>
          )}

          <div>
            <Label>What's prompting this? (optional, one line)</Label>
            <Input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder='e.g. "Saba won the Edinburgh Worldwide vote yesterday" / "Curation deal closed with Yarrow"'
              className="mt-1"
            />
          </div>

          <div>
            <Label>Your brief — what do you want to say?</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={6}
              placeholder={
                type === "paired"
                  ? "Free-form. The point you want to make, the angle, the specific names or numbers. The system drafts both the company post and your personal reshare from this."
                  : type === "reshare"
                    ? "Free-form. Your take on the original post. The position you want to add. Usually 1-3 sentences worth of substance, longer if the topic warrants it."
                    : "Free-form. What you want to say. Cultural rec? Just the name + a line of reaction. Personal commentary? The point and the angle."
              }
              className="mt-1 font-sans text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-teal hover:bg-teal/90 text-white"
            disabled={busy}
            onClick={onGenerate}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tiny helpers (would belong in lib/linkedin but live here to keep that file
// focused on the public API surface).
// -----------------------------------------------------------------------------
async function fetchApproved(): Promise<{ data: LinkedInPostRow[] }> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase
    .from("linkedin_posts")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { data: (data ?? []) as LinkedInPostRow[] };
}

async function fetchSupabaseUpdate(id: string, patch: Record<string, unknown>): Promise<void> {
  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.from("linkedin_posts").update(patch).eq("id", id);
  if (error) throw error;
}
