import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronDown, ChevronRight, Link2, Mic } from "lucide-react";
import { supabase, type Contact, type Interaction, type IntroductionWithOther, type Deal } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { IntroductionStatusBadge } from "@/components/IntroductionStatusBadge";
import { formatLongDate, formatMoney } from "@/lib/format";
import { DraftEmailModal } from "@/components/modals/DraftEmailModal";
import { DraftIntroEmailModal } from "@/components/modals/DraftIntroEmailModal";
import { AddNoteModal } from "@/components/modals/AddNoteModal";
import { LinkToDealModal } from "@/components/modals/LinkToDealModal";
import { DealModal } from "@/components/modals/DealModal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ActionItemList } from "@/components/ActionItemList";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type LinkedDeal = Deal & { role_in_deal: string | null };

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Contact | null>(null);
  const [hist, setHist] = useState<Interaction[]>([]);
  const [intros, setIntros] = useState<IntroductionWithOther[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState(false);
  const [intro, setIntro] = useState(false);
  const [note, setNote] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [linkDeal, setLinkDeal] = useState(false);
  const [linkedDeals, setLinkedDeals] = useState<LinkedDeal[]>([]);
  const [openDeal, setOpenDeal] = useState<Deal | null>(null);
  const [inlineLink, setInlineLink] = useState(false);
  const [activeDeals, setActiveDeals] = useState<Deal[]>([]);
  const [pickedDealId, setPickedDealId] = useState<string>("");
  const [pickedRole, setPickedRole] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
    setC(data as Contact | null);
    const { data: ints } = await supabase.from("interactions").select("*").eq("contact_id", id).order("date", { ascending: false });
    setHist((ints || []) as Interaction[]);

    const { data: introRows } = await supabase
      .from("introductions")
      .select("*, first:contacts!introductions_first_contact_id_fkey(*), second:contacts!introductions_second_contact_id_fkey(*)")
      .or(`first_contact_id.eq.${id},second_contact_id.eq.${id}`)
      .order("created_at", { ascending: false });
    const mapped: IntroductionWithOther[] = (introRows || []).map((r: any) => {
      const other = r.first_contact_id === id ? r.second : r.first;
      return {
        id: r.id,
        first_contact_id: r.first_contact_id,
        second_contact_id: r.second_contact_id,
        reason: r.reason,
        status: r.status,
        created_at: r.created_at,
        other: other || null,
      };
    });
    setIntros(mapped);

    const { data: dealRows } = await supabase
      .from("deal_contacts")
      .select("role_in_deal, deal:deals(*)")
      .eq("contact_id", id);
    setLinkedDeals(
      (dealRows || [])
        .map((r: any) => r.deal ? { ...(r.deal as Deal), role_in_deal: r.role_in_deal } : null)
        .filter(Boolean) as LinkedDeal[]
    );
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const openInlineLink = async () => {
    setInlineLink(true);
    setPickedDealId(""); setPickedRole("");
    const { data } = await supabase.from("deals").select("*").neq("stage","done").order("created_at",{ascending:false});
    const linkedIds = new Set(linkedDeals.map(d => d.id));
    setActiveDeals(((data || []) as Deal[]).filter(d => !linkedIds.has(d.id)));
  };

  const saveInlineLink = async () => {
    if (!id || !pickedDealId) return;
    setSavingLink(true);
    const { error } = await supabase.from("deal_contacts").insert({
      deal_id: pickedDealId, contact_id: id, role_in_deal: pickedRole.trim() || null,
    });
    setSavingLink(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Deal linked");
    setInlineLink(false);
    await load();
  };

  const toggleAction = async (interactionId: string, idx: number) => {
    const i = hist.find(h => h.id === interactionId); if (!i?.action_items) return;
    const next = i.action_items.map((a, j) => j === idx ? { ...a, done: !a.done } : a);
    await supabase.from("interactions").update({ action_items: next }).eq("id", interactionId);
    setHist(hist.map(h => h.id === interactionId ? { ...h, action_items: next } : h));
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await supabase.from("action_items").delete().eq("interaction_id", deletingId);
    const { error } = await supabase.from("interactions").delete().eq("id", deletingId);
    if (error) { toast.error(error.message); return; }
    toast.success("Note deleted");
    setDeletingId(null);
    load();
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
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-md overflow-hidden shadow-sm">
              <Button
                className="bg-teal hover:bg-teal/90 text-white rounded-none border-r border-white/15"
                onClick={()=>setDraft(true)}
              >Draft Email</Button>
              <Button
                className="bg-teal-light hover:bg-teal-light/80 text-teal rounded-none"
                onClick={()=>setIntro(true)}
              >Draft Introduction Email</Button>
            </div>
            <Button variant="outline" size="sm" onClick={()=>setLinkDeal(true)}>
              <Link2 className="h-4 w-4 mr-1.5" /> Link to deal
            </Button>
            <Button variant="outline" size="sm" onClick={()=>setNote(true)}>Add Note</Button>
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
        <Tabs defaultValue="history">
          <TabsList className="bg-muted">
            <TabsTrigger value="history" className="data-[state=active]:bg-background data-[state=active]:text-teal">
              History
            </TabsTrigger>
            <TabsTrigger value="introductions" className="data-[state=active]:bg-background data-[state=active]:text-teal">
              Introductions{intros.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({intros.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            {hist.length === 0 ? (
              <div className="card-soft p-6 text-sm text-muted-foreground italic">No interactions yet.</div>
            ) : (
              <div className="card-soft divide-y">
                {hist.map(i => {
                  const open = !!expanded[i.id];
                  const isVoice = i.type === "voice note";
                  return (
                    <div key={i.id} className="px-5 py-4">
                      <button onClick={()=>setExpanded(s => ({...s, [i.id]: !open}))} className="w-full text-left flex items-start gap-3">
                        <span className="mt-1">{open ? <ChevronDown className="h-4 w-4 text-muted-foreground"/> : <ChevronRight className="h-4 w-4 text-muted-foreground"/>}</span>
                        {isVoice && <Mic className="h-4 w-4 mt-1 text-teal shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-3 flex-wrap">
                            <span className="text-xs text-muted-foreground">{formatLongDate(i.date)}</span>
                            <span className={`text-xs ${isVoice ? "text-teal" : "uppercase tracking-wide text-muted-foreground"}`}>
                              {isVoice ? "Voice note" : i.type}
                            </span>
                          </div>
                          <div className="font-semibold text-ink mt-0.5">{i.summary}</div>
                        </div>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); setEditingInteraction(i); setNote(true); }}
                          className="text-xs text-teal hover:underline shrink-0 mt-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); setDeletingId(i.id); }}
                          className="text-xs text-red-600 hover:underline shrink-0 mt-1 ml-2"
                        >
                          Delete
                        </button>
                      </button>
                      {open && (
                        <div className="pl-7 mt-3 space-y-3">
                          {i.full_note && <p className="text-sm text-ink/85 whitespace-pre-wrap">{i.full_note}</p>}
                          <ActionItemList
                            interactionId={i.id}
                            needsFollowup={i.needs_followup}
                            onAllCompleteChanged={load}
                          />
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
          </TabsContent>

          <TabsContent value="introductions" className="mt-4">
            {intros.length === 0 ? (
              <div className="card-soft p-6 text-sm text-muted-foreground italic">No introductions logged for this contact.</div>
            ) : (
              <div className="card-soft divide-y">
                {intros.map(i => (
                  <div key={i.id} className="px-5 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink">
                        {i.other ? (
                          <Link to={`/contacts/${i.other.id}`} className="hover:text-teal">{i.other.full_name}</Link>
                        ) : "Unknown contact"}
                        {i.other?.company && <span className="text-muted-foreground font-normal"> — {i.other.company}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatLongDate(i.created_at)}</div>
                      {i.reason && <div className="text-sm text-ink/80 mt-1">{i.reason}</div>}
                    </div>
                    <IntroductionStatusBadge status={i.status} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl text-teal">Linked Deals</h2>
          {!inlineLink && (
            <button
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-teal-light text-teal hover:bg-teal-light/80"
              onClick={openInlineLink}
            >
              + Link to deal
            </button>
          )}
        </div>

        {inlineLink && (
          <div className="card-soft p-4 mb-3 space-y-2">
            {activeDeals.length === 0 ? (
              <div className="text-sm italic text-muted-foreground">No active deals available to link.</div>
            ) : (
              <Select value={pickedDealId} onValueChange={setPickedDealId}>
                <SelectTrigger><SelectValue placeholder="Choose a deal…" /></SelectTrigger>
                <SelectContent>
                  {activeDeals.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2">
              <Input
                value={pickedRole}
                onChange={e=>setPickedRole(e.target.value)}
                placeholder="e.g. Investor, Introducer, Advisor"
                className="flex-1"
              />
              <button
                disabled={!pickedDealId || savingLink}
                onClick={saveInlineLink}
                className="px-3 py-2 rounded-md text-sm font-medium bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
              >
                Link
              </button>
              <button
                onClick={()=>setInlineLink(false)}
                className="px-2 py-2 text-xs text-muted-foreground hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {linkedDeals.length === 0 ? (
          <div className="card-soft p-6 text-sm text-muted-foreground italic">No deals linked.</div>
        ) : (
          <div className="card-soft divide-y">
            {linkedDeals.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-teal">{d.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-light text-teal">{d.stage}</span>
                    {d.target_amount != null && (
                      <span className="text-sm text-ink">{formatMoney(d.target_amount)}</span>
                    )}
                    {d.role_in_deal && (
                      <span className="text-xs italic text-teal">{d.role_in_deal}</span>
                    )}
                  </div>
                  {d.description && (
                    <div className="text-sm text-muted-foreground truncate mt-0.5">{d.description}</div>
                  )}
                </div>
                <button
                  className="text-xs text-teal hover:underline shrink-0"
                  onClick={()=>setOpenDeal(d)}
                >
                  View deal
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <DraftEmailModal open={draft} onOpenChange={setDraft} contactName={c.full_name} contact={c} />
      <DraftIntroEmailModal open={intro} onOpenChange={setIntro} firstContact={c} />
      <AddNoteModal
        open={note}
        onOpenChange={(v)=>{ setNote(v); if (!v) setEditingInteraction(null); }}
        contactId={c.id}
        editing={editingInteraction}
        onSaved={load}
      />
      <LinkToDealModal open={linkDeal} onOpenChange={setLinkDeal} contactId={c.id} onSaved={load} />
      <DealModal deal={openDeal} onOpenChange={(v)=>!v && setOpenDeal(null)} />
      <AlertDialog open={!!deletingId} onOpenChange={(v)=>!v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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