import { useEffect, useState } from "react";

// /crmpage: the Cyber Suite CRM. It is fetched with the tools password and shown full screen.
// Its ticks, notes and pipeline are saved in this browser by the CRM itself.

const BASE = import.meta.env.BASE_URL || "/";

export default function CrmPage() {
  const [html, setHtml] = useState("");
  const [msg, setMsg] = useState("Opening your CRM...");

  useEffect(() => {
    document.title = "CRM";
    const pw = localStorage.getItem("cybersuite-pw") || "";
    fetch(`${BASE}api/crm-page`, { headers: { "x-app-password": pw } })
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
      title="CRM"
      srcDoc={html}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#0D0D0D" }}
    />
  );
}
