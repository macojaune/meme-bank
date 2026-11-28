import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorizationFor } from "./auth";
import { cachedVideo } from "./video-files";

export function getVideoFile(mediaUrl: string, title: string): Promise<string> {
  return cachedVideo(
    join(tmpdir(), "com.memebank.raycast", "videos"),
    mediaUrl,
    authorizationFor(mediaUrl),
    title,
  );
}
