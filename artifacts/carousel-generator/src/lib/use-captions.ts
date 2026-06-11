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
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Failed to load captions" }));
        throw new Error(data.error || "Failed to load captions");
      }
      const data = await resp.json();
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
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: "Failed to save caption" }));
      throw new Error(data.error || "Failed to save caption");
    }
    const data = await resp.json();
    setCaptions((prev) => [data.caption, ...prev]);
    return data.caption as SavedCaption;
  };

  const bulkSave = async (items: { text: string; category?: string; clientName?: string }[]) => {
    const resp = await fetch(`${BASE}api/captions/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captions: items }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: "Failed to save captions" }));
      throw new Error(data.error || "Failed to save captions");
    }
    const data = await resp.json();
    setCaptions((prev) => [...data.captions, ...prev]);
    return data.captions as SavedCaption[];
  };

  const updateCaption = async (id: number, updates: Partial<Pick<SavedCaption, "text" | "category" | "clientName" | "favourite">>) => {
    const resp = await fetch(`${BASE}api/captions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: "Failed to update caption" }));
      throw new Error(data.error || "Failed to update caption");
    }
    const data = await resp.json();
    setCaptions((prev) => prev.map((c) => (c.id === id ? data.caption : c)));
    return data.caption as SavedCaption;
  };

  const deleteCaption = async (id: number) => {
    const resp = await fetch(`${BASE}api/captions/${id}`, { method: "DELETE" });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: "Failed to delete caption" }));
      throw new Error(data.error || "Failed to delete caption");
    }
    const data = await resp.json();
    setCaptions((prev) => prev.filter((c) => c.id !== id));
  };

  return { captions, loading, fetchCaptions, saveCaption, bulkSave, updateCaption, deleteCaption };
}
