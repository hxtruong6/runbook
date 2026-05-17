// src/pages/useGallery.ts
import { useState, useEffect } from "react";
import type { ProjectBundle } from "../projects/types";

export interface GalleryEntry {
  slug: string;
  name: string;
  description: string;
  version: string;
  scenarioCount: number;
  blockCount: number;
  tags: string[];
  ogImage: string;
}

type IndexState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; entries: GalleryEntry[] };

type BundleState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; bundle: ProjectBundle };

export function useGalleryIndex(): IndexState {
  const [state, setState] = useState<IndexState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/gallery/index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: GalleryEntry[]) => {
        if (!cancelled) setState({ status: "loaded", entries: data });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useGalleryBundle(slug: string): BundleState {
  const [state, setState] = useState<BundleState>({ status: "loading" });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/gallery/${slug}.bundle.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ProjectBundle) => {
        if (!cancelled) setState({ status: "loaded", bundle: data });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}
