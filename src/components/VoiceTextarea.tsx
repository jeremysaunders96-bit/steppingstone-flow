import { useEffect, useRef, useState, forwardRef } from "react";
import { Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Textarea> & {
  value: string;
  onValueChange: (v: string) => void;
};

function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export const VoiceTextarea = forwardRef<HTMLTextAreaElement, Props>(function VoiceTextarea(
  { value, onValueChange, className, ...rest }, ref
) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const baseRef = useRef<string>("");          // text in field when listening started
  const finalChunksRef = useRef<string>("");   // accumulated final transcript this session
  const silenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const w = typeof window !== "undefined" ? (window as any) : null;
    setSupported(!!(w && (w.SpeechRecognition || w.webkitSpeechRecognition)));
    return () => {
      if (recRef.current) { try { recRef.current.stop(); } catch {} }
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const stop = () => {
    if (recRef.current) { try { recRef.current.stop(); } catch {} }
    if (silenceTimerRef.current) { window.clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  };

  const armSilenceTimer = () => {
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => { stop(); }, 2000);
  };

  const start = () => {
    if (listening) { stop(); return; }
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    baseRef.current = value;
    finalChunksRef.current = "";
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-GB";

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
      onValueChange(baseRef.current + sep + combined);
      armSilenceTimer();
    };
    rec.onerror = () => { stop(); };
    rec.onend = () => {
      setListening(false);
      if (silenceTimerRef.current) { window.clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    };

    try {
      rec.start();
      setListening(true);
      armSilenceTimer();
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={e => onValueChange(e.target.value)}
        className={cn(supported ? "pr-10 pb-12" : undefined, className)}
        {...rest}
      />
      {supported && (
        <button
          type="button"
          onClick={start}
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          aria-pressed={listening}
          style={listening ? { color: "#d97732", backgroundColor: "rgba(217,119,50,0.12)" } : undefined}
          className={cn(
            "absolute bottom-2 right-2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full border bg-background shadow-sm transition-colors",
            listening
              ? "border-[#d97732] animate-pulse"
              : "border-border text-muted-foreground hover:text-ink hover:bg-muted"
          )}
        >
          <Mic className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});