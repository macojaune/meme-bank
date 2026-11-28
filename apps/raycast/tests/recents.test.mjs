import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Raycast provides this module only while a command is running.
const storageModule = `
const entries = new Map();
export const LocalStorage = {
  allItems: async () => Object.fromEntries(entries),
  setItem: async (key, value) => entries.set(key, value),
  removeItem: async (key) => entries.delete(key),
};
`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@raycast/api") {
      return { url: "data:text/javascript," + encodeURIComponent(storageModule), shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { readRecentIds, rememberVideo } = await import("../src/recents.ts");

test("keeps eight unique uses per instance and moves a reused video to the top", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) });
  const catalog = "https://dev.example";
  for (let i = 0; i < 10; i++) {
    await rememberVideo(catalog, String(i));
    t.mock.timers.tick(1000);
  }
  await rememberVideo(catalog, "3");
  await rememberVideo("https://other.example", "4");
  assert.deepEqual(await readRecentIds(catalog), ["3", "9", "8", "7", "6", "5", "4", "2"]);
  assert.deepEqual(await readRecentIds("https://other.example"), ["4"]);
});
