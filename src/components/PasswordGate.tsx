import { useState, type ReactNode, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Change this and tell Will via WhatsApp. Trivially visible to anyone reading
// the bundle, but blocks every casual visitor to the published URL — which is
// the threat model we actually care about for a single-user private tool.
const DASHBOARD_PASSWORD = "steppingstone-2026";
const STORAGE_KEY = "sf_dashboard_authed_v1";

function isAuthed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(isAuthed);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (authed) return <>{children}</>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input === DASHBOARD_PASSWORD) {
      try { localStorage.setItem(STORAGE_KEY, "true"); } catch { /* noop */ }
      setAuthed(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal p-4">
      <form
        onSubmit={submit}
        className="bg-background rounded-lg shadow-xl p-8 w-full max-w-sm space-y-5"
      >
        <div className="text-center">
          <h1 className="font-display text-3xl text-teal">Steppingstone</h1>
          <p className="text-sm text-muted-foreground mt-1">Dashboard access</p>
        </div>
        <div>
          <Label htmlFor="dashboard-password">Password</Label>
          <Input
            id="dashboard-password"
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            autoFocus
            placeholder="Enter password"
            autoComplete="current-password"
          />
          {error && <p className="text-xs text-orange mt-1">Wrong password. Try again.</p>}
        </div>
        <Button type="submit" className="w-full bg-teal hover:bg-teal/90 text-white">
          Enter
        </Button>
      </form>
    </div>
  );
}
