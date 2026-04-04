import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface CalendarPost {
  id: number;
  date: string;
  clientName: string;
  postType: string;
  title: string;
  caption: string;
  notes: string;
  status: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

const BASE = import.meta.env.BASE_URL || "/";
const api = (path: string) => `${BASE}api${path}`;

export function useCalendar() {
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPosts = useCallback(async (from?: string, to?: string, client?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (client) params.set("client", client);
      const res = await fetch(`${api("/calendar")}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch calendar posts");
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load calendar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createPost = useCallback(async (post: Partial<CalendarPost>) => {
    const res = await fetch(api("/calendar"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      throw new Error(err.error);
    }
    const data = await res.json();
    setPosts((prev) => [...prev, data.post]);
    return data.post as CalendarPost;
  }, []);

  const updatePost = useCallback(async (id: number, updates: Partial<CalendarPost>) => {
    const res = await fetch(api(`/calendar/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      throw new Error(err.error);
    }
    const data = await res.json();
    setPosts((prev) => prev.map((p) => (p.id === id ? data.post : p)));
    return data.post as CalendarPost;
  }, []);

  const deletePost = useCallback(async (id: number) => {
    const res = await fetch(api(`/calendar/${id}`), { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      throw new Error(err.error);
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { posts, loading, fetchPosts, createPost, updatePost, deletePost };
}
