import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cachedVideo } from "../src/video-files.ts";

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
