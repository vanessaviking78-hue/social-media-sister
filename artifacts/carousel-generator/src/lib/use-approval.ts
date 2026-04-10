import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export function authHeaders(): Record<string, string> {
  const pw = sessionStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, "Authorization": `Bearer ${pw}` };
}

export interface ApprovalBatch {
  id: number;
  name: string;
  clientName: string;
  presetId: number | null;
  token: string;
  expiresAt: string | null;
  status: string;
  createdAt: string;
  imageCount: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface ApprovalImage {
  id: number;
  batchId: number;
  imageUrl: string;
  status: string;
  clientNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalBatchDetail extends Omit<ApprovalBatch, "imageCount" | "approved" | "rejected" | "pending"> {
  images: ApprovalImage[];
}

export function useApprovalBatches() {
  const qc = useQueryClient();

  const { data: batches = [], isLoading } = useQuery<ApprovalBatch[]>({
    queryKey: ["approval-batches"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/approval/batches`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load batches");
      return res.json();
    },
  });

  const createBatch = useMutation({
    mutationFn: async (data: { name: string; clientName: string; presetId?: number; imageUrls: string[]; expiryDays?: number }) => {
      const res = await fetch(`${BASE}api/approval/batches`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create batch");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval-batches"] }),
  });

  const deleteBatch = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}api/approval/batches/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to delete batch");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval-batches"] }),
  });

  return { batches, isLoading, createBatch, deleteBatch };
}

export function useApprovalBatchDetail(id: number | null) {
  return useQuery<ApprovalBatchDetail>({
    queryKey: ["approval-batch-detail", id],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/approval/batches/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load batch");
      return res.json();
    },
    enabled: id !== null,
  });
}

export function usePublicApproval(token: string) {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<{ name: string; clientName: string; status: string; images: ApprovalImage[] }>({
    queryKey: ["approval-public", token],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/approval/public/${token}`);
      if (res.status === 410) throw new Error("expired");
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    retry: false,
  });

  const updateImage = useMutation({
    mutationFn: async ({ imageId, status, clientNote }: { imageId: number; status: "approved" | "rejected"; clientNote?: string }) => {
      const res = await fetch(`${BASE}api/approval/public/${token}/images/${imageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, clientNote }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval-public", token] }),
  });

  return { data, isLoading, error, updateImage };
}

export function useApprovedImages(clientName: string) {
  return useQuery<{ id: number; imageUrl: string; batchName: string; clientName: string }[]>({
    queryKey: ["approved-images", clientName],
    queryFn: async () => {
      const params = clientName ? `?clientName=${encodeURIComponent(clientName)}` : "";
      const res = await fetch(`${BASE}api/approval/approved-images${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load approved images");
      return res.json();
    },
  });
}
