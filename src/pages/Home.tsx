import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase, type Contact, type Interaction, type Deal } from "@/lib/supabase";
import { formatShortDate, formatMoney, daysSince } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AddMeetingModal } from "@/components/modals/AddMeetingModal";
import { DraftEmailModal } from "@/components/modals/DraftEmailModal";
import { DealModal } from "@/components/modals/DealModal";

type OwesReplyRow = { interaction: Interaction; contact: Contact };
type WorthCallRow = { contact: Contact };
type DealPulseRow = {
  deal: Deal;
  last_activity_date: string | null;
  days_since_activity: number | null;
};
type UpcomingRow = { interaction: Interaction; contact: Contact };

type TodayMeeting = {
  interaction: Interaction;
  contact: Contact | null;
  recentNote: Interaction | null;
};

export default function Home() {
  const [owesReply, setOwesReply] = useState<OwesReplyRow[]>([]);
  const [worthCall, setWorthCall] = useState<WorthCallRow[]>([]);
  const [dealPulse, setDealPulse] = useState<DealPulseRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  const [meetings, setMeetings] = useState<TodayMeeting[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const [meetingOpen, setMeetingOpen] = useState(false);
  const [draftFor, setDraftFor] = useState<Contact | null>(null);
  const [openDeal, setOpenDeal] = useState<Deal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().slice(0,10);

    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0,10);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().slice(0,10);
    const fourteenAgo = new Date(today); fourteenAgo.setDate(fourteenAgo.getDate() - 14);
    const fourteenAgoStr = fourteenAgo.toISOString().slice(0,10);

    // 1. Owes a Reply — overdue followups
    const { data: owes } = await supabase
      .from("interactions")
      .select("*, contact:contacts(*)")
      .eq("needs_followup", true)
      .lte("followup_by", todayStr)
      .order("followup_by", { ascending: true })
      .limit(5);
    const owesRows: OwesReplyRow[] = (owes || [])
      .filter((r: any) => r.contact)
      .map((r: any) => ({ interaction: r as Interaction, contact: r.contact as Contact }));
    const owesContactIds = new Set(owesRows.map(r => r.contact.id));
    setOwesReply(owesRows);

    // 2. Worth a Call This Week — stale contacts not already in Owes a Reply
    const { data: stale } = await supabase
      .from("contacts").select("*")
      .in("status", ["contacted","replied","meeting booked"])
      .lt("last_contact_date", fourteenAgoStr)
      .order("last_contact_date", { ascending: true });
    const worthRows: WorthCallRow[] = (stale || [])
      .filter((c: Contact) => !owesContactIds.has(c.id))
      .slice(0, 3)
      .map((c: Contact) => ({ contact: c }));
    setWorthCall(worthRows);

    // 3. Deal Pulse — from deal_last_activity view
    const { data: pulse } = await supabase
      .from("deal_last_activity")
      .select("*");
    const pulseRows: DealPulseRow[] = (pulse || [])
      .filter((r: any) => r.stage !== "done")
      .filter((r: any) => r.last_activity_date == null || (r.days_since_activity ?? 0) > 7)
      .map((r: any) => ({
        deal: {
          id: r.id ?? r.deal_id,
          name: r.name ?? r.deal_name,
          stage: r.stage,
          description: r.description ?? null,
          target_amount: r.target_amount ?? null,
          created_at: r.created_at ?? "",
        } as Deal,
        last_activity_date: r.last_activity_date,
        days_since_activity: r.days_since_activity,
      }));
    setDealPulse(pulseRows);

    // 4. Follow-ups Coming Up — between tomorrow and +7 days
    const { data: upcomingData } = await supabase
      .from("interactions")
      .select("*, contact:contacts(*)")
      .eq("needs_followup", true)
      .gte("followup_by", tomorrowStr)
      .lte("followup_by", in7Str)
      .order("followup_by", { ascending: true })
      .limit(5);
    const upcomingRows: UpcomingRow[] = (upcomingData || [])
      .filter((r: any) => r.contact)
      .map((r: any) => ({ interaction: r as Interaction, contact: r.contact as Contact }));
    setUpcoming(upcomingRows);

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

  const allClear = !loading && owesReply.length === 0 && worthCall.length === 0
    && dealPulse.length === 0 && upcoming.length === 0;

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
        ) : allClear ? (
          <div className="card-soft p-8 text-center text-muted-foreground italic">All clear.</div>
        ) : (
          <div className="space-y-6">
            {/* Owes a Reply */}
            {owesReply.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/70 mb-2">Owes a Reply</h3>
                <div className="card-soft divide-y">
                  {owesReply.map(({ interaction, contact }) => (
                    <div key={interaction.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <Link to={`/contacts/${contact.id}`} className="font-semibold text-ink hover:text-teal">{contact.full_name}</Link>
                          {contact.company && <span className="text-sm text-muted-foreground">{contact.company}</span>}
                        </div>
                        <div className="text-xs text-orange mt-0.5">
                          Follow-up due {formatShortDate(interaction.followup_by)}
                        </div>
                        {interaction.summary && (
                          <div className="text-sm italic text-ink/80 mt-1 truncate">{interaction.summary}</div>
                        )}
                      </div>
                      <Button
                        className="bg-teal hover:bg-teal/90 text-white"
                        onClick={() => setDraftFor(contact)}
                      >Draft Email</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deal Pulse */}
            {dealPulse.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/70 mb-2">Deal Pulse</h3>
                <div className="card-soft divide-y">
                  {dealPulse.map(({ deal, last_activity_date, days_since_activity }) => (
                    <div key={deal.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-teal">{deal.name}</span>
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-light text-teal">
                            {deal.stage}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {last_activity_date == null
                            ? "No activity logged"
                            : `Last activity: ${days_since_activity} days ago`}
                        </div>
                      </div>
                      <button
                        onClick={() => setOpenDeal(deal)}
                        className="text-sm text-teal hover:underline whitespace-nowrap"
                      >View deal</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-ups Coming Up */}
            {upcoming.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/70 mb-2">Follow-ups Coming Up</h3>
                <div className="card-soft divide-y">
                  {upcoming.map(({ interaction, contact }) => (
                    <div key={interaction.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <Link to={`/contacts/${contact.id}`} className="font-semibold text-ink hover:text-teal">{contact.full_name}</Link>
                          {contact.company && <span className="text-sm text-muted-foreground">{contact.company}</span>}
                        </div>
                        <div className="text-xs text-teal mt-0.5">
                          Follow-up due {formatShortDate(interaction.followup_by)}
                        </div>
                        {interaction.summary && (
                          <div className="text-sm italic text-ink/80 mt-1 truncate">{interaction.summary}</div>
                        )}
                      </div>
                      <Link
                        to={`/contacts/${contact.id}`}
                        className="text-sm text-teal hover:underline whitespace-nowrap"
                      >View contact</Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Worth a Call This Week */}
            {worthCall.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/70 mb-2">Worth a Call This Week</h3>
                <div className="card-soft divide-y">
                  {worthCall.map(({ contact }) => (
                    <div key={contact.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <Link to={`/contacts/${contact.id}`} className="font-semibold text-ink hover:text-teal">{contact.full_name}</Link>
                          {contact.company && <span className="text-sm text-muted-foreground">{contact.company}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Last contact: {formatShortDate(contact.last_contact_date)} · {daysSince(contact.last_contact_date)} days ago
                        </div>
                      </div>
                      <Button
                        className="bg-teal-light text-teal hover:bg-teal-light/80"
                        onClick={() => setDraftFor(contact)}
                      >Draft Email</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          <div className="card-soft p-6 text-sm text-muted-foreground italic">
            No active deals yet — add one to see it here.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 auto-rows-fr">
            {deals.map(d => (
              <button
                key={d.id}
                onClick={() => setOpenDeal(d)}
                className="card-soft p-5 text-left hover:shadow-lg transition-shadow flex flex-col h-full min-h-[180px]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display text-lg text-teal leading-tight">{d.name}</h3>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-light text-teal whitespace-nowrap">
                    Active
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