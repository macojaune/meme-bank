import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const MiB = 1024 * 1024;
const maxFileSize = 64 * MiB;
const day = 24 * 60 * 60 * 1000;

export interface VideoCachePreferences {
  cacheRetentionDays?: string;
  cacheSizeMiB?: string;
}

export function videoCachePolicy(preferences: VideoCachePreferences = {}) {
  const days = Number(preferences.cacheRetentionDays);
  const size = Number(preferences.cacheSizeMiB);
  return {
    maxAge: ([1, 7, 30].includes(days) ? days : 7) * day,
    maxCacheSize: ([128, 256, 512].includes(size) ? size : 256) * MiB,
  };
}

type CachePolicy = ReturnType<typeof videoCachePolicy>;
const types: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
  "video/x-m4v": ".m4v",
};
const inflight = new Map<string, Promise<string>>();

async function prune(
  directory: string,
  keep: string,
  { maxAge, maxCacheSize }: CachePolicy,
) {
  const entries = await Promise.all(
    (await readdir(directory)).map(async (name) => {
      const path = join(directory, name);
      const info = await stat(path).catch(() => undefined);
      return info?.isFile() ? { path, info } : undefined;
    }),
  );
  let bytes = (await stat(keep)).size;
  for (const entry of entries.sort(
    (a, b) => (b?.info.mtimeMs ?? 0) - (a?.info.mtimeMs ?? 0),
  )) {
    if (!entry || entry.path === keep) continue;
    const age = Date.now() - entry.info.mtimeMs;
    if (entry.path.endsWith(".part") && age < maxAge) continue;
    bytes += entry.info.size;
    if (age > maxAge || bytes > maxCacheSize) {
      await rm(entry.path, { force: true });
      bytes -= entry.info.size;
    }
  }
}

async function resolveFile(
  directory: string,
  url: string,
  headers: Record<string, string>,
  title: string,
  policy: CachePolicy,
) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const hash = createHash("sha256")
    .update(headers.Authorization || "")
    .update("\0")
    .update(url)
    .digest("hex")
    .slice(0, 16);
  const name =
    Array.from(
      title
        .normalize("NFC")
        .replace(/[^\p{L}\p{N} -]+/gu, " ")
        .trim(),
    )
      .slice(0, 45)
      .join("")
      .trim() || "MemeBank";
  const stem = name + "-" + hash;
  for (const extension of new Set(Object.values(types))) {
    const path = join(directory, stem + extension);
    const info = await stat(path).catch(() => undefined);
    if (info && info.size > 0 && Date.now() - info.mtimeMs <= policy.maxAge) {
      const now = new Date();
      // Track use for eviction. Published media are keyed by their asset URL.
      await utimes(path, now, now);
      await prune(directory, path, policy);
      return path;
    }
  }
  const response = await fetch(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok || !response.body)
    throw new Error(
      "Téléchargement impossible (HTTP " + response.status + ").",
    );
  const type = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  let extension = types[type];
  if (type === "application/octet-stream") {
    const suffix = extname(new URL(response.url).pathname).toLowerCase();
    if (suffix === ".ogg") extension = ".ogv";
    else if (Object.values(types).includes(suffix)) extension = suffix;
  }
  if (!extension) {
    await response.body.cancel();
    throw new Error("Le serveur n’a pas renvoyé un fichier vidéo reconnu.");
  }
  if (Number(response.headers.get("content-length")) > maxFileSize) {
    await response.body.cancel();
    throw new Error("La vidéo dépasse la limite de 64 Mio.");
  }
  const path = join(directory, stem + extension);
  const partial = join(directory, randomUUID() + ".part");
  try {
    let size = 0;
    const reader = response.body.getReader();
    await pipeline(
      async function* readVideo() {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) return;
            size += value.byteLength;
            if (size > maxFileSize)
              throw new Error("La vidéo dépasse la limite de 64 Mio.");
            yield value;
          }
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
      },
      createWriteStream(partial, { flags: "wx", mode: 0o600 }),
    );
    if (!size) throw new Error("Le fichier vidéo est vide.");
    await rename(partial, path);
    await prune(directory, path, policy);
    return path;
  } finally {
    await rm(partial, { force: true });
  }
}

export function cachedVideo(
  directory: string,
  url: string,
  headers: Record<string, string>,
  title = "MemeBank",
  policy = videoCachePolicy(),
) {
  const key = JSON.stringify([directory, url, headers.Authorization]);
  let pending = inflight.get(key);
  if (!pending) {
    pending = resolveFile(directory, url, headers, title, policy).finally(() =>
      inflight.delete(key),
    );
    inflight.set(key, pending);
  }
  return pending;
}
