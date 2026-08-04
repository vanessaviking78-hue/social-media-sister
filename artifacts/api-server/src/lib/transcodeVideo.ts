import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { logger } from "./logger";

// Third-party video generation APIs (Fal.ai WAN, Google Veo) are trusted to
// return "video/mp4", but have been observed in practice to hand back other
// containers (e.g. WebM) that then get silently mislabeled as MP4 when saved
// to storage. This re-encodes whatever bytes we actually receive into a real
// H.264 / AAC MP4 (with faststart for streaming/playback), so downloads and
// scheduled posts to Meta always get a genuinely valid MP4 file.
export async function transcodeToMp4(buf: Buffer): Promise<Buffer> {
  const inPath = join(tmpdir(), `transcode-in-${randomUUID()}`);
  const outPath = join(tmpdir(), `transcode-out-${randomUUID()}.mp4`);
  try {
    await writeFile(inPath, buf);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inPath,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", "128k",
        "-y",
        outPath,
      ]);
      let stderr = "";
      ffmpeg.stderr.on("data", (d) => { stderr += d.toString(); });
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg transcode exited with code ${code}: ${stderr.slice(-500)}`));
      });
      ffmpeg.on("error", reject);
    });
    return await readFile(outPath);
  } catch (err) {
    logger.error({ err }, "transcodeToMp4 failed — falling back to original bytes");
    return buf;
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
