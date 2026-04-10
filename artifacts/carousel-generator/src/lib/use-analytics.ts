import { useState, useCallback } from "react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL || "/";
const api = (path: string) => `${BASE}api${path}`;

export interface AnalyticsSummary {
  totalActions: number;
  totalGenerated: number;
  totalDownloaded: number;
  totalPushed: number;
  totalCarousels: number;
  totalSingleImages: number;
  totalStories: number;
  totalPosts: number;
  totalSlides: number;
  monthActions: number;
  monthDownloads: number;
}

export interface ClientStat {
  clientName: string;
  total: number;
  posts: number;
  generated: number;
  downloaded: number;
}

export interface OverTimePoint {
  period: string;
  total: number;
  posts: number;
}

export interface TypeStat {
  postType: string;
  total: number;
  posts: number;
}

export interface RecentActivity {
  id: number;
  action: string;
  postType: string;
  clientName: string;
  slideCount: number;
  postCount: number;
  createdAt: string;
}

export function useAnalytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [clients, setClients] = useState<ClientStat[]>([]);
  const [overTime, setOverTime] = useState<OverTimePoint[]>([]);
  const [byType, setByType] = useState<TypeStat[]>([]);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(api("/analytics/summary"));
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      setSummary(data.summary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load summary";
      toast.error(message);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(api("/analytics/by-client"));
      if (!res.ok) throw new Error("Failed to fetch client data");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load client data";
      toast.error(message);
    }
  }, []);

  const fetchOverTime = useCallback(async (group: "week" | "month" = "month") => {
    try {
      const res = await fetch(api(`/analytics/over-time?group=${group}`));
      if (!res.ok) throw new Error("Failed to fetch over-time data");
      const data = await res.json();
      setOverTime(data.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load time data";
      toast.error(message);
    }
  }, []);

  const fetchByType = useCallback(async () => {
    try {
      const res = await fetch(api("/analytics/by-type"));
      if (!res.ok) throw new Error("Failed to fetch type data");
      const data = await res.json();
      setByType(data.types || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load type data";
      toast.error(message);
    }
  }, []);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch(api("/analytics/recent"));
      if (!res.ok) throw new Error("Failed to fetch recent activity");
      const data = await res.json();
      setRecent(data.recent || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load recent activity";
      toast.error(message);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSummary(), fetchClients(), fetchOverTime(), fetchByType(), fetchRecent()]);
    setLoading(false);
  }, [fetchSummary, fetchClients, fetchOverTime, fetchByType, fetchRecent]);

  const logActivity = useCallback(async (params: {
    action: string;
    postType: string;
    clientName?: string;
    slideCount?: number;
    postCount?: number;
  }) => {
    try {
      await fetch(api("/analytics/log"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
    } catch {}
  }, []);

  return { summary, clients, overTime, byType, recent, loading, fetchAll, fetchOverTime, logActivity };
}
