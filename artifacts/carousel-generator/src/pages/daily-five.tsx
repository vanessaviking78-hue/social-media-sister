import React, { useCallback, useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";
const API = `${BASE}api/daily-five`;
const SESSION_KEY = "dailyfive_session";
const STAN_URL = (import.meta.env.VITE_DAILY_FIVE_STAN_URL as string | undefined) || "";
const TASTER_KEY = "dailyfive_taster";

type Task = { id: string; cat: string; text: string };
type State = { day: string; tasks: Task[]; ticked: string[]; streak: number; full: boolean };

const MESSAGES = [
  "Right then, get on with it.",
  "One down. Four to go. Do not get comfy.",
  "Two. Look at you, being useful.",
  "Three. Over halfway. Still not impressed.",
  "Four. Do not stop now, you absolute legend.",
  "All five done! Go and have a biscuit.",
];

type TasterSave = { day: string; ticked: string[] };
function getTaster(): TasterSave | null {
  try {
    const raw = localStorage.getItem(TASTER_KEY);
    return raw ? (JSON.parse(raw) as TasterSave) : null;
  } catch {
    return null;
  }
}
function saveTaster(v: TasterSave) {
  try {
    localStorage.setItem(TASTER_KEY, JSON.stringify(v));
  } catch {
    /* private mode, carry on */
  }
}

function getSession(): string {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}
function setSession(v: string) {
  try {
    if (v) localStorage.setItem(SESSION_KEY, v);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode, carry on */
  }
}

const CSS = `
.df{--bg:#1d1a1f;--card:#2a252d;--ink:#f7f1ea;--mute:#b9aeb8;--pink:#ff4f9a;--gold:#ffc857;--ok:#5be3a1;background:var(--bg);color:var(--ink);min-height:100vh;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:max(env(safe-area-inset-top),0px) 16px 40px;box-sizing:border-box}
.df *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.df .wrap{max-width:520px;margin:0 auto}
.df header{padding:28px 0 12px}
.df h1{margin:0;font-size:2rem;letter-spacing:-.5px}
.df h1 span{color:var(--pink)}
.df .date{color:var(--mute);margin-top:4px;font-size:.95rem}
.df .bar{display:flex;gap:10px;margin:16px 0}
.df .pill{background:var(--card);border-radius:14px;padding:10px 14px;flex:1;text-align:center}
.df .pill b{display:block;font-size:1.4rem;color:var(--gold)}
.df .pill small{color:var(--mute)}
.df .prog{height:10px;background:var(--card);border-radius:99px;overflow:hidden;margin-bottom:18px}
.df .prog i{display:block;height:100%;background:linear-gradient(90deg,var(--pink),var(--gold));transition:width .4s}
.df .task{display:flex;gap:14px;align-items:flex-start;background:var(--card);border-radius:18px;padding:16px;margin-bottom:12px;cursor:pointer;border:2px solid transparent;transition:.2s;user-select:none;width:100%;text-align:left;color:inherit;font:inherit}
.df .task:active{transform:scale(.98)}
.df .box{flex:0 0 32px;height:32px;border-radius:10px;border:2px solid var(--mute);display:grid;place-items:center;font-size:1.2rem;color:transparent;transition:.2s}
.df .task.done{opacity:.6;border-color:var(--ok)}
.df .task.done .box{background:var(--ok);border-color:var(--ok);color:#10261b}
.df .task.done .t{text-decoration:line-through}
.df .cat{font-size:.7rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--pink);font-weight:700}
.df .t{margin-top:4px;line-height:1.4;font-size:1.02rem}
.df .msg{text-align:center;font-size:1.15rem;margin:22px 0;min-height:1.6em;color:var(--gold)}
.df .foot{text-align:center;color:var(--mute);font-size:.8rem;margin-top:30px}
.df .foot button{background:none;border:0;color:var(--mute);text-decoration:underline;font:inherit;cursor:pointer;padding:6px}
.df canvas{position:fixed;inset:0;pointer-events:none;z-index:9}
.df .panel{background:var(--card);border-radius:18px;padding:22px;margin-top:20px}
.df .panel p{line-height:1.5;margin:0 0 14px;color:var(--ink)}
.df input{width:100%;padding:14px;border-radius:12px;border:2px solid #4a4250;background:#1d1a1f;color:var(--ink);font-size:1rem;margin-bottom:12px}
.df .btn{display:block;width:100%;padding:14px;border-radius:12px;border:0;background:var(--pink);color:#fff;font-size:1rem;font-weight:700;cursor:pointer;text-align:center;text-decoration:none}
.df .btn:disabled{opacity:.6}
.df .err{color:#ff8fa3;margin:0 0 12px}
`;

export default function DailyFive() {
  const [status, setStatus] = useState<"loading" | "login" | "sent" | "inactive" | "app" | "taster" | "tasterEnded">("loading");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<State | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const confetti = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    const cx = cv.getContext("2d");
    if (!cx) return;
    const cols = ["#ff4f9a", "#ffc857", "#5be3a1", "#6ec6ff", "#ffffff", "#c77dff"];
    const p = Array.from({ length: 180 }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 4,
      w: 6 + Math.random() * 7,
      h: 8 + Math.random() * 8,
      r: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      c: cols[Math.floor(Math.random() * cols.length)],
    }));
    let f = 0;
    const step = () => {
      cx.clearRect(0, 0, cv.width, cv.height);
      p.forEach((q) => {
        q.vy += 0.35;
        q.vx *= 0.99;
        q.x += q.vx;
        q.y += q.vy;
        q.r += q.vr;
        cx.save();
        cx.translate(q.x, q.y);
        cx.rotate(q.r);
        cx.fillStyle = q.c;
        cx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        cx.restore();
      });
      if (++f < 220) requestAnimationFrame(step);
      else cx.clearRect(0, 0, cv.width, cv.height);
    };
    step();
  }, []);

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) {
      setStatus("login");
      return;
    }
    try {
      const r = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${session}` } });
      if (r.status === 401) {
        setSession("");
        setStatus("login");
        return;
      }
      if (r.status === 402) {
        setStatus("inactive");
        return;
      }
      if (!r.ok) throw new Error("Could not load");
      setState(await r.json());
      setStatus("app");
    } catch {
      setError("Could not reach the server. Check your signal and refresh.");
      setStatus("login");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const taster = params.get("taster");
    if (taster) {
      (async () => {
        try {
          const r = await fetch(`${API}/taster?code=${encodeURIComponent(taster)}`);
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            setError(data.error || "This taster link is not valid any more");
            setStatus("login");
            return;
          }
          const saved = getTaster();
          if (saved && saved.day !== data.day) {
            setStatus("tasterEnded");
            return;
          }
          const ticked = saved && saved.day === data.day ? saved.ticked : [];
          saveTaster({ day: data.day, ticked });
          setState({ day: data.day, tasks: data.tasks, ticked, streak: 0, full: ticked.length >= data.tasks.length });
          setStatus("taster");
        } catch {
          setError("Could not reach the server. Check your signal and refresh.");
          setStatus("login");
        }
      })();
      return;
    }
    if (!token) {
      void load();
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await r.json().catch(() => ({}));
        window.history.replaceState({}, "", window.location.pathname);
        if (r.status === 402) {
          setStatus("inactive");
          return;
        }
        if (!r.ok) {
          setError(data.error || "That link did not work. Ask for a new one.");
          setStatus("login");
          return;
        }
        setSession(data.session);
        await load();
      } catch {
        setError("Could not reach the server. Try the link again.");
        setStatus("login");
      }
    })();
  }, [load]);

  const askForLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) setError(data.error || "Something went wrong");
      else setStatus("sent");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (task: Task) => {
    if (!state) return;
    const isDone = state.ticked.includes(task.id);
    const optimistic = isDone ? state.ticked.filter((i) => i !== task.id) : [...state.ticked, task.id];
    if (status === "taster") {
      const full = optimistic.length >= state.tasks.length;
      setState({ ...state, ticked: optimistic, full });
      saveTaster({ day: state.day, ticked: optimistic });
      if (full && !state.full) confetti();
      return;
    }
    setState({ ...state, ticked: optimistic });
    try {
      const r = await fetch(`${API}/tick`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSession()}` },
        body: JSON.stringify({ taskId: task.id, done: !isDone }),
      });
      if (r.status === 401 || r.status === 402) {
        await load();
        return;
      }
      if (!r.ok) throw new Error("tick failed");
      const data = await r.json();
      setState({ day: data.day, tasks: data.tasks, ticked: data.ticked, streak: data.streak, full: data.full });
      if (data.justCompleted) confetti();
    } catch {
      setState(state);
    }
  };

  const signOut = () => {
    setSession("");
    setState(null);
    setStatus("login");
  };

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });

  return (
    <div className="df">
      <style>{CSS}</style>
      <canvas ref={canvasRef} />
      <div className="wrap">
        <header>
          <h1>
            Daily <span>Five</span>
          </h1>
          <div className="date">{dateLabel}</div>
        </header>

        {status === "loading" && <p style={{ color: "#b9aeb8" }}>Loading your five...</p>}

        {(status === "login" || status === "sent") && (
          <div className="panel">
            {status === "login" ? (
              <form onSubmit={askForLink}>
                <p>Pop in the email you used when you joined and I will send you a link to get in.</p>
                {error && <p className="err">{error}</p>}
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@yourclinic.co.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Sending..." : "Send me the link"}
                </button>
              </form>
            ) : (
              <p>
                Check your inbox. If that email has a membership, a link is on its way and it works for 30 minutes. Not
                there? Look in your spam folder.
              </p>
            )}
          </div>
        )}

        {status === "tasterEnded" && (
          <div className="panel">
            <p>Your free day has been and gone. Hope the confetti was worth it. Fancy a new five every morning?</p>
            {STAN_URL ? (
              <a className="btn" href={STAN_URL}>
                Join for £9 a month
              </a>
            ) : null}
          </div>
        )}

        {status === "inactive" && (
          <div className="panel">
            <p>This email does not have an active Daily Five membership right now.</p>
            {STAN_URL ? (
              <a className="btn" href={STAN_URL}>
                Join for £9 a month
              </a>
            ) : null}
            <div className="foot">
              <button onClick={signOut}>Use a different email</button>
            </div>
          </div>
        )}

        {(status === "app" || status === "taster") && state && (
          <>
            {status === "taster" && (
              <div className="panel" style={{ marginTop: 0, marginBottom: 16 }}>
                <p style={{ margin: 0 }}>
                  This is your free taster, today only. Tick all five and see what happens.
                </p>
              </div>
            )}
            <div className="bar">
              <div className="pill">
                <b>{state.streak}</b>
                <small>day streak</small>
              </div>
              <div className="pill">
                <b>{state.ticked.length}/{state.tasks.length}</b>
                <small>done today</small>
              </div>
            </div>
            <div className="prog">
              <i style={{ width: `${(state.ticked.length / Math.max(state.tasks.length, 1)) * 100}%` }} />
            </div>
            {state.tasks.map((t) => {
              const done = state.ticked.includes(t.id);
              return (
                <button key={t.id} className={`task${done ? " done" : ""}`} onClick={() => toggle(t)}>
                  <div className="box">✓</div>
                  <div>
                    <div className="cat">{t.cat}</div>
                    <div className="t">{t.text}</div>
                  </div>
                </button>
              );
            })}
            <div className="msg">{MESSAGES[Math.min(state.ticked.length, MESSAGES.length - 1)]}</div>
            <div className="foot">
              New five at midnight. No, you cannot have them early.
              {status === "taster" ? (
                STAN_URL ? (
                  <div style={{ marginTop: 14 }}>
                    <a className="btn" href={STAN_URL}>
                      Want one every day? Join for £9 a month
                    </a>
                  </div>
                ) : null
              ) : (
                <div>
                  <button onClick={signOut}>Sign out</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
