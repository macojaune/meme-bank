import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  truncate,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cachedVideo, videoCachePolicy } from "../src/video-files.ts";

test("réutilise le fichier complet et nettoie les téléchargements rejetés", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "memebank-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let hits = 0;
  const server = createServer((request, response) => {
    hits++;
    if (request.url === "/expired") return response.writeHead(401).end();
    if (request.url === "/html")
      return response
        .writeHead(200, { "content-type": "text/html" })
        .end("login");
    if (request.url === "/oversize")
      return response
        .writeHead(200, {
          "content-type": "video/mp4",
          "content-length": 100 * 1024 * 1024,
        })
        .end();
    response
      .writeHead(200, { "content-type": "video/mp4" })
      .end(request.url === "/empty" ? "" : "sample");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.address().port;
  const get = (route) => cachedVideo(directory, base + route, {});
  const [first, second] = await Promise.all([get("/media"), get("/media")]);
  assert.equal(first, second);
  assert.match(first, /\.mp4$/);
  assert.equal(await readFile(first, "utf8"), "sample");
  assert.equal(await get("/media"), first);
  assert.equal(hits, 1);
  await utimes(first, new Date(0), new Date(0));
  await get("/other");
  await assert.rejects(readFile(first), { code: "ENOENT" });
  for (const route of ["/empty", "/html", "/expired", "/oversize"])
    await assert.rejects(get(route));
  assert.equal((await readdir(directory)).length, 1);
});

test("les préférences invalides ou absentes gardent sept jours et 256 Mio", () => {
  const defaults = { maxAge: 7 * 86400000, maxCacheSize: 256 * 1024 ** 2 };
  assert.deepEqual(videoCachePolicy(), defaults);
  assert.deepEqual(
    videoCachePolicy({ cacheRetentionDays: "-1", cacheSizeMiB: "Infinity" }),
    defaults,
  );
});

test("applique la durée à la dernière utilisation et libère les fichiers les moins récents", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "memebank-policy-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let downloads = 0;
  const server = createServer((_request, response) => {
    downloads++;
    response.writeHead(200, { "content-type": "video/mp4" }).end("video");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const url = "http://127.0.0.1:" + server.address().port + "/media";
  const get = (days, size) =>
    cachedVideo(
      directory,
      url,
      {},
      "Vidéo",
      videoCachePolicy({
        cacheRetentionDays: days,
        cacheSizeMiB: size,
      }),
    );
  const file = await get("7", "256");
  const twelveDaysAgo = new Date(Date.now() - 12 * 86400000);
  await utimes(file, twelveDaysAgo, twelveDaysAgo);
  assert.equal(await get("30", "512"), file);
  assert.equal(downloads, 1);
  assert.ok((await stat(file)).mtimeMs > twelveDaysAgo.valueOf());
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
  await utimes(file, twoDaysAgo, twoDaysAgo);
  assert.equal(await get("1", "128"), file);
  assert.equal(downloads, 2);

  // Sparse files exercise actual filesystem sizes without allocating hundreds of MiB.
  const earlier = new Date(Date.now() - 30000);
  const files = ["old.mp4", "recent.mp4"].map((name) => join(directory, name));
  for (const path of files) {
    await writeFile(path, "");
    await truncate(path, 64 * 1024 ** 2);
  }
  await utimes(files[0], earlier, earlier);
  await get("7", "256");
  assert.ok(await stat(files[0]));
  await get("7", "128");
  await assert.rejects(stat(files[0]), { code: "ENOENT" });
  assert.ok(await stat(files[1]));
  assert.equal(downloads, 2);
});
