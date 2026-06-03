import { useState, useEffect, useCallback } from "react";
import { CORNER_STYLES } from "@workspace/db/schema";
import type { TextAlign, LogoPosition, CornerStyle } from "@workspace/db/schema";

export type { CornerStyle };

export function isCornerStyle(value: string): value is CornerStyle {
  return (CORNER_STYLES as readonly string[]).includes(value);
}

export type { TextAlign };
export type TextPosition = "top" | "center" | "bottom";

export function normalizeTextPosition(raw: string | undefined | null): TextPosition {
  if (!raw) return "bottom";
  const vPos = raw.split("-")[0];
  if (vPos === "top") return "top";
  if (vPos === "center") return "center";
  return "bottom";
}

export interface ClientPreset {
  id: number;
  name: string;
  pageColor: string;
  overlayColor: string;
  fontFamily: string;
  subheadingFont: string | null;
  fontSize: number;
  contentFontSize: number;
  textColor: string;
  lineSpacing: string;
  cornerStyle: CornerStyle;
  cornerColor: string;
  textPosition: TextPosition;
  logoPosition: LogoPosition;
  logoSize: number;
  logoUrl: string | null;
  accentColor: string;
  ccWorkspaceId: string | null;
  metaPageAccessToken: string | null;
  metaFacebookPageId: string | null;
  metaInstagramAccountId: string | null;
  textAlign: TextAlign;
  textBoxOutline: boolean;
  textBoxOutlineColor: string;
  captionFootnote: string;
  coverSubheading: string;
  clientPortalToken: string | null;
  defaultPostTime: string;
  defaultFirstCommentCarousel: string | null;
  defaultFirstCommentSingle: string | null;
  defaultFirstCommentReel: string | null;
  onboardingConnectedAt: string | null;
  voiceStyle: string;
  targetAudience: string | null;
  contentPillars: string | null;
  brandNotes: string | null;
}

export interface PresetStyleFields {
  pageColor: string;
  overlayColor: string;
  fontFamily: string;
  subheadingFont: string;
  fontSize: number;
  contentFontSize: number;
  textColor: string;
  lineSpacing: number;
  cornerStyle: CornerStyle;
  cornerColor: string;
  textPosition: TextPosition;
  textAlign: TextAlign;
  textBoxOutline: boolean;
  textBoxOutlineColor: string;
  logoPosition: LogoPosition;
  logoSize: number;
  accentColor?: string;
  coverSubheading?: string;
}

export function usePresets() {
  const [presets, setPresets] = useState<ClientPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = useCallback(async () => {
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/presets`);
      if (!resp.ok) throw new Error("Failed to fetch");
      const data = await resp.json();
      const normalized: ClientPreset[] = (data.presets || [])
        .map((p: ClientPreset & { textPosition: string }) => ({
          ...p,
          textPosition: normalizeTextPosition(p.textPosition),
          defaultPostTime: p.defaultPostTime || "18:00",
        }))
        .sort((a: ClientPreset, b: ClientPreset) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      setPresets(normalized);
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

  const savePreset = useCallback(async (name: string, styles: PresetStyleFields, ccWorkspaceId?: string, logoUrl?: string | null, captionFootnote?: string, personalityFields?: { voiceStyle?: string; targetAudience?: string | null; contentPillars?: string | null; brandNotes?: string | null }) => {
    const body = {
      name,
      ...styles,
      lineSpacing: String(styles.lineSpacing),
      ccWorkspaceId: ccWorkspaceId || null,
      logoUrl: logoUrl || null,
      captionFootnote: captionFootnote || "",
      ...(personalityFields || {}),
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

  const updatePreset = useCallback(async (
    id: number,
    name: string,
    styles: PresetStyleFields,
    ccWorkspaceId?: string,
    logoUrl?: string | null,
    captionFootnote?: string,
    metaFields?: { metaPageAccessToken?: string | null; metaFacebookPageId?: string | null; metaInstagramAccountId?: string | null },
    extra?: { defaultPostTime?: string; defaultFirstCommentCarousel?: string | null; defaultFirstCommentSingle?: string | null; defaultFirstCommentReel?: string | null; voiceStyle?: string; targetAudience?: string | null; contentPillars?: string | null; brandNotes?: string | null },
  ) => {
    const body = {
      name,
      ...styles,
      lineSpacing: String(styles.lineSpacing),
      ccWorkspaceId: ccWorkspaceId || null,
      logoUrl: logoUrl || null,
      captionFootnote: captionFootnote ?? "",
      ...(metaFields || {}),
      ...(extra || {}),
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
