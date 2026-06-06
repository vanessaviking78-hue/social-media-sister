const STORAGE_KEY = "cybersuite-brand";

export interface BrandDefaults {
  logoDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  subheadingFont: string;
}

const FACTORY: BrandDefaults = {
  logoDataUrl: null,
  primaryColor: "#000000",
  secondaryColor: "#ffffff",
  fontFamily: "'Bebas Neue', sans-serif",
  subheadingFont: "'Bebas Neue', sans-serif",
};

export function getBrandDefaults(): BrandDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return FACTORY;
    return { ...FACTORY, ...JSON.parse(raw) };
  } catch {
    return FACTORY;
  }
}

export function setBrandDefaults(d: BrandDefaults): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

export function clearBrandDefaults(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasBrandDefaults(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export async function compressLogoToDataUrl(file: File, maxW = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
    img.src = objectUrl;
  });
}
