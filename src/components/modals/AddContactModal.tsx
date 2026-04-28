import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, type ContactStatus } from "@/lib/supabase";
import { toast } from "sonner";

const STATUSES: ContactStatus[] = ["contacted","replied","meeting booked","intro made","deal done","gone cold"];

export function AddContactModal({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange:(v:boolean)=>void; onSaved:()=>void }) {
  const [f, setF] = useState({
    full_name:"", company:"", role:"", email:"", phone:"", how_we_met:"",
    status: "contacted" as ContactStatus, linkedin_url:"", notes:"",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof f, v: string) => setF(s => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.full_name.trim()) { toast.error("Full name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("contacts").insert({
      full_name: f.full_name.trim(),
      company: f.company.trim() || null,
      role: f.role.trim() || null,
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      how_we_met: f.how_we_met.trim() || null,
      status: f.status,
      linkedin_url: f.linkedin_url.trim() || null,
      notes: f.notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact added");
    setF({ full_name:"", company:"", role:"", email:"", phone:"", how_we_met:"", status:"contacted", linkedin_url:"", notes:"" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-teal">Add Contact</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Full name</Label><Input value={f.full_name} onChange={e=>set("full_name",e.target.value)} /></div>
          <div><Label>Company</Label><Input value={f.company} onChange={e=>set("company",e.target.value)} /></div>
          <div><Label>Role</Label><Input value={f.role} onChange={e=>set("role",e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={e=>set("email",e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={e=>set("phone",e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>How we met</Label><Input value={f.how_we_met} onChange={e=>set("how_we_met",e.target.value)} /></div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={(v)=>set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>LinkedIn URL</Label><Input value={f.linkedin_url} onChange={e=>set("linkedin_url",e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={3} value={f.notes} onChange={e=>set("notes",e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" disabled={saving} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}