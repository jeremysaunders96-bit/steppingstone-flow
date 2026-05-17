import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Copy, RefreshCcw, Mic, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContactPicker } from "@/components/ContactPicker";
import { type Contact, supabase } from "@/lib/supabase";
import { generateDraft, fetchRecentInteractions, contactToBrief } from "@/lib/draftEmail";
import { DraftFeedback } from "@/components/DraftFeedback";
import { listConnectedAccounts, type GoogleAccountRow } from "@/lib/googleAccounts";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lockedContact?: Contact | null;
  // When true, hide the template tab entirely and offer only the dictate flow.
  // Used by contact-specific entry points where Will is composing to a known person.
  dictateOnly?: boolean;
}

type TemplateType = "stepping-stone" | "stepping-stone-long" | "curation" | "waymap" | "richard-noble" | "newsletter";

const TEMPLATES: { id: TemplateType; label: string }[] = [
  { id: "stepping-stone", label: "Steppingstone Introduction" },
  { id: "stepping-stone-long", label: "Steppingstone (long version)" },
  { id: "curation", label: "Curation Connect Introduction" },
  { id: "waymap", label: "Waymap Introduction" },
  { id: "richard-noble", label: "Richard Noble (ThrustWSH)" },
  { id: "newsletter", label: "Newsletter Pitch" },
];

const TEMPLATE_PLACEHOLDERS: Record<TemplateType, string> = {
  "stepping-stone": "e.g. We met at the Langham yesterday, he runs a hospitality group and is interested in growing his profile. Lunch booked for next Thursday.",
  "stepping-stone-long": "e.g. James at Curation, we collaborated on Waymap recently which went well. Worth mentioning we may collaborate on AI introductions and revenue-sharing arrangements.",
  "curation": "e.g. She chairs JPMorgan Claverhouse, we had lunch last week, she's interested but has to put it to the board next month.",
  "waymap": "e.g. Introduced by James Blomfield, runs hotels in central London, focus should be on the built environment use case.",
  "richard-noble": "e.g. Scottish entrepreneur, interested in sponsorship, met him at David Yarrow's exhibition.",
  "newsletter": "e.g. Owner of a Cotswolds wine estate, I think they'd be a fit for the Christmas issue, mention Hayley Ferguson at Hanikon as a precedent.",
};

function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function ComposeEmailModal({ open, onOpenChange, lockedContact, dictateOnly = false }: Props) {
  const [tab, setTab] = useState<"template" | "dictate">(dictateOnly ? "dictate" : "template");
  const [contact, setContact] = useState<Contact | null>(lockedContact ?? null);
  const [template, setTemplate] = useState<TemplateType | null>(null);
  const [personalisation, setPersonalisation] = useState("");
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<GoogleAccountRow[]>([]);
  const [fromAccount, setFromAccount] = useState<string>("");
  const { toast } = useToast();

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
    if (!lockedContact) setContact(null);
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
    } catch (e) {
      toast({
        title: "Couldn't save draft",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSending(false);
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

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); toast({ title: "Copied to clipboard" }); }
    catch { toast({ title: "Could not copy", variant: "destructive" }); }
  };

  const briefForFeedback = tab === "template"
    ? `[${template ?? "no-template"}] ${personalisation}`
    : transcript;

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
              {TEMPLATES.map((t) => (
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
                    placeholder={template ? TEMPLATE_PLACEHOLDERS[template] : "Add anything specific that should shape this email: a recent meeting, a shared connection, why this person specifically. The system will fill in the standard structure - you just add the personal context."}
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
                  <div className="h-10 flex items-center text-xs text-muted-foreground italic">
                    No Gmail account connected
                  </div>
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
            </div>
            <DraftFeedback
              mode="single"
              contactId={contact?.id ?? null}
              originalDraft={originalDraft}
              currentDraft={draft}
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
    </Dialog>
  );
}