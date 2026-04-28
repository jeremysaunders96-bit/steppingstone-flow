import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase, type Contact, type Interaction, type Deal } from "@/lib/supabase";
import { formatShortDate, formatMoney, daysSince } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AddMeetingModal } from "@/components/modals/AddMeetingModal";
import { DraftEmailModal } from "@/components/modals/DraftEmailModal";
import { DealModal } from "@/components/modals/DealModal";

type AttentionRow = {
  contact: Contact;
  summary: string | null;
  reason: "followup" | "stale";
};

type TodayMeeting = {
  interaction: Interaction;
  contact: Contact | null;
  recentNote: Interaction | null;
};

export default function Home() {
  const [attention, setAttention] = useState<AttentionRow[]>([]);
  const [meetings, setMeetings] = useState<TodayMeeting[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const [meetingOpen, setMeetingOpen] = useState(false);
  const [draftFor, setDraftFor] = useState<Contact | null>(null);
  const [openDeal, setOpenDeal] = useState<Deal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date(); today.setHours(0,0,0,0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const todayStr = today.toISOString().slice(0,10);
    const in7Str = in7.toISOString().slice(0,10);

    // Followups
    const { data: followups } = await supabase
      .from("interactions")
      .select("*, contact:contacts(*)")
      .eq("needs_followup", true)
      .lte("followup_by", in7Str)
      .order("followup_by", { ascending: true });

    // Stale contacts
    const { data: stale } = await supabase
      .from("contacts").select("*")
      .in("status", ["contacted","replied"])
      .order("last_contact_date", { ascending: true });

    const map = new Map<string, AttentionRow>();
    (followups || []).forEach((row: any) => {
      if (!row.contact) return;
      map.set(row.contact.id, { contact: row.contact, summary: row.summary, reason: "followup" });
    });
    (stale || []).forEach((c: Contact) => {
      if (daysSince(c.last_contact_date) > 5 && !map.has(c.id)) {
        map.set(c.id, { contact: c, summary: null, reason: "stale" });
      }
    });

    // Pull recent summary for stale contacts that lack one
    const needSummary = Array.from(map.values()).filter(r => !r.summary).map(r => r.contact.id);
    if (needSummary.length) {
      const { data: recent } = await supabase
        .from("interactions")
        .select("contact_id, summary, date")
        .in("contact_id", needSummary)
        .order("date", { ascending: false });
      const seen = new Set<string>();
      (recent || []).forEach((i: any) => {
        if (seen.has(i.contact_id)) return;
        seen.add(i.contact_id);
        const row = map.get(i.contact_id);
        if (row && !row.summary) row.summary = i.summary;
      });
    }
    setAttention(Array.from(map.values()));

    // Today's meetings
    const { data: todays } = await supabase
      .from("interactions").select("*, contact:contacts(*)")
      .eq("type", "meeting").eq("date", todayStr)
      .order("created_at");
    const todaysList: TodayMeeting[] = (todays || []).map((i: any) => ({
      interaction: i, contact: i.contact, recentNote: null,
    }));
    if (todaysList.length) {
      const ids = todaysList.map(m => m.contact?.id).filter(Boolean) as string[];
      const { data: notes } = await supabase
        .from("interactions").select("*").in("contact_id", ids).order("date", { ascending: false });
      const seen = new Set<string>();
      (notes || []).forEach((n: any) => {
        if (seen.has(n.contact_id)) return;
        if (n.type === "meeting" && n.date === todayStr) return;
        seen.add(n.contact_id);
        const row = todaysList.find(m => m.contact?.id === n.contact_id);
        if (row) row.recentNote = n;
      });
    }
    setMeetings(todaysList);

    // Deals
    const { data: dealRows } = await supabase
      .from("deals").select("*").neq("stage","done").order("created_at",{ascending:false});
    setDeals((dealRows || []) as Deal[]);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-3xl text-teal">Good morning, Will</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>

      {/* Needs Attention */}
      <section>
        <h2 className="font-display text-2xl text-teal mb-4">Needs Attention</h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : attention.length === 0 ? (
          <div className="card-soft p-8 text-center text-muted-foreground italic">All clear.</div>
        ) : (
          <div className="card-soft divide-y">
            {attention.map(({ contact, summary }) => (
              <div key={contact.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link to={`/contacts/${contact.id}`} className="font-semibold text-ink hover:text-teal">{contact.full_name}</Link>
                    {contact.company && <span className="text-sm text-muted-foreground">{contact.company}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Last contact: {formatShortDate(contact.last_contact_date)}
                  </div>
                  {summary && <div className="text-sm text-ink/80 mt-1 truncate">{summary}</div>}
                </div>
                <Button
                  className="bg-teal-light text-teal hover:bg-teal-light/80"
                  onClick={() => setDraftFor(contact)}
                >Draft Email</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Today */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-teal">Today</h2>
          <Button variant="ghost" className="text-teal" onClick={() => setMeetingOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add today's meeting
          </Button>
        </div>
        {meetings.length === 0 ? (
          <div className="card-soft p-6 text-sm text-muted-foreground italic">No meetings logged for today.</div>
        ) : (
          <div className="card-soft divide-y">
            {meetings.map(({ interaction, contact, recentNote }) => (
              <div key={interaction.id} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="font-semibold text-ink">{contact?.full_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{contact?.company || ""}</div>
                    <div className="text-sm text-ink/80 mt-1">{interaction.summary}</div>
                    {recentNote && (
                      <div className="text-xs italic text-muted-foreground mt-1.5">{recentNote.summary}</div>
                    )}
                  </div>
                  {contact && (
                    <Link to={`/contacts/${contact.id}`} className="text-sm text-teal hover:underline whitespace-nowrap">
                      View contact
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Deals */}
      <section>
        <h2 className="font-display text-2xl text-teal mb-4">Active Deals</h2>
        {deals.length === 0 ? (
          <div className="card-soft p-6 text-sm text-muted-foreground italic">No active deals.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {deals.map(d => (
              <button
                key={d.id}
                onClick={() => setOpenDeal(d)}
                className="card-soft p-5 text-left hover:shadow-lg transition-shadow flex flex-col h-full min-h-[180px]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display text-lg text-teal leading-tight">{d.name}</h3>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-light text-teal whitespace-nowrap">
                    {d.stage}
                  </span>
                </div>
                <p className="text-sm text-ink/75 line-clamp-2 min-h-[2.5rem]">
                  {d.description || ""}
                </p>
                <div className="font-display text-xl text-ink mt-auto pt-3">
                  {d.target_amount != null ? formatMoney(d.target_amount) : "\u00A0"}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <AddMeetingModal open={meetingOpen} onOpenChange={setMeetingOpen} onSaved={load} />
      <DraftEmailModal open={!!draftFor} onOpenChange={(v)=>!v && setDraftFor(null)} contactName={draftFor?.full_name} contact={draftFor} />
      <DealModal deal={openDeal} onOpenChange={(v)=>!v && setOpenDeal(null)} />
    </div>
  );
}