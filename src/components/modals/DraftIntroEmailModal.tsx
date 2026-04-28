import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ContactPicker } from "@/components/ContactPicker";
import { type Contact } from "@/lib/supabase";

export function DraftIntroEmailModal({
  open, onOpenChange, firstContact,
}: { open: boolean; onOpenChange:(v:boolean)=>void; firstContact: Contact | null }) {
  const [first, setFirst] = useState<Contact | null>(firstContact);
  const [second, setSecond] = useState<Contact | null>(null);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={(v)=>{ onOpenChange(v); if(!v) setDraft(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-teal">Draft Introduction Email</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <ContactPicker label="First person" value={first} onChange={setFirst} excludeId={second?.id} />
          <ContactPicker label="Second person" value={second} onChange={setSecond} excludeId={first?.id} />
          <div><Label>Reason for this introduction</Label><Input value={reason} onChange={e=>setReason(e.target.value)} /></div>
          {draft && <div className="card-soft p-4 text-sm whitespace-pre-wrap text-ink/90">{draft}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Close</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white"
            onClick={()=>setDraft("Email draft will appear here once Claude API is connected.")}>
            Generate Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}