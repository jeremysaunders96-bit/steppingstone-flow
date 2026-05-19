import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Loader2, X, Plus, RefreshCw, CalendarPlus, CheckCircle2 } from "lucide-react";
import { ContactPicker } from "@/components/ContactPicker";
import { DealPicker } from "@/components/DealPicker";
import { AddContactModal } from "@/components/modals/AddContactModal";
import { supabase, type Contact, type Deal } from "@/lib/supabase";
import { listConnectedAccounts, type GoogleAccountRow } from "@/lib/googleAccounts";
import { findClosestContact, correctName } from "@/lib/contactMatch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "record" | "review";
type MeetingType = "meeting" | "call" | "other";

interface SuggestedEvent {
  summary: string;
  description: string | null;
  location: string | null;
  suggested_start: string;
  suggested_end: string;
  all_day: boolean;
  confidence: "high" | "medium" | "low";
}

interface Extraction {
  contact_name: string | null;
  company: string | null;
  key_points: string[];
  action_items: string[];
  additional_notes: string | null;
  calendar_events?: SuggestedEvent[];
}

function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function speechSupported() {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoToDDMMYYYY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function ddmmyyyyToISO(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function CaptureMeetingModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [step, setStep] = useState<Step>("record");
  const [supported, setSupported] = useState(true);

  // Recording state
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<any>(null);
  const baseRef = useRef<string>("");
  const finalChunksRef = useRef<string>("");
  const tickRef = useRef<number | null>(null);

  // Review state
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [punctuating, setPunctuating] = useState(false);

  const [primaryContact, setPrimaryContact] = useState<Contact | null>(null);
  const [extraContacts, setExtraContacts] = useState<(Contact | null)[]>([]);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [pendingPrePopulate, setPendingPrePopulate] = useState(false);
  const [linkedDeal, setLinkedDeal] = useState<Deal | null>(null);

  const [dateStr, setDateStr] = useState(isoToDDMMYYYY(todayISO()));
  const [type, setType] = useState<MeetingType>("meeting");
  const [needsFollowup, setNeedsFollowup] = useState(true);
  const [followupBy, setFollowupBy] = useState(isoToDDMMYYYY(plusDaysISO(4)));

  const [saving, setSaving] = useState(false);

  // Calendar suggestions
  const [connectedAccounts, setConnectedAccounts] = useState<GoogleAccountRow[]>([]);
  const [targetAccount, setTargetAccount] = useState<string>("");
  const [addingEventIdx, setAddingEventIdx] = useState<number | null>(null);
  const [addedEventIds, setAddedEventIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSupported(speechSupported());
  }, []);

  useEffect(() => {
    if (!open) return;
    listConnectedAccounts()
      .then((rows) => {
        setConnectedAccounts(rows);
        if (rows.length && !targetAccount) {
          // Prefer the work account.
          const work = rows.find((r) => r.account_email.endsWith("@sstone.co.uk"));
          setTargetAccount((work ?? rows[0]).account_email);
        }
      })
      .catch(() => { /* silent — visible from Settings */ });
  }, [open, targetAccount]);

  const addEventToCalendar = async (idx: number, ev: SuggestedEvent) => {
    if (!targetAccount) {
      toast.error("Connect a Google Calendar in Settings first.");
      return;
    }
    setAddingEventIdx(idx);
    try {
      const { data, error } = await supabase.functions.invoke("gcal-create-event", {
        body: {
          account_email: targetAccount,
          summary: ev.summary,
          description: ev.description ?? undefined,
          location: ev.location ?? undefined,
          start: ev.suggested_start,
          end: ev.suggested_end,
          all_day: ev.all_day,
        },
      });
      if (error) throw error;
      const result = data as { ok: boolean; event_id?: string; html_link?: string; error?: string; detail?: string };
      if (!result.ok) throw new Error(result.detail || result.error || "Calendar create failed");
      setAddedEventIds((s) => new Set(s).add(idx));
      toast.success(`Added to ${targetAccount}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add event");
    } finally {
      setAddingEventIdx(null);
    }
  };

  // Reset everything when the modal opens fresh
  useEffect(() => {
    if (open) {
      setStep("record");
      setTranscript("");
      setSeconds(0);
      setExtraction(null);
      setExtractError(null);
      setAddedEventIds(new Set());
      setAddingEventIdx(null);
      setPrimaryContact(null);
      setExtraContacts([]);
      setLinkedDeal(null);
      setDateStr(isoToDDMMYYYY(todayISO()));
      setType("meeting");
      setNeedsFollowup(true);
      setFollowupBy(isoToDDMMYYYY(plusDaysISO(4)));
    } else {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wordCount = useMemo(
    () => transcript.trim().split(/\s+/).filter(Boolean).length,
    [transcript],
  );

  function startTick() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }
  function stopTick() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function stopListening() {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    stopTick();
    setListening(false);
  }

  function startListening() {
    if (!supported) return;
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    baseRef.current = transcript;
    finalChunksRef.current = "";
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang =
      (typeof navigator !== "undefined" && navigator.language) || "en-GB";

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0].transcript;
        if (r.isFinal) finalChunksRef.current += t;
        else interim += t;
      }
      const combined = (finalChunksRef.current + interim).trim();
      const sep = baseRef.current && !baseRef.current.endsWith(" ") ? " " : "";
      setTranscript(baseRef.current + sep + combined);
    };
    rec.onerror = () => {
      stopListening();
    };
    rec.onend = () => {
      stopTick();
      setListening(false);
    };

    try {
      rec.start();
      setListening(true);
      startTick();
    } catch {
      setListening(false);
    }
  }

  function toggleRecord() {
    if (listening) stopListening();
    else startListening();
  }

  function reRecord() {
    stopListening();
    setTranscript("");
    setSeconds(0);
  }

  async function callExtract(text: string) {
    setExtracting(true);
    setExtractError(null);
    try {
      const { data, error } = await supabase.functions.invoke("process-meeting", {
        body: { transcript: text },
      });
      if (error) {
        setExtractError(error.message || "Could not process transcript - please try regenerating");
        setExtraction(null);
      } else if (data && (data as { error?: string }).error) {
        setExtractError((data as { error: string }).error);
        setExtraction(null);
      } else if (data && (data as { extraction?: Extraction }).extraction) {
        let finalExtraction = data.extraction as Extraction;
        // Try to pre-populate primary contact by name, with fuzzy matching
        // because speech-to-text mangles unusual names ("Cian" → "siyan",
        // "Eoin" → "owen" etc.). When we match a contact, also rewrite the
        // misheard name throughout the extraction text so the saved
        // interaction notes use the correct spelling.
        const misheardName = (finalExtraction.contact_name || "").trim();
        if (misheardName && !primaryContact) {
          const match = await findClosestContact(misheardName);
          if (match) {
            setPrimaryContact(match.contact);
            const correctFullName = match.contact.full_name;
            const fix = (s: string | null | undefined) => correctName(s, misheardName, correctFullName);
            finalExtraction = {
              ...finalExtraction,
              contact_name: correctFullName,
              company: fix(finalExtraction.company) || null,
              key_points: finalExtraction.key_points.map((p) => fix(p) || p),
              action_items: finalExtraction.action_items.map((a) => fix(a) || a),
              additional_notes: fix(finalExtraction.additional_notes) || null,
              calendar_events: (finalExtraction.calendar_events ?? []).map((ev) => ({
                ...ev,
                summary: fix(ev.summary) || ev.summary,
                description: ev.description ? (fix(ev.description) || null) : null,
                location: ev.location ? (fix(ev.location) || null) : null,
              })),
            };
          }
        }
        setExtraction(finalExtraction);
      } else {
        setExtractError("Could not process transcript - please try regenerating");
      }
    } catch (e: any) {
      setExtractError(e?.message || "Could not process transcript - please try regenerating");
    } finally {
      setExtracting(false);
    }
  }

  async function goToReview() {
    stopListening();
    setStep("review");
    if (!transcript.trim()) return;
    // 1. Punctuate the raw transcript
    setPunctuating(true);
    let cleaned = transcript;
    try {
      const { data, error } = await supabase.functions.invoke("process-meeting", {
        body: { transcript, mode: "punctuate" },
      });
      if (!error) {
        const cleanedText = (data as { cleaned?: string } | null)?.cleaned;
        if (typeof cleanedText === "string" && cleanedText.trim()) {
          cleaned = cleanedText.trim();
          setTranscript(cleaned);
        }
      }
    } catch {
      // fall through with original transcript
    } finally {
      setPunctuating(false);
    }
    // 2. Extract structured info from the cleaned transcript
    await callExtract(cleaned);
  }

  function addExtraContactSlot() {
    const total = 1 + extraContacts.length;
    if (total >= 4) return;
    setExtraContacts((arr) => [...arr, null]);
  }

  function setExtraContact(i: number, c: Contact | null) {
    setExtraContacts((arr) => arr.map((x, idx) => (idx === i ? c : x)));
  }
  function removeExtraContact(i: number) {
    setExtraContacts((arr) => arr.filter((_, idx) => idx !== i));
  }

  function handleAddContactOpen() {
    setPendingPrePopulate(true);
    setAddContactOpen(true);
  }

  async function handleNewContactSaved() {
    if (!pendingPrePopulate) return;
    setPendingPrePopulate(false);
    // Pull most recently created contact and pre-select
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data[0]) {
      if (!primaryContact) setPrimaryContact(data[0] as Contact);
      else if (extraContacts.length < 3) setExtraContacts((arr) => [...arr, data[0] as Contact]);
    }
  }

  function buildFullNote(): string {
    const parts: string[] = [];
    if (extraction) {
      if (extraction.contact_name || extraction.company) {
        parts.push(
          [extraction.contact_name, extraction.company].filter(Boolean).join(" — "),
        );
      }
      if (extraction.key_points?.length) {
        parts.push("Key points:");
        extraction.key_points.forEach((p, i) => parts.push(`${i + 1}. ${p}`));
      }
      if (extraction.action_items?.length) {
        parts.push("Action items:");
        extraction.action_items.forEach((a) => parts.push(`- ${a}`));
      }
      if (extraction.additional_notes) {
        parts.push("Notes:");
        parts.push(extraction.additional_notes);
      }
    }
    parts.push("");
    parts.push("RAW TRANSCRIPT:");
    parts.push(transcript);
    return parts.join("\n");
  }

  async function save() {
    const dateISO = ddmmyyyyToISO(dateStr);
    if (!dateISO) {
      toast.error("Date must be DD/MM/YYYY");
      return;
    }
    const fbISO = needsFollowup ? ddmmyyyyToISO(followupBy) : null;
    if (needsFollowup && !fbISO) {
      toast.error("Follow-up date must be DD/MM/YYYY");
      return;
    }

    const selected = [primaryContact, ...extraContacts].filter(
      (c): c is Contact => !!c,
    );
    const summary =
      extraction?.key_points?.[0] ||
      transcript.split(/[.!?]\s/)[0]?.slice(0, 200) ||
      "Meeting";
    const fullNote = buildFullNote();

    setSaving(true);
    try {
      if (selected.length > 0) {
        const today = todayISO();
        const rows = selected.map((c) => ({
          contact_id: c.id,
          date: dateISO,
          type,
          summary,
          full_note: fullNote,
          needs_followup: needsFollowup,
          followup_by: fbISO,
        }));
        const { data: insertedRows, error } = await supabase
          .from("interactions")
          .insert(rows)
          .select("id, contact_id");
        if (error) throw error;
        // Create action_items records (one per Claude action item, per interaction)
        const aiTexts = extraction?.action_items || [];
        if (insertedRows && aiTexts.length > 0) {
          const dueISO = plusDaysISO(4);
          const aiRows = (insertedRows as { id: string; contact_id: string }[]).flatMap((row) =>
            aiTexts.map((text) => ({
              interaction_id: row.id,
              contact_id: row.contact_id,
              text,
              due_date: dueISO,
              completed: false,
            })),
          );
          await supabase.from("action_items").insert(aiRows);
        }
        await Promise.all(
          selected.map((c) =>
            supabase
              .from("contacts")
              .update({ last_contact_date: today })
              .eq("id", c.id),
          ),
        );
        // Link selected contacts to the chosen deal (if any), skipping existing links
        if (linkedDeal) {
          const { data: existing } = await supabase
            .from("deal_contacts")
            .select("contact_id")
            .eq("deal_id", linkedDeal.id)
            .in("contact_id", selected.map((c) => c.id));
          const linkedIds = new Set(((existing || []) as { contact_id: string }[]).map((r) => r.contact_id));
          const toInsert = selected
            .filter((c) => !linkedIds.has(c.id))
            .map((c) => ({ deal_id: linkedDeal.id, contact_id: c.id, role_in_deal: "Meeting participant" }));
          if (toInsert.length > 0) {
            await supabase.from("deal_contacts").insert(toInsert);
          }
        }
        toast.success(
          `Meeting captured and saved to ${selected.map((c) => c.full_name).join(", ")} record`,
        );
      } else {
        const { error } = await supabase.from("unmatched_memos").insert({
          extracted_contact_name: extraction?.contact_name || "Unknown",
          extracted_company: extraction?.company || null,
          extracted_summary:
            extraction?.key_points?.length
              ? extraction.key_points.join("\n")
              : summary,
          extracted_full_note: fullNote,
          extracted_action_items:
            extraction?.action_items?.map((t) => ({ text: t, done: false })) || [],
          extracted_date: dateISO,
          extracted_type: type === "meeting" ? "voice note" : type,
          status: "unmatched",
        });
        if (error) throw error;
        toast.success("Meeting saved to Unmatched - assign it to a contact when ready");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[100vw] w-screen h-[100dvh] sm:rounded-none p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="font-display text-2xl text-teal">Capture Meeting</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {!supported ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Voice capture is not supported on this browser. Please use Chrome or Safari.
              </div>
            ) : step === "record" ? (
              <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col items-center">
                <button
                  type="button"
                  onClick={toggleRecord}
                  aria-label={listening ? "Stop recording" : "Start recording"}
                  style={
                    listening
                      ? { backgroundColor: "#d97732" }
                      : undefined
                  }
                  className={cn(
                    "rounded-full flex items-center justify-center text-white shadow-md transition-transform",
                    listening ? "animate-pulse" : "bg-teal hover:scale-[1.02]",
                  )}
                >
                  <span className="flex items-center justify-center" style={{ width: 80, height: 80 }}>
                    <Mic className="h-8 w-8" />
                  </span>
                </button>
                <div className="mt-3 text-sm text-muted-foreground">
                  {listening ? "Recording... tap to stop" : "Tap to start recording"}
                </div>
                {listening && (
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {fmtTime(seconds)}
                  </div>
                )}

                <div className="w-full mt-6">
                  <Label className="text-xs text-muted-foreground">Live transcript</Label>
                  <Textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Your words will appear here as you speak…"
                    className="mt-1 min-h-[220px] max-h-[40vh]"
                  />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {wordCount} word{wordCount === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 w-full justify-end">
                  <Button variant="ghost" onClick={reRecord}>Re-record</Button>
                  <Button
                    className="bg-teal hover:bg-teal/90 text-white"
                    disabled={wordCount < 10}
                    onClick={goToReview}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            ) : (
              <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* LEFT — raw transcript */}
                  <div className="card-soft p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-display text-lg text-teal">What you said</div>
                      {punctuating && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Cleaning up…
                        </div>
                      )}
                    </div>
                    <Textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      className="flex-1 min-h-[260px]"
                      disabled={punctuating}
                    />
                  </div>

                  {/* RIGHT — Claude understood */}
                  <div className="card-soft p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-display text-lg text-teal">What Claude understood</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(extractError && "text-orange ring-1 ring-orange")}
                        disabled={extracting}
                        onClick={() => callExtract(transcript)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                      </Button>
                    </div>
                    {extracting ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                      </div>
                    ) : extractError ? (
                      <div className="text-sm text-destructive">{extractError}</div>
                    ) : extraction ? (
                      <div className="space-y-3 text-sm">
                        <div className="font-semibold text-ink">
                          {extraction.contact_name || "(no name extracted)"}
                          {extraction.company ? ` — ${extraction.company}` : ""}
                        </div>
                        {extraction.key_points?.length > 0 && (
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Key points</div>
                            <ol className="list-decimal pl-5 space-y-1">
                              {extraction.key_points.map((p, i) => <li key={i}>{p}</li>)}
                            </ol>
                          </div>
                        )}
                        {extraction.action_items?.length > 0 && (
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Action items</div>
                            <ul className="space-y-1">
                              {extraction.action_items.map((a, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <input type="checkbox" className="mt-1" />
                                  <span>{a}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {extraction.additional_notes && (
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</div>
                            <div className="italic">{extraction.additional_notes}</div>
                          </div>
                        )}
                        {extraction.calendar_events && extraction.calendar_events.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                Add to calendar?
                              </div>
                              {connectedAccounts.length > 1 && (
                                <Select value={targetAccount} onValueChange={setTargetAccount}>
                                  <SelectTrigger className="h-7 text-xs w-[200px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {connectedAccounts.map((a) => (
                                      <SelectItem key={a.account_email} value={a.account_email}>
                                        {a.account_email}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <div className="space-y-2">
                              {extraction.calendar_events.map((ev, idx) => {
                                const added = addedEventIds.has(idx);
                                const adding = addingEventIdx === idx;
                                const startLabel = ev.all_day
                                  ? new Date(ev.suggested_start).toLocaleDateString("en-GB", {
                                      weekday: "short", day: "numeric", month: "short",
                                    })
                                  : new Date(ev.suggested_start).toLocaleString("en-GB", {
                                      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                                    });
                                return (
                                  <div key={idx} className="flex items-start gap-2 rounded-md border p-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm truncate">{ev.summary}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {startLabel}
                                        {ev.location ? ` · ${ev.location}` : ""}
                                        {ev.confidence !== "high" ? ` · ${ev.confidence} confidence` : ""}
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={added ? "ghost" : "outline"}
                                      disabled={added || adding || connectedAccounts.length === 0}
                                      onClick={() => addEventToCalendar(idx, ev)}
                                    >
                                      {added ? (
                                        <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Added</>
                                      ) : adding ? (
                                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Adding</>
                                      ) : (
                                        <><CalendarPlus className="h-3.5 w-3.5 mr-1" /> Add</>
                                      )}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                            {connectedAccounts.length === 0 && (
                              <div className="text-xs italic text-muted-foreground mt-1">
                                Connect a Google Calendar in Settings to enable.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">Nothing yet.</div>
                    )}
                  </div>
                </div>

                {/* Assignment fields */}
                <div className="card-soft p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Link to contact (optional)</Label>
                      <button
                        type="button"
                        onClick={handleAddContactOpen}
                        className="text-xs text-teal hover:underline"
                      >
                        Create new contact
                      </button>
                    </div>
                    <div className="mt-1">
                      <ContactPicker
                        label=""
                        value={primaryContact}
                        onChange={setPrimaryContact}
                      />
                    </div>
                    {extraContacts.map((c, i) => (
                      <div key={i} className="mt-3 flex items-start gap-2">
                        <div className="flex-1">
                          <ContactPicker
                            label=""
                            value={c}
                            onChange={(v) => setExtraContact(i, v)}
                            excludeId={primaryContact?.id}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExtraContact(i)}
                          className="mt-2 p-1 text-muted-foreground hover:text-ink"
                          aria-label="Remove contact"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {1 + extraContacts.length < 4 && (
                      <button
                        type="button"
                        onClick={addExtraContactSlot}
                        className="mt-2 inline-flex items-center text-xs text-teal hover:underline"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add another person from this meeting
                      </button>
                    )}
                  </div>

                {/* Deal link */}
                <div>
                  <Label>Link to deal (optional)</Label>
                  <div className="mt-1">
                    <DealPicker label="" value={linkedDeal} onChange={setLinkedDeal} />
                  </div>
                </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Date</Label>
                      <Input
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        placeholder="DD/MM/YYYY"
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={type} onValueChange={(v) => setType(v as MeetingType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meeting">meeting</SelectItem>
                          <SelectItem value="call">call</SelectItem>
                          <SelectItem value="other">other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Needs follow-up</Label>
                      <div className="h-10 flex items-center">
                        <Switch checked={needsFollowup} onCheckedChange={setNeedsFollowup} />
                      </div>
                    </div>
                  </div>

                  {needsFollowup && (
                    <div className="max-w-xs">
                      <Label>Follow-up by</Label>
                      <Input
                        value={followupBy}
                        onChange={(e) => setFollowupBy(e.target.value)}
                        placeholder="DD/MM/YYYY"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setStep("record")}>Back</Button>
                    <Button
                      className="bg-teal hover:bg-teal/90 text-white"
                      disabled={saving}
                      onClick={save}
                    >
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddContactModal
        open={addContactOpen}
        onOpenChange={(v) => {
          setAddContactOpen(v);
          if (!v) setPendingPrePopulate(false);
        }}
        onSaved={handleNewContactSaved}
      />
    </>
  );
}