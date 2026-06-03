import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Copy, RefreshCcw, Mic, Send, Save, Replace } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContactPicker } from "@/components/ContactPicker";
import { type Contact, supabase } from "@/lib/supabase";
import { generateDraft, fetchRecentInteractions, contactToBrief, saveDraftFeedback } from "@/lib/draftEmail";
import { DraftFeedback } from "@/components/DraftFeedback";
import { listConnectedAccounts, type GoogleAccountRow } from "@/lib/googleAccounts";
import { buildConsentUrl, isConfigured as isOAuthConfigured } from "@/lib/googleOAuth";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lockedContact?: Contact | null;
  // When true, hide the template tab entirely and offer only the dictate flow.
  // Used by contact-specific entry points where Will is composing to a known person.
  dictateOnly?: boolean;
}

type TemplateRow = { id: string; label: string };

const TEMPLATE_PLACEHOLDER =
  "Add anything specific that should shape this email: a recent meeting, a shared connection, why this person specifically. The system will fill in the standard structure - you just add the personal context.";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "template";
}

function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function ComposeEmailModal({ open, onOpenChange, lockedContact, dictateOnly = false }: Props) {
  const [tab, setTab] = useState<"template" | "dictate">(dictateOnly ? "dictate" : "template");
  const [contact, setContact] = useState<Contact | null>(lockedContact ?? null);
  const [template, setTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [personalisation, setPersonalisation] = useState("");
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<GoogleAccountRow[]>([]);
  const [fromAccount, setFromAccount] = useState<string>("");
  const { toast } = useToast();

  // Save/replace template dialogs
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string>("");
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [replacingTpl, setReplacingTpl] = useState(false);

  // hold-to-record
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);
  const baseRef = useRef<string>("");
  const finalChunksRef = useRef<string>("");

  useEffect(() => {
    const w = typeof window !== "undefined" ? (window as any) : null;
    setSupported(!!(w && (w.SpeechRecognition || w.webkitSpeechRecognition)));
    return () => { try { recRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  useEffect(() => {
    if (open) setContact(lockedContact ?? null);
  }, [open, lockedContact]);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("id, label")
      .order("label");
    if (!error && data) setTemplates(data as TemplateRow[]);
    setTemplatesLoading(false);
  };

  useEffect(() => {
    if (open) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listConnectedAccounts()
      .then((rows) => {
        setConnectedAccounts(rows);
        if (rows.length && !fromAccount) setFromAccount(rows[0].account_email);
      })
      .catch(() => { /* silent — Settings page is where users handle this */ });
  }, [open, fromAccount]);

  const reset = () => {
    setTab(dictateOnly ? "dictate" : "template");
    setTemplate(null);
    setPersonalisation("");
    setTranscript("");
    setDraft("");
    setOriginalDraft("");
    setSubject("");
    setLoading(false);
    setSending(false);
    setFeedbackSaved(false);
    if (!lockedContact) setContact(null);
  };

  const saveAsNewTemplate = async () => {
    const label = saveName.trim();
    if (!label) { toast({ title: "Give the template a name", variant: "destructive" }); return; }
    if (!draft.trim()) { toast({ title: "Draft is empty", variant: "destructive" }); return; }
    setSavingTpl(true);
    try {
      const baseId = slugify(label);
      // Collision check — append -2, -3, … until unique.
      const { data: existing } = await supabase
        .from("email_templates")
        .select("id")
        .like("id", `${baseId}%`);
      const taken = new Set(((existing || []) as { id: string }[]).map((r) => r.id));
      let id = baseId;
      let n = 2;
      while (taken.has(id)) { id = `${baseId}-${n++}`; }

      const { error } = await supabase.from("email_templates").insert({
        id,
        label,
        subject_template: subject || "",
        body_template: draft,
        guidance: "",
        treat_as_guidance: true,
      });
      if (error) throw error;
      toast({ title: "Template saved", description: label });
      setSaveOpen(false);
      setSaveName("");
      await loadTemplates();
      setTemplate(id);
    } catch (e) {
      toast({
        title: "Couldn't save template",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSavingTpl(false);
    }
  };

  const replaceExistingTemplate = async () => {
    if (!replaceTargetId) { toast({ title: "Pick a template to replace", variant: "destructive" }); return; }
    if (!draft.trim()) { toast({ title: "Draft is empty", variant: "destructive" }); return; }
    setReplacingTpl(true);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject_template: subject || "",
          body_template: draft,
          updated_at: new Date().toISOString(),
        })
        .eq("id", replaceTargetId);
      if (error) throw error;
      const replaced = templates.find((t) => t.id === replaceTargetId);
      toast({ title: "Template replaced", description: replaced?.label ?? replaceTargetId });
      setReplaceOpen(false);
      setReplaceConfirm(false);
      setReplaceTargetId("");
      await loadTemplates();
    } catch (e) {
      toast({
        title: "Couldn't replace template",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setReplacingTpl(false);
    }
  };

  const sendToDrafts = async () => {
    if (!contact?.email) {
      toast({ title: "No recipient email on this contact", variant: "destructive" });
      return;
    }
    if (!fromAccount) {
      toast({
        title: "Connect a Gmail account first",
        description: "Go to Settings → Google integrations.",
        variant: "destructive",
      });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Add a subject line", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-create-draft", {
        body: {
          account_email: fromAccount,
          to: contact.email,
          subject: subject.trim(),
          body: draft,
        },
      });
      if (error) throw error;
      const result = data as { ok: boolean; draft_id?: string; error?: string; detail?: string };
      if (!result.ok) throw new Error(result.detail || result.error || "Unknown error");
      toast({
        title: "Draft saved to Gmail",
        description: `Open Gmail Drafts in ${fromAccount} to send.`,
      });
      recordFeedback();
    } catch (e) {
      console.error("gmail-create-draft failed", e);
      toast({
        title: "Couldn't save draft",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const connectGmail = () => {
    if (!isOAuthConfigured()) {
      toast({
        title: "Gmail OAuth not configured",
        description: "Set VITE_GOOGLE_OAUTH_CLIENT_ID and the matching Supabase secrets first.",
        variant: "destructive",
      });
      return;
    }
    try {
      // Full-page redirect — required on iPad Safari. No popup, no webview.
      window.location.href = buildConsentUrl();
    } catch (e) {
      console.error("buildConsentUrl failed", e);
      toast({ title: "Couldn't start Gmail connect", variant: "destructive" });
    }
  };

  const startRecording = () => {
    if (recording) return;
    const rec = getRecognition();
    if (!rec) { toast({ title: "Speech recognition not supported in this browser", variant: "destructive" }); return; }
    recRef.current = rec;
    baseRef.current = transcript;
    finalChunksRef.current = "";
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-GB";
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0].transcript;
        if (r.isFinal) finalChunksRef.current += t;
        else interim += t;
      }
      const combined = (finalChunksRef.current + interim).trim();
      const sep = baseRef.current && !baseRef.current.endsWith(" ") ? " " : "";
      setTranscript(baseRef.current + sep + combined);
    };
    rec.onerror = () => { setRecording(false); };
    rec.onend = () => { setRecording(false); };
    try { rec.start(); setRecording(true); } catch { setRecording(false); }
  };

  const stopRecording = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setRecording(false);
  };

  const generate = async () => {
    if (!contact) { toast({ title: "Pick a contact first", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const interactions = await fetchRecentInteractions(contact.id);
      const brief = contactToBrief(contact, interactions);
      let text = "";
      if (tab === "template") {
        if (!template) { toast({ title: "Choose a template", variant: "destructive" }); setLoading(false); return; }
        text = await generateDraft({
          mode: "single",
          brief: personalisation.trim() || "(no extra personalisation)",
          account: "william@sstone.co.uk",
          contact: brief,
          templateType: template,
        });
      } else {
        if (!transcript.trim()) { toast({ title: "Dictate something first", variant: "destructive" }); setLoading(false); return; }
        text = await generateDraft({
          mode: "dictation",
          brief: transcript.trim(),
          contact: brief,
        });
      }
      setDraft(text);
      setOriginalDraft(text);
      setFeedbackSaved(false);
    } catch (e) {
      toast({
        title: "Could not generate draft",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const briefForFeedback = tab === "template"
    ? `[${template ?? "no-template"}] ${personalisation}`
    : transcript;

  // Implicit feedback capture: fires when Will commits a draft via Copy or Send to Drafts.
  // No manual click needed. Outcome is inferred from whether the textarea content differs
  // from Claude's original output. Silent on error — never disrupt the primary action.
  const recordFeedback = async () => {
    if (feedbackSaved || !originalDraft) return;
    setFeedbackSaved(true);
    try {
      await saveDraftFeedback({
        contactId: contact?.id ?? null,
        mode: "single",
        outcome: draft.trim() === originalDraft.trim() ? "sent-as-written" : "edited-and-sent",
        originalDraft,
        finalVersion: draft,
        editNotes: null,
        brief: briefForFeedback,
      });
    } catch (e) {
      console.warn("Implicit feedback save failed", e);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast({ title: "Copied to clipboard" });
      recordFeedback();
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const ToField = (
    lockedContact ? (
      <div>
        <Label>To</Label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/40">
          <span className="text-sm">
            <strong>{lockedContact.full_name}</strong>
            {lockedContact.company ? ` — ${lockedContact.company}` : ""}
          </span>
        </div>
      </div>
    ) : (
      <ContactPicker label="To" value={contact} onChange={setContact} allowCreate />
    )
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-teal">{dictateOnly ? "Dictate email" : "Compose email"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "template" | "dictate")}>
          {!dictateOnly && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template">Use a template</TabsTrigger>
              <TabsTrigger value="dictate">Dictate from scratch</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="template" className="space-y-3">
            <div className="grid grid-cols-2 gap-2 pt-2">
              {templatesLoading && templates.length === 0 && (
                <div className="col-span-2 text-xs text-muted-foreground italic py-2">Loading templates…</div>
              )}
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={cn(
                    "rounded-md border-2 px-3 py-4 text-sm text-left text-white font-medium transition-colors min-h-[64px]",
                    template === t.id
                      ? "border-orange bg-teal/90"
                      : "border-transparent bg-teal hover:bg-teal/80"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {template && (
              <div className="space-y-3 pt-2">
                {ToField}
                <div>
                  <Label>Personalisation</Label>
                  <Textarea
                    value={personalisation}
                    onChange={(e) => setPersonalisation(e.target.value)}
                    placeholder={TEMPLATE_PLACEHOLDER}
                    rows={5}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="dictate" className="space-y-3 pt-2">
            {ToField}
            <div className="flex flex-col items-center gap-2 py-4">
              <button
                type="button"
                disabled={!supported}
                onClick={() => (recording ? stopRecording() : startRecording())}
                className={cn(
                  "h-20 w-20 rounded-full border-2 flex items-center justify-center transition-all select-none",
                  recording
                    ? "border-orange bg-orange/20 text-orange animate-pulse scale-110"
                    : "border-teal bg-teal/10 text-teal hover:bg-teal/20",
                  !supported && "opacity-50 cursor-not-allowed"
                )}
              >
                <Mic className="h-8 w-8" />
              </button>
              <p className="text-xs text-muted-foreground">
                {supported
                  ? recording ? "Recording - click to stop" : "Click to dictate"
                  : "Speech recognition not supported in this browser"}
              </p>
            </div>
            <div>
              <Label>Transcript</Label>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Your dictation appears here. You can edit it before generating."
                rows={8}
              />
            </div>
          </TabsContent>
        </Tabs>

        {draft && (
          <div className="space-y-2 pt-3 border-t mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <div>
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Introducing Will Meadon"
                />
              </div>
              <div>
                <Label>From</Label>
                {connectedAccounts.length > 0 ? (
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="h-10 rounded-md border bg-background px-3 text-sm w-full"
                  >
                    {connectedAccounts.map((a) => (
                      <option key={a.account_email} value={a.account_email}>{a.account_email}</option>
                    ))}
                  </select>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 bg-teal hover:bg-teal/90 text-white"
                    onClick={connectGmail}
                  >
                    Connect Gmail
                  </Button>
                )}
              </div>
            </div>
            <Label>Draft</Label>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} className="font-sans text-sm" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                <Copy className="h-4 w-4 mr-1" /> Copy to clipboard
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
                Regenerate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={sendToDrafts}
                disabled={sending || connectedAccounts.length === 0 || !contact?.email}
              >
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Send to Gmail Drafts
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setSaveName(""); setSaveOpen(true); }}
                disabled={!draft.trim()}
              >
                <Save className="h-4 w-4 mr-1" /> Save as new template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setReplaceTargetId(""); setReplaceConfirm(false); setReplaceOpen(true); }}
                disabled={!draft.trim() || templates.length === 0}
              >
                <Replace className="h-4 w-4 mr-1" /> Replace existing template
              </Button>
            </div>
            <DraftFeedback
              mode="single"
              contactId={contact?.id ?? null}
              originalDraft={originalDraft}
              brief={briefForFeedback}
            />
          </div>
        )}

        <div className="pt-3">
          <Button className="w-full bg-teal hover:bg-teal/90 text-white" onClick={generate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {tab === "dictate" ? "Tidy into an email" : "Generate"}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {/* Save as new template */}
      <Dialog open={saveOpen} onOpenChange={(v) => { setSaveOpen(v); if (!v) setSaveName(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-teal">Save as new template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template name</Label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Family-office cold intro"
                autoFocus
              />
              {saveName.trim() && (
                <p className="text-xs text-muted-foreground mt-1">
                  ID: <code>{slugify(saveName)}</code> (a numeric suffix is added if taken)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              className="bg-teal hover:bg-teal/90 text-white"
              onClick={saveAsNewTemplate}
              disabled={savingTpl || !saveName.trim()}
            >
              {savingTpl && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace existing template */}
      <Dialog
        open={replaceOpen}
        onOpenChange={(v) => {
          setReplaceOpen(v);
          if (!v) { setReplaceTargetId(""); setReplaceConfirm(false); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-teal">Replace existing template</DialogTitle>
          </DialogHeader>
          {!replaceConfirm ? (
            <div className="space-y-3">
              <div>
                <Label>Template to overwrite</Label>
                <select
                  value={replaceTargetId}
                  onChange={(e) => setReplaceTargetId(e.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm w-full mt-1"
                >
                  <option value="">Pick a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReplaceOpen(false)}>Cancel</Button>
                <Button
                  className="bg-teal hover:bg-teal/90 text-white"
                  onClick={() => setReplaceConfirm(true)}
                  disabled={!replaceTargetId}
                >
                  Continue
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">
                This will overwrite{" "}
                <strong className="text-ink">
                  {templates.find((t) => t.id === replaceTargetId)?.label ?? replaceTargetId}
                </strong>{" "}
                with the current draft. This cannot be undone.
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReplaceConfirm(false)}>Back</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={replaceExistingTemplate}
                  disabled={replacingTpl}
                >
                  {replacingTpl && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Overwrite template
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}