// src/blocks/localBlocksStore.ts
import { BlockDefDataSchema, type BlockDefData } from "./dataBlock";
import { z } from "zod";

const KEY = "runbook:local-blocks";

const LocalBlocksSchema = z.array(BlockDefDataSchema);

export function loadLocalBlocks(): BlockDefData[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const result = LocalBlocksSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function saveLocalBlocks(blocks: BlockDefData[]): void {
  localStorage.setItem(KEY, JSON.stringify(blocks));
}

export function upsertLocalBlock(block: BlockDefData): void {
  const all = loadLocalBlocks();
  const idx = all.findIndex((b) => b.kind === block.kind);
  if (idx >= 0) all[idx] = block;
  else all.push(block);
  saveLocalBlocks(all);
}

export function deleteLocalBlock(kind: string): void {
  saveLocalBlocks(loadLocalBlocks().filter((b) => b.kind !== kind));
}
