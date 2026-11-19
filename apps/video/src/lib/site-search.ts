// Site search for the nav panel: a small in-memory index of models, features,
// templates and pages, matched in either language.

export type SearchTab = "all" | "models" | "features" | "templates" | "pages";

export type SearchEntry<Icon = unknown> = {
  id: string;
  tab: Exclude<SearchTab, "all">;
  /** Heading the entry is listed under, e.g. "视频模型". */
  section: string;
  title: string;
  desc: string;
  /** Other names that should find it: the other language's title, ids, tags. */
  keywords?: string[];
  /** Omitted for features that are not live yet. */
  href?: string;
  badge?: "hot" | "new";
  tag?: string;
  soon?: boolean;
  icon?: Icon;
  image?: string;
};

export type SearchSection<Icon = unknown> = { section: string; items: SearchEntry<Icon>[] };

/** Lower-case and drop spaces and punctuation, so "gpt-image 2.6" finds "GPT Image 2.6". */
export function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\-_.,，。·/:：()（）]+/g, "");
}

/** How well an entry matches; 0 when it does not. */
export function scoreEntry(entry: SearchEntry, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(entry.title);
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  const keywords = (entry.keywords ?? []).map(normalize);
  if (keywords.some((word) => word.startsWith(q))) return 50;
  if (keywords.some((word) => word.includes(q))) return 40;
  if (normalize(entry.desc).includes(q)) return 20;
  // Every word of a multi-word query somewhere in the entry.
  const words = query.toLowerCase().split(/\s+/).map(normalize).filter(Boolean);
  if (words.length > 1) {
    const haystack = [title, normalize(entry.desc), ...keywords].join(" ");
    if (words.every((word) => haystack.includes(word))) return 10;
  }
  return 0;
}

/**
 * Matching entries grouped by section, in the index's section order, best
 * matches first within each section. Live entries rank above coming-soon ones.
 */
export function searchSite<Icon>(
  entries: SearchEntry<Icon>[],
  query: string,
  tab: SearchTab = "all",
  perSection = 8,
): SearchSection<Icon>[] {
  const order: string[] = [];
  const buckets = new Map<string, { entry: SearchEntry<Icon>; score: number; index: number }[]>();
  entries.forEach((entry, index) => {
    if (tab !== "all" && entry.tab !== tab) return;
    const score = scoreEntry(entry, query);
    if (score === 0) return;
    if (!buckets.has(entry.section)) {
      buckets.set(entry.section, []);
      order.push(entry.section);
    }
    buckets.get(entry.section)?.push({ entry, score: score - (entry.href && !entry.soon ? 0 : 5), index });
  });
  return order.map((section) => ({
    section,
    items: (buckets.get(section) ?? [])
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, perSection)
      .map((item) => item.entry),
  }));
}

const RECENT_KEY = "aivd:recent-searches";

export function readRecentSearches(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

/** Remember a query, newest first, without duplicates, at most five. */
export function rememberSearch(query: string): string[] {
  const text = query.trim();
  if (!text) return readRecentSearches();
  const next = [text, ...readRecentSearches().filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(0, 5);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode: recent searches just are not kept.
  }
  return next;
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Nothing to clear.
  }
}
