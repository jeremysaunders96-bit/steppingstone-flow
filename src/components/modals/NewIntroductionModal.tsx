import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ContactPicker } from "@/components/ContactPicker";
import { supabase, type Contact } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Copy, RefreshCcw } from "lucide-react";
import { generateDraft, fetchRecentInteractions, contactToBrief } from "@/lib/draftEmail";

export function NewIntroductionModal({
  open, onOpenChange, onSaved, lockedFirst,
}: { open: boolean; onOpenChange:(v:boolean)=>void; onSaved?:()=>void; lockedFirst?: Contact | null }) {
  const [first, setFirst] = useState<Contact | null>(lockedFirst || null);
  const [second, setSecond] = useState<Contact | null>(null);
  const [reason, setReason] = useState("");
  const [createDeal, setCreateDeal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);

  const reset = () => {
    setFirst(lockedFirst || null); setSecond(null); setReason("");
    setCreateDeal(true); setDraft(""); setDrafting(false); setSaving(false);
  };

  const draftEmail = async () => {
    if (!first || !second) { toast.error("Pick both people"); return; }
    if (!reason.trim()) { toast.error("Add a reason for the introduction"); return; }
    setDrafting(true);
    try {
      const [iA, iB] = await Promise.all([
        fetchRecentInteractions(first.id),
        fetchRecentInteractions(second.id),
      ]);
      const text = await generateDraft({
        mode: "intro",
        brief: reason.trim(),
        contactA: contactToBrief(first, iA),
        contactB: contactToBrief(second, iB),
      });
      setDraft(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate draft");
    } finally {
      setDrafting(false);
    }
  };

  const copyDraft = async () => {
    try { await navigator.clipboard.writeText(draft); toast.success("Copied to clipboard"); }
    catch { toast.error("Could not copy"); }
  };

  const save = async () => {
    if (!first || !second) { toast.error("Pick both people"); return; }
    setSaving(true);
    const { error } = await supabase.from("introductions").insert({
      first_contact_id: first.id, second_contact_id: second.id,
      reason: reason.trim() || null, status: "made",
    });
    if (error) { setSaving(false); toast.error(error.message); return; }

    if (createDeal) {
      const dealName = `Introduction: ${first.full_name} / ${second.full_name}`;
      const { data: deal, error: dealErr } = await supabase
        .from("deals")
        .insert({
          name: dealName,
          deal_type: "one-off-introduction",
          description: reason.trim() || null,
          stage: "active",
        })
        .select("id")
        .single();
      if (dealErr || !deal) {
        setSaving(false);
        toast.error(dealErr?.message || "Failed to create deal");
        return;
      }
      const { error: linkErr } = await supabase.from("deal_contacts").insert([
        { deal_id: deal.id, contact_id: first.id },
        { deal_id: deal.id, contact_id: second.id },
      ]);
      if (linkErr) {
        setSaving(false);
        toast.error(linkErr.message);
        return;
      }
    }
    toast.success("Introduction saved");

    reset();
    onOpenChange(false); onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v)=>{ if(!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-display text-teal">New Introduction</DialogTitle></DialogHeader>
        {!draft ? (
          <>
            <div className="space-y-3">
              <ContactPicker label="First person" value={first} onChange={setFirst} excludeId={second?.id} />
              <ContactPicker label="Second person" value={second} onChange={setSecond} excludeId={first?.id} />
              <div>
                <Label>Reason for introduction</Label>
                <Textarea
                  value={reason}
                  onChange={e=>setReason(e.target.value)}
                  rows={4}
                  placeholder="Why should these two people meet? One sentence. e.g. Victoria chairs a £500m investment trust and is exploring ways to address the discount problem. Nirav runs Curation Connect which helps exactly that."
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <Label htmlFor="create-deal-toggle" className="cursor-pointer">Create a deal for this introduction?</Label>
                <Switch id="create-deal-toggle" checked={createDeal} onCheckedChange={setCreateDeal} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
              <Button className="bg-teal hover:bg-teal/90 text-white" disabled={drafting} onClick={draftEmail}>
                {drafting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Draft Introduction Email
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <Label>Draft</Label>
              <Textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={16} className="font-sans text-sm" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyDraft}>
                  <Copy className="h-4 w-4 mr-1" /> Copy Email
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={draftEmail} disabled={drafting}>
                  {drafting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
                  Regenerate
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={()=>setDraft("")}>Back</Button>
              <Button className="bg-teal hover:bg-teal/90 text-white" disabled={saving} onClick={save}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Introduction
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}