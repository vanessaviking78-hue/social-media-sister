import React, { useState, useRef } from "react";
import { Link } from "wouter";
import {
  Layers, Plus, Trash2, Copy, Check, ExternalLink, Loader2,
  ImagePlus, CalendarDays, BarChart3, PenTool, BookOpen,
  MessageSquareText, Eye, CheckCircle2, XCircle, Clock, ShieldCheck, Film, Play,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApprovalBatches, useApprovalBatchDetail, type ApprovalBatch } from "@/lib/use-approval";
import { usePresets } from "@/lib/use-presets";

export default function Approval() {
  const { batches, isLoading, createBatch, deleteBatch } = useApprovalBatches();
  const { presets } = usePresets();
  const [showCreate, setShowCreate] = useState(false);
  const [viewBatchId, setViewBatchId] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [batchName, setBatchName] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [expiryDays, setExpiryDays] = useState<number | null>(90);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (files: FileList) => {
    setUploading(true);
    const toastId = toast.loading("Uploading images...");
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const resp = await fetch(`${import.meta.env.BASE_URL}api/content/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [{ name: file.name, base64 }] }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({ error: resp.status === 413 ? "Images too large — try smaller files" : `Upload failed (${resp.status})` }));
          throw new Error(data.error || "Upload failed");
        }
        const data = await resp.json();
        if (data.results?.[0]?.url) newUrls.push(data.results[0].url);
      }
      setUploadedUrls((prev) => [...prev, ...newUrls]);
      toast.success(`${newUrls.length} image(s) uploaded`, { id: toastId });
    } catch (e: any) {
      toast.error("Upload failed: " + (e?.message || "Unknown error"), { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!batchName.trim()) { toast.error("Please enter a batch name"); return; }
    if (!selectedClient.trim()) { toast.error("Please select a client for this batch"); return; }
    if (uploadedUrls.length === 0) { toast.error("Please upload at least one image"); return; }
    try {
      await createBatch.mutateAsync({
        name: batchName,
        clientName: selectedClient,
        presetId: selectedPresetId || undefined,
        imageUrls: uploadedUrls,
        expiryDays: expiryDays || undefined,
      });
      toast.success("Approval batch created!");
      setShowCreate(false);
      setBatchName("");
      setSelectedClient("");
      setSelectedPresetId(null);
      setUploadedUrls([]);
      setExpiryDays(90 as number | null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create batch");
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}approve/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this approval batch and all its images?")) return;
    try {
      await deleteBatch.mutateAsync(id);
      toast.success("Batch deleted");
      if (viewBatchId === id) setViewBatchId(null);
    } catch {
      toast.error("Failed to delete batch");
    }
  };

  const isExpired = (batch: ApprovalBatch) => batch.expiresAt && new Date() > new Date(batch.expiresAt);

  const statusBadge = (batch: ApprovalBatch) => {
    if (isExpired(batch)) return <Badge className="bg-zinc-600 text-white">Expired</Badge>;
    if (batch.status === "reviewed") return <Badge className="bg-green-600 text-white">All Reviewed</Badge>;
    if (batch.approved > 0 || batch.rejected > 0) return <Badge className="bg-yellow-600 text-white">In Progress</Badge>;
    return <Badge variant="secondary">Awaiting Review</Badge>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-pink-500" />
            <span className="font-bold text-3xl">
              <span className="text-white">The</span>{" "}
              <span className="text-pink-400">CyberSuite™</span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/hub"><Button variant="ghost" size="sm" className="text-muted-foreground"><Layers className="w-4 h-4 mr-2" />Carousel</Button></Link>
            <Link href="/single-image"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-2" />Single Image</Button></Link>
            <Link href="/stories"><Button variant="ghost" size="sm" className="text-muted-foreground"><BookOpen className="w-4 h-4 mr-2" />Stories</Button></Link>
            <Link href="/reels"><Button variant="ghost" size="sm" className="text-muted-foreground"><Film className="w-4 h-4 mr-2" />Reels</Button></Link>
            <Link href="/video-overlay"><Button variant="ghost" size="sm" className="text-muted-foreground"><Play className="w-4 h-4 mr-2" />Video Overlay</Button></Link>
            <Link href="/presets"><Button variant="ghost" size="sm" className="text-muted-foreground"><PenTool className="w-4 h-4 mr-2" />Presets</Button></Link>
            <Link href="/captions"><Button variant="ghost" size="sm" className="text-muted-foreground"><MessageSquareText className="w-4 h-4 mr-2" />Captions</Button></Link>
            <Link href="/library"><Button variant="ghost" size="sm" className="text-muted-foreground"><BookOpen className="w-4 h-4 mr-2" />Library</Button></Link>
            <Link href="/calendar"><Button variant="ghost" size="sm" className="text-muted-foreground"><CalendarDays className="w-4 h-4 mr-2" />Calendar</Button></Link>
            <Link href="/analytics"><Button variant="ghost" size="sm" className="text-muted-foreground"><BarChart3 className="w-4 h-4 mr-2" />Analytics</Button></Link>
            <Button variant="ghost" size="sm" className="text-pink-400 font-semibold"><ShieldCheck className="w-4 h-4 mr-2" />Approvals</Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-8 pb-32">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Image Approval System</h1>
            <p className="text-muted-foreground text-sm">Send images to clients for approval before using them in content</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-pink-600 hover:bg-pink-700">
            <Plus className="w-4 h-4 mr-2" />
            New Batch
          </Button>
        </div>

        {showCreate && (
          <div className="bg-card border border-border rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Create Approval Batch</h2>
            <div className="space-y-4">
              <div>
                <Label>Batch Name</Label>
                <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="e.g. March Content - Lip Fillers" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client</Label>
                  <Select value={selectedClient || "none"} onValueChange={(v) => {
                    if (v === "none") { setSelectedClient(""); setSelectedPresetId(null); return; }
                    setSelectedClient(v);
                    const preset = presets.find((p) => p.name === v);
                    if (preset) setSelectedPresetId(preset.id);
                  }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No client</SelectItem>
                      {presets.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Link Expiry</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" value={expiryDays ?? ""} onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) || 90 : null)} min={1} max={365} placeholder="No expiry" className="flex-1" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{expiryDays ? `${expiryDays} day${expiryDays !== 1 ? "s" : ""}` : "Never expires"}</span>
                  </div>
                </div>
              </div>
              <div>
                <Label>Images</Label>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
                <div className="mt-1 border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-pink-500/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Uploading...</div>
                  ) : (
                    <div className="text-muted-foreground text-sm">Click to upload images ({uploadedUrls.length} uploaded)</div>
                  )}
                </div>
                {uploadedUrls.length > 0 && (
                  <div className="grid grid-cols-6 gap-2 mt-3">
                    {uploadedUrls.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-border">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5" onClick={() => setUploadedUrls((prev) => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleCreate} disabled={createBatch.isPending} className="bg-pink-600 hover:bg-pink-700">
                  {createBatch.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Batch
                </Button>
                <Button variant="outline" onClick={() => { setShowCreate(false); setUploadedUrls([]); }}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {viewBatchId && <BatchDetail id={viewBatchId} onClose={() => setViewBatchId(null)} />}

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
        ) : batches.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No approval batches yet</p>
            <p className="text-sm">Create a batch to send images to your clients for review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => (
              <div key={batch.id} className={`bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-4 ${isExpired(batch) ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold truncate">{batch.name}</h3>
                    {statusBadge(batch)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {batch.clientName && <span>{batch.clientName}</span>}
                    <span>{batch.imageCount} image{batch.imageCount !== 1 ? "s" : ""}</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />{batch.approved}</span>
                    <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />{batch.rejected}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-500" />{batch.pending}</span>
                    {batch.expiresAt && (
                      <span className="text-xs">{new Date(batch.expiresAt) < new Date() ? "Expired" : `Expires ${new Date(batch.expiresAt).toLocaleDateString()}`}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewBatchId(batch.id)}>
                    <Eye className="w-3 h-3 mr-1" />Details
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyLink(batch.token)}>
                    {copiedToken === batch.token ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedToken === batch.token ? "Copied" : "Copy Link"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(batch.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BatchDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useApprovalBatchDetail(id);

  if (isLoading) return (
    <div className="bg-card border border-border rounded-xl p-6 mb-8 flex items-center justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
    </div>
  );

  if (!data) return null;

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === "rejected") return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{data.name}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {data.images.map((img) => (
          <div key={img.id} className="border border-border rounded-lg overflow-hidden">
            <div className="aspect-[4/5] relative">
              <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2">{statusIcon(img.status)}</div>
            </div>
            <div className="p-2 text-xs">
              <div className="flex items-center gap-1 mb-1 capitalize font-medium">
                {statusIcon(img.status)}
                {img.status}
              </div>
              {img.clientNote && <p className="text-muted-foreground italic">"{img.clientNote}"</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
