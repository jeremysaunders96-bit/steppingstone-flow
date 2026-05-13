import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface QuickAsset {
  id: string;
  label: string;
  content: string;
  category: string;
  created_at: string;
}

const CATEGORIES = ["bio", "signature", "intro", "other"];

export default function QuickAssets() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<QuickAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("other");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quick_assets")
      .select("*")
      .order("category", { ascending: true })
      .order("label", { ascending: true });
    if (error) {
      toast({ title: "Could not load assets", description: error.message, variant: "destructive" });
    } else {
      setAssets((data ?? []) as QuickAsset[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: "Copied to clipboard" }); }
    catch { toast({ title: "Could not copy", variant: "destructive" }); }
  };

  const save = async () => {
    if (!label.trim() || !content.trim()) {
      toast({ title: "Label and content are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("quick_assets") as any).insert({
      label: label.trim(), content: content.trim(), category,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Asset added" });
    setLabel(""); setContent(""); setCategory("other"); setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("quick_assets") as any).delete().eq("id", id);
    if (error) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Asset removed" });
    load();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-teal">Quick Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable snippets — bio, signature, intro paragraphs.</p>
        </div>
        <Button className="bg-teal hover:bg-teal/90 text-white" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add new asset
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No assets yet.</div>
      ) : (
        <div className="space-y-3">
          {assets.map((a) => (
            <div key={a.id} className="rounded-md border p-4 bg-background">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">{a.category}</span>
                  </div>
                  <pre className="text-sm mt-2 whitespace-pre-wrap font-sans text-foreground/90">{a.content}</pre>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => copy(a.content)}>
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-teal">Add new asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Short bio" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-teal hover:bg-teal/90 text-white" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}