import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Mic, Handshake, Phone, Mail, FileText, MessageSquare, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase, type Interaction, type Contact, type InteractionType } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AddNoteModal } from "@/components/modals/AddNoteModal";
import { cn } from "@/lib/utils";

type Row = Interaction & { contact: Contact | null };

type FilterKey = "all" | "voice note" | "meeting" | "call" | "email";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "voice note", label: "Voice Notes" },
  { key: "meeting", label: "Meetings" },
  { key: "call", label: "Calls" },
  { key: "email", label: "Emails" },
];

function typeIcon(type: InteractionType) {
  switch (type) {
    case "voice note": return Mic;
    case "meeting": return Handshake;
    case "call": return Phone;
    case "email": return Mail;
    case "introduction made": return MessageSquare;
    default: return FileText;
  }
}

function fmtRowDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return format(d, "EEE d MMM");
}

export default function Meetings() {
  const today = new Date();
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const [from, setFrom] = useState<Date>(thirtyAgo);
  const [to, setTo] = useState<Date>(today);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [openRow, setOpenRow] = useState<Row | null>(null);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [contactOptions, setContactOptions] = useState<Contact[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const fromStr = from.toISOString().slice(0,10);
    const toStr = to.toISOString().slice(0,10);
    const { data } = await supabase
      .from("interactions")
      .select("*, contact:contacts(*)")
      .gte("date", fromStr)
      .lte("date", toStr)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    setRows((data || []) as Row[]);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // Contact options for the edit modal's contact picker
  useEffect(() => {
    if (!editingRow) return;
    (async () => {
      const { data } = await supabase
        .from("contacts").select("*").order("full_name").limit(1000);
      setContactOptions((data || []) as Contact[]);
    })();
  }, [editingRow]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter(r => r.type === filter);
  }, [rows, filter]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-teal">Meetings</h1>
        <p className="text-sm text-muted-foreground mt-1">Full activity feed across your network.</p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filter === f.key
                  ? "bg-teal text-white border-teal"
                  : "bg-background text-ink border-border hover:bg-muted"
              )}
            >{f.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <DateBtn label="From" value={from} onChange={setFrom} />
          <span className="text-muted-foreground">→</span>
          <DateBtn label="To" value={to} onChange={setTo} />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground italic py-12 text-center">No interactions in this range.</div>
      ) : (
        <div className="divide-y border-y">
          {filtered.map(r => {
            const Icon = typeIcon(r.type);
            return (
              <div
                key={r.id}
                className="grid grid-cols-[auto_1fr_auto] gap-4 items-start py-3 px-1 cursor-pointer hover:bg-muted/40"
                onClick={() => setOpenRow(r)}
              >
                <div className="flex items-center gap-2 text-xs text-teal min-w-[110px] pt-0.5">
                  <Icon className="h-4 w-4" />
                  <span>{fmtRowDate(r.date)}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold text-ink">{r.contact?.full_name || "Unknown"}</span>
                    {r.contact?.company && <span className="text-muted-foreground ml-2">{r.contact.company}</span>}
                  </div>
                  {r.summary && (
                    <div className="text-xs italic text-muted-foreground truncate mt-0.5">{r.summary}</div>
                  )}
                </div>
                <button
                  className="text-xs text-teal hover:underline"
                  onClick={(e) => { e.stopPropagation(); setEditingRow(r); }}
                >Edit</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!openRow} onOpenChange={(v) => !v && setOpenRow(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {openRow && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-teal text-2xl">
                  {openRow.summary}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-teal-light text-teal uppercase tracking-wide">{openRow.type}</span>
                  <span className="text-muted-foreground">{fmtRowDate(openRow.date)}</span>
                  {openRow.needs_followup && (
                    <span className="px-2 py-0.5 rounded-full bg-orange/15 text-orange">
                      Follow-up by {openRow.followup_by || "—"}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Contact: </span>
                  {openRow.contact ? (
                    <Link
                      to={`/contacts/${openRow.contact.id}`}
                      className="font-semibold text-teal hover:underline"
                      onClick={() => setOpenRow(null)}
                    >{openRow.contact.full_name}</Link>
                  ) : "Unknown"}
                  {openRow.contact?.company && <span className="text-muted-foreground"> — {openRow.contact.company}</span>}
                </div>
                {openRow.full_note && (
                  <div className="whitespace-pre-wrap text-ink/90 leading-relaxed pt-2 border-t">{openRow.full_note}</div>
                )}
                {openRow.action_items && openRow.action_items.length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink/70 mb-2">Action items</div>
                    <ul className="space-y-1.5">
                      {openRow.action_items.map((a, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <input type="checkbox" checked={!!a.done} readOnly className="rounded" />
                          <span className={a.done ? "line-through text-muted-foreground" : ""}>{a.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="pt-3 flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setOpenRow(null)}>Close</Button>
                  <Button
                    className="bg-teal hover:bg-teal/90 text-white"
                    onClick={() => { setEditingRow(openRow); setOpenRow(null); }}
                  >Edit</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <AddNoteModal
        open={!!editingRow}
        onOpenChange={(v) => !v && setEditingRow(null)}
        contactOptions={contactOptions.map(c => ({ id: c.id, full_name: c.full_name, company: c.company }))}
        editing={editingRow ? {
          id: editingRow.id,
          contact_id: editingRow.contact_id,
          date: editingRow.date,
          type: editingRow.type,
          summary: editingRow.summary,
          full_note: editingRow.full_note,
          action_items: editingRow.action_items,
          needs_followup: editingRow.needs_followup,
          followup_by: editingRow.followup_by,
        } : null}
        onSaved={() => { setEditingRow(null); load(); }}
      />
    </div>
  );
}

function DateBtn({ label, value, onChange }:{ label: string; value: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-normal">
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="text-xs text-muted-foreground">{label}:</span>
          {format(value, "d MMM yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
