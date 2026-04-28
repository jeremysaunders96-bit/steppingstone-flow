import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, type InteractionType } from "@/lib/supabase";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

const TYPES: InteractionType[] = ["meeting","call","email","voice note","introduction made","note"];

export function AddNoteModal({
  open, onOpenChange, contactId, onSaved,
}: { open: boolean; onOpenChange:(v:boolean)=>void; contactId: string; onSaved:()=>void }) {
  const today = new Date().toISOString().slice(0,10);
  const [date, setDate] = useState(today);
  const [type, setType] = useState<InteractionType>("note");
  const [summary, setSummary] = useState("");
  const [fullNote, setFullNote] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [needs, setNeeds] = useState(false);
  const [by, setBy] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!summary.trim()) { toast.error("Summary is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("interactions").insert({
      contact_id: contactId, date, type, summary: summary.trim(),
      full_note: fullNote.trim() || null,
      action_items: actions.filter(Boolean).map(text => ({ text, done: false })),
      needs_followup: needs, followup_by: needs && by ? by : null,
    });
    if (!error) await supabase.from("contacts").update({ last_contact_date: date }).eq("id", contactId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setDate(today); setType("note"); setSummary(""); setFullNote(""); setActions([]); setNeeds(false); setBy("");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-teal">Add Note</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
            <div><Label>Type</Label>
              <Select value={type} onValueChange={(v)=>setType(v as InteractionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Summary</Label><Input value={summary} onChange={e=>setSummary(e.target.value)} /></div>
          <div><Label>Full note</Label><Textarea rows={4} value={fullNote} onChange={e=>setFullNote(e.target.value)} /></div>
          <div>
            <Label>Action items</Label>
            <div className="space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={a} onChange={e=>{ const n=[...actions]; n[i]=e.target.value; setActions(n); }} />
                  <Button variant="ghost" size="icon" onClick={()=>setActions(actions.filter((_,j)=>j!==i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-teal" onClick={()=>setActions([...actions, ""])}>
                <Plus className="h-4 w-4 mr-1" /> Add action
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={needs} onCheckedChange={setNeeds} />
            <Label className="!mb-0">Needs follow-up</Label>
          </div>
          {needs && (
            <div><Label>Follow-up by</Label><Input type="date" value={by} onChange={e=>setBy(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" disabled={saving} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}