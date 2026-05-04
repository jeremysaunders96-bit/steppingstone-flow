import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDraft, fetchRecentInteractions, contactToBrief } from "@/lib/draftEmail";
import type { Contact } from "@/lib/supabase";
import { DraftFeedback } from "@/components/DraftFeedback";

export function DraftEmailModal({
  open, onOpenChange, contactName, contact,
}: { open: boolean; onOpenChange: (v: boolean) => void; contactName?: string; contact?: Contact | null }) {
  const [brief, setBrief] = useState("");
  const [account, setAccount] = useState("william@steppingstone.co.uk");
  const [draft, setDraft] = useState<string>("");
  const [originalDraft, setOriginalDraft] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const reset = () => { setDraft(""); setOriginalDraft(""); setBrief(""); setLoading(false); };

  const run = async () => {
    if (!contact) {
      toast({ title: "No contact selected", description: "Open this from a contact record." , variant: "destructive"});
      return;
    }
    if (!brief.trim()) {
      toast({ title: "Add a quick brief", description: "Describe what the email needs to do." });
      return;
    }
    setLoading(true);
    try {
      const interactions = await fetchRecentInteractions(contact.id);
      const text = await generateDraft({
        mode: "single",
        brief: brief.trim(),
        account,
        contact: contactToBrief(contact, interactions),
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
    <Dialog open={open} onOpenChange={(v)=>{ onOpenChange(v); if(!v) reset(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-teal">
            Draft email{contactName ? ` — ${contactName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>What does this email need to do?</Label>
            <VoiceTextarea
              placeholder={`Speak or type the four things Claude needs:\n\n1. WHO - their name, company and role\n2. WHAT - what this email introduces or does\n3. CONNECTION - how you know them or who introduced you\n4. CONTEXT - anything Claude should use: a lunch coming up, something they said, why this matters to them specifically\n\nExample intro: "Victoria Stewart, chair of JPMorgan Claverhouse. Introduce Curation Connect. Introduced via Richard Plasket, first email. She runs a £500m trust and the discount problem is front of mind for her board."\n\nExample follow-up: "Nathan Brown at Numis. Chase him on the Curation meeting we discussed. Emailed two weeks ago, no response. Keep it short."`}
              value={brief} onValueChange={setBrief} rows={12}
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
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Close</Button>
          <Button
            className="bg-teal hover:bg-teal/90 text-white"
            onClick={run}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}