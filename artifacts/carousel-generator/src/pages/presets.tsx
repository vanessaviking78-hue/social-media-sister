import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Trash2, Pencil, Save, X, Layers, ArrowLeft, MessageSquareText, CalendarDays, BarChart3, ShieldCheck, Plus, CheckCircle2, AlertCircle, Loader2, Globe, Copy, RefreshCw, Facebook, Instagram, Unlink, ChevronDown, ChevronUp, Clock, BookOpen, Zap, UserCheck, Link2, Brain, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePresets, type ClientPreset, type PresetStyleFields, type TextAlign } from "@/lib/use-presets";
import { FONT_OPTIONS } from "@/lib/slide-utils";
import VoiceStyleSelector from "@/components/voice-style-selector";

const BASE = import.meta.env.BASE_URL || "/";

function PortalButton({ preset }: { preset: import("@/lib/use-presets").ClientPreset }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(preset.clientPortalToken ?? null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalUrl = token
    ? `${window.location.origin}${BASE.replace(/\/$/, "")}/portal/${token}`
    : null;

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${BASE}api/presets/${preset.id}/generate-portal-token`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setToken(d.token);
      setOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate portal link");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => token ? setOpen((o) => !o) : generate()}
        disabled={generating}
        title="Client portal"
        className="text-blue-400 hover:text-blue-300 h-8 px-2"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
      </Button>
      {open && token && (
        <div className="absolute right-0 top-10 z-50 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400" />Client Portal</p>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-400">Share this link with <span className="text-white font-medium">{preset.name}</span> — they'll see upcoming content and approval requests.</p>
          <div className="flex gap-1.5">
            <input
              readOnly
              value={portalUrl ?? ""}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 font-mono overflow-hidden"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={copy}
              title="Copy link"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-2.5 py-1.5 transition"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" />Regenerate link (invalidates old one)
          </button>
        </div>
      )}
    </div>
  );
}

function TestMetaConnection({ presetId }: { presetId: number }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await fetch(`${BASE}api/meta/test-connection?presetId=${presetId}`);
      const data = await r.json();
      if (r.ok) setResult({ ok: true, name: data.name });
      else setResult({ ok: false, error: data.error });
    } catch {
      setResult({ ok: false, error: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={test}
        disabled={testing}
        className="text-xs px-3 py-1.5 rounded-lg bg-purple-700/40 hover:bg-purple-700/60 text-purple-200 border border-purple-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
      >
        {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {testing ? "Testing…" : "Test Connection"}
      </button>
      {result && (
        result.ok ? (
          <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> Connected as {result.name}</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="w-3.5 h-3.5" /> {result.error}</span>
        )
      )}
    </div>
  );
}

interface MetaConnectSectionProps {
  editingId: number | null;
  editData: Partial<ClientPreset>;
  setEditData: React.Dispatch<React.SetStateAction<Partial<ClientPreset>>>;
  onConnected: () => void;
}

function MetaConnectSection({ editingId, editData, setEditData, onConnected }: MetaConnectSectionProps) {
  const [showManual, setShowManual] = useState(true);
  const isConnected = !!(editData.metaFacebookPageId || editData.metaPageAccessToken);

  const openOAuth = () => {
    if (!editingId) return;
    const popup = window.open(
      `${BASE}api/meta/auth/start?presetId=${editingId}`,
      "meta-oauth",
      "width=520,height=680,scrollbars=yes,resizable=yes"
    );

    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "meta-oauth-result") return;
      window.removeEventListener("message", handler);
      popup?.close();
      if (e.data.success) {
        void (async () => {
          void onConnected();
          try {
            const r = await fetch(`${BASE}api/presets/${editingId}`);
            const d = (await r.json()) as { preset?: Partial<ClientPreset> };
            if (r.ok && d.preset) setEditData((prev) => ({ ...prev, ...d.preset }));
          } catch { /* ignore */ }
        })();
        toast.success(`Connected: ${e.data.pageName || "Facebook Page"}${e.data.hasInstagram ? " + Instagram" : ""}`);
      } else {
        toast.error(`Connection failed: ${e.data.error || "Unknown error"}`);
      }
    };

    window.addEventListener("message", handler);

    const poll = setInterval(() => {
      if (popup?.closed) {
        clearInterval(poll);
        window.removeEventListener("message", handler);
      }
    }, 500);
  };

  const disconnect = () => {
    setEditData((d) => ({
      ...d,
      metaPageAccessToken: null,
      metaFacebookPageId: null,
      metaFacebookPageName: null,
      metaInstagramAccountId: null,
      metaInstagramUsername: null,
    }));
  };

  return (
    <div className="border border-purple-500/20 rounded-xl p-5 bg-purple-950/10 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-purple-300">Direct Instagram &amp; Facebook Posting</Label>
        {isConnected ? (
          <span className="text-xs bg-green-900/40 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="text-xs bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
            Not connected
          </span>
        )}
      </div>

      {isConnected && (
        <div className="bg-gray-800/60 rounded-lg px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Facebook className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-medium text-white">{editData.metaFacebookPageName || editData.metaFacebookPageId}</span>
          </div>
          {editData.metaInstagramAccountId ? (
            <div className="flex items-center gap-2 text-xs text-purple-300">
              <Instagram className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              {editData.metaInstagramUsername
                ? <span>@{editData.metaInstagramUsername}</span>
                : <span className="font-mono text-gray-500">{editData.metaInstagramAccountId}</span>
              }
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-amber-400/80">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>No Instagram Business account connected to this page</span>
            </div>
          )}
        </div>
      )}

      {/* Auto connect */}
      {editingId && (
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={openOAuth}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm h-9"
          >
            <Facebook className="w-4 h-4 mr-2" />
            {isConnected ? "Reconnect via Facebook" : "Auto-connect via Facebook"}
          </Button>
          {isConnected && (
            <Button type="button" size="sm" variant="ghost" onClick={disconnect}
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 h-9">
              <Unlink className="w-3.5 h-3.5 mr-1" />Disconnect
            </Button>
          )}
        </div>
      )}
      {!editingId && (
        <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2">
          Save this preset first, then reopen it to connect.
        </p>
      )}

    </div>
  );
}

interface OnboardingLinkSectionProps {
  editingId: number;
  token: string | null;
  connectedAt: string | null;
  onGenerated: (token: string) => void;
}

function OnboardingLinkSection({ editingId, token, connectedAt, onGenerated }: OnboardingLinkSectionProps) {
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const onboardingUrl = token
    ? `${window.location.origin}${BASE.replace(/\/$/, "")}/onboard/${token}`
    : null;

  const connectedDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${BASE}api/presets/${editingId}/generate-onboarding-token`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      onGenerated(d.token);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!onboardingUrl) return;
    await navigator.clipboard.writeText(onboardingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-pink-500/20 rounded-xl p-5 bg-pink-950/10 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-pink-300 flex items-center gap-2">
          <UserCheck className="w-4 h-4" />Client Self-Serve Onboarding
        </Label>
        {connectedDate ? (
          <span className="text-xs bg-green-900/40 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Connected {connectedDate}
          </span>
        ) : (
          <span className="text-xs bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
            Not connected yet
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Send this link to your client. They complete the Facebook login themselves and their page is connected automatically.
      </p>

      {onboardingUrl ? (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              readOnly
              value={onboardingUrl}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 font-mono overflow-hidden"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={copy}
              title="Copy link"
              className="bg-pink-600 hover:bg-pink-500 text-white rounded-lg px-2.5 py-1.5 transition"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Regenerate link (invalidates old one)
          </button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={generate}
          disabled={generating}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium text-sm h-9"
        >
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
          {generating ? "Generating…" : "Generate Onboarding Link"}
        </Button>
      )}
    </div>
  );
}

const DEFAULT_STYLES: PresetStyleFields = {
  pageColor: "#000000",
  overlayColor: "rgba(0,0,0,0.5)",
  fontFamily: "Inter, sans-serif",
  subheadingFont: "'Poppins', sans-serif",
  fontSize: 52,
  textColor: "#ffffff",
  lineSpacing: 0.9,
  cornerStyle: "none",
  cornerColor: "#d4af37",
  textPosition: "bottom",
  textAlign: "left",
  textBoxOutline: false,
  textBoxOutlineColor: "#ffffff",
  logoPosition: "top-right",
  logoSize: 140,
  accentColor: "#d4af37",
  contentFontSize: 44,
};

export default function PresetsPage() {
  const { presets, loading, savePreset, updatePreset, deletePreset, fetchPresets, uploadLogo } = usePresets();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<ClientPreset>>({});
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddVoiceStyle, setQuickAddVoiceStyle] = useState("northern-grit");
  const [quickAddTargetAudience, setQuickAddTargetAudience] = useState("");
  const [quickAddContentPillars, setQuickAddContentPillars] = useState("");
  const [quickAddBrandNotes, setQuickAddBrandNotes] = useState("");
  const [ccWorkspaces, setCcWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [ccWorkspacesLoading, setCcWorkspacesLoading] = useState(false);
  const [ccWorkspacesError, setCcWorkspacesError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientPreset | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId === null) return;
    setCcWorkspacesLoading(true);
    setCcWorkspacesError(null);
    fetch(`${BASE}api/cloud-campaign/workspaces`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load workspaces");
        setCcWorkspaces(data.workspaces || []);
      })
      .catch((err: Error) => {
        setCcWorkspacesError(err.message || "Could not load Cloud Campaign workspaces");
        setCcWorkspaces([]);
      })
      .finally(() => setCcWorkspacesLoading(false));
  }, [editingId]);

  const handleDelete = (id: number) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setDeleteTarget(preset);
    setDeleteConfirmText("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== "DELETE") return;
    setDeleteDeleting(true);
    try {
      await deletePreset(deleteTarget.id);
      if (editingId === deleteTarget.id) {
        setEditingId(null);
        setEditData({});
        setEditNameError(null);
      }
      toast.success(`"${deleteTarget.name}" has been removed`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    } finally {
      setDeleteDeleting(false);
    }
  };

  const startEdit = (preset: ClientPreset) => {
    setEditingId(preset.id);
    setEditData({ ...preset });
    setEditNameError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
    setEditNameError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editData.name?.trim()) return;
    setEditNameError(null);
    try {
      const styles: PresetStyleFields = {
        pageColor: editData.pageColor || "#000000",
        overlayColor: editData.overlayColor || "rgba(0,0,0,0.5)",
        fontFamily: editData.fontFamily || "Inter, sans-serif",
        subheadingFont: editData.subheadingFont || editData.fontFamily || "Inter, sans-serif",
        fontSize: editData.fontSize || 52,
        textColor: editData.textColor || "#ffffff",
        lineSpacing: parseFloat(editData.lineSpacing || "0.9"),
        cornerStyle: editData.cornerStyle || "none",
        cornerColor: editData.cornerColor || "#d4af37",
        textPosition: editData.textPosition || "bottom",
        textAlign: editData.textAlign || "left",
        textBoxOutline: editData.textBoxOutline ?? false,
        textBoxOutlineColor: editData.textBoxOutlineColor || "#ffffff",
        logoPosition: editData.logoPosition || "top-right",
        logoSize: editData.logoSize || 140,
        accentColor: editData.accentColor || "#d4af37",
        contentFontSize: editData.contentFontSize ?? 44,
      };
      await updatePreset(editingId, editData.name!.trim(), styles, editData.ccWorkspaceId || undefined, editData.logoUrl, editData.captionFootnote, {
        metaPageAccessToken: editData.metaPageAccessToken || null,
        metaFacebookPageId: editData.metaFacebookPageId || null,
        metaFacebookPageName: editData.metaFacebookPageName || null,
        metaInstagramAccountId: editData.metaInstagramAccountId || null,
        metaInstagramUsername: editData.metaInstagramUsername || null,
      }, {
        defaultPostTime: editData.defaultPostTime || "18:00",
        defaultFirstCommentCarousel: editData.defaultFirstCommentCarousel || null,
        defaultFirstCommentSingle: editData.defaultFirstCommentSingle || null,
        defaultFirstCommentReel: editData.defaultFirstCommentReel || null,
        voiceStyle: editData.voiceStyle || "northern-grit",
        targetAudience: editData.targetAudience || null,
        contentPillars: editData.contentPillars || null,
        brandNotes: editData.brandNotes || null,
      });
      toast.success("Preset updated");
      cancelEdit();
    } catch (err: any) {
      const msg: string = err?.message || "Failed to update";
      if (msg.toLowerCase().includes("already exists")) {
        setEditNameError(msg);
      } else {
        toast.error(msg);
      }
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddName.trim()) return;
    setQuickAddSaving(true);
    setQuickAddError(null);
    try {
      await savePreset(quickAddName.trim(), DEFAULT_STYLES, undefined, undefined, undefined, {
        voiceStyle: quickAddVoiceStyle,
        targetAudience: quickAddTargetAudience.trim() || null,
        contentPillars: quickAddContentPillars.trim() || null,
        brandNotes: quickAddBrandNotes.trim() || null,
      });
      toast.success(`"${quickAddName.trim()}" added`);
      setQuickAddName("");
      setQuickAddVoiceStyle("northern-grit");
      setQuickAddTargetAudience("");
      setQuickAddContentPillars("");
      setQuickAddBrandNotes("");
      setShowQuickAdd(false);
    } catch (err: any) {
      const message = err?.message || "Failed to add client";
      setQuickAddError(message);
    } finally {
      setQuickAddSaving(false);
    }
  };

  const getFontLabel = (value: string) => FONT_OPTIONS.find((f) => f.value === value)?.label || value;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border/20">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hub" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 text-white/60" />
              <img src="/sms-logo.png" alt="Social Media Sister" className="h-8 w-auto object-contain" />
            </Link>
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">Client Presets</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/hub" className="text-muted-foreground hover:text-white transition">Carousel</Link>
            <Link href="/single-image" className="text-muted-foreground hover:text-white transition">Single Image</Link>
            <Link href="/stories" className="text-muted-foreground hover:text-white transition">Stories</Link>
            <Link href="/reels" className="text-muted-foreground hover:text-white transition">Reels</Link>
            <Link href="/video-overlay" className="text-muted-foreground hover:text-white transition">Video Overlay</Link>
            <Link href="/captions" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><MessageSquareText className="w-4 h-4" />Captions</Link>
            <Link href="/library" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><BookOpen className="w-4 h-4" />Library</Link>
            <Link href="/calendar" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><CalendarDays className="w-4 h-4" />Calendar</Link>
            <Link href="/analytics" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><BarChart3 className="w-4 h-4" />Analytics</Link>
            <Link href="/approval" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><ShieldCheck className="w-4 h-4" />Approvals</Link>
            <Link href="/scheduler" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><Clock className="w-4 h-4" />Scheduler</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold mb-2 tracking-tight">Client Brand Presets</h1>
            <p className="text-xl" style={{ color: "rgba(255,255,255,0.9)" }}>Manage saved brand settings for all your clients. Use presets in any post creation mode to quickly apply a client's look.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => { window.open(`${BASE}api/meta/auth/bulk-start`, "_blank", "noopener"); }}
              className="border-purple-500/40 text-purple-300 hover:bg-purple-900/30 hover:text-purple-200 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Bulk Connect All Clients
            </Button>
            <Button
              onClick={() => { setShowQuickAdd(true); setQuickAddName(""); setQuickAddVoiceStyle("northern-grit"); setQuickAddTargetAudience(""); setQuickAddContentPillars(""); setQuickAddBrandNotes(""); setQuickAddError(null); }}
              className="bg-pink-600 hover:bg-pink-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add New Client
            </Button>
          </div>
        </div>

        {showQuickAdd && (
          <div className="mb-6 rounded-2xl border border-pink-500/30 bg-pink-950/20 p-5 space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-xs text-gray-400 mb-1 block">Client name</Label>
                <Input
                  autoFocus
                  placeholder="e.g. Glow Studio"
                  value={quickAddName}
                  onChange={(e) => { setQuickAddName(e.target.value); setQuickAddError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(); if (e.key === "Escape") { setShowQuickAdd(false); setQuickAddError(null); } }}
                  className={`bg-gray-900 border-gray-700 text-white ${quickAddError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {quickAddError && (
                  <p className="text-xs text-red-400 mt-1.5">{quickAddError}</p>
                )}
              </div>
              <Button
                onClick={handleQuickAdd}
                disabled={!quickAddName.trim() || quickAddSaving}
                className="bg-pink-600 hover:bg-pink-700"
              >
                <Save className="w-4 h-4 mr-1" /> {quickAddSaving ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => { setShowQuickAdd(false); setQuickAddError(null); }} className="text-gray-400">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="border-t border-pink-500/20 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-xs font-medium text-pink-300">Brand personality (optional — you can fill this in later)</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">Voice style</Label>
                  <VoiceStyleSelector value={quickAddVoiceStyle} onChange={setQuickAddVoiceStyle} />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">Target audience</Label>
                  <Input
                    placeholder="e.g. Women 30-55 interested in aesthetics"
                    value={quickAddTargetAudience}
                    onChange={(e) => setQuickAddTargetAudience(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">Content pillars</Label>
                  <Input
                    placeholder="e.g. Education, Results, Behind the scenes"
                    value={quickAddContentPillars}
                    onChange={(e) => setQuickAddContentPillars(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">Brand notes</Label>
                  <textarea
                    placeholder="e.g. Warm and approachable, avoid clinical jargon"
                    value={quickAddBrandNotes}
                    onChange={(e) => setQuickAddBrandNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading presets...</div>
        ) : presets.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/30 rounded-2xl">
            <Layers className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-lg text-muted-foreground mb-2">No presets yet</p>
            <p className="text-sm text-gray-500 mb-6">Create your first preset in Step 2 of any post creation mode</p>
            <Link href="/hub">
              <Button className="bg-pink-600 hover:bg-pink-700">Go to Carousel Mode</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="rounded-2xl border border-border/30 bg-card/50 p-6 transition hover:border-border/50"
              >
                {editingId === preset.id ? (
                  <div className="space-y-4">
                    {/* Brand Personality */}
                    <div className="border border-pink-500/20 rounded-xl p-5 bg-pink-950/10 space-y-4">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-pink-400" />
                        <Label className="text-sm font-semibold text-pink-300">Brand Personality</Label>
                        <span className="text-xs text-gray-500">Woven into every AI generation for this client</span>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Caption voice style</Label>
                        <div className="mt-1">
                          <VoiceStyleSelector
                            value={editData.voiceStyle || "northern-grit"}
                            onChange={(v) => setEditData((d) => ({ ...d, voiceStyle: v }))}
                            size="sm"
                            showLabel={false}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Applied automatically when generating captions for this client.</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Target audience</Label>
                        <Input
                          placeholder="e.g. Women 30-55, interested in non-surgical aesthetics, disposable income"
                          value={editData.targetAudience || ""}
                          onChange={(e) => setEditData((d) => ({ ...d, targetAudience: e.target.value || null }))}
                          className="bg-gray-900 border-gray-700 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Content pillars</Label>
                        <Input
                          placeholder="e.g. Education, Behind the scenes, Results, Promotions, Confidence"
                          value={editData.contentPillars || ""}
                          onChange={(e) => setEditData((d) => ({ ...d, contentPillars: e.target.value || null }))}
                          className="bg-gray-900 border-gray-700 text-white mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">The recurring themes and topics this client focuses on.</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Brand notes</Label>
                        <textarea
                          placeholder="e.g. Warm and approachable tone, avoid clinical jargon, emphasise natural results and consultations over procedures"
                          value={editData.brandNotes || ""}
                          onChange={(e) => setEditData((d) => ({ ...d, brandNotes: e.target.value || null }))}
                          rows={3}
                          className="w-full mt-1 bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Anything the AI should know about this client's tone, personality, or specific requirements.</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Client Logo</Label>
                      <p className="text-xs text-gray-500 mt-0.5 mb-2">PNG or JPG with a transparent or white background works best. The logo auto-loads in the carousel builder when this preset is selected.</p>
                      {editData.logoUrl ? (
                        <div className="flex items-center gap-4 p-3 bg-gray-900/60 border border-gray-700 rounded-xl">
                          <div className="w-16 h-16 rounded-lg bg-white/5 border border-gray-700 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                            <img src={editData.logoUrl} alt="Client logo" className="max-w-full max-h-full object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-300 truncate">{editData.logoUrl.split("/").pop()}</p>
                            <div className="flex gap-3 mt-1.5">
                              <button
                                onClick={() => logoInputRef.current?.click()}
                                disabled={logoUploading}
                                className="text-xs text-pink-400 hover:text-pink-300 transition-colors disabled:opacity-50"
                              >
                                {logoUploading ? "Uploading…" : "Replace"}
                              </button>
                              <button
                                onClick={() => setEditData((d) => ({ ...d, logoUrl: null }))}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={logoUploading}
                          className="w-full flex items-center gap-3 p-3 border border-dashed border-gray-700 rounded-xl hover:border-pink-500/50 transition-colors disabled:opacity-50"
                        >
                          {logoUploading ? (
                            <Loader2 className="w-5 h-5 text-gray-500 animate-spin shrink-0" />
                          ) : (
                            <Upload className="w-5 h-5 text-gray-500 shrink-0" />
                          )}
                          <span className="text-xs text-gray-500">{logoUploading ? "Uploading…" : "Upload logo (PNG, JPG)"}</span>
                        </button>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          e.target.value = "";
                          setLogoUploading(true);
                          try {
                            const url = await uploadLogo(file);
                            setEditData((d) => ({ ...d, logoUrl: url }));
                            toast.success("Logo uploaded");
                          } catch (err: any) {
                            toast.error(err?.message || "Logo upload failed");
                          } finally {
                            setLogoUploading(false);
                          }
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-400">Name</Label>
                        <Input
                          value={editData.name || ""}
                          onChange={(e) => { setEditData((d) => ({ ...d, name: e.target.value })); setEditNameError(null); }}
                          className={`bg-gray-900 border-gray-700 text-white${editNameError ? " border-red-500 focus-visible:ring-red-500" : ""}`}
                        />
                        {editNameError && (
                          <p className="text-xs text-red-400 mt-1">{editNameError}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Font</Label>
                        <Select value={editData.fontFamily || ""} onValueChange={(v) => setEditData((d) => ({ ...d, fontFamily: v }))}>
                          <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 max-h-80 overflow-y-auto">
                            {FONT_OPTIONS.map((f) => (
                              <SelectItem key={f.value} value={f.value} className="text-white">{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Page Colour</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={editData.pageColor || "#000000"} onChange={(e) => setEditData((d) => ({ ...d, pageColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" />
                          <Input value={editData.pageColor || ""} onChange={(e) => setEditData((d) => ({ ...d, pageColor: e.target.value }))} className="flex-1 bg-gray-900 border-gray-700 text-white" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Text Colour</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={editData.textColor || "#ffffff"} onChange={(e) => setEditData((d) => ({ ...d, textColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" />
                          <Input value={editData.textColor || ""} onChange={(e) => setEditData((d) => ({ ...d, textColor: e.target.value }))} className="flex-1 bg-gray-900 border-gray-700 text-white" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Accent Colour</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={editData.accentColor || "#d4af37"} onChange={(e) => setEditData((d) => ({ ...d, accentColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" />
                          <Input value={editData.accentColor || ""} onChange={(e) => setEditData((d) => ({ ...d, accentColor: e.target.value }))} className="flex-1 bg-gray-900 border-gray-700 text-white" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Font Size</Label>
                        <Input type="number" value={editData.fontSize || 52} onChange={(e) => setEditData((d) => ({ ...d, fontSize: Number(e.target.value) }))} className="bg-gray-900 border-gray-700 text-white" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Text Alignment</Label>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        {([{ value: "left" as TextAlign, label: "Left" }, { value: "center" as TextAlign, label: "Centre" }, { value: "right" as TextAlign, label: "Right" }] as const).map((opt) => (
                          <button key={opt.value} onClick={() => setEditData((d) => ({ ...d, textAlign: opt.value }))}
                            className={`px-2 py-2 rounded text-xs font-semibold transition-all ${(editData.textAlign || "left") === opt.value ? "bg-pink-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs text-gray-400">Text Box Outline</Label>
                        <button
                          onClick={() => setEditData((d) => ({ ...d, textBoxOutline: !d.textBoxOutline }))}
                          className={`relative w-10 h-5 rounded-full transition-colors ${editData.textBoxOutline ? "bg-pink-500" : "bg-gray-600"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${editData.textBoxOutline ? "translate-x-5" : ""}`} />
                        </button>
                      </div>
                      {editData.textBoxOutline && (
                        <div className="flex items-center gap-2">
                          <input type="color" value={editData.textBoxOutlineColor || "#ffffff"} onChange={(e) => setEditData((d) => ({ ...d, textBoxOutlineColor: e.target.value }))} className="w-8 h-8 rounded cursor-pointer" />
                          <Input value={editData.textBoxOutlineColor || "#ffffff"} onChange={(e) => setEditData((d) => ({ ...d, textBoxOutlineColor: e.target.value }))} className="flex-1 bg-gray-900 border-gray-700 text-white font-mono text-xs" />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Cloud Campaign Workspace</Label>
                      {ccWorkspacesLoading ? (
                        <p className="text-xs text-gray-500 mt-1">Loading workspaces…</p>
                      ) : ccWorkspacesError ? (
                        <div>
                          <p className="text-xs text-red-400 mt-1 mb-1">{ccWorkspacesError}</p>
                          <Input
                            placeholder="Paste workspace UUID manually"
                            value={editData.ccWorkspaceId || ""}
                            onChange={(e) => setEditData((d) => ({ ...d, ccWorkspaceId: e.target.value || null }))}
                            className="bg-gray-900 border-gray-700 text-white font-mono text-xs"
                          />
                        </div>
                      ) : (
                        <Select
                          value={editData.ccWorkspaceId || "__none__"}
                          onValueChange={(v) => setEditData((d) => ({ ...d, ccWorkspaceId: v === "__none__" ? null : v }))}
                        >
                          <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                            <SelectValue placeholder="Select a workspace…" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="bg-gray-800 border-gray-700 max-h-72 overflow-y-auto">
                            <SelectItem value="__none__" className="text-gray-400">None (unlink)</SelectItem>
                            {ccWorkspaces.map((ws) => (
                              <SelectItem key={ws.id} value={ws.id} className="text-white">{ws.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <MetaConnectSection
                      editingId={editingId}
                      editData={editData}
                      setEditData={setEditData}
                      onConnected={async () => {
                        await fetchPresets();
                        const fresh = presets.find((p) => p.id === editingId);
                        if (fresh) {
                          setEditData((d) => ({
                            ...d,
                            metaPageAccessToken: fresh.metaPageAccessToken,
                            metaFacebookPageId: fresh.metaFacebookPageId,
                            metaInstagramAccountId: fresh.metaInstagramAccountId,
                          }));
                        }
                      }}
                    />
                    <OnboardingLinkSection
                      editingId={editingId}
                      token={editData.clientPortalToken ?? null}
                      connectedAt={editData.onboardingConnectedAt ?? null}
                      onGenerated={(newToken) => {
                        setEditData((d) => ({ ...d, clientPortalToken: newToken, onboardingConnectedAt: null }));
                      }}
                    />
                    <div>
                      <Label className="text-xs text-gray-400">Default Post Time</Label>
                      <Input
                        type="time"
                        value={editData.defaultPostTime || "18:00"}
                        onChange={(e) => setEditData((d) => ({ ...d, defaultPostTime: e.target.value }))}
                        className="bg-gray-900 border-gray-700 text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">Used when auto-scheduling from the Content Library.</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Caption Footnote (appended to AI-generated captions)</Label>
                      <textarea
                        placeholder="e.g. 📍 123 High Street, London | @clinicname"
                        value={editData.captionFootnote || ""}
                        onChange={(e) => setEditData((d) => ({ ...d, captionFootnote: e.target.value }))}
                        rows={2}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
                      />
                    </div>
                    <div className="space-y-3 border-t border-gray-800 pt-3">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Default First Comments</p>
                      <div>
                        <Label className="text-xs text-gray-400">Carousel default</Label>
                        <textarea
                          placeholder="Which slide surprised you most? Comment the number below 👇"
                          value={editData.defaultFirstCommentCarousel || ""}
                          onChange={(e) => setEditData((d) => ({ ...d, defaultFirstCommentCarousel: e.target.value }))}
                          rows={2}
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Single image default</Label>
                        <textarea
                          placeholder="Save this one for later 💗"
                          value={editData.defaultFirstCommentSingle || ""}
                          onChange={(e) => setEditData((d) => ({ ...d, defaultFirstCommentSingle: e.target.value }))}
                          rows={2}
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Reel default</Label>
                        <textarea
                          placeholder="Drop a 🔥 if this helped"
                          value={editData.defaultFirstCommentReel || ""}
                          onChange={(e) => setEditData((d) => ({ ...d, defaultFirstCommentReel: e.target.value }))}
                          rows={2}
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-gray-400">Cancel</Button>
                      <Button size="sm" onClick={handleSaveEdit} className="bg-pink-600 hover:bg-pink-700">
                        <Save className="w-3.5 h-3.5 mr-1" /> Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        {preset.logoUrl && (
                          <div className="w-9 h-9 rounded-lg bg-white/5 border border-gray-700 flex items-center justify-center overflow-hidden p-1 shrink-0">
                            <img src={preset.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                          </div>
                        )}
                        <h3 className="text-lg font-semibold text-white">{preset.name}</h3>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded border border-gray-600 inline-block" style={{ backgroundColor: preset.pageColor }} />
                          Page
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded border border-gray-600 inline-block" style={{ backgroundColor: preset.textColor }} />
                          Text
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded border border-gray-600 inline-block" style={{ backgroundColor: preset.accentColor }} />
                          Accent
                        </span>
                        <span style={{ fontFamily: preset.fontFamily }}>{getFontLabel(preset.fontFamily)}</span>
                        <span>{preset.fontSize}px</span>
                        {preset.cornerStyle !== "none" && <span>Corner: {preset.cornerStyle}</span>}
                        {preset.ccWorkspaceId && <span className="text-blue-400">CC linked</span>}
                        {preset.metaInstagramAccountId && <span className="text-purple-400">Meta connected</span>}
                        {preset.onboardingConnectedAt && (
                          <span className="flex items-center gap-1 text-pink-400"><UserCheck className="w-3 h-3" /> Client connected</span>
                        )}
                        {preset.clientPortalToken && !preset.onboardingConnectedAt && (
                          <span className="flex items-center gap-1 text-amber-400"><Link2 className="w-3 h-3" /> Onboard link sent</span>
                        )}
                      </div>
                      {preset.captionFootnote && (
                        <p className="text-xs text-gray-500 mt-1 italic">Footnote: {preset.captionFootnote}</p>
                      )}
                      {(preset.targetAudience || preset.contentPillars || preset.brandNotes) && (
                        <p className="text-xs text-pink-400 mt-1 flex items-center gap-1">
                          <Brain className="w-3 h-3" /> Brand profile set
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <PortalButton preset={preset} />
                      <Button variant="ghost" size="sm" onClick={() => startEdit(preset)} className="text-gray-400 hover:text-white h-8 px-2">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(preset.id)} className="text-red-400 hover:text-red-300 h-8 px-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => !deleteDeleting && setDeleteTarget(null)}>
          <div className="bg-zinc-900 border border-red-900/50 rounded-xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-white">Delete {deleteTarget.name}?</h2>
                <p className="text-sm text-zinc-400 mt-0.5">This cannot be undone</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-300 leading-relaxed">
                This will permanently clear all unscheduled posts, library items, and Meta connections for this client.
                Posted history will be kept for records.
              </p>
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
                <p>What gets removed:</p>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-500">
                  <li>All Content Library entries for this client</li>
                  <li>All pending and draft scheduled posts</li>
                  <li>Meta access tokens and account connections</li>
                </ul>
                <p className="text-zinc-500 pt-1">Published and failed post history is kept.</p>
              </div>
              <div>
                <Label className="text-zinc-300 text-sm mb-1.5 block">
                  Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
                  placeholder="DELETE"
                  autoFocus
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 font-mono"
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteDeleting}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleteConfirmText !== "DELETE" || deleteDeleting}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
              >
                {deleteDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
