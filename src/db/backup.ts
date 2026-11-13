/**
 * Backup & Abgleich: Export aller Daten als JSON-Datei, Import mit Zusammenführen
 * pro Datensatz, automatischer Sicherungsstand (Snapshot) vor jedem Import.
 */
import type { Table } from 'dexie';
import { decodeRecord, encodeRecord, mergeRecords, sumStats, type MergeStats } from '../domain/merge';
import { db, SYNC_TABLES, type SyncTableName } from './db';
import { newId } from './repo';
import type { Base } from './types';

export const BACKUP_APP = 'conganizer';
export const BACKUP_VERSION = 1;
/** Gerätespezifisch – wird weder exportiert noch importiert. */
const LOCAL_ONLY_SETTINGS = new Set(['lastBackupAt']);
const MAX_SNAPSHOTS = 3;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  tables: Partial<Record<SyncTableName, Record<string, unknown>[]>>;
}

const table = (name: SyncTableName) => db[name] as unknown as Table<Base, string>;

/** Alle synchronisierbaren Daten inkl. Tombstones als JSON-String. */
export async function exportBackupJson(): Promise<string> {
  const tables: BackupFile['tables'] = {};
  for (const name of SYNC_TABLES) {
    let rows = await table(name).toArray();
    if (name === 'settings') rows = rows.filter((r) => !LOCAL_ONLY_SETTINGS.has(r.id));
    tables[name] = await Promise.all(rows.map((r) => encodeRecord(r)));
  }
  const file: BackupFile = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: Date.now(), tables };
  return JSON.stringify(file);
}

export function parseBackup(json: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  const f = data as BackupFile;
  if (!f || f.app !== BACKUP_APP || typeof f.tables !== 'object') throw new Error('Das ist keine ConGanizer-Sicherung.');
  if (f.version > BACKUP_VERSION) throw new Error('Die Sicherung stammt aus einer neueren App-Version – bitte erst die App aktualisieren.');
  return f;
}

export interface ImportResult {
  stats: MergeStats;
  perTable: Partial<Record<SyncTableName, MergeStats>>;
  exportedAt: number;
}

/** Legt einen Sicherungsstand an und behält nur die letzten paar. */
export async function createSnapshot(): Promise<void> {
  const data = await exportBackupJson();
  await db.snapshots.add({ id: newId(), createdAt: Date.now(), data });
  const all = await db.snapshots.orderBy('createdAt').toArray();
  const excess = all.slice(0, Math.max(0, all.length - MAX_SNAPSHOTS));
  if (excess.length) await db.snapshots.bulkDelete(excess.map((s) => s.id));
}

/** Führt eine Sicherung mit den lokalen Daten zusammen (vorher Snapshot). */
export async function importBackup(json: string): Promise<ImportResult> {
  const file = parseBackup(json);
  await createSnapshot();
  const perTable: ImportResult['perTable'] = {};
  const tables = SYNC_TABLES.map(table);
  await db.transaction('rw', tables, async () => {
    for (const name of SYNC_TABLES) {
      let incoming = (file.tables[name] ?? []).map((r) => decodeRecord<Base>(r));
      if (name === 'settings') incoming = incoming.filter((r) => !LOCAL_ONLY_SETTINGS.has(r.id));
      const local = await table(name).bulkGet(incoming.map((r) => r.id));
      const { toPut, stats } = mergeRecords(
        local.filter((r): r is Base => !!r),
        incoming,
      );
      if (toPut.length) await table(name).bulkPut(toPut);
      perTable[name] = stats;
    }
  });
  return { stats: sumStats(Object.values(perTable) as MergeStats[]), perTable, exportedAt: file.exportedAt };
}

/** Stellt einen Sicherungsstand exakt wieder her (ersetzt alle Daten). */
export async function restoreSnapshot(id: string): Promise<void> {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error('Sicherungsstand nicht gefunden');
  const file = parseBackup(snap.data);
  const tables = SYNC_TABLES.map(table);
  await db.transaction('rw', tables, async () => {
    for (const name of SYNC_TABLES) {
      const t = table(name);
      const keep = name === 'settings' ? (await t.toArray()).filter((r) => LOCAL_ONLY_SETTINGS.has(r.id)) : [];
      await t.clear();
      const rows = (file.tables[name] ?? []).map((r) => decodeRecord<Base>(r));
      await t.bulkPut([...rows, ...keep]);
    }
  });
}
