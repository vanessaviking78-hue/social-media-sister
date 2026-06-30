import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Inbox, Loader2, ImageOff } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type Submission = {
  id: number;
  clientName: string;
  beforeUrl: string;
  afterUrl: string;
  treatment: string;
  story: string;
  submitterName: string;
  createdAt: string;
};

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, "Authorization": `Bearer ${pw}` };
}

export default function Submissions() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}api/submissions`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/hub"><button className="text-zinc-400 hover:text-white transition"><ArrowLeft className="w-5 h-5" /></button></Link>
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-pink-400" />
            <h1 className="text-xl font-bold">Before & After Inbox</h1>
            {rows.length > 0 && <span className="ml-2 text-xs text-zinc-500">{rows.length} submission{rows.length !== 1 ? "s" : ""}</span>}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
            <ImageOff className="w-8 h-8 mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-500">No before & afters submitted yet. Send a clinic their link and they'll show up here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((s) => (
              <div key={s.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                  <span className="font-semibold text-sm">{s.clientName}{s.treatment ? ` — ${s.treatment}` : ""}</span>
                  <span className="text-xs text-zinc-500">{new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-zinc-800">
                  {[["Before", s.beforeUrl], ["After", s.afterUrl]].map(([lab, url]) => (
                    <div key={lab} className="relative bg-zinc-900">
                      <img src={url as string} alt={lab as string} className="w-full h-56 object-cover" />
                      <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-black/60 px-2 py-0.5 rounded-full">{lab}</span>
                      <a href={url as string} download className="absolute bottom-2 right-2 text-[10px] bg-black/60 hover:bg-black/80 px-2 py-0.5 rounded-full">Download</a>
                    </div>
                  ))}
                </div>
                {(s.story || s.submitterName) && (
                  <div className="px-4 py-3">
                    {s.story && <p className="text-sm text-zinc-300 whitespace-pre-wrap">{s.story}</p>}
                    {s.submitterName && <p className="text-xs text-zinc-500 mt-1">Sent by {s.submitterName}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
