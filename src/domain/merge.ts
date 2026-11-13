/**
 * Datei-Abgleich zwischen Geräten: Zusammenführen pro Datensatz.
 * Regel: Der Datensatz mit dem neueren `updatedAt` gewinnt (bei Gleichstand der lokale).
 * Löschungen reisen als Tombstones (`deleted = 1`) mit und gewinnen, wenn sie neuer sind.
 */
import type { Base } from '../db/types';

export interface MergeStats {
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

export interface MergeResult<T extends Base> {
  toPut: T[];
  stats: MergeStats;
}

export function mergeRecords<T extends Base>(local: T[], incoming: T[]): MergeResult<T> {
  const byId = new Map(local.map((r) => [r.id, r]));
  const toPut: T[] = [];
  const stats: MergeStats = { added: 0, updated: 0, deleted: 0, unchanged: 0 };

  for (const inc of incoming) {
    if (!inc || typeof inc.id !== 'string') continue;
    const cur = byId.get(inc.id);
    if (cur && (cur.updatedAt ?? 0) >= (inc.updatedAt ?? 0)) {
      stats.unchanged++;
      continue;
    }
    toPut.push(inc);
    if (inc.deleted) {
      if (cur && !cur.deleted) stats.deleted++;
      else stats.unchanged++; // Tombstone für etwas, das es hier nie gab bzw. schon gelöscht war
    } else if (!cur || cur.deleted) stats.added++;
    else stats.updated++;
  }
  return { toPut, stats };
}

export const sumStats = (list: MergeStats[]): MergeStats =>
  list.reduce(
    (a, s) => ({
      added: a.added + s.added,
      updated: a.updated + s.updated,
      deleted: a.deleted + s.deleted,
      unchanged: a.unchanged + s.unchanged,
    }),
    { added: 0, updated: 0, deleted: 0, unchanged: 0 },
  );

// ---------------------------------------------------------------- Blobs in JSON

interface EncodedBlob {
  __blob: string;
  data: string;
}

const isEncodedBlob = (v: unknown): v is EncodedBlob =>
  !!v && typeof v === 'object' && typeof (v as EncodedBlob).__blob === 'string' && typeof (v as EncodedBlob).data === 'string';

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Ersetzt Blob-Felder (eine Ebene tief) durch Base64, damit der Datensatz in JSON passt. */
export async function encodeRecord<T extends object>(record: T): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = v instanceof Blob ? ({ __blob: v.type || 'application/octet-stream', data: await blobToBase64(v) } satisfies EncodedBlob) : v;
  }
  return out;
}

export function decodeRecord<T>(record: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) out[k] = isEncodedBlob(v) ? base64ToBlob(v.data, v.__blob) : v;
  return out as T;
}
