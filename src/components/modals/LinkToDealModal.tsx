import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, type Deal } from "@/lib/supabase";
import { toast } from "sonner";

export function LinkToDealModal({
  open, onOpenChange, contactId, onSaved,
}: { open: boolean; onOpenChange:(v:boolean)=>void; contactId: string; onSaved?:()=>void }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealId, setDealId] = useState<string>("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("deals").select("*").neq("stage","done").order("created_at",{ascending:false});
      setDeals((data || []) as Deal[]);
    })();
  }, [open]);

  const save = async () => {
    if (!dealId) { toast.error("Pick a deal"); return; }
    setSaving(true);
    const { error } = await supabase.from("deal_contacts").insert({
      deal_id: dealId, contact_id: contactId, role_in_deal: role.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Linked to deal");
    setDealId(""); setRole("");
    onOpenChange(false); onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display text-teal">Link to deal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Deal</Label>
            {deals.length === 0 ? (
              <div className="text-sm text-muted-foreground italic mt-1">No active deals.</div>
            ) : (
              <Select value={dealId} onValueChange={setDealId}>
                <SelectTrigger><SelectValue placeholder="Choose a deal…" /></SelectTrigger>
                <SelectContent>
                  {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Role in deal</Label>
            <Input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Introducer, Buyer, Advisor" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" disabled={saving || !dealId} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}