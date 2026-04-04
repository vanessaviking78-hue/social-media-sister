import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export interface SavedCaption {
  id: number;
  text: string;
  category: string;
  clientName: string;
  favourite: boolean;
  createdAt: string;
  updatedAt: string;
}

const BASE = import.meta.env.BASE_URL;

export function useCaptions() {
  const [captions, setCaptions] = useState<SavedCaption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCaptions = useCallback(async (search?: string, category?: string, client?: string) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (client) params.set("client", client);
      const qs = params.toString();
      const resp = await fetch(`${BASE}api/captions${qs ? `?${qs}` : ""}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setCaptions(data.captions || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load captions";
      console.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCaptions(); }, [fetchCaptions]);

  const saveCaption = async (text: string, category?: string, clientName?: string) => {
    const resp = await fetch(`${BASE}api/captions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, category, clientName }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);
    setCaptions((prev) => [data.caption, ...prev]);
    return data.caption as SavedCaption;
  };

  const bulkSave = async (items: { text: string; category?: string; clientName?: string }[]) => {
    const resp = await fetch(`${BASE}api/captions/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captions: items }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);
    setCaptions((prev) => [...data.captions, ...prev]);
    return data.captions as SavedCaption[];
  };

  const updateCaption = async (id: number, updates: Partial<Pick<SavedCaption, "text" | "category" | "clientName" | "favourite">>) => {
    const resp = await fetch(`${BASE}api/captions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);
    setCaptions((prev) => prev.map((c) => (c.id === id ? data.caption : c)));
    return data.caption as SavedCaption;
  };

  const deleteCaption = async (id: number) => {
    const resp = await fetch(`${BASE}api/captions/${id}`, { method: "DELETE" });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);
    setCaptions((prev) => prev.filter((c) => c.id !== id));
  };

  return { captions, loading, fetchCaptions, saveCaption, bulkSave, updateCaption, deleteCaption };
}
