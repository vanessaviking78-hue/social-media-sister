import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus, Trash2, Pencil, ToggleLeft, ToggleRight, MessageSquareText, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePresets, type ClientPreset } from "@/lib/use-presets";

interface DmAutomation {
  id: number;
  presetId: number;
  keyword: string;
  replyTemplate: string;
  isActive: boolean;
  matchExact: boolean;
  caseSensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DmInteraction {
  id: number;
  automationId: number | null;
  senderId: string;
  messageText: string;
  matchedKeyword: string | null;
  replySent: boolean;
  replyText: string | null;
  errorMessage: string | null;
  receivedAt: string;
}

const BASE = import.meta.env.BASE_URL ?? "/";
const apiUrl = (path: string) => `${BASE}api/${path}`.replace(/\/+/g, "/").replace(":/", "://");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(apiUrl(path), { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

const EMPTY_FORM = { keyword: "", replyTemplate: "", isActive: true, matchExact: false, caseSensitive: false };

export default function DmAutomations() {
  const { presets, loading: presetsLoading } = usePresets();
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [automations, setAutomations] = useState<DmAutomation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [interactions, setInteractions] = useState<Record<number, DmInteraction[]>>({});

  const selectedPreset = presets.find((p) => p.id === selectedPresetId) ?? null;

  const fetchAutomations = useCallback(async (presetId: number) => {
    setLoading(true);
    try {
      const data = await apiFetch(`dm-automations?presetId=${presetId}`);
      setAutomations(data ?? []);
    } catch {
      toast.error("Could not load keyword rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPresetId) fetchAutomations(selectedPresetId);
    else setAutomations([]);
  }, [selectedPresetId, fetchAutomations]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(a: DmAutomation) {
    setEditingId(a.id);
    setForm({ keyword: a.keyword, replyTemplate: a.replyTemplate, isActive: a.isActive, matchExact: a.matchExact, caseSensitive: a.caseSensitive });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!selectedPresetId) return;
    if (!form.keyword.trim()) { toast.error("Keyword is required"); return; }
    if (!form.replyTemplate.trim()) { toast.error("Reply message is required"); return; }
    setSaving(true);
    try {
      if (editingId !== null) {
        const updated = await apiFetch(`dm-automations/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
        setAutomations((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
        toast.success("Rule updated");
      } else {
        const created = await apiFetch("dm-automations", { method: "POST", body: JSON.stringify({ ...form, presetId: selectedPresetId }) });
        setAutomations((prev) => [created, ...prev]);
        toast.success("Rule added");
      }
      cancelForm();
    } catch {
      toast.error("Could not save rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(a: DmAutomation) {
    try {
      const updated = await apiFetch(`dm-automations/${a.id}`, { method: "PUT", body: JSON.stringify({ isActive: !a.isActive }) });
      setAutomations((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } catch {
      toast.error("Could not update rule");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this keyword rule?")) return;
    try {
      await apiFetch(`dm-automations/${id}`, { method: "DELETE" });
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      toast.success("Rule deleted");
    } catch {
      toast.error("Could not delete rule");
    }
  }

  async function toggleLog(a: DmAutomation) {
    if (expandedLog === a.id) { setExpandedLog(null); return; }
    setExpandedLog(a.id);
    if (!interactions[a.id]) {
      try {
        const data = await apiFetch(`dm-automations/${a.id}/interactions`);
        setInteractions((prev) => ({ ...prev, [a.id]: data ?? [] }));
      } catch {
        toast.error("Could not load interaction log");
      }
    }
  }

  const hasIg = selectedPreset?.metaInstagramAccountId && selectedPreset?.metaPageAccessToken;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <MessageSquareText className="h-5 w-5 text-cyan-400" />
        <div>
          <h1 className="font-semibold text-base leading-none">DM Keyword Responder</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Auto-reply to Instagram DMs that match a keyword</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1.5">
          <Label>Client</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedPresetId ?? ""}
            onChange={(e) => setSelectedPresetId(e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={presetsLoading}
          >
            <option value="">Select a client preset...</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {selectedPreset && !hasIg && (
          <div className="flex gap-2 items-start rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>This client has no Instagram account connected. Go to <Link href="/presets" className="underline">Presets</Link> to connect a Meta account first.</span>
          </div>
        )}

        {selectedPreset && (
          <div className="flex gap-2 items-start rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400" />
            <div>
              <p className="font-medium text-foreground mb-0.5">Webhook setup required</p>
              <p>In your Meta app dashboard, subscribe your Instagram account to the <strong>messages</strong> webhook field and set the callback URL to:</p>
              <code className="block mt-1 text-xs bg-black/30 rounded px-2 py-1 break-all">{window.location.origin}/api/webhooks/instagram</code>
              <p className="mt-1">Verify token: <code className="text-xs bg-black/30 rounded px-1 py-0.5">sms-cybersuite-webhook</code></p>
            </div>
          </div>
        )}

        {selectedPreset && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Keyword rules</h2>
              {!showForm && (
                <Button size="sm" onClick={openCreate} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add rule
                </Button>
              )}
            </div>

            {showForm && (
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
                <h3 className="font-medium text-sm">{editingId !== null ? "Edit rule" : "New rule"}</h3>
                <div className="space-y-1.5">
                  <Label>Keyword or phrase</Label>
                  <Input
                    placeholder="e.g. pricing, how much, link in bio"
                    value={form.keyword}
                    onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Auto-reply message</Label>
                  <Textarea
                    rows={4}
                    placeholder="The reply text that gets sent when the keyword is matched..."
                    value={form.replyTemplate}
                    onChange={(e) => setForm((f) => ({ ...f, replyTemplate: e.target.value }))}
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.matchExact} onChange={(e) => setForm((f) => ({ ...f, matchExact: e.target.checked }))} className="rounded" />
                    Exact match only
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.caseSensitive} onChange={(e) => setForm((f) => ({ ...f, caseSensitive: e.target.checked }))} className="rounded" />
                    Case sensitive
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                    Active
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelForm}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save rule"}</Button>
                </div>
              </div>
            )}

            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

            {!loading && automations.length === 0 && !showForm && (
              <div className="rounded-lg border border-dashed border-border/50 px-6 py-10 text-center text-sm text-muted-foreground">
                No keyword rules yet. Add one to get started.
              </div>
            )}

            <div className="space-y-2">
              {automations.map((a) => (
                <div key={a.id} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => handleToggle(a)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                      {a.isActive
                        ? <ToggleRight className="h-5 w-5 text-cyan-400" />
                        : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium truncate">{a.keyword}</span>
                        {a.matchExact && <span className="text-xs rounded-full bg-muted px-1.5 py-0.5">exact</span>}
                        {a.caseSensitive && <span className="text-xs rounded-full bg-muted px-1.5 py-0.5">case</span>}
                        {!a.isActive && <span className="text-xs rounded-full bg-muted/50 px-1.5 py-0.5 text-muted-foreground">paused</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{a.replyTemplate}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleLog(a)}>
                        {expandedLog === a.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {expandedLog === a.id && (
                    <div className="border-t border-border/30 px-4 py-3 bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Recent matches</p>
                      {!interactions[a.id] ? (
                        <p className="text-xs text-muted-foreground">Loading...</p>
                      ) : interactions[a.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground">No interactions yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {interactions[a.id].slice(0, 10).map((i) => (
                            <div key={i.id} className="text-xs rounded bg-background/60 px-3 py-2 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground font-mono truncate">{i.senderId}</span>
                                <span className={i.replySent ? "text-emerald-400" : "text-red-400"}>{i.replySent ? "replied" : "failed"}</span>
                              </div>
                              <p className="truncate text-foreground/70">{i.messageText}</p>
                              {i.errorMessage && <p className="text-red-400 truncate">{i.errorMessage}</p>}
                              <p className="text-muted-foreground/60">{new Date(i.receivedAt).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
