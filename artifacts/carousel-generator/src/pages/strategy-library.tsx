import React, { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, BookOpen, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { authHeaders } from "@/lib/use-approval";

const BASE = import.meta.env.BASE_URL || "/";

interface Topic {
  id: number;
  topic: string;
  userId: string;
  createdAt: string;
}

function api(path: string) {
  return `${BASE}api/${path}`;
}

export default function StrategyLibrary() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const fetchTopics = async () => {
    try {
      const r = await fetch(api("strategy-topics"), { headers: authHeaders() });
      const data = await r.json();
      setTopics(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Could not load topics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTopics(); }, []);

  useEffect(() => {
    if (editingId !== null) editRef.current?.focus();
  }, [editingId]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const r = await fetch(api("strategy-topics/seed"), { method: "POST", headers: authHeaders() });
      const data = await r.json();
      if (data.seeded) {
        setTopics(data.topics);
        toast.success("20 starters added");
      } else {
        toast("Library already has topics — starters not added");
      }
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;
    setAdding(true);
    try {
      const r = await fetch(api("strategy-topics"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ topic: newTopic.trim() }),
      });
      if (!r.ok) throw new Error();
      const row: Topic = await r.json();
      setTopics((prev) => [...prev, row]);
      setNewTopic("");
      toast.success("Topic added");
    } catch {
      toast.error("Failed to add topic");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (t: Topic) => {
    setEditingId(t.id);
    setEditValue(t.topic);
  };

  const cancelEdit = () => { setEditingId(null); setEditValue(""); };

  const saveEdit = async (id: number) => {
    if (!editValue.trim()) return;
    try {
      const r = await fetch(api(`strategy-topics/${id}`), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ topic: editValue.trim() }),
      });
      if (!r.ok) throw new Error();
      const updated: Topic = await r.json();
      setTopics((prev) => prev.map((t) => t.id === id ? updated : t));
      setEditingId(null);
      setEditValue("");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(api(`strategy-topics/${id}`), { method: "DELETE", headers: authHeaders() });
      setTopics((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        <div className="flex items-center justify-between">
          <Link href="/hub">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub
            </Button>
          </Link>
          {topics.length === 0 && !loading && (
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Load starters
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="font-sans text-3xl font-semibold tracking-tight">Strategy Library</h1>
              <p className="text-sm text-muted-foreground">{topics.length} topic{topics.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            Content angles for the Trial Bundle generator. Four are picked at random per bundle.
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Add a new topic…"
            className="flex-1 h-11"
          />
          <Button type="submit" disabled={adding || !newTopic.trim()} className="h-11 px-5">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : topics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 py-16 flex flex-col items-center gap-4 text-muted-foreground">
            <BookOpen className="w-10 h-10 opacity-20" />
            <div className="text-center">
              <p className="font-medium">No topics yet</p>
              <p className="text-sm">Add one above or load the starter topics.</p>
            </div>
            <Button variant="outline" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
              Load 20 starters
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/30 bg-card/40 divide-y divide-border/20 overflow-hidden">
            {topics.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-accent/20 transition-colors">
                <span className="text-xs text-muted-foreground/40 font-mono w-5 flex-shrink-0 text-right">{i + 1}</span>

                {editingId === t.id ? (
                  <>
                    <Input
                      ref={editRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(t.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1 h-8 text-sm"
                    />
                    <button onClick={() => saveEdit(t.id)} className="text-green-400 hover:text-green-300 transition-colors p-1">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{t.topic}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(t)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent/40">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
