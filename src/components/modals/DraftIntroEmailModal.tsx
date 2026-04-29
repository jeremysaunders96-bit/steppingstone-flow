import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import { Loader2, Copy, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContactPicker } from "@/components/ContactPicker";
import { type Contact } from "@/lib/supabase";
import { generateDraft, fetchRecentInteractions, contactToBrief } from "@/lib/draftEmail";
import { DraftFeedback } from "@/components/DraftFeedback";

export function DraftIntroEmailModal({
  open, onOpenChange, firstContact,
}: { open: boolean; onOpenChange:(v:boolean)=>void; firstContact: Contact | null }) {
  const [first, setFirst] = useState<Contact | null>(firstContact);
  const [second, setSecond] = useState<Contact | null>(null);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<string>("");
  const [originalDraft, setOriginalDraft] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const run = async () => {
    if (!first || !second) {
      toast({ title: "Pick both people", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Add a reason for the introduction" });
      return;
    }
    setLoading(true);
    try {
      const [iA, iB] = await Promise.all([
        fetchRecentInteractions(first.id),
        fetchRecentInteractions(second.id),
      ]);
      const text = await generateDraft({
        mode: "intro",
        brief: reason.trim(),
        contactA: contactToBrief(first, iA),
        contactB: contactToBrief(second, iB),
      });
      setDraft(text);
      setOriginalDraft(text);
    } catch (e) {
      toast({ title: "Could not generate draft", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v)=>{ onOpenChange(v); if(!v) { setDraft(""); setOriginalDraft(""); setLoading(false); } }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-display text-teal">Draft Introduction Email</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <ContactPicker label="First person" value={first} onChange={setFirst} excludeId={second?.id} />
          <ContactPicker label="Second person" value={second} onChange={setSecond} excludeId={first?.id} />
          <div>
            <Label>Reason for this introduction</Label>
            <VoiceTextarea value={reason} onValueChange={setReason} rows={3} placeholder="Why are you connecting these two people?" />
          </div>
          {draft && (
            <div className="space-y-2">
              <Label>Draft</Label>
              <Textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={14} className="font-sans text-sm" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copy}>
                  <Copy className="h-4 w-4 mr-1" /> Copy to clipboard
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={run} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
                  Regenerate
                </Button>
              </div>
              <DraftFeedback
                mode="intro"
                contactId={first?.id ?? null}
                originalDraft={originalDraft}
                currentDraft={draft}
                brief={reason}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Close</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" onClick={run} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}