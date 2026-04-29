import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, type InteractionType, type Contact } from "@/lib/supabase";
import { ContactPicker } from "@/components/ContactPicker";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

const TYPES: InteractionType[] = ["meeting","call","email","voice note","introduction made","note"];

// Remembers the last type Will picked, for the lifetime of this browser session.
let lastType: InteractionType = "note";

type LinkedContactOption = { id: string; full_name: string; company?: string | null };

export function AddNoteModal({
  open, onOpenChange, contactId, contactOptions, onSaved, editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fixed contact this note belongs to. Ignored when contactOptions is provided. */
  contactId?: string;
  /** When provided, render a contact picker at the top of the modal. */
  contactOptions?: LinkedContactOption[];
  onSaved: () => void;
  /** When provided, edit this existing interaction instead of inserting a new one. */
  editing?: {
    id: string;
    contact_id: string;
    date: string;
    type: InteractionType;
    summary: string;
    full_note: string | null;
    action_items: { text: string; done: boolean }[] | null;
    needs_followup: boolean;
    followup_by: string | null;
  } | null;
}) {
  const today = new Date().toISOString().slice(0,10);
  const [date, setDate] = useState(today);
  const [type, setType] = useState<InteractionType>(lastType);
  const [summary, setSummary] = useState("");
  const [fullNote, setFullNote] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [needs, setNeeds] = useState(false);
  const [by, setBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickedContactId, setPickedContactId] = useState<string>("");
  const [pickedContact, setPickedContact] = useState<Contact | null>(null);

  const usePicker = !!contactOptions && contactOptions.length > 0;
  // When editing, always allow reassignment via a searchable contact picker.
  const useSearchPicker = !!editing;
  const effectiveContactId = useSearchPicker
    ? (pickedContact?.id || "")
    : usePicker
      ? pickedContactId
      : (contactId || "");

  const followupRequired = type === "meeting" || type === "call";

  // When opening in edit mode, hydrate the form with the existing interaction.
  useEffect(() => {
    if (open && editing) {
      setDate(editing.date);
      setType(editing.type);
      setSummary(editing.summary);
      setFullNote(editing.full_note || "");
      setActions((editing.action_items || []).map(a => a.text));
      setNeeds(!!editing.needs_followup);
      setBy(editing.followup_by || "");
      setPickedContactId(editing.contact_id);
      // Hydrate the searchable picker with the currently linked contact.
      (async () => {
        const { data } = await supabase
          .from("contacts").select("*").eq("id", editing.contact_id).maybeSingle();
        if (data) setPickedContact(data as Contact);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // When type flips to meeting/call, force needs_followup on and default to +4 days.
  useEffect(() => {
    if (followupRequired) {
      setNeeds(true);
      if (!by) {
        const d = new Date();
        d.setDate(d.getDate() + 4);
        setBy(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const save = async () => {
    if (!effectiveContactId) { toast.error("Pick a contact for this note"); return; }
    if (!summary.trim()) { toast.error("Summary is required"); return; }
    if (followupRequired && !by) {
      toast.error("Follow-up date is required for meetings and calls");
      return;
    }
    setSaving(true);
    const existingActions = editing?.action_items || [];
    const mergedActions = actions.filter(Boolean).map((text, i) => {
      const prev = existingActions[i];
      return { text, done: prev ? prev.done : false };
    });
    const payload = {
      contact_id: effectiveContactId, date, type, summary: summary.trim(),
      full_note: fullNote.trim() || null,
      action_items: mergedActions,
      needs_followup: needs, followup_by: needs && by ? by : null,
    };
    const { error } = editing
      ? await supabase.from("interactions").update(payload).eq("id", editing.id)
      : await supabase.from("interactions").insert(payload);
    if (!error) {
      await supabase.from("contacts").update({ last_contact_date: date }).eq("id", effectiveContactId);
      // If editing reassigned the note to a different contact, also bump that contact's last_contact_date
      if (editing && editing.contact_id !== effectiveContactId) {
        // (the new contact is already updated above)
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    lastType = type;
    toast.success(editing ? "Note updated" : "Saved");
    setDate(today); setSummary(""); setFullNote(""); setActions([]); setNeeds(false); setBy(""); setPickedContactId(""); setPickedContact(null);
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-teal">{editing ? "Edit Note" : "Add Note"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {useSearchPicker ? (
            <ContactPicker label="Contact" value={pickedContact} onChange={setPickedContact} />
          ) : usePicker && (
            <div>
              <Label>Contact</Label>
              <Select value={pickedContactId} onValueChange={setPickedContactId}>
                <SelectTrigger><SelectValue placeholder="Which linked contact is this about?" /></SelectTrigger>
                <SelectContent>
                  {contactOptions!.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.company ? ` — ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
            <Switch
              checked={needs}
              onCheckedChange={setNeeds}
              disabled={followupRequired}
            />
            <Label className="!mb-0">
              Needs follow-up
              {followupRequired && <span className="text-orange ml-1">(required)</span>}
            </Label>
          </div>
          {needs && (
            <div>
              <Label>
                Follow-up by
                {followupRequired && <span className="text-orange ml-1">*</span>}
              </Label>
              <Input
                type="date"
                value={by}
                onChange={e=>setBy(e.target.value)}
                className={followupRequired ? "ring-2 ring-orange/60 border-orange focus-visible:ring-orange" : ""}
              />
              {followupRequired && (
                <p className="text-xs text-orange mt-1">Defaulted to 4 days from today — change if needed.</p>
              )}
            </div>
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