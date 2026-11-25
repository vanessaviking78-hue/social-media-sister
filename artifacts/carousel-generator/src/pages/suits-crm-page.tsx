import { useEffect, useState } from "react";

// /suitscrm: the Suits in Social Media CRM. It is fetched with the tools password and shown full screen.
// Its ticks, notes and pipeline are saved in this browser by the CRM itself.

const BASE = import.meta.env.BASE_URL || "/";

export default function SuitsCrmPage() {
  const [html, setHtml] = useState("");
  const [msg, setMsg] = useState("Opening your Suits CRM...");

  // The signed in tools flip the whole page with invert + hue rotate for the white theme. That turns hot pink
  // into purple inside the CRM, which is already white, so the flip is switched off on this page only.
  useEffect(() => {
    const root = document.documentElement;
    const hadFlip = root.classList.contains("cs-light");
    const drop = () => {
      if (root.classList.contains("cs-light")) root.classList.remove("cs-light");
    };
    drop();
    // The sign in wrapper adds the class after this page mounts, so keep it off for as long as the CRM is open.
    const watcher = new MutationObserver(drop);
    watcher.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      watcher.disconnect();
      if (hadFlip) root.classList.add("cs-light");
    };
  }, []);

  useEffect(() => {
    document.title = "Suits in Social Media CRM";
    const pw = localStorage.getItem("cybersuite-pw") || "";
    fetch(`${BASE}api/suits-crm`, { headers: { "x-app-password": pw } })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Please log in to your tools first." : "Could not open the CRM.");
        setHtml(await r.text());
      })
      .catch((e: Error) => setMsg(e.message));
  }, []);

  if (!html) {
    return <div style={{ padding: 40, fontFamily: "League Spartan, sans-serif", fontWeight: 900, fontSize: 24 }}>{msg}</div>;
  }
  return (
    <iframe
      title="Suits in Social Media CRM"
      srcDoc={html}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#fff" }}
    />
  );
}
