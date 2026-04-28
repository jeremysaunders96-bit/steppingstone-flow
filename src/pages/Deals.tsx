import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Briefcase, Users } from "lucide-react";
import { supabase, type Contact, type Deal, type DealStage, type DealType, type Interaction } from "@/lib/supabase";
import { formatLongDate, formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AddDealModal } from "@/components/modals/AddDealModal";
import { AddNoteModal } from "@/components/modals/AddNoteModal";
import { toast } from "sonner";

type DealRow = Deal & {
  last_activity_date: string | null;
  days_since_activity: number | null;
};
type LinkedContact = Contact & { role_in_deal: string | null };
type FeedRow = Interaction & { contact: Contact | null };

const STANDARD_STAGES: DealStage[] = ["active","progressing","stalled","done"];
const INTRO_STAGES: DealStage[] = ["introduced","progressing","led-somewhere","gone-cold"];

function isIntroType(t: DealType | null | undefined) {
  return t === "one-off-introduction";
}
function stagesFor(t: DealType | null | undefined): DealStage[] {
  return isIntroType(t) ? INTRO_STAGES : STANDARD_STAGES;
}

const TYPE_LABEL: Record<DealType, string> = {
  "capital-raise": "Capital Raise",
  "introduction-mandate": "Intro Mandate",
  "advisory": "Advisory",
  "other": "Other",
  "one-off-introduction": "Introduction",
};

function dealTypeLabel(t: DealType | null | undefined) {
  return t ? TYPE_LABEL[t] : null;
}

type FilterKey = "all" | "capital-raise" | "introduction" | "advisory";

function matchesFilter(t: DealType | null | undefined, f: FilterKey): boolean {
  if (f === "all") return true;
  if (f === "capital-raise") return t === "capital-raise" || t === "introduction-mandate";
  if (f === "introduction") return t === "one-off-introduction";
  if (f === "advisory") return t === "advisory" || t === "other";
  return true;
}

export default function Deals() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [deals, setDeals] = useState<DealRow[]>([]);
  // Map of deal_id -> linked contacts (used by left list for intro deals)
  const [dealContactsMap, setDealContactsMap] = useState<Record<string, LinkedContact[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const loadDeals = useCallback(async () => {
    const { data: viewData, error: viewErr } = await supabase
      .from("deal_last_activity").select("*");
    let rows: DealRow[];
    if (viewErr || !viewData) {
      const { data } = await supabase.from("deals").select("*").order("created_at",{ascending:false});
      rows = ((data || []) as Deal[]).map(d => ({ ...d, last_activity_date: null, days_since_activity: null }));
    } else {
      rows = (viewData as any[]).map(r => ({
        id: r.id ?? r.deal_id,
        name: r.name ?? r.deal_name ?? "Untitled deal",
        stage: r.stage,
        description: r.description ?? null,
        target_amount: r.target_amount ?? null,
        created_at: r.created_at ?? "",
        deal_type: r.deal_type ?? null,
        client_name: r.client_name ?? null,
        start_date: r.start_date ?? null,
        target_close_date: r.target_close_date ?? null,
        commission_structure: r.commission_structure ?? null,
        next_action: r.next_action ?? null,
        next_action_date: r.next_action_date ?? null,
        latest_update: r.latest_update ?? null,
        last_activity_date: r.last_activity_date ?? null,
        days_since_activity: r.days_since_activity ?? null,
      }));
    }
    rows.sort((a,b) => (b.created_at || "").localeCompare(a.created_at || ""));
    setDeals(rows);

    // Pull linked contacts for all deals (used by left list and detail).
    const { data: dcData } = await supabase
      .from("deal_contacts").select("deal_id, role_in_deal, contact:contacts(*)");
    const map: Record<string, LinkedContact[]> = {};
    ((dcData || []) as any[]).forEach(r => {
      if (!r.contact) return;
      const list = map[r.deal_id] || (map[r.deal_id] = []);
      list.push({ ...(r.contact as Contact), role_in_deal: r.role_in_deal });
    });
    setDealContactsMap(map);
  }, []);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  const filteredDeals = useMemo(
    () => deals.filter(d => matchesFilter(d.deal_type, filter)),
    [deals, filter]
  );

  // Initial selection: ?deal= param, then first filtered deal.
  useEffect(() => {
    if (selectedId && deals.some(d => d.id === selectedId)) return;
    const fromUrl = params.get("deal");
    if (fromUrl && deals.some(d => d.id === fromUrl)) { setSelectedId(fromUrl); return; }
    if (filteredDeals.length > 0) setSelectedId(filteredDeals[0].id);
  }, [deals, filteredDeals, selectedId, params]);

  const selectDeal = (id: string) => {
    setSelectedId(id);
    setParams({ deal: id }, { replace: true });
  };

  const selected = useMemo(() => deals.find(d => d.id === selectedId) || null, [deals, selectedId]);

  const onDealCreated = async (id: string) => {
    await loadDeals();
    selectDeal(id);
  };

  const onDealUpdated = async () => { await loadDeals(); };

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "capital-raise", label: "Capital Raise" },
    { key: "introduction", label: "Introductions" },
    { key: "advisory", label: "Advisory" },
  ];

  return (
    <div className="-mx-6 md:-mx-10 -my-8 md:-my-10 flex min-h-[calc(100vh-3rem)]">
      {/* LEFT PANEL */}
      <aside className="w-[320px] shrink-0 bg-teal text-white flex flex-col">
        <div className="px-5 pt-6 pb-3 flex items-center justify-between">
          <div className="font-display text-xl">Deals</div>
          <button
            onClick={() => setAddOpen(true)}
            className="text-sm font-medium text-orange hover:text-orange/80"
          >
            + Add Deal
          </button>
        </div>

        {/* Filter chips */}
        <div className="px-3 pb-3 flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] px-2 py-1 rounded-full transition-colors ${
                filter === f.key
                  ? "bg-white text-teal font-medium"
                  : "bg-white/10 text-white/85 hover:bg-white/20"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          {filteredDeals.length === 0 ? (
            <div className="px-5 py-8 text-sm italic text-white/60">No deals match this filter.</div>
          ) : (
            <ul>
              {filteredDeals.map(d => {
                const isActive = d.id === selectedId;
                const typeLbl = dealTypeLabel(d.deal_type);
                const staleness = d.last_activity_date == null
                  ? "No activity"
                  : `${d.days_since_activity ?? 0}d since activity`;
                const isIntro = isIntroType(d.deal_type);
                const intros = isIntro ? (dealContactsMap[d.id] || []).slice(0, 2) : [];
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => selectDeal(d.id)}
                      className={`w-full text-left px-5 py-3 border-b border-white/10 transition-colors ${
                        isActive ? "bg-[hsl(195_42%_36%)]" : "hover:bg-[hsl(195_42%_24%)]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isIntro
                          ? <Users className="h-4 w-4 mt-1 text-teal-light shrink-0" />
                          : <Briefcase className="h-4 w-4 mt-1 text-teal-light shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-base text-white truncate">{d.name}</div>
                          {isIntro && intros.length > 0 && (
                            <div className="text-[11px] text-white/70 truncate mt-0.5">
                              {intros.map(c => c.full_name).join(" / ")}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {typeLbl && (
                              <span className="text-[10px] uppercase tracking-wide text-teal-light">{typeLbl}</span>
                            )}
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/15 text-white">
                              {d.stage}
                            </span>
                          </div>
                          <div className="text-[11px] text-white/60 mt-1">{staleness}</div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <section className="flex-1 min-w-0 bg-background overflow-y-auto">
        {!selected ? (
          <div className="p-10 text-sm text-muted-foreground italic">
            Select a deal on the left, or click "+ Add Deal" to create one.
          </div>
        ) : (
          <DealDetail
            key={selected.id}
            deal={selected}
            onChanged={onDealUpdated}
            onOpenContact={(id) => navigate(`/contacts/${id}`)}
          />
        )}
      </section>

      <AddDealModal open={addOpen} onOpenChange={setAddOpen} onSaved={onDealCreated} />
    </div>
  );
}

function DealDetail({
  deal, onChanged, onOpenContact,
}: { deal: DealRow; onChanged: () => void; onOpenContact: (id: string) => void }) {
  const intro = isIntroType(deal.deal_type);
  const stages = stagesFor(deal.deal_type);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Deal>>({});

  const [contacts, setContacts] = useState<LinkedContact[]>([]);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Inline link
  const [linking, setLinking] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [picked, setPicked] = useState<Contact | null>(null);
  const [role, setRole] = useState("");

  const [noteOpen, setNoteOpen] = useState(false);

  const loadContacts = useCallback(async () => {
    const { data } = await supabase.from("deal_contacts")
      .select("role_in_deal, contact:contacts(*)").eq("deal_id", deal.id);
    setContacts(((data || []) as any[])
      .map(r => r.contact ? { ...(r.contact as Contact), role_in_deal: r.role_in_deal } : null)
      .filter(Boolean) as LinkedContact[]);
  }, [deal.id]);

  const loadFeed = useCallback(async (contactIds: string[]) => {
    if (contactIds.length === 0) { setFeed([]); return; }
    const { data } = await supabase
      .from("interactions").select("*, contact:contacts(*)")
      .in("contact_id", contactIds)
      .order("date", { ascending: false });
    setFeed(((data || []) as any[]).map(r => ({ ...(r as Interaction), contact: r.contact || null })));
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { loadFeed(contacts.map(c => c.id)); }, [contacts, loadFeed]);

  // Search contacts for linking
  useEffect(() => {
    if (!linking || !q || picked) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("contacts").select("*")
        .or(`full_name.ilike.%${q}%,company.ilike.%${q}%`).limit(8);
      const linkedIds = new Set(contacts.map(c => c.id));
      setResults(((data || []) as Contact[]).filter(c => !linkedIds.has(c.id)));
    }, 150);
    return () => clearTimeout(t);
  }, [q, linking, picked, contacts]);

  const updateDealField = async (patch: Partial<Deal>) => {
    const { error } = await supabase.from("deals").update(patch).eq("id", deal.id);
    if (error) { toast.error(error.message); return false; }
    onChanged();
    return true;
  };

  const saveStage = async (stage: DealStage) => {
    const ok = await updateDealField({ stage });
    if (ok) toast.success("Stage updated");
  };

  const startEdit = () => {
    setDraft({
      client_name: deal.client_name,
      start_date: deal.start_date,
      target_close_date: deal.target_close_date,
      commission_structure: deal.commission_structure,
      next_action: deal.next_action,
      next_action_date: deal.next_action_date,
      target_amount: deal.target_amount,
      latest_update: deal.latest_update,
      description: deal.description,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    const ok = await updateDealField(draft);
    if (ok) { setEditing(false); toast.success("Saved"); }
  };

  const saveNextActionInline = async (val: string) => {
    if (val === (deal.next_action || "")) return;
    await updateDealField({ next_action: val.trim() || null });
  };

  const saveLatestUpdateInline = async (val: string) => {
    if (val === (deal.latest_update || "")) return;
    await updateDealField({ latest_update: val.trim() || null });
  };

  const linkContact = async () => {
    if (!picked) return;
    const { error } = await supabase.from("deal_contacts").insert({
      deal_id: deal.id, contact_id: picked.id, role_in_deal: role.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    setLinking(false); setPicked(null); setRole(""); setQ("");
    await loadContacts();
    toast.success("Contact linked");
  };

  const removeContact = async (contactId: string) => {
    const { error } = await supabase.from("deal_contacts")
      .delete().eq("deal_id", deal.id).eq("contact_id", contactId);
    if (error) { toast.error(error.message); return; }
    await loadContacts();
  };

  const typeLbl = dealTypeLabel(deal.deal_type);

  return (
    <div className="p-8 md:p-10 space-y-8">
      {/* HEADER */}
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-3xl text-teal">{deal.name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {typeLbl && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-light text-teal">
                  {typeLbl}
                </span>
              )}
              <Select value={deal.stage} onValueChange={(v)=>saveStage(v as DealStage)}>
                <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!intro && (
            <div className="font-display text-2xl text-ink">
              {deal.target_amount != null ? formatMoney(deal.target_amount) : "TBC"}
            </div>
          )}
        </div>
      </div>

      {/* TWO COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: deal info */}
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg text-teal">
              {intro ? "Introduction details" : "Deal information"}
            </h3>
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={()=>setEditing(false)}>Cancel</Button>
                <Button size="sm" className="bg-teal hover:bg-teal/90 text-white" onClick={saveEdit}>Save</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
            )}
          </div>

          <dl className="space-y-3 text-sm">
            {intro ? (
              <>
                <Field label="Reason for introduction">
                  {editing ? (
                    <Textarea rows={3} value={draft.description ?? ""} onChange={e=>setDraft({...draft, description: e.target.value})} />
                  ) : (
                    <div className="whitespace-pre-wrap min-h-[2rem]">
                      {deal.description || <span className="italic text-muted-foreground">Not set</span>}
                    </div>
                  )}
                </Field>
                <Field label="Commission structure">
                  {editing ? (
                    <Textarea rows={2} value={draft.commission_structure ?? ""} onChange={e=>setDraft({...draft, commission_structure: e.target.value})} />
                  ) : (
                    <div className="bg-teal-light/40 text-ink/80 rounded-md px-3 py-2 text-sm whitespace-pre-wrap min-h-[2.5rem]">
                      {deal.commission_structure || <span className="italic text-muted-foreground">Not set</span>}
                    </div>
                  )}
                </Field>
                <Field label="Date made">
                  {editing ? (
                    <Input type="date" value={draft.start_date ?? ""} onChange={e=>setDraft({...draft, start_date: e.target.value || null})} />
                  ) : formatLongDate(deal.start_date)}
                </Field>
                <Field label="Latest update">
                  {editing ? (
                    <Input value={draft.latest_update ?? ""} onChange={e=>setDraft({...draft, latest_update: e.target.value})} />
                  ) : (
                    <InlineEditableText
                      value={deal.latest_update || ""}
                      placeholder="Click to add latest update…"
                      onSave={saveLatestUpdateInline}
                    />
                  )}
                </Field>
              </>
            ) : (
              <>
                <Field label="Client name">
                  {editing ? (
                    <Input value={draft.client_name ?? ""} onChange={e=>setDraft({...draft, client_name: e.target.value})} />
                  ) : (deal.client_name || "—")}
                </Field>
                <Field label={deal.deal_type === "advisory" || deal.deal_type === "other" ? "Fee (if applicable)" : "Target amount"}>
                  {editing ? (
                    <Input
                      type="number"
                      value={draft.target_amount == null ? "" : String(draft.target_amount)}
                      onChange={e=>setDraft({...draft, target_amount: e.target.value ? Number(e.target.value) : null})}
                    />
                  ) : (deal.target_amount != null ? formatMoney(deal.target_amount) : "TBC")}
                </Field>
                <Field label="Start date">
                  {editing ? (
                    <Input type="date" value={draft.start_date ?? ""} onChange={e=>setDraft({...draft, start_date: e.target.value || null})} />
                  ) : formatLongDate(deal.start_date)}
                </Field>
                <Field label="Target close date">
                  {editing ? (
                    <Input type="date" value={draft.target_close_date ?? ""} onChange={e=>setDraft({...draft, target_close_date: e.target.value || null})} />
                  ) : formatLongDate(deal.target_close_date)}
                </Field>
                <Field label="Commission structure">
                  {editing ? (
                    <Textarea rows={2} value={draft.commission_structure ?? ""} onChange={e=>setDraft({...draft, commission_structure: e.target.value})} />
                  ) : (
                    <div className="bg-teal-light/40 text-ink/80 rounded-md px-3 py-2 text-sm whitespace-pre-wrap min-h-[2.5rem]">
                      {deal.commission_structure || <span className="italic text-muted-foreground">Not set</span>}
                    </div>
                  )}
                </Field>
                <Field label="Next action">
                  {editing ? (
                    <Input value={draft.next_action ?? ""} onChange={e=>setDraft({...draft, next_action: e.target.value})} />
                  ) : (
                    <InlineEditableText
                      value={deal.next_action || ""}
                      placeholder="Click to set next action…"
                      onSave={saveNextActionInline}
                    />
                  )}
                </Field>
                <Field label="Next action date">
                  {editing ? (
                    <Input type="date" value={draft.next_action_date ?? ""} onChange={e=>setDraft({...draft, next_action_date: e.target.value || null})} />
                  ) : formatLongDate(deal.next_action_date)}
                </Field>
              </>
            )}
          </dl>
        </div>

        {/* Right: linked contacts */}
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg text-teal">
              {intro ? "Introduction" : "Linked contacts"}
            </h3>
            {!linking && (!intro || contacts.length < 2) && (
              <button
                onClick={()=>setLinking(true)}
                className="text-xs font-medium px-2.5 py-1 rounded bg-teal-light text-teal hover:bg-teal-light/80"
              >+ Link Contact</button>
            )}
          </div>

          {linking && (
            <div className="space-y-2 p-3 mb-3 rounded-md border bg-muted/30">
              {!picked ? (
                <div className="relative">
                  <Input
                    autoFocus placeholder="Search by name or company…"
                    value={q} onChange={e=>setQ(e.target.value)}
                  />
                  {results.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                      {results.map(c => (
                        <button key={c.id}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={()=>{ setPicked(c); setQ(""); setResults([]); }}>
                          <strong>{c.full_name}</strong>
                          {c.company && <span className="text-muted-foreground"> — {c.company}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border">
                  <span className="text-sm flex-1 truncate">
                    <strong>{picked.full_name}</strong>
                    {picked.company && <span className="text-muted-foreground"> — {picked.company}</span>}
                  </span>
                  <button className="text-xs text-muted-foreground hover:text-ink" onClick={()=>setPicked(null)}>Change</button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input value={role} onChange={e=>setRole(e.target.value)}
                  placeholder={intro ? "Role (e.g. Introducing, To)" : "e.g. Investor, Introducer, Advisor"}
                  className="flex-1" />
                <button disabled={!picked} onClick={linkContact}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-teal text-white hover:bg-teal/90 disabled:opacity-50">
                  Link
                </button>
                <button onClick={()=>{ setLinking(false); setPicked(null); setQ(""); setRole(""); }}
                  className="px-2 py-2 text-xs text-muted-foreground hover:text-ink">Cancel</button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <div className="text-sm italic text-muted-foreground">
              {intro ? "Pick the two contacts being introduced." : "No contacts linked yet."}
            </div>
          ) : intro ? (
            <div className="space-y-3">
              {contacts.slice(0, 2).map((c, i) => (
                <div key={c.id} className="border rounded-md px-3 py-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-teal">
                      {c.role_in_deal || (i === 0 ? "Introducing" : "To")}
                    </div>
                    <button className="font-bold text-base hover:text-teal text-left" onClick={()=>onOpenContact(c.id)}>
                      {c.full_name}
                    </button>
                    {c.company && <div className="text-sm text-muted-foreground">{c.company}</div>}
                  </div>
                  <button onClick={()=>removeContact(c.id)}
                    className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {contacts.map(c => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <button className="font-bold hover:text-teal text-left" onClick={()=>onOpenContact(c.id)}>
                      {c.full_name}
                    </button>
                    {c.company && <span className="text-muted-foreground"> — {c.company}</span>}
                    {c.role_in_deal && <span className="ml-2 text-xs italic text-teal">{c.role_in_deal}</span>}
                  </div>
                  <button onClick={()=>removeContact(c.id)}
                    className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ACTIVITY FEED */}
      <div>
        <h2 className="font-display text-2xl text-teal mb-3">Activity</h2>
        {feed.length === 0 ? (
          <div className="card-soft p-6 text-sm italic text-muted-foreground">
            No activity logged across linked contacts yet.
          </div>
        ) : (
          <div className="card-soft divide-y">
            {feed.map(i => {
              const open = !!expanded[i.id];
              return (
                <div key={i.id} className="px-5 py-3">
                  <button
                    onClick={()=>setExpanded(s => ({...s, [i.id]: !open}))}
                    className="w-full text-left flex items-start gap-3"
                  >
                    <span className="mt-1">
                      {open ? <ChevronDown className="h-4 w-4 text-muted-foreground"/> : <ChevronRight className="h-4 w-4 text-muted-foreground"/>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap text-xs">
                        <span className="text-muted-foreground">{formatLongDate(i.date)}</span>
                        {i.contact && (
                          <span className="text-teal">{i.contact.full_name}</span>
                        )}
                        <span className="uppercase tracking-wide text-muted-foreground">{i.type}</span>
                      </div>
                      <div className="font-semibold text-ink mt-0.5">{i.summary}</div>
                    </div>
                  </button>
                  {open && i.full_note && (
                    <p className="pl-7 mt-2 text-sm text-ink/80 whitespace-pre-wrap">{i.full_note}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3">
          <Button
            variant="ghost"
            className="text-teal"
            disabled={contacts.length === 0}
            onClick={()=>setNoteOpen(true)}
          >
            + Add Note
          </Button>
          {contacts.length === 0 && (
            <span className="ml-2 text-xs text-muted-foreground italic">Link a contact first.</span>
          )}
        </div>
      </div>

      <AddNoteModal
        open={noteOpen}
        onOpenChange={setNoteOpen}
        contactOptions={contacts.map(c => ({ id: c.id, full_name: c.full_name, company: c.company }))}
        onSaved={() => loadFeed(contacts.map(c => c.id))}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

function InlineEditableText({
  value, placeholder, onSave,
}: { value: string; placeholder: string; onSave: (v: string) => Promise<void> | void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);

  if (!editing) {
    return (
      <button
        onClick={()=>setEditing(true)}
        className={`text-left w-full hover:text-teal ${value ? "" : "italic text-muted-foreground"}`}
      >
        {value || placeholder}
      </button>
    );
  }
  return (
    <Input
      autoFocus value={v} onChange={e=>setV(e.target.value)}
      onBlur={async ()=>{ await onSave(v); setEditing(false); }}
      onKeyDown={async (e)=>{ if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setV(value); setEditing(false); } }}
    />
  );
}