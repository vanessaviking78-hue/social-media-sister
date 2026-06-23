import type { File } from "@google-cloud/storage";
import { Readable, PassThrough } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// ---------------------------------------------------------------------------
// Storage now runs on ImageKit instead of Replit's object storage.
//
// Why: the old code logged in through a Replit-only "sidecar" that does not
// exist on Railway, which is what threw the
// "DEFAULT_OBJECT_STORAGE_BUCKET_ID not set" / storage errors.
//
// This file keeps the SAME shape the rest of the app already calls, i.e.
//   objectStorageClient.bucket(id).file(key).save(buffer, ...)
//   objectStorageClient.bucket(id).file(key).download()
//   objectStorageClient.bucket(id).file(key).createReadStream()
// so none of the other files needed changing. Underneath, it talks to ImageKit
// over its normal REST API (no extra npm package needed).
//
// Set these in Railway > Variables:
//   IMAGEKIT_PRIVATE_KEY   = your ImageKit private key (starts with private_)
//   IMAGEKIT_URL_ENDPOINT  = your ImageKit URL endpoint, e.g.
//                            https://ik.imagekit.io/yourid
//   DEFAULT_OBJECT_STORAGE_BUCKET_ID = imagekit   (any non-empty value; it is
//                            only used to satisfy old checks, ImageKit has no
//                            bucket id)
// ---------------------------------------------------------------------------

const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

function getPrivateKey(): string {
  const key = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "IMAGEKIT_PRIVATE_KEY not set. Add your ImageKit private key in " +
        "Railway > Variables."
    );
  }
  return key;
}

function getUrlEndpoint(): string {
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "IMAGEKIT_URL_ENDPOINT not set. Add your ImageKit URL endpoint " +
        "(e.g. https://ik.imagekit.io/yourid) in Railway > Variables."
    );
  }
  return endpoint.replace(/\/+$/, "");
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${getPrivateKey()}:`).toString("base64")}`;
}

// Turns an object key like "ai-portraits/source/<uuid>/source.jpg" into the
// folder + file name ImageKit expects, while keeping the public URL exactly
// "<endpoint>/<key>" so downloads by key stay predictable.
function splitKey(key: string): { folder: string; fileName: string } {
  const clean = key.replace(/^\/+/, "");
  const idx = clean.lastIndexOf("/");
  if (idx === -1) {
    return { folder: "/", fileName: clean };
  }
  return { folder: "/" + clean.slice(0, idx), fileName: clean.slice(idx + 1) };
}

function publicUrlForKey(key: string): string {
  return `${getUrlEndpoint()}/${key.replace(/^\/+/, "")}`;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// A stand-in for a Google Cloud Storage "File", backed by ImageKit. It only
// implements the bits the app actually uses.
class ImageKitFile {
  constructor(public readonly name: string) {}

  private url(): string {
    return publicUrlForKey(this.name);
  }

  async save(
    buffer: Buffer,
    opts?: { contentType?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const { folder, fileName } = splitKey(this.name);
    const contentType = opts?.contentType || "application/octet-stream";

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: contentType }), fileName);
    form.append("fileName", fileName);
    if (folder && folder !== "/") form.append("folder", folder);
    form.append("useUniqueFileName", "false");
    form.append("overwriteFile", "true");

    const res = await fetch(IMAGEKIT_UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: authHeader() },
      body: form as any,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `ImageKit upload failed for ${this.name}: ${res.status} ${body}`
      );
    }
  }

  async download(): Promise<[Buffer]> {
    const res = await fetch(this.url());
    if (res.status === 404) throw new ObjectNotFoundError();
    if (!res.ok) {
      throw new Error(`Failed to download ${this.name}: ${res.status}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return [Buffer.from(arrayBuf)];
  }

  createReadStream(): Readable {
    const pass = new PassThrough();
    (async () => {
      try {
        const res = await fetch(this.url());
        if (!res.ok || !res.body) {
          pass.destroy(new ObjectNotFoundError());
          return;
        }
        const nodeStream = Readable.fromWeb(res.body as any);
        nodeStream.on("error", (e) => pass.destroy(e));
        nodeStream.pipe(pass);
      } catch (e) {
        pass.destroy(e as Error);
      }
    })();
    return pass;
  }

  async exists(): Promise<[boolean]> {
    try {
      let res = await fetch(this.url(), { method: "HEAD" });
      if (res.status === 405 || res.status === 501) {
        // Some CDNs don't allow HEAD; fall back to a normal GET.
        res = await fetch(this.url());
      }
      return [res.ok];
    } catch {
      return [false];
    }
  }

  async getMetadata(): Promise<[Record<string, any>]> {
    const res = await fetch(this.url(), { method: "HEAD" });
    if (!res.ok) {
      return [{}];
    }
    return [
      {
        contentType: res.headers.get("content-type") || undefined,
        size: res.headers.get("content-length") || undefined,
        // ACL custom metadata isn't stored on ImageKit; treated as absent.
        metadata: {},
      },
    ];
  }

  // ACL policies were stored as GCS custom metadata. ImageKit doesn't support
  // that here, so this is a safe no-op. Access is gated by the app's own routes.
  async setMetadata(_meta: Record<string, unknown>): Promise<void> {
    return;
  }

  async getSignedUrl(opts: {
    action?: string;
    version?: string;
    expires?: number;
  }): Promise<[string]> {
    // Reads use the public URL. (Writes go through save(), not signed URLs.)
    if (opts.action && opts.action !== "read") {
      throw new Error(
        "Signed write/upload URLs are not supported on ImageKit storage. " +
          "Uploads happen server-side via save()."
      );
    }
    return [this.url()];
  }
}

class ImageKitBucket {
  constructor(public readonly name: string) {}
  file(key: string): File {
    return new ImageKitFile(key) as unknown as File;
  }
}

export const objectStorageClient = {
  bucket(name: string): ImageKitBucket {
    return new ImageKitBucket(name);
  },
};

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Set it to a comma-separated list " +
          "of paths, e.g. /public"
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Set it to a path, e.g. /.private"
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const key = `${searchPath}/${filePath}`.replace(/^\/+/, "");
      const file = new ImageKitFile(key);
      const [exists] = await file.exists();
      if (exists) {
        return file as unknown as File;
      }
    }
    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await (file as any).getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = (file as any).createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    // The old presigned-PUT upload flow isn't available on ImageKit. Uploads
    // are handled server-side (multer -> save()). If you still need the generic
    // "request upload URL" widget, route those uploads through the server.
    throw new Error(
      "Direct presigned uploads are not supported on ImageKit storage. " +
        "Upload files through the server (it already does this for the photo " +
        "studio and other tools)."
    );
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }
    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const key = `${entityDir}${entityId}`.replace(/^\/+/, "");
    const file = new ImageKitFile(key);
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return file as unknown as File;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    const endpoint = process.env.IMAGEKIT_URL_ENDPOINT
      ? process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/+$/, "")
      : "";
    if (endpoint && rawPath.startsWith(endpoint)) {
      const key = rawPath.slice(endpoint.length).replace(/^\/+/, "");
      let dir = this.getPrivateObjectDir().replace(/^\/+/, "");
      if (!dir.endsWith("/")) dir = `${dir}/`;
      if (key.startsWith(dir)) {
        return `/objects/${key.slice(dir.length)}`;
      }
      return `/${key}`;
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

// Used by the /api/media/<key> route to hand the browser a working image URL.
// On ImageKit that's simply the public URL for the key.
export async function signObjectURL({
  bucketName: _bucketName,
  objectName,
  method,
  ttlSec: _ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  if (method !== "GET" && method !== "HEAD") {
    throw new Error(
      `signObjectURL only supports reads on ImageKit storage (got ${method}).`
    );
  }
  return publicUrlForKey(objectName);
}
