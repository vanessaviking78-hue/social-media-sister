// Gathers what a client has told Vanessa in her own words, so the Month tool can write from who they really are.
// Sources: Getting to know you, the Client Question answers they have sent, and their Homework replies.
// Returned as one short block of text that is added to the brand notes the copy writers already receive.

import { authHeaders, sameClientName } from "@/lib/use-approval";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

// The Getting to know you answers worth writing from. Brand colours, fonts and links are left out on purpose.
const PROFILE_PARTS: { id: string; label: string }[] = [
  { id: "words", label: "Their personality in three words" },
  { id: "adore", label: "What patients adore about them" },
  { id: "patient", label: "Their ideal patient" },
  { id: "worries", label: "What that patient worries about" },
  { id: "treatments", label: "Signature treatments" },
  { id: "humour", label: "Their sense of humour" },
  { id: "extra", label: "What makes them them" },
];

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trim()}…` : t);
const one = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim();

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: authHeaders() });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export type ClientVoice = { text: string; found: { profile: boolean; questions: number; homework: number } };

export async function fetchClientVoice(presetId: number, name: string): Promise<ClientVoice> {
  const [profile, questions, homework] = await Promise.all([
    getJson<{ answers?: Record<string, string> }>(`/api/client-profiles/${encodeURIComponent(name)}`),
    getJson<{ question: string; answers: { answer: string; respondentName: string }[] }[]>("/api/client-questions"),
    getJson<{ replies: Record<string, unknown>[] }>("/api/homework/replies"),
  ]);
  const lines: string[] = [];

  const answers = profile?.answers ?? {};
  const aboutThem = PROFILE_PARTS.map((q) => (one(answers[q.id]) ? `${q.label}: ${clip(one(answers[q.id]), 220)}` : "")).filter(Boolean);
  if (aboutThem.length) lines.push(`ABOUT THEM, IN THEIR OWN WORDS: ${aboutThem.join(". ")}`);
  if (one(answers.never)) lines.push(`OFF LIMITS, NEVER WRITE ABOUT: ${clip(one(answers.never), 260)}`);

  // Client Question: things they have said in reply to the weekly question.
  const said: string[] = [];
  for (const q of Array.isArray(questions) ? questions : []) {
    for (const a of q.answers ?? []) {
      if (sameClientName(a.respondentName, name) && one(a.answer)) said.push(`${clip(one(q.question), 80)} Answer: ${clip(one(a.answer), 140)}`);
    }
  }
  if (said.length) lines.push(`THINGS THEY HAVE TOLD ME LATELY: ${said.slice(-4).join(" | ")}`);

  // Homework: the questions are on the set, the answers are on the reply. The replies come newest first.
  const hw: string[] = [];
  for (const r of (homework?.replies ?? []).filter((x) => x.presetId === presetId).slice(0, 2)) {
    const set = (r.set ?? {}) as Record<string, unknown>;
    for (let i = 1; i <= 10; i++) {
      const a = one(r[`answer${i}`]);
      const q = one(set[`question${i}`]);
      if (a && q) hw.push(`${clip(q, 70)} Answer: ${clip(a, 120)}`);
    }
  }
  if (hw.length) lines.push(`HOMEWORK THEY HANDED IN: ${hw.slice(0, 6).join(" | ")}`);

  return { text: lines.join("\n"), found: { profile: aboutThem.length > 0, questions: said.length, homework: hw.length } };
}
