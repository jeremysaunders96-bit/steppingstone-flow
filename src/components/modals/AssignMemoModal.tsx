import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ContactPicker } from "@/components/ContactPicker";
import { supabase, type Contact, type UnmatchedMemo } from "@/lib/supabase";
import { toast } from "sonner";

export function AssignMemoModal({
  open, onOpenChange, memo, onAssigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memo: UnmatchedMemo | null;
  onAssigned: () => void;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const assign = async () => {
    if (!memo) return;
    if (!contact) { toast.error("Pick a contact"); return; }
    setSaving(true);
    const { data: inserted, error: e1 } = await supabase
      .from("interactions")
      .insert({
        contact_id: contact.id,
        date: memo.extracted_date || new Date().toISOString().slice(0,10),
        type: memo.extracted_type || "voice note",
        summary: memo.extracted_summary || "(no summary)",
        full_note: memo.extracted_full_note,
        action_items: memo.extracted_action_items || [],
        needs_followup: false,
      })
      .select("id")
      .single();
    if (e1 || !inserted) { setSaving(false); toast.error(e1?.message || "Failed"); return; }
    const { error: e2 } = await supabase
      .from("unmatched_memos")
      .update({
        status: "assigned",
        assigned_contact_id: contact.id,
        assigned_interaction_id: inserted.id,
      })
      .eq("id", memo.id);
    if (e2) { setSaving(false); toast.error(e2.message); return; }
    await supabase.from("contacts")
      .update({ last_contact_date: memo.extracted_date || new Date().toISOString().slice(0,10) })
      .eq("id", contact.id);
    setSaving(false);
    toast.success(`Assigned to ${contact.full_name}`);
    setContact(null);
    onOpenChange(false);
    onAssigned();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setContact(null); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-teal">Assign to contact</DialogTitle>
        </DialogHeader>
        {memo && (
          <div className="space-y-3">
            <div className="text-sm bg-muted/40 rounded-md p-3">
              <div><span className="text-muted-foreground">Claude heard: </span><strong>{memo.extracted_contact_name || "—"}</strong></div>
              {memo.extracted_company && <div className="text-muted-foreground text-xs">{memo.extracted_company}</div>}
              {memo.extracted_summary && <div className="italic text-xs mt-1">{memo.extracted_summary}</div>}
            </div>
            <ContactPicker label="Assign to" value={contact} onChange={setContact} />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" disabled={saving} onClick={assign}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
