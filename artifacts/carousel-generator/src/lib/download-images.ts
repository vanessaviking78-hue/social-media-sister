import JSZip from "jszip";
import { saveAs } from "file-saver";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type DownloadItem = { name: string; url?: string; blob?: Blob };

function extFor(type: string, url?: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("mp4")) return "mp4";
  const m = url?.split("?")[0].match(/\.(png|jpe?g|webp|mp4)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "png";
}

// Puts every image (and any video) into one ZIP and saves it. Items can be a blob already in the
// browser or a server address, which is fetched first.
export async function downloadAllImages(items: DownloadItem[], zipName: string): Promise<number> {
  const zip = new JSZip();
  let added = 0;
  for (const it of items) {
    let blob = it.blob;
    if (!blob && it.url) {
      const r = await fetch(it.url.startsWith("/") ? `${BASE}${it.url}` : it.url);
      if (!r.ok) continue;
      blob = await r.blob();
    }
    if (!blob) continue;
    zip.file(`${it.name}.${extFor(blob.type, it.url)}`, blob);
    added++;
  }
  if (!added) throw new Error("There were no images to download");
  saveAs(await zip.generateAsync({ type: "blob" }), `${zipName}.zip`);
  return added;
}
