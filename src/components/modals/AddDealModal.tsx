import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, type DealStage, type DealType } from "@/lib/supabase";
import { toast } from "sonner";

const TYPES: { value: DealType; label: string }[] = [
  { value: "capital-raise", label: "Capital Raise" },
  { value: "introduction-mandate", label: "Intro Mandate" },
  { value: "advisory", label: "Advisory" },
  { value: "other", label: "Other" },
];

const STAGES: DealStage[] = ["exploring","in progress","warm","closing","done"];

export function AddDealModal({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange:(v:boolean)=>void; onSaved:(dealId: string)=>void }) {
  const [name, setName] = useState("");
  const [dealType, setDealType] = useState<DealType | "">("");
  const [client, setClient] = useState("");
  const [target, setTarget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [commission, setCommission] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [stage, setStage] = useState<DealStage>("exploring");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setDealType(""); setClient(""); setTarget("");
    setStartDate(""); setCloseDate(""); setCommission("");
    setNextAction(""); setNextDate(""); setStage("exploring");
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Deal name is required"); return; }
    setSaving(true);
    const targetNum = target.trim() ? Number(target.replace(/[, ]/g, "")) : null;
    const { data, error } = await supabase.from("deals").insert({
      name: name.trim(),
      deal_type: dealType || null,
      client_name: client.trim() || null,
      target_amount: Number.isFinite(targetNum as number) ? targetNum : null,
      start_date: startDate || null,
      target_close_date: closeDate || null,
      commission_structure: commission.trim() || null,
      next_action: nextAction.trim() || null,
      next_action_date: nextDate || null,
      stage,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Deal created");
    reset();
    onOpenChange(false);
    if (data?.id) onSaved(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v)=>{ if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-teal">Add Deal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Deal name <span className="text-orange">*</span></Label>
            <Input value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Deal type</Label>
              <Select value={dealType} onValueChange={(v)=>setDealType(v as DealType)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Stage</Label>
              <Select value={stage} onValueChange={(v)=>setStage(v as DealStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Client name</Label>
            <Input value={client} onChange={e=>setClient(e.target.value)} />
          </div>
          <div><Label>Target amount (£)</Label>
            <Input type="number" inputMode="numeric" value={target} onChange={e=>setTarget(e.target.value)} placeholder="e.g. 12000000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start date</Label>
              <Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
            </div>
            <div><Label>Target close date</Label>
              <Input type="date" value={closeDate} onChange={e=>setCloseDate(e.target.value)} />
            </div>
          </div>
          <div><Label>Commission structure</Label>
            <Textarea rows={2} value={commission} onChange={e=>setCommission(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Next action</Label>
              <Input value={nextAction} onChange={e=>setNextAction(e.target.value)} />
            </div>
            <div><Label>Next action date</Label>
              <Input type="date" value={nextDate} onChange={e=>setNextDate(e.target.value)} />
            </div>
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