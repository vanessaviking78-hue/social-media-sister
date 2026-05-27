import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Search,
  Plus,
  Trash2,
  Star,
  Edit3,
  X,
  Check,
  BookOpen,
  Filter,
  Layers,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCaptions, type SavedCaption } from "@/lib/use-captions";

const CATEGORIES = [
  "General",
  "Dermal Filler",
  "Skin",
  "Promotional",
  "Educational",
  "Before & After",
  "Testimonial",
  "Seasonal",
  "Facial Aesthetics",
  "Wellness",
  "Dental",
  "Body Contouring",
  "Hair Restoration",
];

export default function CaptionLibrary() {
  const { captions, loading, fetchCaptions, saveCaption, updateCaption, deleteCaption } = useCaptions();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newClient, setNewClient] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editClient, setEditClient] = useState("");

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [allClientNames, setAllClientNames] = useState<string[]>([]);

  useEffect(() => {
    if (!searchQuery && !filterCategory && !filterClient) {
      const names = Array.from(new Set(captions.map((c) => c.clientName).filter(Boolean)));
      if (names.length > 0 || allClientNames.length === 0) setAllClientNames(names);
    }
  }, [captions, searchQuery, filterCategory, filterClient]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchCaptions(searchQuery || undefined, filterCategory || undefined, filterClient || undefined);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, filterCategory, filterClient, fetchCaptions]);

  const handleAdd = async () => {
    if (!newText.trim()) { toast.error("Caption text is required"); return; }
    try {
      await saveCaption(newText, newCategory, newClient);
      toast.success("Caption saved to library");
      setNewText("");
      setNewCategory("General");
      setNewClient("");
      setShowAddForm(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast.error(msg);
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateCaption(id, { text: editText, category: editCategory, clientName: editClient });
      toast.success("Caption updated");
      setEditingId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast.error(msg);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCaption(id);
      toast.success("Caption deleted");
      setDeleteConfirmId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast.error(msg);
    }
  };

  const handleToggleFavourite = async (caption: SavedCaption) => {
    try {
      await updateCaption(caption.id, { favourite: !caption.favourite });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast.error(msg);
    }
  };

  const startEdit = (caption: SavedCaption) => {
    setEditingId(caption.id);
    setEditText(caption.text);
    setEditCategory(caption.category);
    setEditClient(caption.clientName);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center gap-4 px-6">
          <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <Link href="/hub" className="flex items-center gap-2">
            <img src="/sms-logo.png" alt="Social Media Sister" className="h-12 w-12 rounded-full object-cover" />
          </Link>
          <span className="text-xs font-semibold text-muted-foreground bg-accent/50 px-2 py-1 rounded-full">Caption Library</span>
          <div className="flex-1" />
          <nav className="flex items-center gap-6">
            <Link href="/hub" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Carousel
            </Link>
            <Link href="/single-image" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Single Image
            </Link>
            <Link href="/stories" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Stories
            </Link>
            <Link href="/presets" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Presets
            </Link>
            <Link href="/library" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Library
            </Link>
            <Link href="/calendar" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Calendar
            </Link>
            <Link href="/analytics" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Analytics
            </Link>
            <Link href="/approval" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Approvals
            </Link>
          </nav>
        </div>
      </header>

      <main className="container px-6 py-10 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-4xl font-semibold mb-2">Caption Library</h1>
          <p className="text-lg text-muted-foreground">
            Save, organise, and reuse your best captions. Browse by category, client, or keyword.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search captions..."
              className="pl-10 h-11"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[160px] h-11">
                <Filter className="w-4 h-4 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allClientNames.length > 0 && (
              <Select value={filterClient || "all"} onValueChange={(v) => setFilterClient(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px] h-11">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {allClientNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="h-11 px-5">
            <Plus className="w-4 h-4 mr-2" />
            Add Caption
          </Button>
        </div>

        {showAddForm && (
          <div className="rounded-xl border border-border/40 bg-accent/10 p-6 mb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <h3 className="font-semibold text-lg">Add New Caption</h3>
            <div className="space-y-3">
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Write your caption here..."
                className="w-full min-h-[120px] rounded-lg border border-border/40 bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground mb-1 block">Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground mb-1 block">Client (optional)</Label>
                  <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Client name" className="h-10" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button onClick={handleAdd}>Save Caption</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading captions...</div>
        ) : captions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-accent/5 p-12 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">No captions yet</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery || filterCategory || filterClient
                ? "No captions match your search. Try different filters."
                : "Add captions manually or save them from Step 4 of any post creation mode."}
            </p>
            {!searchQuery && !filterCategory && !filterClient && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Your First Caption
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {captions.length} caption{captions.length !== 1 ? "s" : ""}
            </p>
            {captions.map((caption) => (
              <div key={caption.id} className="rounded-xl border border-border/30 bg-accent/10 overflow-hidden group hover:border-border/50 transition-colors">
                {editingId === caption.id ? (
                  <div className="p-5 space-y-4">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full min-h-[100px] rounded-lg border border-border/40 bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                    />
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label className="text-sm text-muted-foreground mb-1 block">Category</Label>
                        <Select value={editCategory} onValueChange={setEditCategory}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-sm text-muted-foreground mb-1 block">Client</Label>
                        <Input value={editClient} onChange={(e) => setEditClient(e.target.value)} placeholder="Client name" className="h-10" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleUpdate(caption.id)}>
                        <Check className="w-4 h-4 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-3 bg-accent/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          {caption.category}
                        </span>
                        {caption.clientName && (
                          <span className="text-xs text-muted-foreground bg-accent/40 px-2 py-1 rounded-full">
                            {caption.clientName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleFavourite(caption)}
                          className="p-1.5 rounded-lg hover:bg-accent/40 transition-colors"
                          title={caption.favourite ? "Remove from favourites" : "Add to favourites"}
                        >
                          <Star className={`w-4 h-4 ${caption.favourite ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                        </button>
                        <button onClick={() => startEdit(caption)} className="p-1.5 rounded-lg hover:bg-accent/40 transition-colors" title="Edit">
                          <Edit3 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {deleteConfirmId === caption.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(caption.id)} className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors" title="Confirm delete">
                              <Check className="w-4 h-4 text-red-400" />
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)} className="p-1.5 rounded-lg hover:bg-accent/40 transition-colors" title="Cancel">
                              <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(caption.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">{caption.text}</p>
                      <p className="text-xs text-muted-foreground/50 mt-3">
                        {new Date(caption.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
