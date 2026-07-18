"use client";

import { useEffect, useState } from "react";
import { CatalogTopic, listTopics } from "./api";

interface CatalogState {
  /** Topics advertised by the backend (empty until loaded / on failure). */
  topics: CatalogTopic[];
  /** True while the first fetch is in flight. */
  loading: boolean;
  /** True once a fetch has resolved (success or failure). */
  loaded: boolean;
}

/**
 * Fetches the backend's public topic catalog once on mount.
 *
 * The terminal uses this to showcase what's on the wire — quick-subscribe chips
 * are driven by the backend rather than a hard-coded list. If the backend is
 * unreachable the list stays empty and callers fall back to their own defaults.
 */
export function useTopicCatalog(): CatalogState {
  const [topics, setTopics] = useState<CatalogTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listTopics();
        if (!cancelled) setTopics(list);
      } catch {
        /* backend unreachable — leave empty so the UI can fall back */
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { topics, loading, loaded };
}
