import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface QuickAsset {
  id: string;
  label: string;
  content: string;
  category: string;
  created_at: string;
}

const CATEGORIES = ["bio", "signature", "template", "other"];
const CATEGORY_LABELS: Record<string, string> = {
  bio: "Bio",
  signature: "Signature",
  template: "Templates",
  other: "Other",
};
const GROUP_ORDER = ["bio", "signature", "template", "other"];

export default function QuickAssets() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<QuickAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("other");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quick_assets")
      .select("*")
      .order("label", { ascending: true });
    if (error) {
      toast({ title: "Could not load assets", description: error.message, variant: "destructive" });
    } else {
      setAssets((data ?? []) as QuickAsset[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map: Record<string, QuickAsset[]> = {};
    for (const a of assets) {
      const key = GROUP_ORDER.includes(a.category) ? a.category : "other";
      (map[key] ??= []).push(a);
    }
    return GROUP_ORDER.filter((k) => map[k]?.length).map((k) => ({ key: k, items: map[k] }));
  }, [assets]);

  const copy = async (text: string, lbl: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: `Copied ${lbl} to clipboard` }); }
    catch { toast({ title: "Could not copy", variant: "destructive" }); }
  };

  const openNew = () => {
    setEditingId(null); setLabel(""); setContent(""); setCategory("other"); setOpen(true);
  };
  const openEdit = (a: QuickAsset) => {
    setEditingId(a.id); setLabel(a.label); setContent(a.content);
    setCategory(GROUP_ORDER.includes(a.category) ? a.category : "other");
    setOpen(true);
  };

  const save = async () => {
    if (!label.trim() || !content.trim()) {
      toast({ title: "Label and content are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { label: label.trim(), content: content.trim(), category };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = supabase.from("quick_assets");
    const { error } = editingId
      ? await q.update(payload).eq("id", editingId)
      : await q.insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Asset updated" : "Asset added" });
    setOpen(false);
    load();
  };

  const remove = async (a: QuickAsset) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("quick_assets") as any).delete().eq("id", a.id);
    if (error) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Deleted ${a.label}` });
    load();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-teal">Quick Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">Bio, signature, intro templates — one-click copy</p>
        </div>
        <Button className="bg-teal hover:bg-teal/90 text-white" onClick={openNew}>
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
        <div className="space-y-8">
          {grouped.map((g) => (
            <div key={g.key}>
              <h2 className="font-display text-lg text-teal mb-2">{CATEGORY_LABELS[g.key]}</h2>
              <div className="space-y-3">
                {g.items.map((a) => {
                  const preview = a.content.length > 150 ? a.content.slice(0, 150) + "…" : a.content;
                  return (
                    <div key={a.id} className="rounded-md border p-4 bg-background">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-teal">{a.label}</div>
                          <pre className="text-sm mt-2 whitespace-pre-wrap font-sans text-foreground/80">{preview}</pre>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => copy(a.content, a.label)}>
                            <Copy className="h-4 w-4 mr-1" /> Copy
                          </Button>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(a)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-teal">{editingId ? "Edit asset" : "Add new asset"}</DialogTitle>
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
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
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
