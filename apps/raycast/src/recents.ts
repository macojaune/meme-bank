import { LocalStorage } from "@raycast/api";

const capacity = 8;

function prefix(catalog: string) {
  return `recent/v1/${new URL(catalog).origin}/`;
}

async function recentEntries(catalog: string) {
  const scope = prefix(catalog);
  const entries = Object.entries(await LocalStorage.allItems())
    .filter(([key, id]) => key.startsWith(scope) && typeof id === "string")
    .sort(([a], [b]) => b.localeCompare(a));

  const ids = new Set<string>();
  const expired: string[] = [];
  for (const [key, id] of entries) {
    if (ids.size < capacity && !ids.has(id)) {
      ids.add(id);
    } else {
      expired.push(key);
    }
  }
  return { ids: Array.from(ids), expired };
}

export async function readRecentIds(catalog: string): Promise<string[]> {
  return (await recentEntries(catalog)).ids;
}

export async function rememberVideo(catalog: string, id: string): Promise<void> {
  // Each use has its own key so overlapping actions cannot overwrite the list.
  const key = `${prefix(catalog)}${new Date().toISOString()}/${id}`;
  await LocalStorage.setItem(key, id);
  const { expired } = await recentEntries(catalog);
  await Promise.all(expired.map((oldKey) => LocalStorage.removeItem(oldKey)));
}
