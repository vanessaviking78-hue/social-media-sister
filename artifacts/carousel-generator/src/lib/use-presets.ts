import { useState, useEffect, useCallback } from "react";

export interface ClientPreset {
  id: number;
  name: string;
  pageColor: string;
  overlayColor: string;
  fontFamily: string;
  subheadingFont: string | null;
  fontSize: number;
  textColor: string;
  lineSpacing: string;
  cornerStyle: string;
  cornerColor: string;
  textPosition: string;
  logoPosition: string;
  logoSize: number;
  logoUrl: string | null;
  accentColor: string;
  ccWorkspaceId: string | null;
  captionFootnote: string;
}

export interface PresetStyleFields {
  pageColor: string;
  overlayColor: string;
  fontFamily: string;
  subheadingFont: string;
  fontSize: number;
  textColor: string;
  lineSpacing: number;
  cornerStyle: string;
  cornerColor: string;
  textPosition: string;
  logoPosition: string;
  logoSize: number;
  accentColor?: string;
}

export function usePresets() {
  const [presets, setPresets] = useState<ClientPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = useCallback(async () => {
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/presets`);
      if (!resp.ok) throw new Error("Failed to fetch");
      const data = await resp.json();
      setPresets(data.presets || []);
    } catch (err) {
      console.error("Failed to fetch presets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const uploadLogo = useCallback(async (file: File): Promise<string> => {
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const resp = await fetch(`${import.meta.env.BASE_URL}api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ name: `logo-${Date.now()}.png`, base64 }] }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Logo upload failed");
    return data.results?.[0]?.url || "";
  }, []);

  const savePreset = useCallback(async (name: string, styles: PresetStyleFields, ccWorkspaceId?: string, logoUrl?: string | null, captionFootnote?: string) => {
    const body = {
      name,
      ...styles,
      lineSpacing: String(styles.lineSpacing),
      ccWorkspaceId: ccWorkspaceId || null,
      logoUrl: logoUrl || null,
      captionFootnote: captionFootnote || "",
    };
    const resp = await fetch(`${import.meta.env.BASE_URL}api/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || "Failed to save preset");
    }
    const data = await resp.json();
    await fetchPresets();
    return data.preset as ClientPreset;
  }, [fetchPresets]);

  const updatePreset = useCallback(async (id: number, name: string, styles: PresetStyleFields, ccWorkspaceId?: string, logoUrl?: string | null, captionFootnote?: string) => {
    const body = {
      name,
      ...styles,
      lineSpacing: String(styles.lineSpacing),
      ccWorkspaceId: ccWorkspaceId || null,
      logoUrl: logoUrl || null,
      captionFootnote: captionFootnote ?? "",
    };
    const resp = await fetch(`${import.meta.env.BASE_URL}api/presets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update preset");
    }
    const data = await resp.json();
    await fetchPresets();
    return data.preset as ClientPreset;
  }, [fetchPresets]);

  const deletePreset = useCallback(async (id: number) => {
    const resp = await fetch(`${import.meta.env.BASE_URL}api/presets/${id}`, { method: "DELETE" });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || "Failed to delete preset");
    }
    await fetchPresets();
  }, [fetchPresets]);

  return { presets, loading, fetchPresets, savePreset, updatePreset, deletePreset, uploadLogo };
}
