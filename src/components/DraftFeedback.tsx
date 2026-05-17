import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { saveDraftFeedback } from "@/lib/draftEmail";

interface Props {
  mode: "single" | "intro";
  contactId?: string | null;
  originalDraft: string;
  brief?: string | null;
}

// Sent / edited outcomes are captured implicitly when Will hits Send to Drafts or Copy
// in ComposeEmailModal. This component is just the "this draft was rubbish" escape hatch
// for the case where the model produced something Will doesn't want to use at all —
// the one signal we cannot infer from a commit action.
export function DraftFeedback({ mode, contactId, originalDraft, brief }: Props) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const markRubbish = async () => {
    setBusy(true);
    try {
      await saveDraftFeedback({
        contactId: contactId ?? null,
        mode,
        outcome: "rejected",
        originalDraft,
        finalVersion: null,
        editNotes: note.trim() || null,
        brief: brief ?? null,
      });
      setSaved(true);
      setShowNote(false);
      toast({ title: "Marked rubbish — the model will see this" });
    } catch (e) {
      toast({
        title: "Could not save feedback",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <p className="text-xs text-muted-foreground italic">Marked as rubbish. Thanks.</p>
    );
  }

  if (!showNote) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => setShowNote(true)}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-orange disabled:opacity-50"
      >
        This one was rubbish
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 items-center pt-1">
      <Input
        placeholder="Why? (optional, e.g. 'wrong tone', 'made stuff up')"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="text-sm h-8 flex-1 min-w-[200px]"
        autoFocus
      />
      <button
        type="button"
        disabled={busy}
        onClick={markRubbish}
        className="text-xs text-orange underline-offset-2 hover:underline disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => { setShowNote(false); setNote(""); }}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
