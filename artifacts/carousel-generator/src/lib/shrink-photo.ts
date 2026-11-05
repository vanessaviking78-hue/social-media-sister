// Phone photos can be 10MB or more, which is too big to upload on a mobile connection. This redraws a photo at a sensible size as a JPEG,
// keeping its orientation. If anything goes wrong it hands back the original so the upload still has a chance.
export async function shrinkPhoto(file: File, maxEdge = 2400, quality = 0.88): Promise<File> {
  try {
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) return file;
    let w = 0, h = 0;
    let src: CanvasImageSource;
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      w = bmp.width; h = bmp.height; src = bmp;
    } else {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("bad image")); i.src = url; });
      URL.revokeObjectURL(url);
      w = img.naturalWidth; h = img.naturalHeight; src = img;
    }
    if (!w || !h) return file;
    if (file.size < 1.5 * 1024 * 1024 && Math.max(w, h) <= maxEdge && file.type === "image/jpeg") return file;
    const s = Math.min(1, maxEdge / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    const g = c.getContext("2d");
    if (!g) return file;
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0, c.width, c.height);
    let q = quality;
    let blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
    while (blob && blob.size > 7 * 1024 * 1024 && q > 0.5) { q -= 0.1; blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q)); }
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
