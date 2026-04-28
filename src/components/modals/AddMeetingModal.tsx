import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function AddMeetingModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [about, setAbout] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setCompany(""); setAbout(""); setTime(""); };

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("contacts").select("id").eq("full_name", name.trim()).maybeSingle();
      let contactId = existing?.id as string | undefined;
      if (!contactId) {
        const { data: created, error } = await supabase
          .from("contacts")
          .insert({ full_name: name.trim(), company: company.trim() || null, status: "meeting booked" })
          .select("id").single();
        if (error) throw error;
        contactId = created.id;
      }
      const today = new Date().toISOString().slice(0, 10);
      const summary = time ? `Meeting at ${time}${about ? ` — ${about}` : ""}` : (about || "Meeting");
      const { error: e2 } = await supabase.from("interactions").insert({
        contact_id: contactId, date: today, type: "meeting", summary, full_note: about || null,
      });
      if (e2) throw e2;
      await supabase.from("contacts").update({ last_contact_date: today }).eq("id", contactId);
      toast.success("Meeting added");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display text-teal">Add today's meeting</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div>
          <div><Label>Company</Label><Input value={company} onChange={e=>setCompany(e.target.value)} /></div>
          <div><Label>What it's about</Label><Textarea value={about} onChange={e=>setAbout(e.target.value)} /></div>
          <div><Label>Time</Label><Input placeholder="e.g. 10:30" value={time} onChange={e=>setTime(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" disabled={saving} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}