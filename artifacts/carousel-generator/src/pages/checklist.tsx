import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ListChecks, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type ChecklistRow = {
  presetId: number;
  clientName: string;
  hexColours: boolean;
  images: boolean;
  bulkCarousels: boolean;
  seamlessCarousels: boolean;
  quotes: boolean;
  beforeAfters: boolean;
  footnoteLogo: boolean;
  connectedAccounts: boolean;
  notes: string;
};

const FIELDS: { key: keyof ChecklistRow; label: string }[] = [
  { key: "hexColours", label: "Hex colours" },
  { key: "images", label: "Images" },
  { key: "bulkCarousels", label: "Bulk carousels" },
  { key: "seamlessCarousels", label: "Seamless carousels" },
  { key: "quotes", label: "Quotes" },
  { key: "beforeAfters", label: "Before & afters" },
  { key: "footnoteLogo", label: "Footnote & logo" },
  { key: "connectedAccounts", label: "Connected accounts" },
];

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, "Authorization": `Bearer ${pw}` };
}

export default function Checklist() {
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch(`${BASE}api/checklist`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const arr = Array.isArray(d) ? d : [];
        setRows(arr);
        const drafts: Record<number, string> = {};
        arr.forEach((r: ChecklistRow) => { drafts[r.presetId] = r.notes || ""; });
        setNoteDrafts(drafts);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  async function toggleField(presetId: number, field: keyof ChecklistRow, value: boolean) {
    setRows((prev) => prev.map((r) => (r.presetId === presetId ? { ...r, [field]: value } : r)));
    try {
      await fetch(`${BASE}api/checklist/${presetId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ field, value }),
      });
    } catch {
      // optimistic update stays; a refresh will resync if the request failed
    }
  }

  async function saveNotes(presetId: number) {
    const notes = noteDrafts[presetId] ?? "";
    setRows((prev) => prev.map((r) => (r.presetId === presetId ? { ...r, notes } : r)));
    try {
      await fetch(`${BASE}api/checklist/${presetId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ field: "notes", value: notes }),
      });
    } catch {
      // optimistic update stays; a refresh will resync if the request failed
    }
  }

  const fullyDone = rows.filter((r) => FIELDS.every((f) => r[f.key] === true)).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/hub"><button className="text-zinc-400 hover:text-white transition"><ArrowLeft className="w-5 h-5" /></button></Link>
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-pink-400" />
            <h1 className="text-xl font-bold">Client Checklist</h1>
            {rows.length > 0 && (
              <span className="ml-2 text-xs text-zinc-500">
                {fullyDone}/{rows.length} clients fully up to date
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-zinc-500 -mt-4">
          One ongoing row per client. Nothing here resets, so it's always a live snapshot of who still needs what before the next 90-day batch.
        </p>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
            <ListChecks className="w-8 h-8 mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-500">No clients saved as presets yet. Add one in Presets and it'll show up here.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-zinc-900/60 whitespace-nowrap">Client</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="text-center font-medium text-zinc-400 px-3 py-3 whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="text-left font-medium text-zinc-400 px-4 py-3 whitespace-nowrap min-w-[200px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const doneCount = FIELDS.filter((f) => r[f.key] === true).length;
                  const allDone = doneCount === FIELDS.length;
                  return (
                    <tr key={r.presetId} className="border-b border-zinc-900 last:border-0">
                      <td className="px-4 py-3 sticky left-0 bg-zinc-950 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.clientName}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${allDone ? "bg-green-900/30 text-green-400 border-green-700/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                            {doneCount}/{FIELDS.length}
                          </span>
                        </div>
                      </td>
                      {FIELDS.map((f) => (
                        <td key={f.key} className="text-center px-3 py-3">
                          <input
                            type="checkbox"
                            checked={r[f.key] === true}
                            onChange={(e) => toggleField(r.presetId, f.key, e.target.checked)}
                            className="accent-pink-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={noteDrafts[r.presetId] ?? ""}
                          onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [r.presetId]: e.target.value }))}
                          onBlur={() => saveNotes(r.presetId)}
                          placeholder="Optional note..."
                          className="w-full bg-transparent border-b border-zinc-800 focus:border-pink-600 outline-none text-xs text-zinc-300 placeholder:text-zinc-700 py-1"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
