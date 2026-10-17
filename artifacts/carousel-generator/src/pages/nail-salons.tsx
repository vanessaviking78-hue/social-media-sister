import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Sparkles, Loader2, Copy, RefreshCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Kind = "personal" | "facts" | "availability" | "beforeafter" | "tweet";

type Post = {
  kind: Kind;
  day: string;
  hook: string;
  caption: string;
  replyWord: string;
  hashtags: string[];
  headline?: string;
  facts?: string[];
  beforeLabel?: string;
  afterLabel?: string;
  signOff?: string;
};

const ORDER: Kind[] = ["personal", "facts", "availability", "beforeafter", "tweet"];

const META: Record<Kind, { title: string; blurb: string }> = {
  personal: { title: "Personal post", blurb: "A bit of Millie's week, so her followers feel they know her." },
  facts: { title: "Nail facts post", blurb: "Fun and true, never a lecture. Great for saves and shares." },
  availability: { title: "Availability post", blurb: "Gaps in the diary, written as a little treat, never pressure." },
  beforeafter: { title: "Before and after template", blurb: "Add Millie's photos, then use the words below." },
  tweet: { title: "Sunday tweet post", blurb: "A shareable tweet. Drop the text into Tweet Maker for the graphic." },
};

const inputCls =
  "w-full rounded-lg bg-zinc-900 border border-zinc-800 focus:border-pink-500 outline-none px-3 py-2 text-sm text-white placeholder:text-zinc-600";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">{children}</span>;
}

function fullCaption(p: Post): string {
  return `${p.caption}\n\n${p.hashtags.join(" ")}`;
}

export default function NailSalons() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [owner, setOwner] = useState("Millie");
  const [area, setArea] = useState("Wyke, Bradford");
  const [services, setServices] = useState("");
  const [offer, setOffer] = useState("");
  const [availability, setAvailability] = useState("");
  const [personal, setPersonal] = useState("");
  const [booking, setBooking] = useState("");
  const [emojis, setEmojis] = useState(false);
  const [replyWords, setReplyWords] = useState<Record<string, string>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState<Kind | "all" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Start on The Nail Corner when it exists, otherwise let her choose.
  useEffect(() => {
    if (presetId != null || !presets.length) return;
    const nc = presets.find((p) => /nail/i.test(p.name));
    if (nc) setPresetId(nc.id);
  }, [presets, presetId]);

  const preset = useMemo(() => presets.find((p) => p.id === presetId), [presets, presetId]);

  async function generate(only?: Kind) {
    if (!preset) {
      toast.error("Pick a client first");
      return;
    }
    setBusy(only ?? "all");
    try {
      const r = await fetch(`${BASE}/api/nail-salons/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          only,
          businessName: preset.name,
          ownerName: owner,
          area,
          audience: preset.targetAudience ?? "",
          brandNotes: preset.brandNotes ?? "",
          services,
          offer,
          availability,
          personal,
          booking,
          emojis,
          replyWords,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The copy would not write, try again");
      const fresh: Post[] = data.posts ?? [];
      setPosts((old) => {
        const merged = new Map(old.map((p) => [p.kind, p] as const));
        for (const p of fresh) merged.set(p.kind, p);
        return ORDER.map((k) => merged.get(k)).filter(Boolean) as Post[];
      });
      toast.success(only ? "Rewritten" : "Your week is written");
    } catch (e: any) {
      toast.error(e?.message || "The copy would not write, try again");
    } finally {
      setBusy(null);
    }
  }

  function patch(kind: Kind, change: Partial<Post>) {
    setPosts((old) => old.map((p) => (p.kind === kind ? { ...p, ...change } : p)));
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("Copy did not work, select the text and copy it by hand");
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Sparkles className="w-5 h-5 text-pink-400" />
        <h1 className="font-bold text-lg">Nail Salons</h1>
        <span className="text-sm text-muted-foreground">One week of posts for a nail tech: 4 posts plus a Sunday tweet</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="rounded-2xl border border-border/30 p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <Label>Client</Label>
              <select className={inputCls} value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choose a client</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <Label>Owner's first name</Label>
              <input className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)} />
            </label>
            <label className="block">
              <Label>Area (used for the 5 hashtags)</Label>
              <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Wyke, Bradford" />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <Label>Services (optional)</Label>
              <input className={inputCls} value={services} onChange={(e) => setServices(e.target.value)} placeholder="Gel polish, BIAB, acrylics, nail art" />
            </label>
            <label className="block">
              <Label>Current offer (optional)</Label>
              <input className={inputCls} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Leave blank if there isn't one" />
            </label>
            <label className="block">
              <Label>This week's availability (for the availability post)</Label>
              <input className={inputCls} value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Tuesday 11am, Thursday 4pm, two Saturday slots" />
            </label>
            <label className="block">
              <Label>What's happening in Millie's week (for the personal post)</Label>
              <input className={inputCls} value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="New colour in, quiet Monday, treated herself" />
            </label>
            <label className="block">
              <Label>How people book (optional)</Label>
              <input className={inputCls} value={booking} onChange={(e) => setBooking(e.target.value)} placeholder="Message me on Instagram" />
            </label>
            <label className="flex items-center gap-2 mt-6 text-sm">
              <input type="checkbox" checked={emojis} onChange={(e) => setEmojis(e.target.checked)} />
              Add a few cute emojis
            </label>
          </div>

          <div>
            <Label>Reply words (optional, leave blank and I will pick a fun one for each post)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ORDER.map((k) => (
                <input
                  key={k}
                  className={inputCls}
                  placeholder={META[k].title.split(" ")[0]}
                  value={replyWords[k] ?? ""}
                  onChange={(e) => setReplyWords((r) => ({ ...r, [k]: e.target.value }))}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={busy !== null || !preset}
            onClick={() => generate()}
            className="inline-flex items-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-semibold px-5 py-2.5"
          >
            {busy === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Write my week
          </button>
        </section>

        {posts.length > 0 && (
          <section className="space-y-5">
            {posts.map((p) => (
              <article key={p.kind} className="rounded-2xl border border-border/30 p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold text-base">{META[p.kind].title}</h2>
                  <span className="text-xs rounded-full bg-pink-500/15 text-pink-300 px-2.5 py-0.5">Suggested: {p.day}</span>
                  {p.replyWord && <span className="text-xs rounded-full bg-zinc-800 text-zinc-300 px-2.5 py-0.5">Reply word: {p.replyWord}</span>}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => generate(p.kind)}
                    className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {busy === p.kind ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    Rewrite
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">{META[p.kind].blurb}</p>

                {p.kind === "tweet" && (
                  <div>
                    <Label>Tweet text</Label>
                    <textarea rows={3} className={inputCls} value={p.hook} onChange={(e) => patch(p.kind, { hook: e.target.value })} />
                    <p className="text-xs text-zinc-500 mt-1">{p.hook.length} characters</p>
                    <button type="button" onClick={() => copy(`${p.kind}-tweet`, p.hook)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-pink-300 hover:text-pink-200">
                      {copied === `${p.kind}-tweet` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      Copy tweet text
                    </button>
                    <Link href="/tweet-maker" className="ml-4 text-sm text-pink-300 hover:text-pink-200 underline">
                      Open Tweet Maker
                    </Link>
                  </div>
                )}

                {p.headline && (
                  <div>
                    <Label>Graphic headline</Label>
                    <input className={inputCls} value={p.headline} onChange={(e) => patch(p.kind, { headline: e.target.value })} />
                  </div>
                )}

                {p.facts && p.facts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Facts for the graphic</Label>
                    {p.facts.map((f, i) => (
                      <textarea
                        key={i}
                        rows={2}
                        className={inputCls}
                        value={f}
                        onChange={(e) => patch(p.kind, { facts: p.facts!.map((x, j) => (j === i ? e.target.value : x)) })}
                      />
                    ))}
                  </div>
                )}

                {p.kind === "beforeafter" && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <label className="block">
                      <Label>Before label</Label>
                      <input className={inputCls} value={p.beforeLabel ?? ""} onChange={(e) => patch(p.kind, { beforeLabel: e.target.value })} />
                    </label>
                    <label className="block">
                      <Label>After label</Label>
                      <input className={inputCls} value={p.afterLabel ?? ""} onChange={(e) => patch(p.kind, { afterLabel: e.target.value })} />
                    </label>
                    <label className="block">
                      <Label>Sign off line</Label>
                      <input className={inputCls} value={p.signOff ?? ""} onChange={(e) => patch(p.kind, { signOff: e.target.value })} />
                    </label>
                  </div>
                )}

                <div>
                  <Label>Caption</Label>
                  <textarea rows={8} className={inputCls} value={p.caption} onChange={(e) => patch(p.kind, { caption: e.target.value })} />
                  <p className="text-sm text-pink-300 mt-2 break-words">{p.hashtags.join(" ")}</p>
                  <button type="button" onClick={() => copy(`${p.kind}-cap`, fullCaption(p))} className="mt-2 inline-flex items-center gap-1.5 text-sm text-pink-300 hover:text-pink-200">
                    {copied === `${p.kind}-cap` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    Copy caption and hashtags
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
