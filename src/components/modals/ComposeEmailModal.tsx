import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Copy, RefreshCcw, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContactPicker } from "@/components/ContactPicker";
import { type Contact } from "@/lib/supabase";
import { generateDraft, fetchRecentInteractions, contactToBrief } from "@/lib/draftEmail";
import { DraftFeedback } from "@/components/DraftFeedback";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lockedContact?: Contact | null;
}

type TemplateType = "stepping-stone" | "curation" | "waymap" | "richard-noble" | "newsletter";

const TEMPLATES: { id: TemplateType; label: string }[] = [
  { id: "stepping-stone", label: "Stepping Stone Introduction" },
  { id: "curation", label: "Curation Connect Introduction" },
  { id: "waymap", label: "Waymap Introduction" },
  { id: "richard-noble", label: "Richard Noble (ThrustWSH)" },
  { id: "newsletter", label: "Newsletter Pitch" },
];

function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function ComposeEmailModal({ open, onOpenChange, lockedContact }: Props) {
  const [tab, setTab] = useState<"template" | "dictate">("template");
  const [contact, setContact] = useState<Contact | null>(lockedContact ?? null);
  const [template, setTemplate] = useState<TemplateType | null>(null);
  const [personalisation, setPersonalisation] = useState("");
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [loading, setLoading] = useState(false);
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

  const reset = () => {
    setTab("template");
    setTemplate(null);
    setPersonalisation("");
    setTranscript("");
    setDraft("");
    setOriginalDraft("");
    setLoading(false);
    if (!lockedContact) setContact(null);
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
          account: "william@steppingstone.co.uk",
          contact: brief,
          templateType: template,
        });
      } else {
        if (!transcript.trim()) { toast({ title: "Dictate something first", variant: "destructive" }); setLoading(false); return; }
        text = await generateDraft({
          mode: "dictation",
          dictation: transcript.trim(),
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
          <DialogTitle className="font-display text-teal">Compose email</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "template" | "dictate")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Template</TabsTrigger>
            <TabsTrigger value="dictate">Dictate</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-3">
            <div className="grid grid-cols-2 gap-2 pt-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={cn(
                    "rounded-md border px-3 py-4 text-sm text-left transition-colors min-h-[64px]",
                    template === t.id
                      ? "border-teal bg-teal/10 text-teal font-medium"
                      : "border-border hover:bg-muted"
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
                    placeholder="Anything specific to add? (recent meeting, shared connection, why this person specifically)"
                    rows={5}
                  />
                </div>
                <Button className="bg-teal hover:bg-teal/90 text-white" onClick={generate} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Generate
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="dictate" className="space-y-3 pt-2">
            {ToField}
            <div className="flex flex-col items-center gap-2 py-4">
              <button
                type="button"
                disabled={!supported}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => recording && stopRecording()}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
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
                {supported ? "Hold to dictate, release to stop" : "Speech recognition not supported in this browser"}
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
            <Button className="bg-teal hover:bg-teal/90 text-white" onClick={generate} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tidy into an email
            </Button>
          </TabsContent>
        </Tabs>

        {draft && (
          <div className="space-y-2 pt-3 border-t mt-3">
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

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}