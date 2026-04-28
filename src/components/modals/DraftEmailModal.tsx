import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DraftEmailModal({
  open, onOpenChange, contactName,
}: { open: boolean; onOpenChange: (v: boolean) => void; contactName?: string }) {
  const [brief, setBrief] = useState("");
  const [account, setAccount] = useState("william@steppingstone.co.uk");
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={(v)=>{ onOpenChange(v); if(!v){ setDraft(null); setBrief(""); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-teal">
            Draft email{contactName ? ` — ${contactName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>What does this email need to do?</Label>
            <Textarea
              placeholder="What does this email need to do? Describe in 1-2 sentences."
              value={brief} onChange={e=>setBrief(e.target.value)} rows={3}
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
            <div className="card-soft p-4 text-sm whitespace-pre-wrap text-ink/90">{draft}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Close</Button>
          <Button
            className="bg-teal hover:bg-teal/90 text-white"
            onClick={()=>setDraft("Email draft will appear here once Claude API is connected.")}
          >Generate Draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}