import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronDown, ChevronRight } from "lucide-react";
import { supabase, type Contact, type Interaction } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatLongDate } from "@/lib/format";
import { DraftEmailModal } from "@/components/modals/DraftEmailModal";
import { DraftIntroEmailModal } from "@/components/modals/DraftIntroEmailModal";
import { AddNoteModal } from "@/components/modals/AddNoteModal";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Contact | null>(null);
  const [hist, setHist] = useState<Interaction[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState(false);
  const [intro, setIntro] = useState(false);
  const [note, setNote] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
    setC(data as Contact | null);
    const { data: ints } = await supabase.from("interactions").select("*").eq("contact_id", id).order("date", { ascending: false });
    setHist((ints || []) as Interaction[]);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const toggleAction = async (interactionId: string, idx: number) => {
    const i = hist.find(h => h.id === interactionId); if (!i?.action_items) return;
    const next = i.action_items.map((a, j) => j === idx ? { ...a, done: !a.done } : a);
    await supabase.from("interactions").update({ action_items: next }).eq("id", interactionId);
    setHist(hist.map(h => h.id === interactionId ? { ...h, action_items: next } : h));
  };

  if (!c) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-10">
      <Link to="/contacts" className="inline-flex items-center text-sm text-teal hover:underline">
        <ChevronLeft className="h-4 w-4" /> All contacts
      </Link>

      <section className="card-soft p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-3xl text-ink">{c.full_name}</h1>
            {(c.role || c.company) && (
              <p className="text-muted-foreground mt-1">{[c.role, c.company].filter(Boolean).join(" · ")}</p>
            )}
            <div className="mt-2"><StatusBadge status={c.status} /></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button className="bg-teal hover:bg-teal/90 text-white" onClick={()=>setDraft(true)}>Draft Email</Button>
            <Button className="bg-teal-light hover:bg-teal-light/80 text-teal" onClick={()=>setIntro(true)}>Draft Introduction Email</Button>
            <Button variant="outline" onClick={()=>setNote(true)}>Add Note</Button>
          </div>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-8 text-sm">
          <Field label="Email">{c.email ? <a className="text-teal hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : "—"}</Field>
          <Field label="Phone">{c.phone || "—"}</Field>
          <Field label="How we met">{c.how_we_met || "—"}</Field>
          <Field label="Last contact">{formatLongDate(c.last_contact_date)}</Field>
          <Field label="LinkedIn">{c.linkedin_url ? <a className="text-teal hover:underline" href={c.linkedin_url} target="_blank" rel="noreferrer">View profile</a> : "—"}</Field>
          {c.notes && <div className="md:col-span-2"><Field label="Notes"><span className="whitespace-pre-wrap">{c.notes}</span></Field></div>}
        </dl>
      </section>

      <section>
        <h2 className="font-display text-2xl text-teal mb-4">History</h2>
        {hist.length === 0 ? (
          <div className="card-soft p-6 text-sm text-muted-foreground italic">No interactions yet.</div>
        ) : (
          <div className="card-soft divide-y">
            {hist.map(i => {
              const open = !!expanded[i.id];
              return (
                <div key={i.id} className="px-5 py-4">
                  <button onClick={()=>setExpanded(s => ({...s, [i.id]: !open}))} className="w-full text-left flex items-start gap-3">
                    <span className="mt-1">{open ? <ChevronDown className="h-4 w-4 text-muted-foreground"/> : <ChevronRight className="h-4 w-4 text-muted-foreground"/>}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{i.type}</span>
                        <span className="text-xs text-muted-foreground">{formatLongDate(i.date)}</span>
                      </div>
                      <div className="font-semibold text-ink mt-0.5">{i.summary}</div>
                    </div>
                  </button>
                  {open && (
                    <div className="pl-7 mt-3 space-y-3">
                      {i.full_note && <p className="text-sm text-ink/85 whitespace-pre-wrap">{i.full_note}</p>}
                      {i.action_items && i.action_items.length > 0 && (
                        <ul className="space-y-1">
                          {i.action_items.map((a, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={a.done} onChange={()=>toggleAction(i.id, idx)} />
                              <span className={a.done ? "line-through text-muted-foreground" : ""}>{a.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {i.needs_followup && i.followup_by && (
                        <div className="text-xs text-orange">Follow up by {formatLongDate(i.followup_by)}</div>
                      )}
                      <button className="text-xs text-teal hover:underline" onClick={()=>setNote(true)}>Add follow-up</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4">
          <Button variant="outline" onClick={()=>setNote(true)}>Add Note</Button>
        </div>
      </section>

      <DraftEmailModal open={draft} onOpenChange={setDraft} contactName={c.full_name} />
      <DraftIntroEmailModal open={intro} onOpenChange={setIntro} firstContact={c} />
      <AddNoteModal open={note} onOpenChange={setNote} contactId={c.id} onSaved={load} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-ink mt-1">{children}</dd>
    </div>
  );
}