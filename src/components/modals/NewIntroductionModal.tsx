import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactPicker } from "@/components/ContactPicker";
import { supabase, type Contact } from "@/lib/supabase";
import { toast } from "sonner";

type Status = "made" | "progressing" | "led-somewhere" | "gone-cold";

export function NewIntroductionModal({
  open, onOpenChange, onSaved, lockedFirst,
}: { open: boolean; onOpenChange:(v:boolean)=>void; onSaved?:()=>void; lockedFirst?: Contact | null }) {
  const [first, setFirst] = useState<Contact | null>(lockedFirst || null);
  const [second, setSecond] = useState<Contact | null>(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<Status>("made");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!first || !second) { toast.error("Pick both people"); return; }
    setSaving(true);
    const { error } = await supabase.from("introductions").insert({
      first_contact_id: first.id, second_contact_id: second.id,
      reason: reason.trim() || null, status,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Introduction logged");
    setFirst(lockedFirst || null); setSecond(null); setReason(""); setStatus("made");
    onOpenChange(false); onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-teal">New Introduction</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <ContactPicker label="First person" value={first} onChange={setFirst} excludeId={second?.id} />
          <ContactPicker label="Second person" value={second} onChange={setSecond} excludeId={first?.id} />
          <div><Label>Reason for introduction</Label><Input value={reason} onChange={e=>setReason(e.target.value)} /></div>
          <div><Label>Status</Label>
            <Select value={status} onValueChange={(v)=>setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="made">made</SelectItem>
                <SelectItem value="progressing">progressing</SelectItem>
                <SelectItem value="led-somewhere">led-somewhere</SelectItem>
                <SelectItem value="gone-cold">gone-cold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" disabled={saving} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}