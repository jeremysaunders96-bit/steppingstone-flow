import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, type Contact, type DealStage, type DealType } from "@/lib/supabase";
import { toast } from "sonner";

const TYPES: { value: DealType; label: string }[] = [
  { value: "capital-raise", label: "Capital Raise" },
  { value: "introduction-mandate", label: "Intro Mandate" },
  { value: "advisory", label: "Advisory" },
  { value: "other", label: "Other" },
  { value: "one-off-introduction", label: "One-off Introduction" },
];

const STANDARD_STAGES: DealStage[] = ["active","progressing","stalled","done"];
const INTRO_STAGES: DealStage[] = ["introduced","progressing","led-somewhere","gone-cold"];

function isIntro(t: DealType | "") { return t === "one-off-introduction"; }

export function AddDealModal({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange:(v:boolean)=>void; onSaved:(dealId: string)=>void }) {
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [dealType, setDealType] = useState<DealType | "">("");
  const [client, setClient] = useState("");
  const [target, setTarget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [commission, setCommission] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [stage, setStage] = useState<DealStage>("active");
  const [introducing, setIntroducing] = useState<Contact | null>(null);
  const [toContact, setToContact] = useState<Contact | null>(null);
  const [introReason, setIntroReason] = useState("");
  const [saving, setSaving] = useState(false);

  const intro = isIntro(dealType);
  const stages = intro ? INTRO_STAGES : STANDARD_STAGES;
  const isAdvisoryOrOther = dealType === "advisory" || dealType === "other";

  // When type switches, reset stage to a sensible default for that type.
  useEffect(() => {
    setStage(intro ? "introduced" : "active");
  }, [intro]);

  // Auto-generate intro deal name from picked contacts (unless Will edited it).
  useEffect(() => {
    if (!intro || nameTouched) return;
    if (introducing && toContact) {
      setName(`Introduction: ${introducing.full_name} / ${toContact.full_name}`);
    } else {
      setName("");
    }
  }, [intro, introducing, toContact, nameTouched]);

  const reset = () => {
    setName(""); setNameTouched(false); setDealType(""); setClient(""); setTarget("");
    setStartDate(""); setCloseDate(""); setCommission("");
    setNextAction(""); setNextDate(""); setStage("active");
    setIntroducing(null); setToContact(null); setIntroReason("");
  };

  const save = async () => {
    if (intro) {
      if (!introducing || !toContact) { toast.error("Pick both contacts for the introduction"); return; }
      if (introducing.id === toContact.id) { toast.error("Pick two different contacts"); return; }
    }
    if (!name.trim()) { toast.error("Deal name is required"); return; }
    setSaving(true);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      deal_type: dealType || null,
      stage,
    };

    if (intro) {
      payload.description = introReason.trim() || null;
      payload.commission_structure = commission.trim() || null;
      payload.start_date = startDate || new Date().toISOString().slice(0,10);
    } else {
      const targetNum = target.trim() ? Number(target.replace(/[, ]/g, "")) : null;
      payload.client_name = client.trim() || null;
      payload.target_amount = Number.isFinite(targetNum as number) ? targetNum : null;
      payload.start_date = startDate || null;
      payload.target_close_date = closeDate || null;
      payload.commission_structure = commission.trim() || null;
      payload.next_action = nextAction.trim() || null;
      payload.next_action_date = nextDate || null;
    }

    const { data, error } = await supabase.from("deals")
      .insert(payload).select("id").maybeSingle();
    if (error || !data?.id) {
      setSaving(false);
      toast.error(error?.message || "Could not create deal");
      return;
    }

    if (intro && introducing && toContact) {
      const { error: linkErr } = await supabase.from("deal_contacts").insert([
        { deal_id: data.id, contact_id: introducing.id, role_in_deal: "Introducing" },
        { deal_id: data.id, contact_id: toContact.id, role_in_deal: "To" },
      ]);
      if (linkErr) toast.error(`Deal created but linking failed: ${linkErr.message}`);
    }

    setSaving(false);
    toast.success("Deal created");
    reset();
    onOpenChange(false);
    onSaved(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v)=>{ if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-teal">Add Deal</DialogTitle></DialogHeader>
        <div className="space-y-3">
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
                  {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {intro && (
            <>
              <ContactPicker label="Introducing *" value={introducing} onChange={setIntroducing} excludeId={toContact?.id} />
              <ContactPicker label="To *" value={toContact} onChange={setToContact} excludeId={introducing?.id} />
            </>
          )}

          <div><Label>Deal name <span className="text-orange">*</span></Label>
            <Input
              value={name}
              onChange={e=>{ setName(e.target.value); setNameTouched(true); }}
              placeholder={intro ? "Auto-fills once both contacts are picked" : ""}
            />
          </div>

          {intro ? (
            <>
              <div><Label>Reason for introduction</Label>
                <Textarea rows={3} value={introReason} onChange={e=>setIntroReason(e.target.value)} />
              </div>
              <div><Label>Commission structure (optional)</Label>
                <Textarea rows={2} value={commission} onChange={e=>setCommission(e.target.value)} />
              </div>
              <div><Label>Date made</Label>
                <Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div><Label>Client name</Label>
                <Input value={client} onChange={e=>setClient(e.target.value)} />
              </div>
              <div>
                <Label>{isAdvisoryOrOther ? "Fee (if applicable)" : "Target amount (£)"}</Label>
                <Input
                  type="number" inputMode="numeric"
                  value={target} onChange={e=>setTarget(e.target.value)}
                  placeholder={isAdvisoryOrOther ? "Optional" : "e.g. 12000000"}
                />
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
            </>
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

function ContactPicker({
  label, value, onChange, excludeId,
}: { label: string; value: Contact | null; onChange: (c: Contact | null) => void; excludeId?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q || value) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("contacts").select("*")
        .or(`full_name.ilike.%${q}%,company.ilike.%${q}%`).limit(8);
      setResults(((data || []) as Contact[]).filter(c => c.id !== excludeId));
    }, 150);
    return () => clearTimeout(t);
  }, [q, value, excludeId]);

  return (
    <div>
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/40">
          <span className="text-sm"><strong>{value.full_name}</strong>{value.company ? ` — ${value.company}` : ""}</span>
          <button className="text-xs text-muted-foreground hover:text-ink" onClick={()=>onChange(null)}>Change</button>
        </div>
      ) : (
        <div className="relative">
          <Input
            placeholder="Search contacts…"
            value={q}
            onFocus={()=>setOpen(true)}
            onChange={e=>{ setQ(e.target.value); setOpen(true); }}
            onBlur={()=>setTimeout(()=>setOpen(false), 150)}
          />
          {open && results.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
              {results.map(c => (
                <button key={c.id}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onClick={()=>{ onChange(c); setQ(""); setOpen(false); }}
                >
                  <strong>{c.full_name}</strong>
                  {c.company && <span className="text-muted-foreground"> — {c.company}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}