import { useEffect, useState } from "react";

// /suitscrm: the Suits in Social Media CRM. It has its own password and sits outside the main tools login.
// Its followers, pipeline and notes are saved in this browser by the CRM itself.

const BASE = import.meta.env.BASE_URL || "/";
const KEY = "suits-crm-pw";

export default function SuitsCrmPage() {
  const [html, setHtml] = useState("");
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  // The signed in tools flip the page colours for the white theme, which would change the purple here, so it is switched off on this page.
  useEffect(() => {
    const root = document.documentElement;
    const hadFlip = root.classList.contains("cs-light");
    const drop = () => {
      if (root.classList.contains("cs-light")) root.classList.remove("cs-light");
    };
    drop();
    const watcher = new MutationObserver(drop);
    watcher.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      watcher.disconnect();
      if (hadFlip) root.classList.add("cs-light");
    };
  }, []);

  async function open(password: string) {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`${BASE}api/suits-crm`, { headers: { "x-suits-password": password } });
      if (!r.ok) throw new Error(r.status === 401 ? "That password is not right." : "Could not open the CRM.");
      setHtml(await r.text());
      localStorage.setItem(KEY, password);
    } catch (e) {
      localStorage.removeItem(KEY);
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    document.title = "Suits in Social Media CRM";
    const saved = localStorage.getItem(KEY);
    if (saved) open(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!html) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "League Spartan, sans-serif" }}>
        <form
          onSubmit={(e) => { e.preventDefault(); open(pw); }}
          style={{ background: "#fff", border: "3px solid #b05cff", borderRadius: 16, padding: 32, width: 340, maxWidth: "90vw" }}
        >
          <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.1, marginBottom: 6 }}>Suits in Social Media CRM</div>
          <label htmlFor="suits-pw" style={{ display: "block", fontWeight: 700, fontSize: 14, margin: "14px 0 6px" }}>Password</label>
          <input
            id="suits-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid #000", fontSize: 16 }}
          />
          <button type="submit" disabled={busy || !pw} style={{ marginTop: 14, width: "100%", padding: "12px 0", borderRadius: 10, border: 0, background: "#b05cff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
            {busy ? "Opening..." : "Open"}
          </button>
          {msg && <div role="alert" style={{ marginTop: 12, fontWeight: 700, color: "#b00020" }}>{msg}</div>}
        </form>
      </div>
    );
  }
  return (
    <iframe
      title="Suits in Social Media CRM"
      srcDoc={html}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#fff" }}
    />
  );
}
