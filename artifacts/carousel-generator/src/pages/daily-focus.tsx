import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Flame, Loader2, Play, Pause, RotateCcw, CheckCircle2, PartyPopper } from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

type UrgentClient = {
  presetId: number;
  clientName: string;
  daysCovered: number;
  postsScheduled: number;
  postsNeeded: number;
  taskType: string;
  batchSize: number;
  suggestedMinutes: number;
  urgent: boolean;
};

type DailyFocusData = {
  generatedAt: string;
  targetDays: number;
  totalClients: number;
  onTrackCount: number;
  urgentClients: UrgentClient[];
};

function todayKey(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function loadDoneSet(): Set<number> {
  try {
    const raw = localStorage.getItem("dailyFocusDone-" + todayKey());
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveDoneSet(set: Set<number>) {
  localStorage.setItem("dailyFocusDone-" + todayKey(), JSON.stringify([...set]));
}

export default function DailyFocus() {
  const [data, setData] = useState<DailyFocusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Set<number>>(() => loadDoneSet());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [justFinished, setJustFinished] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(BASE + "api/daily-focus");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeId === null) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setJustFinished(activeId);
          setActiveId(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeId]);

  const startTimer = (client: UrgentClient) => {
    const total = client.suggestedMinutes * 60;
    setTotalSeconds(total);
    setSecondsLeft(total);
    setActiveId(client.presetId);
    setJustFinished(null);
  };

  const stopTimer = () => {
    setActiveId(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resetTimer = (client: UrgentClient) => {
    setTotalSeconds(client.suggestedMinutes * 60);
    setSecondsLeft(client.suggestedMinutes * 60);
  };

  const markDone = (presetId: number) => {
    const next = new Set(done);
    next.add(presetId);
    setDone(next);
    saveDoneSet(next);
    if (activeId === presetId) stopTimer();
    setJustFinished(null);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  };

  const clients = (data?.urgentClients || []).filter((c) => !done.has(c.presetId));
  const doneCount = (data?.urgentClients || []).filter((c) => done.has(c.presetId)).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <button className="shrink-0 rounded-lg p-2 hover:bg-muted/50">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <Flame className="h-5 w-5 text-orange-400" />
        <div className="flex-1">
          <h1 className="font-semibold text-base leading-none">Daily Focus</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Live content gaps, sprint the ones on fire first</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs rounded-full border border-border/50 px-3 py-1.5 hover:bg-muted/50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {loading && !data && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading live gaps...
          </div>
        )}

        {data && (
          <div className="rounded-2xl border border-border/50 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{data.onTrackCount} of {data.totalClients} clients have {data.targetDays}+ days scheduled</p>
              <p className="text-xs text-muted-foreground mt-0.5">{clients.length} still need a sprint today, {doneCount} sorted so far</p>
            </div>
            <PartyPopper className="w-6 h-6 text-emerald-400 shrink-0" />
          </div>
        )}

        {data && clients.length === 0 && !loading && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
            <PartyPopper className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold">Every client is covered for {data.targetDays}+ days.</p>
            <p className="text-xs text-muted-foreground mt-1">Clean sweep, go and have your weekend.</p>
          </div>
        )}

        {clients.map((client) => {
          const isActive = activeId === client.presetId;
          const isFinished = justFinished === client.presetId;
          const progress = isActive && totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
          return (
            <div
              key={client.presetId}
              className={
                "rounded-2xl border p-4 space-y-3 " +
                (isActive ? "border-pink-500/60 bg-pink-500/5" : isFinished ? "border-emerald-500/50 bg-emerald-500/5" : "border-border/50")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{client.clientName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {client.daysCovered} days of content left, {client.postsScheduled} scheduled, needs {client.postsNeeded} more to hit {data?.targetDays} days
                  </p>
                </div>
                <button
                  onClick={() => markDone(client.presetId)}
                  className="text-xs text-muted-foreground hover:text-emerald-400 flex items-center gap-1 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                </button>
              </div>

              {isFinished ? (
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold">
                  <PartyPopper className="w-4 h-4" /> Time is up! Mark it done once the batch is posted.
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm">
                    Sprint: <span className="font-semibold">{client.batchSize} {client.taskType}{client.batchSize === 1 ? "" : "s"}</span> in <span className="font-semibold">{client.suggestedMinutes} minutes</span>
                  </p>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full bg-pink-500 transition-all duration-1000"
                      style={{ width: (isActive ? progress * 100 : 0) + "%" }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <>
                        <span className="text-lg font-mono font-semibold tabular-nums">{formatTime(secondsLeft)}</span>
                        <button
                          onClick={stopTimer}
                          className="text-xs rounded-full border border-border/50 px-3 py-1.5 hover:bg-muted/50 flex items-center gap-1"
                        >
                          <Pause className="w-3 h-3" /> Pause
                        </button>
                        <button
                          onClick={() => resetTimer(client)}
                          className="text-xs rounded-full border border-border/50 px-3 py-1.5 hover:bg-muted/50 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startTimer(client)}
                        className="text-xs rounded-full bg-pink-600 hover:bg-pink-500 text-white px-4 py-1.5 flex items-center gap-1.5 font-semibold"
                      >
                        <Play className="w-3 h-3" /> Start sprint
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
