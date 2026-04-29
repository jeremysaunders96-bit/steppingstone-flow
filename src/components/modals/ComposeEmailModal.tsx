import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContactPicker } from "@/components/ContactPicker";
import { type Contact } from "@/lib/supabase";
import { generateDraft, fetchRecentInteractions, contactToBrief } from "@/lib/draftEmail";
import { DraftFeedback } from "@/components/DraftFeedback";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided, the contact is pre-selected and locked. */
  lockedContact?: Contact | null;
}

export function ComposeEmailModal({ open, onOpenChange, lockedContact }: Props) {
  const [contact, setContact] = useState<Contact | null>(lockedContact ?? null);
  const [subject, setSubject] = useState("");
  const [brief, setBrief] = useState("");
  const [account, setAccount] = useState("william@steppingstone.co.uk");
  const [draft, setDraft] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setContact(lockedContact ?? null);
  }, [open, lockedContact]);

  const reset = () => {
    setSubject(""); setBrief(""); setDraft(""); setOriginalDraft(""); setLoading(false);
    if (!lockedContact) setContact(null);
  };

  const run = async () => {
    if (!contact) { toast({ title: "Pick a contact first", variant: "destructive" }); return; }
    if (!brief.trim()) { toast({ title: "Add a quick brief", description: "Describe what the email needs to do." }); return; }
    setLoading(true);
    try {
      const interactions = await fetchRecentInteractions(contact.id);
      const subjectLine = subject.trim();
      const fullBrief = subjectLine
        ? `Subject line: "${subjectLine}". ${brief.trim()}`
        : brief.trim();
      const text = await generateDraft({
        mode: "single",
        brief: fullBrief,
        account,
        contact: contactToBrief(contact, interactions),
      });
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
    try {
      await navigator.clipboard.writeText(draft);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-teal">Compose email</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {lockedContact ? (
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
          )}
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line" />
          </div>
          <div>
            <Label>What does this email need to do?</Label>
            <VoiceTextarea
              placeholder="2-3 sentences max. What does this email need to do?"
              value={brief}
              onValueChange={setBrief}
              rows={3}
            />
          </div>
          <div>
            <Label>Send from</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="william@steppingstone.co.uk">william@steppingstone.co.uk</SelectItem>
                <SelectItem value="willmeadon@gmail.com">willmeadon@gmail.com</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {draft && (
            <div className="space-y-2">
              <Label>Draft</Label>
              <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={14} className="font-sans text-sm" />
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
                mode="single"
                contactId={contact?.id ?? null}
                originalDraft={originalDraft}
                currentDraft={draft}
                brief={brief}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" onClick={run} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}